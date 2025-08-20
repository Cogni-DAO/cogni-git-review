/**
 * Unit Test for AI Provider - Single Statement Contract
 * Tests the provider router functionality in isolation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { review } from '../../src/ai/provider.js';

describe('AI Provider Unit Tests', () => {

  test.skip('provider forwards input to goal-alignment workflow (SKIP: mocking issues)', async () => {
    const input = {
      statement: "Test statement evaluation",
      pr_title: "Add new feature",
      pr_body: "This PR adds a new feature to the codebase",
      diff_summary: "3 files changed (+45 -12 lines)"
    };

    const result = await review(input);

    // Validate contract structure
    assert.strictEqual(typeof result.score, 'number', 'Should return numeric score');
    assert(result.score >= 0 && result.score <= 1, 'Score should be between 0 and 1');
    assert(Array.isArray(result.annotations), 'Should return annotations array');
    assert(typeof result.summary === 'string', 'Should return summary string');
    
    // Validate provenance wrapper added by provider
    assert(result.provenance, 'Should include provenance');
    assert(typeof result.provenance.runId === 'string', 'Should have runId');
    assert(result.provenance.runId.startsWith('ai-'), 'RunId should start with ai-');
    assert(typeof result.provenance.durationMs === 'number', 'Should track duration');
    assert.strictEqual(result.provenance.providerVersion, '1.0.0', 'Should have version');
  });

  test.skip('provider returns hardcoded workflow response (SKIP: mocking issues)', async () => {
    const input = {
      statement: "Does NOT re-implement mature OSS tools",
      pr_title: "Refactor logging system", 
      pr_body: "Replace custom logger with winston",
      diff_summary: "2 files changed (+30 -15 lines)"
    };

    const result = await review(input);

    // Should get hardcoded response from goal-alignment workflow
    assert.strictEqual(result.score, 0.85, 'Should return hardcoded score');
    assert.deepStrictEqual(result.annotations, [], 'Should return empty annotations');
    assert(result.summary.includes('Refactor logging system'), 'Summary should include PR title');
    assert(result.summary.includes('Does NOT re-implement mature OSS tools'), 'Summary should include statement');
  });

  test('provider handles errors from workflow', async () => {
    // Test error handling - provider should catch and format errors
    const result = await review(null);

    assert.strictEqual(result.score, null, 'Should return null score on error');
    assert(Array.isArray(result.annotations), 'Should return annotations array');
    assert(result.annotations.length > 0, 'Should have error annotations');
    assert.strictEqual(result.annotations[0].code, 'ai_provider_error', 'Should have error code');
    assert(result.provenance.runId, 'Should still have provenance on error');
  });
});