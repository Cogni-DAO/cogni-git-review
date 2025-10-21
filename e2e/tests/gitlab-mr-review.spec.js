/**
 * GitLab E2E Test: MR Creation → Cogni Processing → Commit Status
 * 
 * Hybrid approach:
 * 1. Use glab CLI for GitLab operations (like gh CLI for GitHub)  
 * 2. Use GitLab API for status polling (like sister repo pattern)
 * 3. Playwright test framework for structure, assertions, and artifacts
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { testConfig } from '../helpers/test-config.js';

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

test.describe('GitLab E2E: MR Review Process', () => {
  
  test.beforeAll(async () => {
    // Validate GitLab-specific environment variables
    testConfig.validate();

    // Check glab CLI is available
    sh('glab --version');
    console.log('✅ glab CLI available');

    console.log(`✅ GitLab E2E Setup Complete`);
    console.log(`- Test Repo: ${testConfig.E2E_GITLAB_REPO}`);
    console.log(`- App URL: ${testConfig.E2E_GITLAB_DEPLOYMENT_URL}`);
    console.log(`- Expected Check: ${testConfig.EXPECTED_CHECK_NAME}`);
  });

  test('should complete GitLab MR → Cogni status workflow', async () => {
    const timestamp = Date.now();
    const branch = `gitlab-e2e-test-${timestamp}`;
    const tempDir = mkdtempSync(join(tmpdir(), 'cogni-gitlab-e2e-'));
    let mrNumber = null;
    let commitSha = null;

    try {
      // === PHASE 1: Create Test MR ===
      console.log('📝 Creating GitLab test MR...');

      const envWithToken = { 
        ...process.env, 
        GITLAB_TOKEN: testConfig.E2E_GITLAB_PAT 
      };

      // Clone GitLab repo and create test change (direct git clone with OAuth2 token)
      sh(`git clone "https://oauth2:${testConfig.E2E_GITLAB_PAT}@gitlab.com/${testConfig.E2E_GITLAB_REPO}.git" "${tempDir}"`);
      sh(`git -C ${tempDir} switch -c ${branch}`);

      const testContent = `GitLab E2E test change ${new Date().toISOString()}`;
      sh(`echo '${testContent}' > ${tempDir}/.gitlab-e2e-test.txt`);
      sh(`git -C ${tempDir} add .gitlab-e2e-test.txt`);
      sh(`git -C ${tempDir} -c user.name='cogni-gitlab-e2e-bot' -c user.email='e2e@cogni.gitlab.test' commit -m 'e2e(gitlab): test MR for cogni review'`);
      sh(`git -C ${tempDir} push "https://oauth2:${testConfig.E2E_GITLAB_PAT}@gitlab.com/${testConfig.E2E_GITLAB_REPO}.git" ${branch}`);

      // Get commit SHA before creating MR
      commitSha = sh(`git -C ${tempDir} rev-parse HEAD`);

      // Create MR using glab (run from temp directory to use the correct git context)
      const mrUrl = sh(`glab mr create --title "GitLab E2E Test MR ${timestamp}" --description "Auto-created for GitLab E2E testing - will be processed by cogni-git-review" --source-branch ${branch} --target-branch main`, { 
        env: envWithToken,
        cwd: tempDir 
      });
      
      // Extract MR number from URL (GitLab format: .../merge_requests/123)
      mrNumber = mrUrl.split('/').pop();

      console.log(`✅ Created GitLab MR !${mrNumber}: ${mrUrl}`);
      console.log(`📋 Commit SHA: ${commitSha}`);

      // === PHASE 2: Wait for Cogni Processing ===
      console.log('⏳ Waiting for Cogni GitLab webhook processing...');

      let commitStatusFound = false;
      let statusConclusion = null;
      const startTime = Date.now();

      while (!commitStatusFound && (Date.now() - startTime) < testConfig.E2E_GITLAB_WEBHOOK_TIMEOUT_MS) {
        
        // Poll GitLab commit status API (equivalent to GitHub check-runs)
        const statusJson = sh(`glab api projects/${encodeURIComponent(testConfig.E2E_GITLAB_REPO)}/repository/commits/${commitSha}/statuses`, { env: envWithToken });
        const statuses = JSON.parse(statusJson);

        // Look for Cogni status (matching the check name from constants)
        const cogniStatus = statuses.find(status => 
          status.name === testConfig.EXPECTED_CHECK_NAME
        );

        if (cogniStatus) {
          console.log(`GitLab commit status found: ${cogniStatus.status} - ${cogniStatus.description}`);
          
          if (cogniStatus.status !== 'pending' && cogniStatus.status !== 'running') {
            commitStatusFound = true;
            statusConclusion = cogniStatus.status; // success, failed, canceled
            console.log(`🎯 Final status: ${statusConclusion}`);
            break;
          }
        } else {
          console.log(`Waiting for Cogni status "${testConfig.EXPECTED_CHECK_NAME}" on commit ${commitSha}...`);
        }

        await sleep(testConfig.E2E_GITLAB_POLL_INTERVAL_MS);
      }

      // === PHASE 3: Validation ===
      if (!commitStatusFound) {
        // Debug information
        try {
          const healthCheck = sh(`curl -s ${testConfig.E2E_GITLAB_DEPLOYMENT_URL}/api/v1/health`);
          console.log('App health check:', healthCheck);
        } catch (e) {
          console.log('Could not fetch app health check:', e.message);
        }

        throw new Error(`TIMEOUT: GitLab commit status not found within ${testConfig.E2E_GITLAB_WEBHOOK_TIMEOUT_MS / 1000}s`);
      }

      // Verify status was created (success or failure both indicate processing worked)
      expect(statusConclusion).toBeDefined();
      expect(['success', 'failed', 'canceled']).toContain(statusConclusion);

      console.log(`🎉 SUCCESS: GitLab E2E completed with status: ${statusConclusion}`);

    } finally {
      // === CLEANUP ===
      if (mrNumber && testConfig.E2E_GITLAB_PAT) {
        try {
          console.log('🧹 Cleaning up GitLab test resources...');
          const envWithToken = { 
            ...process.env, 
            GITLAB_TOKEN: testConfig.E2E_GITLAB_PAT 
          };

          // Close the MR (don't merge in e2e tests)
          sh(`glab mr close ${mrNumber} --repo ${testConfig.E2E_GITLAB_REPO}`, { env: envWithToken });
          
          // Delete the test branch (direct git push with OAuth2 token)
          sh(`git push "https://oauth2:${testConfig.E2E_GITLAB_PAT}@gitlab.com/${testConfig.E2E_GITLAB_REPO}.git" --delete ${branch}`, {
            cwd: tempDir
          });
          
          console.log(`✅ Cleaned up MR !${mrNumber} and branch ${branch}`);
        } catch (cleanupErr) {
          console.warn('⚠️  GitLab resource cleanup failed:', cleanupErr);
        }
      }

      // Always cleanup temp directory
      try {
        execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
        console.log('✅ Cleaned up temp directory');
      } catch (cleanupErr) {
        console.warn('⚠️  Temp directory cleanup failed:', cleanupErr);
      }
    }
  }, 300_000); // 5 minute timeout


});