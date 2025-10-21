/**
 * GitHub E2E Test: PR Creation → Cogni Processing → Check Status
 * 
 * Ported from legacy lib/e2e-runner.js to Playwright framework.
 * Uses gh CLI for GitHub operations and GitHub API for check status polling.
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PR_REVIEW_NAME } from '../../src/constants.js';

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'], 
    encoding: 'utf8',
    ...opts
  }).trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// GitHub E2E Configuration
const githubTestConfig = {
  // GitHub E2E Configuration (from environment)
  GITHUB_TOKEN: process.env.E2E_GITHUB_PAT,
  TEST_REPO: process.env.E2E_GITHUB_REPO || 'Cogni-DAO/test-repo',
  
  // Expected check name from constants
  EXPECTED_CHECK_NAME: PR_REVIEW_NAME,
  
  // Timeouts with defaults
  GITHUB_WEBHOOK_TIMEOUT_MS: parseInt(process.env.TIMEOUT_SEC || '480', 10) * 1000,
  GITHUB_POLL_INTERVAL_MS: parseInt(process.env.SLEEP_MS || '5000', 10),
  
  // Validate environment on use
  validate() {
    if (!this.GITHUB_TOKEN) {
      throw new Error('Missing required GitHub E2E environment variable: E2E_GITHUB_PAT');
    }
  }
};

test.describe('GitHub E2E: PR Review Process', () => {
  
  test.beforeAll(async () => {
    // Validate GitHub-specific environment variables
    githubTestConfig.validate();

    // Check gh CLI is available
    sh('gh --version');
    console.log('✅ gh CLI available');

    console.log(`✅ GitHub E2E Setup Complete`);
    console.log(`- Test Repo: ${githubTestConfig.TEST_REPO}`);
    console.log(`- Expected Check: ${githubTestConfig.EXPECTED_CHECK_NAME}`);
  });

  test('should complete GitHub PR → Cogni check workflow', async () => {
    const timestamp = Date.now();
    const branch = `cogni-e2e-${timestamp}`;
    const tempDir = mkdtempSync(join(tmpdir(), 'cogni-github-e2e-'));
    let prNumber = null;
    let commitSha = null;

    try {
      // === PHASE 1: Create Test PR ===
      console.log('📝 Creating GitHub test PR...');

      const envWithToken = { 
        ...process.env, 
        GH_TOKEN: githubTestConfig.GITHUB_TOKEN 
      };

      // Clone GitHub repo and create test change
      sh(`gh repo clone ${githubTestConfig.TEST_REPO} ${tempDir}`, { env: envWithToken });
      sh(`git -C ${tempDir} switch -c ${branch}`);

      const testContent = `GitHub E2E test change ${new Date().toISOString()}`;
      sh(`echo '${testContent}' > ${tempDir}/.cogni-e2e.txt`);
      sh(`git -C ${tempDir} add .cogni-e2e.txt`);
      sh(`git -C ${tempDir} -c user.name='cogni-bot' -c user.email='actions@users.noreply.github.com' commit -m 'chore(e2e): trigger cogni PR review check'`);
      sh(`git -C ${tempDir} push origin ${branch}`);

      // Get commit SHA before creating PR
      commitSha = sh(`git -C ${tempDir} rev-parse HEAD`);

      // Create PR using gh
      const prUrl = sh(`gh pr create -R ${githubTestConfig.TEST_REPO} --title "GitHub E2E Test PR ${timestamp}" --body "Auto-created for GitHub E2E testing - will be processed by cogni-git-review" --base main --head ${branch}`, { env: envWithToken });
      
      // Extract PR number from URL
      prNumber = prUrl.split('/').pop();

      console.log(`✅ Created GitHub PR #${prNumber}: ${prUrl}`);
      console.log(`📋 Commit SHA: ${commitSha}`);

      // === PHASE 2: Wait for Cogni Processing ===
      console.log('⏳ Waiting for Cogni GitHub webhook processing...');

      let checkFound = false;
      let checkConclusion = null;
      const startTime = Date.now();

      while (!checkFound && (Date.now() - startTime) < githubTestConfig.GITHUB_WEBHOOK_TIMEOUT_MS) {
        
        // Poll GitHub check-runs API
        const checkRunsJson = sh(`gh api repos/${githubTestConfig.TEST_REPO}/commits/${commitSha}/check-runs -H 'Accept: application/vnd.github+json'`, { env: envWithToken });
        const checkRuns = JSON.parse(checkRunsJson);

        // Look for Cogni check (matching the check name from constants)
        const cogniCheck = (checkRuns.check_runs || []).find(check => 
          check.name === githubTestConfig.EXPECTED_CHECK_NAME
        );

        if (cogniCheck) {
          console.log(`GitHub check found: ${cogniCheck.status} - ${cogniCheck.conclusion}`);
          
          if (cogniCheck.status === 'completed') {
            checkFound = true;
            checkConclusion = cogniCheck.conclusion;
            console.log(`🎯 Final conclusion: ${checkConclusion}`);
            break;
          }
        } else {
          console.log(`Waiting for Cogni check "${githubTestConfig.EXPECTED_CHECK_NAME}" on commit ${commitSha}...`);
        }

        await sleep(githubTestConfig.GITHUB_POLL_INTERVAL_MS);
      }

      // === PHASE 3: Validation ===
      if (!checkFound) {
        throw new Error(`TIMEOUT: GitHub check not found within ${githubTestConfig.GITHUB_WEBHOOK_TIMEOUT_MS / 1000}s`);
      }

      // Verify check was created (success or failure both indicate processing worked)
      expect(checkConclusion).toBeDefined();
      expect(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required']).toContain(checkConclusion);

      console.log(`🎉 SUCCESS: GitHub E2E completed with conclusion: ${checkConclusion}`);

    } finally {
      // === CLEANUP ===
      if (prNumber && githubTestConfig.GITHUB_TOKEN) {
        try {
          console.log('🧹 Cleaning up GitHub test resources...');
          const envWithToken = { 
            ...process.env, 
            GH_TOKEN: githubTestConfig.GITHUB_TOKEN 
          };

          // Close the PR and delete branch (gh pr close handles both)
          sh(`gh pr close ${prNumber} -R ${githubTestConfig.TEST_REPO} --delete-branch`, { env: envWithToken });
          
          console.log(`✅ Cleaned up PR #${prNumber} and branch ${branch}`);
        } catch (cleanupErr) {
          console.warn('⚠️  GitHub resource cleanup failed:', cleanupErr.message);
        }
      }

      // Always cleanup temp directory
      try {
        execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
        console.log('✅ Cleaned up temp directory');
      } catch (cleanupErr) {
        console.warn('⚠️  Temp directory cleanup failed:', cleanupErr.message);
      }
    }
  }, 300_000); // 5 minute timeout

});