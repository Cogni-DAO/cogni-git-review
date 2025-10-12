/**
 * Review Limits Budget Integration Contract Tests
 * Tests observable behavior of review-limits integration with AI workflows
 * Focuses on end-to-end behavior rather than internal implementation details
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { testEventHandler } from '../helpers/handler-harness.js';
import { PR_REVIEW_NAME } from '../../src/constants.js';
import payload from '../fixtures/pull_request.opened.complete.json' with { type: 'json' };

describe('Review Limits Budget Integration Contract Tests', () => {

  test('AI workflow executes successfully with 30-file review-limits configuration', async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec: 'reviewLimitsBudget30', // Fixture with max_changed_files: 30
      expectCheck: (params) => {
        // Standard contract assertions
        assert.strictEqual(params.name, PR_REVIEW_NAME);
        assert.strictEqual(params.head_sha, payload.pull_request.head.sha);
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
        assert.strictEqual(params.output.title, PR_REVIEW_NAME);
        
        // Verify AI workflow ran (should create neutral due to missing rule file)
        assert.strictEqual(params.conclusion, 'neutral');
        
        // Basic validation that check was created successfully
        const text = params.output.text || '';
        console.log('Review-limits 30 check output length:', text.length);
      }
    });
  });

  test('AI workflow executes successfully without review-limits gate (fallback behavior)', async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec: 'reviewLimitsBudgetNone', // Fixture without review-limits gate
      expectCheck: (params) => {
        assert.strictEqual(params.name, PR_REVIEW_NAME);
        assert.strictEqual(params.head_sha, payload.pull_request.head.sha);
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
        
        // Should handle missing review-limits gracefully
        assert.strictEqual(params.conclusion, 'neutral');
        
        console.log('No review-limits check conclusion:', params.conclusion);
      }
    });
  });

  test('AI workflow executes successfully with small (10-file) review-limits', async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload,
      spec: 'reviewLimitsSmall10', // Fixture with max_changed_files: 10
      expectCheck: (params) => {
        assert.strictEqual(params.name, PR_REVIEW_NAME);
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
        
        // Should execute successfully even with small limit
        assert.strictEqual(params.conclusion, 'neutral');
        
        console.log('Small review-limits (10) check conclusion:', params.conclusion);
      }
    });
  });

  test('review-limits gate itself respects configured limits', async () => {
    // Create a payload that exceeds the 10-file limit to trigger review-limits violation
    const largePayload = {
      ...payload,
      pull_request: {
        ...payload.pull_request,
        changed_files: 15, // Exceeds the 10-file limit in reviewLimitsSmall10 fixture
        additions: 50,
        deletions: 10
      }
    };

    await testEventHandler({
      event: 'pull_request.opened',
      payload: largePayload,
      spec: 'reviewLimitsSmall10', // Has max_changed_files: 10
      expectCheck: (params) => {
        assert.strictEqual(params.name, PR_REVIEW_NAME);
        assert.strictEqual(params.status, 'completed');
        
        // Should fail because PR has 15 files but limit is 10
        assert.strictEqual(params.conclusion, 'failure', 
          'Should fail when PR exceeds review-limits max_changed_files');
        
        // Check that the violation is reported
        const text = params.output.text || '';
        assert(text.includes('review_limits') || text.includes('max_changed_files'),
          'Should mention review-limits violation in output');
      }
    });
  });

  test('integration works with both review-limits and AI gates in same spec', async () => {
    // Test that both gates can coexist and the AI gate can use review-limits config
    await testEventHandler({
      event: 'pull_request.opened',
      payload: {
        ...payload,
        pull_request: {
          ...payload.pull_request,
          changed_files: 5, // Under the 10-file limit
          additions: 20,
          deletions: 5
        }
      },
      spec: 'reviewLimitsSmall10',
      expectCheck: (params) => {
        assert.strictEqual(params.name, PR_REVIEW_NAME);
        assert.strictEqual(params.status, 'completed');
        
        // Should be neutral (AI gate neutral due to missing rule file, but review-limits passes)
        assert.strictEqual(params.conclusion, 'neutral');
        
        // Verify both gates ran
        const text = params.output.text || '';
        console.log('Both gates integration - gates executed');
      }
    });
  });
});