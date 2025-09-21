/**
 * Contract Tests: PR Resolution for Check Reruns
 * Tests deterministic PR resolution logic to prevent wrong PR comments
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { resolvePrRef } from '../../src/rerun-handlers.js';

// Mock context and octokit for testing
function createMockContext(payload = {}) {
  return {
    payload: {
      check_suite: { pull_requests: [] },
      ...payload
    },
    repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
    octokit: {
      repos: {
        listPullRequestsAssociatedWithCommit: async () => ({ data: [] })
      },
      pulls: {
        list: async () => ({ data: [] }),
        get: async () => ({ data: {} }),
        createReview: async () => ({ data: {} })
      },
      issues: {
        createComment: async () => ({ data: {} })
      },
      checks: {
        create: async () => ({ data: {} })
      }
    }
  };
}

test('PR Resolution Contract Tests', async (t) => {
  
  await t.test('resolve_by_exact_head_sha', async () => {
    const context = createMockContext({
      check_suite: { 
        pull_requests: [], 
        head_sha: 'S',
        head_branch: 'feature-x'
      }
    });
    
    // Mock API to return multiple PRs, one with exact SHA match
    context.octokit.repos.listPullRequestsAssociatedWithCommit = async () => ({
      data: [
        { number: 36, head: { sha: 'S', ref: 'feature-x' } },
        { number: 35, head: { sha: 'T', ref: 'feature-y' } }
      ]
    });

    const result = await resolvePrRef(context, { headSha: 'S', headBranch: 'feature-x' });
    
    assert.strictEqual(result.number, 36, 'Should select PR #36 due to exact SHA match');
    assert.strictEqual(result.head.sha, 'S', 'Should match exact SHA');
  });

  await t.test('resolve_by_branch_when_no_sha_match', async () => {
    const context = createMockContext({
      check_suite: { 
        pull_requests: [], 
        head_sha: 'S',
        head_branch: 'feature-x'
      }
    });
    
    context.octokit.repos.listPullRequestsAssociatedWithCommit = async () => ({
      data: [
        { number: 36, head: { sha: 'U', ref: 'feature-x' } }
      ]
    });
    
    context.octokit.pulls.list = async () => ({ data: [] });

    const result = await resolvePrRef(context, { headSha: 'S', headBranch: 'feature-x' });
    
    assert.strictEqual(result.number, 36, 'Should select PR #36 via branch fallback');
    assert.strictEqual(result.head.ref, 'feature-x', 'Should match branch name');
  });

  await t.test('neutral_on_ambiguity_or_not_found', async () => {
    const context = createMockContext({
      check_suite: { 
        pull_requests: [], 
        head_sha: 'S',
        head_branch: null
      }
    });
    
    // Multiple PRs with different SHAs, no branch to match
    context.octokit.repos.listPullRequestsAssociatedWithCommit = async () => ({
      data: [
        { number: 36, head: { sha: 'T', ref: 'feature-x' } },
        { number: 35, head: { sha: 'U', ref: 'feature-y' } }
      ]
    });

    const result = await resolvePrRef(context, { headSha: 'S', headBranch: null });
    
    assert.strictEqual(result, null, 'Should return null when no unique match found');
  });

  await t.test('same_repo_branch_listing_fallback', async () => {
    const context = createMockContext({
      check_suite: { 
        pull_requests: [], 
        head_sha: 'S',
        head_branch: 'feature-x'
      }
    });
    
    // Empty commit association, but branch listing works
    context.octokit.repos.listPullRequestsAssociatedWithCommit = async () => ({ data: [] });
    context.octokit.pulls.list = async ({ head }) => {
      if (head === 'test-org:feature-x') {
        return { data: [{ number: 36, head: { sha: 'S', ref: 'feature-x' } }] };
      }
      return { data: [] };
    };

    const result = await resolvePrRef(context, { headSha: 'S', headBranch: 'feature-x' });
    
    assert.strictEqual(result.number, 36, 'Should find PR #36 via branch listing');
    assert.strictEqual(result.head.sha, 'S', 'Should match exact SHA from branch listing');
  });

  await t.test('payload_provided_pr_takes_precedence', async () => {
    const context = createMockContext({
      check_suite: { 
        pull_requests: [{ number: 42, head: { sha: 'payload123' } }], 
        head_sha: 'S',
        head_branch: 'feature-x'
      }
    });
    
    // Even if other methods would find different PRs, payload should win
    context.octokit.repos.listPullRequestsAssociatedWithCommit = async () => ({
      data: [{ number: 36, head: { sha: 'S' }, state: 'open' }]
    });

    const result = await resolvePrRef(context, { headSha: 'S', headBranch: 'feature-x' });
    
    assert.strictEqual(result.number, 42, 'Should use PR #42 from payload');
    assert.strictEqual(result.head.sha, 'payload123', 'Should use payload SHA');
  });

  await t.test('fork_scenario_exact_sha_match', async () => {
    const context = createMockContext({
      check_suite: { 
        pull_requests: [], 
        head_sha: 'S',
        head_branch: null  // Fork scenario - no branch info
      }
    });
    
    context.octokit.repos.listPullRequestsAssociatedWithCommit = async () => ({
      data: [
        { number: 36, head: { sha: 'S', ref: 'fork-branch' } },
        { number: 35, head: { sha: 'T', ref: 'other-branch' } }
      ]
    });

    const result = await resolvePrRef(context, { headSha: 'S', headBranch: null });
    
    assert.strictEqual(result.number, 36, 'Should select PR #36 by exact SHA match even without head_branch');
  });
});