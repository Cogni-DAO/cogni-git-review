/**
 * GitHub E2E Test: PR Creation → Cogni Processing → Check Status
 * 
 * Ported from legacy lib/e2e-runner.js to Playwright framework.
 * Uses shared GitHub E2E helper for DRY implementation.
 */
import { test, expect } from '@playwright/test';
import { 
  createTestPR, 
  waitForCogniCheck, 
  cleanupTestResources, 
  githubTestConfig 
} from '../helpers/github-e2e-helper.js';

test.describe('GitHub E2E: PR Review Process', () => {
  
  test.beforeAll(async () => {
    // Validate GitHub-specific environment variables
    githubTestConfig.validate();
  });

  test('should complete GitHub PR → Cogni check workflow', async () => {
    const timestamp = Date.now();
    const branch = `cogni-e2e-${timestamp}`;
    let prNumber = null;
    let tempDir = null;

    try {
      // === PHASE 1: Create Test PR ===
      const prResult = await createTestPR({
        branch,
        commitMessage: 'chore(e2e): trigger cogni PR review check',
        prTitle: `GitHub E2E Test PR ${timestamp}`,
        prBody: 'Auto-created for GitHub E2E testing - will be processed by cogni-git-review',
        testFileName: '.cogni-e2e.txt'
      });

      ({ tempDir, prNumber } = prResult);
      const { commitSha } = prResult;

      // === PHASE 2: Wait for Cogni Processing ===
      const cogniCheck = await waitForCogniCheck(commitSha);

      // === PHASE 3: Validation ===
      // Verify check was created (success or failure both indicate processing worked)
      expect(cogniCheck.conclusion).toBeDefined();
      expect(['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required']).toContain(cogniCheck.conclusion);

      console.log(`🎉 SUCCESS: GitHub E2E completed with conclusion: ${cogniCheck.conclusion}`);

    } finally {
      // === CLEANUP ===
      if (prNumber && tempDir) {
        await cleanupTestResources(prNumber, branch, tempDir);
      }
    }
  }, 300_000); // 5 minute timeout

});