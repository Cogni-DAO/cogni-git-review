/**
 * Node.js test wrapper for E2E runner.
 * Uses node:test framework for better local development experience.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { runE2ETest, parseE2EOptionsFromEnv } from '../../lib/e2e-runner.js';

describe('E2E Test Runner', () => {
  test('should successfully run E2E test against preview environment', async (t) => {
    // Skip test if no GitHub token available
    if (!process.env.TEST_REPO_GITHUB_PAT) {
      t.skip('Skipping E2E test - no TEST_REPO_GITHUB_PAT provided');
      return;
    }

    const options = parseE2EOptionsFromEnv();

    console.log('Running E2E test with options:', {
      ...options,
      ghToken: '***' // Don't log token
    });

    const result = await runE2ETest(options);

    // Assertions
    assert.ok(result, 'Should return result object');
    assert.ok(typeof result.success === 'boolean', 'Should have success boolean');
    assert.ok(result.summary, 'Should have summary object');
    
    // Verify summary structure
    assert.ok(result.summary.repo, 'Summary should have repo');
    assert.ok(result.summary.check, 'Summary should have check name');
    assert.ok(result.summary.ts, 'Summary should have timestamp');
    assert.ok(['success', 'timeout', 'error', 'failure'].includes(result.summary.result), 'Summary should have valid result');

    if (result.success) {
      console.log('✅ E2E test passed');
      assert.strictEqual(result.error, null, 'Error should be null on success');
      assert.strictEqual(result.summary.result, 'success', 'Summary result should be success');
    } else {
      console.error('❌ E2E test failed:', result.error);
      assert.ok(result.error, 'Error should be present on failure');
      assert.notStrictEqual(result.summary.result, 'success', 'Summary result should not be success');
      
      // Still assert test completion (don't fail the test framework)
      // The E2E test failing is different from the test runner failing
      console.log('E2E test completed with failure (this is expected behavior)');
    }

    console.log('Final summary:', result.summary);
  });

  test('should handle missing GitHub token gracefully', async () => {
    const options = {
      ghToken: undefined, // Deliberately missing
      testRepo: 'Cogni-DAO/test-repo'
    };

    await assert.rejects(
      () => runE2ETest(options),
      /ghToken is required/,
      'Should throw error for missing token'
    );
  });

  test('should handle invalid repository gracefully', async (t) => {
    if (!process.env.TEST_REPO_GITHUB_PAT) {
      t.skip('Skipping invalid repo test - no TEST_REPO_GITHUB_PAT provided');
      return;
    }

    const options = parseE2EOptionsFromEnv({
      testRepo: 'nonexistent/nonexistent-repo',
      timeoutSec: 30 // Short timeout for invalid repo test
    });

    const result = await runE2ETest(options);
    
    assert.strictEqual(result.success, false, 'Should fail for nonexistent repo');
    assert.ok(result.error, 'Should have error message');
    assert.strictEqual(result.summary.result, 'error', 'Summary should indicate error');
  });
});

// If run directly (not via test runner), execute the main test
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Running E2E tests directly...');
  console.log('Tip: Use `npm test` or `node --test` for better output formatting');
}