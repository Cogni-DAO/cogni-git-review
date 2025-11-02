/**
 * GitHub E2E Test: Failing PR → Cogni Processing → Vote Proposal Link Validation
 * 
 * Creates a PR designed to fail gates, then validates that the "Propose Vote to Merge" 
 * link appears in the detailed check output with correct parameters.
 */
import { test, expect } from '@playwright/test';
import { 
  createTestPR, 
  waitForCogniCheck, 
  cleanupTestResources, 
  githubTestConfig,
  fetchTestRepoSpec 
} from '../helpers/github-e2e-helper.js';

test.describe('GitHub E2E: Failing PR Vote Link Validation', () => {
  
  test.beforeAll(async () => {
    // Validate GitHub-specific environment variables
    githubTestConfig.validate();
  });

  test('should show vote proposal link for failing GitHub PR', async () => {
    const timestamp = Date.now();
    const branch = `cogni-e2e-fail-${timestamp}`;
    let prNumber = null;
    let tempDir = null;

    try {
      // === PHASE 1: Create Failing Test PR ===
      const prResult = await createTestPR({
        branch,
        commitMessage: 'feat: add comprehensive user analytics tracking with cross-device session management',
        prTitle: `E2E Test: Expected Failure for Vote Link Validation ${timestamp}`,
        prBody: `feat: add database migration for user analytics tracking

This PR introduces comprehensive user behavior analytics to better understand user engagement patterns and improve our product recommendations.

## Changes
- Add new user_events table with timestamp, event_type, and metadata columns
- Implement event tracking for page views, clicks, and form submissions  
- Add background job to process and aggregate user behavior data
- Include user session tracking across device types

## Testing
- Added unit tests for event capture and aggregation logic
- Manual testing shows 15% improvement in recommendation accuracy

Note: This is an automated E2E test designed to validate quality gates.
Generated: ${timestamp}`,
        testFileName: '.cogni-fail-test.txt'
      });

      ({ tempDir, prNumber } = prResult);
      const { commitSha } = prResult;

      // === PHASE 2: Wait for Cogni Processing ===
      const cogniCheck = await waitForCogniCheck(commitSha);

      // === PHASE 3: Fetch DAO Config ===
      const daoConfig = await fetchTestRepoSpec();
      console.log(`📋 Test repo DAO config: ${JSON.stringify(daoConfig)}`);

      // === PHASE 4: Enhanced Validation ===
      
      // 1. Verify check FAILED (not just completed)
      expect(cogniCheck.conclusion).toBe('failure');
      console.log(`✅ Verified check conclusion: ${cogniCheck.conclusion}`);
      
      // 2. Validate vote proposal link exists in output
      const checkOutput = cogniCheck.output.text || '';
      expect(checkOutput).toContain('Propose Vote to Merge');
      expect(checkOutput).toContain('target="_blank"');
      console.log('✅ Vote proposal link found in check output');
      
      // 3. Extract and validate vote URL
      const voteUrlMatch = checkOutput.match(/href="([^"]*merge-change[^"]*)"/);
      expect(voteUrlMatch).toBeTruthy();
      expect(voteUrlMatch).toHaveLength(2);
      
      const voteUrl = voteUrlMatch[1];
      console.log(`🎯 Vote proposal URL found: ${voteUrl}`);
      
      // 4. Parse and validate URL parameters
      const urlObject = new URL(voteUrl);
      expect(urlObject.pathname).toBe('/merge-change');
      
      const urlParams = urlObject.searchParams;
      
      // Validate required blockchain parameters (from test-repo's repo-spec)
      expect(urlParams.get('dao')).toBe(daoConfig.dao_contract);
      expect(urlParams.get('plugin')).toBe(daoConfig.plugin_contract);
      expect(urlParams.get('signal')).toBe(daoConfig.signal_contract);
      expect(urlParams.get('chainId')).toBe(daoConfig.chain_id);
      
      // Validate PR-specific parameters
      expect(urlParams.get('pr')).toBe(prNumber);
      expect(urlParams.get('action')).toBe('merge');
      expect(urlParams.get('target')).toBe('change');
      
      // Validate repository URL parameter
      const repoUrl = urlParams.get('repoUrl');
      expect(repoUrl).toContain('github.com');
      expect(repoUrl).toContain('test-repo');
      
      // 5. Validate base URL (now uses https://proposal.cognidao.org)
      expect(urlObject.origin).toBe('https://proposal.cognidao.org');
      
      console.log('✅ All vote proposal URL parameters validated successfully');
      console.log(`🎉 SUCCESS: Failing E2E with vote link validation completed`);

    } finally {
      // === CLEANUP ===
      if (prNumber && tempDir) {
        await cleanupTestResources(prNumber, branch, tempDir);
      }
    }
  });
});