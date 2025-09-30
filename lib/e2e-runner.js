/**
 * Core E2E runner logic for Cogni E2E testing with a real test-repo.
 * Uses PAT, creates a test PR, waits for Cogni check, validates results.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { PR_REVIEW_NAME } from '../src/constants.js';

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts }).trim();
}

function sleep(ms) { 
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); 
}

/**
 * Parse E2E options from environment variables
 * @param {Object} [overrides={}] - Override specific options
 * @returns {E2EOptions} Parsed options with defaults applied
 */
function parseE2EOptionsFromEnv(overrides = {}) {
  const env = (name, fallback) => {
    const v = process.env[name];
    if (!v && fallback === undefined) {
      throw new Error(`Missing required env: ${name}`);
    }
    return v ?? fallback;
  };

  return {
    ghToken: env('TEST_REPO_GITHUB_PAT'),
    testRepo: env('TEST_REPO', 'Cogni-DAO/test-repo'),
    checkName: PR_REVIEW_NAME,
    timeoutSec: parseInt(env('TIMEOUT_SEC', '120'), 10),
    sleepMs: parseInt(env('SLEEP_MS', '10000'), 10),
    ...overrides
  };
}

/**
 * @typedef {Object} E2EOptions
 * @property {string} ghToken - GitHub token for API access (required)
 * @property {string} [testRepo='Cogni-DAO/test-repo'] - Target repository for testing
 * @property {string} [checkName] - Expected Cogni check name (defaults to PR_REVIEW_NAME constant)
 * @property {number} [timeoutSec=480] - Maximum wait time in seconds
 * @property {number} [sleepMs=5000] - Polling interval in milliseconds
 */

/**
 * @typedef {Object} E2ESummary
 * @property {string} repo - Target repository
 * @property {number|string} prNumber - PR number (or 'stub-pr' for errors)
 * @property {string} headSha - Commit SHA (or 'stub-sha' for errors)
 * @property {string} check - Expected check name
 * @property {number} timeoutSec - Timeout configuration used
 * @property {string} ts - ISO timestamp
 * @property {'success'|'timeout'|'error'|'failure'} result - Test result
 */

/**
 * @typedef {Object} E2EResult
 * @property {boolean} success - Whether the E2E test passed
 * @property {E2ESummary} summary - Test execution summary
 * @property {string|null} error - Error message if test failed, null on success
 */

/**
 * Run E2E test against Cogni deployment
 * @param {E2EOptions} options - Configuration options
 * @returns {Promise<E2EResult>} Result object with success, summary, and error details
 */
async function runE2ETest(options = {}) {
  const {
    ghToken,
    testRepo = 'Cogni-DAO/test-repo',
    checkName = PR_REVIEW_NAME,
    timeoutSec = 480,
    sleepMs = 5000
  } = options;

  if (!ghToken) {
    throw new Error('ghToken is required');
  }

  const branch = `cogni-e2e-${Date.now()}`;
  let prNumber = null;
  let headSha = null;
  const envWithToken = { ...process.env, GH_TOKEN: ghToken };
  const tmp = mkdtempSync(join(os.tmpdir(), 'cogni-e2e-'));

  try {
    console.log(`Cloning ${testRepo} to temp directory...`);
    sh(`gh repo clone ${testRepo} ${tmp}`, { env: envWithToken });

    // Create test change
    sh(`git -C ${tmp} switch -c ${branch}`);
    const stamp = new Date().toISOString();
    sh(`bash -lc "echo '${stamp}' > ${tmp}/.cogni-e2e.txt"`);
    sh(`git -C ${tmp} add .cogni-e2e.txt`);
    sh(`git -C ${tmp} -c user.name='cogni-bot' -c user.email='actions@users.noreply.github.com' commit -m 'chore(e2e): trigger cogni PR review check'`);
    sh(`git -C ${tmp} push origin ${branch}`);

    // Open PR
    console.log('Creating test PR...');
    // Documented behavior: gh pr create prints PR URL on success
    const prUrl = sh(`gh pr create -R ${testRepo} --title "E2E test pr ${stamp}" --body "Auto PR createdby e2e-runner" --base main --head ${branch}`, { env: envWithToken });
    prNumber = prUrl.split('/').pop(); // Extract number from URL
    headSha = sh(`git -C ${tmp} rev-parse HEAD`);
    console.log(`Opened PR #${prNumber}: ${prUrl}`);

    // Poll for Cogni check
    console.log(`Waiting for "${checkName}" check (timeout: ${timeoutSec}s)...`);
    const started = Date.now();
    let conclusion = null;
    let cogni_results = null;

    while ((Date.now() - started) / 1000 < timeoutSec) {
      const crJson = sh(`gh api repos/${testRepo}/commits/${headSha}/check-runs -H 'Accept: application/vnd.github+json'`, { env: envWithToken });
      const cr = JSON.parse(crJson);
      cogni_results = (cr.check_runs || []).find(x => x.name === checkName);
      
      if (cogni_results) {
        console.log(`Check status=${cogni_results.status} conclusion=${cogni_results.conclusion}`);
        if (cogni_results.status === 'completed') {
          conclusion = cogni_results.conclusion;
          break;
        }
      } else {
        console.log(`Check "${checkName}" not yet found...`);
      }
      sleep(sleepMs);
    }

    // Create summary
    const summary = {
      repo: testRepo,
      prNumber,
      headSha,
      check: checkName,
      timeoutSec,
      ts: new Date().toISOString(),
      result: conclusion || 'timeout',
      cogniFullOutput: cogni_results?.output || null,
      cogniSummary: cogni_results?.output?.summary || null
    };

    // Write summary file for CI artifact
    mkdirSync('test-artifacts', { recursive: true });
    writeFileSync(join('test-artifacts', 'e2e-summary.json'), JSON.stringify(summary, null, 2));

    if (conclusion !== 'success') {
      console.error(`E2E failed: conclusion=${conclusion || 'timeout'}`);
      
      // Label and comment for debugging
      try {
        sh(`gh pr edit ${prNumber} -R ${testRepo} --add-label e2e-failed`, { env: envWithToken });
        sh(`gh pr comment ${prNumber} -R ${testRepo} --body "E2E test failed (check: \`${checkName}\`, result: \`${conclusion || 'timeout'}\`). Inspect Cogni logs and rerun."`, { env: envWithToken });
      } catch (err) {
        console.warn('Failed to label/comment PR:', err.message);
      }

      return {
        success: false,
        summary,
        error: `E2E test failed with conclusion: ${conclusion || 'timeout'}`
      };
    }

    // SUCCESS
    console.log('✅ E2E succeeded');

    return {
      success: true,
      summary,
      error: null
    };

  } catch (error) {
    console.error('E2E runner error:', error.stderr || error.stack || String(error));

    const summary = {
      repo: testRepo,
      prNumber,
      headSha,
      check: checkName,
      timeoutSec,
      ts: new Date().toISOString(),
      result: 'error',
      cogniFullOutput: null,
      cogniSummary: null
    };

    mkdirSync('test-artifacts', { recursive: true });
    writeFileSync(join('test-artifacts', 'e2e-summary.json'), JSON.stringify(summary, null, 2));

    return {
      success: false,
      summary,
      error: error.message || String(error)
    };
  } finally {
    // Always cleanup test PR/branch
    if (prNumber) {
      console.log('🧹 Cleaning up test PR/branch...');
      try {
        sh(`gh pr close ${prNumber} -R ${testRepo} --delete-branch`, { env: envWithToken });
        console.log(`Closed PR #${prNumber} and deleted branch`);
      } catch (cleanupErr) {
        console.warn('Failed to cleanup PR/branch:', cleanupErr.message);
      }
    }

    // Always cleanup temp directory
    try {
      rmSync(tmp, { recursive: true, force: true });
      console.log('Cleaned up temp directory');
    } catch (cleanupErr) {
      console.warn('Failed to cleanup temp directory:', cleanupErr.message);
    }
  }
}

export { runE2ETest, parseE2EOptionsFromEnv };