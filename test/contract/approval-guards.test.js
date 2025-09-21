/**
 * Contract Tests: Approval Guards and Idempotency
 * Tests approval validation guards and idempotency tags
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { approvePRWithGuards, isAlreadyApprovedByCogni } from '../../src/pr-approval.js';

// Mock context and octokit for testing
function createMockContext(mockData = {}) {
  return {
    repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
    octokit: {
      pulls: {
        get: async ({ pull_number }) => ({ 
          data: mockData.pr || { number: pull_number, head: { sha: 'S' } } 
        }),
        listReviews: async () => ({ 
          data: mockData.reviews || [] 
        }),
        createReview: async (params) => ({ 
          data: { id: 123, event: params.event, body: params.body, ...params } 
        })
      }
    }
  };
}

test('Approval Guards Contract Tests', async (t) => {
  
  await t.test('approval_guard_stale_head', async () => {
    const context = createMockContext({
      pr: { number: 36, head: { sha: 'DIFFERENT_SHA' } }
    });

    const result = await approvePRWithGuards(context, 36, 'S', 'Test approval');
    
    assert.strictEqual(result.skipped, true, 'Should skip approval');
    assert.strictEqual(result.reason, 'sha_mismatch', 'Should indicate SHA mismatch');
  });

  await t.test('idempotency_prevents_duplicate_approvals', async () => {
    const context = createMockContext({
      pr: { number: 36, head: { sha: 'S' } },
      reviews: [
        { 
          id: 999, 
          state: 'APPROVED', 
          body: 'Previous approval\n\n[cogni-approve:S]' 
        }
      ]
    });

    const result = await approvePRWithGuards(context, 36, 'S', 'Test approval');
    
    assert.strictEqual(result.skipped, true, 'Should skip approval');
    assert.strictEqual(result.reason, 'already_approved', 'Should indicate already approved');
    assert.strictEqual(result.existingReview.id, 999, 'Should reference existing review');
  });

  await t.test('successful_approval_with_idempotency_tag', async () => {
    const context = createMockContext({
      pr: { number: 36, head: { sha: 'S' } },
      reviews: []
    });

    const result = await approvePRWithGuards(context, 36, 'S', 'Test approval');
    
    assert.strictEqual(result.approved, true, 'Should approve successfully');
    assert.ok(result.review, 'Should return review data');
    assert.strictEqual(result.review.id, 123, 'Should return review ID');
    // Note: The actual GitHub API call would have the event and body, but our mock simplifies this
  });

  await t.test('check_already_approved_by_cogni', async () => {
    const context = createMockContext({
      reviews: [
        { 
          id: 999, 
          state: 'APPROVED', 
          body: 'Human approval' 
        },
        { 
          id: 1000, 
          state: 'APPROVED', 
          body: 'Cogni approval\n\n[cogni-approve:S]' 
        }
      ]
    });

    const isApproved = await isAlreadyApprovedByCogni(context, 36, 'S');
    assert.strictEqual(isApproved, true, 'Should detect existing Cogni approval');
    
    const isNotApproved = await isAlreadyApprovedByCogni(context, 36, 'DIFFERENT_SHA');
    assert.strictEqual(isNotApproved, false, 'Should not find approval for different SHA');
  });

  await t.test('ignores_non_approved_reviews_with_tag', async () => {
    const context = createMockContext({
      reviews: [
        { 
          id: 999, 
          state: 'CHANGES_REQUESTED', 
          body: 'Changes needed\n\n[cogni-approve:S]' 
        }
      ]
    });

    const isApproved = await isAlreadyApprovedByCogni(context, 36, 'S');
    assert.strictEqual(isApproved, false, 'Should ignore non-approved reviews even with tag');
  });
});