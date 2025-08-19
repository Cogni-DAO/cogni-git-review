/**
 * Spec-Aware Webhook Contract Tests
 * Tests webhook behavior with different spec configurations
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { testPullRequestHandler } from '../helpers/handler-harness.js';
import pullRequestOpenedPayload from '../fixtures/pull_request.opened.complete.json' with { type: 'json' };

function payload(overrides = {}) {
  return {
    ...pullRequestOpenedPayload,
    repository: { 
      ...pullRequestOpenedPayload.repository, 
      name: 'test-repo', 
      owner: { login: 'test-org' } 
    },
    pull_request: {
      ...pullRequestOpenedPayload.pull_request,
      head: { ...pullRequestOpenedPayload.pull_request.head, sha: 'abc123def456789012345678901234567890abcd' },
      changed_files: 5,
      additions: 30,
      deletions: 30,
      ...overrides
    }
  };
}

describe('Spec-Aware Webhook Contract Tests', () => {
  it('missing spec → creates failure check with setup instructions', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: null, // Missing spec
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
        assert.strictEqual(params.status, 'completed');
        assert.strictEqual(params.conclusion, 'failure');
        assert(params.output.summary.includes('No .cogni/repo-spec.yaml found'));
      }
    });
  });

  it('invalid spec → creates failure check with validation error', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'invalidStructure', // Spec missing required sections
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
        assert.strictEqual(params.status, 'completed');
        assert.strictEqual(params.conclusion, 'failure');
        assert.strictEqual(typeof params.output.summary, 'string');
      }
    });
  });

  it('minimal spec → creates success check', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'minimal', // Valid minimal spec
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
        assert.strictEqual(params.status, 'completed');
        assert.strictEqual(params.conclusion, 'success');
        assert.match(params.output.text, /\bGates:\s*\d+\s+total\b/);
      }
    });
  });
});