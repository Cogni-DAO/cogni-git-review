/**
 * GitHub E2E Test Helper - Shared utilities for GitHub E2E tests
 * 
 * Following project patterns:
 * - Centralized config validation with fail-fast behavior (like GitLab)
 * - Function-based utilities (not class-based)
 * - Provider-specific configuration management
 */

import { execSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PR_REVIEW_NAME } from '../../src/constants.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// GitHub E2E Configuration with validation (following GitLab pattern)
export const githubTestConfig = {
  // GitHub E2E Configuration (from environment)
  GITHUB_TOKEN: process.env.E2E_GITHUB_PAT,
  E2E_GITHUB_REPO: process.env.E2E_GITHUB_REPO || 'Cogni-DAO/test-repo',
  
  // Expected check name from constants
  EXPECTED_CHECK_NAME: PR_REVIEW_NAME,
  
  // Timeouts with defaults
  GITHUB_WEBHOOK_TIMEOUT_MS: parseInt(process.env.TIMEOUT_SEC || '480', 10) * 1000,
  GITHUB_POLL_INTERVAL_MS: parseInt(process.env.SLEEP_MS || '5000', 10),
  
  // Fail-fast validation following GitLab pattern
  validate() {
    if (!this.GITHUB_TOKEN) {
      throw new Error('Missing required GitHub E2E environment variable: E2E_GITHUB_PAT');
    }
    
    // Check gh CLI is available (explicit check like original)
    try {
      execSync('gh --version', { stdio: 'ignore' });
      console.log('✅ gh CLI available');
    } catch {
      throw new Error('gh CLI not available - install GitHub CLI: https://cli.github.com/');
    }
    
    console.log('✅ GitHub E2E Setup Complete');
    console.log(`- Test Repo: ${this.E2E_GITHUB_REPO}`);
    console.log(`- Expected Check: ${this.EXPECTED_CHECK_NAME}`);
  }
};

/**
 * Create a test PR with specified configuration
 * @param {Object} options - PR creation options
 * @param {string} options.branch - Branch name to create
 * @param {string} options.commitMessage - Git commit message
 * @param {string} options.prTitle - PR title
 * @param {string} options.prBody - PR body/description
 * @param {string} [options.testFileName='.cogni-e2e.txt'] - Test file to create
 * @returns {Promise<{tempDir: string, commitSha: string, prNumber: string, prUrl: string}>}
 */
export async function createTestPR(options) {
  const { branch, commitMessage, prTitle, prBody, testFileName = '.cogni-e2e.txt' } = options;
  
  console.log('📝 Creating GitHub test PR...');
  
  const tempDir = mkdtempSync(join(tmpdir(), 'cogni-github-e2e-'));
  const envWithToken = { 
    ...process.env, 
    GH_TOKEN: githubTestConfig.GITHUB_TOKEN 
  };

  try {
    // Clone GitHub repo and create test change
    execSync(`gh repo clone ${githubTestConfig.E2E_GITHUB_REPO} ${tempDir}`, { 
      stdio: 'ignore', 
      env: envWithToken 
    });
    execSync(`git -C ${tempDir} switch -c ${branch}`, { stdio: 'ignore' });

    const testContent = `GitHub E2E test change ${new Date().toISOString()}`;
    execSync(`echo '${testContent}' > ${tempDir}/${testFileName}`, { stdio: 'ignore' });
    execSync(`git -C ${tempDir} add ${testFileName}`, { stdio: 'ignore' });
    execSync(`git -C ${tempDir} -c user.name='cogni-bot' -c user.email='actions@users.noreply.github.com' commit -m '${commitMessage}'`, { stdio: 'ignore' });
    execSync(`git -C ${tempDir} push origin ${branch}`, { stdio: 'ignore' });

    // Get commit SHA before creating PR
    const commitSha = execSync(`git -C ${tempDir} rev-parse HEAD`, { 
      encoding: 'utf8', 
      stdio: ['ignore', 'pipe', 'ignore'] 
    }).trim();

    // Create PR using gh
    const prUrl = execSync(`gh pr create -R ${githubTestConfig.E2E_GITHUB_REPO} --title "${prTitle}" --body "${prBody}" --base main --head ${branch}`, { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: envWithToken 
    }).trim();
    
    // Extract PR number from URL
    const prNumber = prUrl.split('/').pop();

    console.log(`✅ Created GitHub PR #${prNumber}: ${prUrl}`);
    console.log(`📋 Commit SHA: ${commitSha}`);

    return { tempDir, commitSha, prNumber, prUrl };
    
  } catch (error) {
    // Cleanup temp directory on error
    try {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
    } catch (cleanupErr) {
      console.warn('⚠️  Temp directory cleanup failed:', cleanupErr.message);
    }
    throw error;
  }
}

/**
 * Wait for Cogni check to complete and return check details
 * @param {string} commitSha - Git commit SHA to poll for
 * @returns {Promise<Object>} GitHub check run object
 */
export async function waitForCogniCheck(commitSha) {
  console.log('⏳ Waiting for Cogni GitHub webhook processing...');
  
  let checkFound = false;
  let cogniCheck = null;
  const startTime = Date.now();
  
  const envWithToken = { 
    ...process.env, 
    GH_TOKEN: githubTestConfig.GITHUB_TOKEN 
  };

  while (!checkFound && (Date.now() - startTime) < githubTestConfig.GITHUB_WEBHOOK_TIMEOUT_MS) {
    
    // Poll GitHub check-runs API
    const checkRunsJson = execSync(`gh api repos/${githubTestConfig.E2E_GITHUB_REPO}/commits/${commitSha}/check-runs -H 'Accept: application/vnd.github+json'`, { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: envWithToken 
    });
    const checkRuns = JSON.parse(checkRunsJson);

    // Look for Cogni check (matching the check name from constants)
    cogniCheck = (checkRuns.check_runs || []).find(check => 
      check.name === githubTestConfig.EXPECTED_CHECK_NAME
    );

    if (cogniCheck) {
      console.log(`GitHub check found: ${cogniCheck.status} - ${cogniCheck.conclusion}`);
      
      if (cogniCheck.status === 'completed') {
        checkFound = true;
        console.log(`🎯 Final conclusion: ${cogniCheck.conclusion}`);
        break;
      }
    } else {
      console.log(`Waiting for Cogni check "${githubTestConfig.EXPECTED_CHECK_NAME}" on commit ${commitSha}...`);
    }

    await sleep(githubTestConfig.GITHUB_POLL_INTERVAL_MS);
  }

  if (!checkFound) {
    throw new Error(`TIMEOUT: GitHub check not found within ${githubTestConfig.GITHUB_WEBHOOK_TIMEOUT_MS / 1000}s`);
  }

  return cogniCheck;
}

/**
 * Cleanup test resources: close PR, delete branch, remove temp directory
 * @param {string} prNumber - PR number to close
 * @param {string} branch - Branch name to delete
 * @param {string} tempDir - Temporary directory to remove
 */
export async function cleanupTestResources(prNumber, branch, tempDir) {
  if (prNumber && githubTestConfig.GITHUB_TOKEN) {
    try {
      console.log('🧹 Cleaning up GitHub test resources...');
      const envWithToken = { 
        ...process.env, 
        GH_TOKEN: githubTestConfig.GITHUB_TOKEN 
      };

      // Close the PR and delete branch (gh pr close handles both)
      execSync(`gh pr close ${prNumber} -R ${githubTestConfig.E2E_GITHUB_REPO} --delete-branch`, { 
        stdio: 'ignore',
        env: envWithToken 
      });
      
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