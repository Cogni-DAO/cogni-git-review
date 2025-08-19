/**
 * Spec-Gate Consistency Contract Tests
 * Tests the core "presence = enabled" semantics of list-of-gates architecture
 * Validates that gate count matches spec configuration exactly
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { testPullRequestHandler } from '../helpers/integration-harness.js';
import pullRequestOpenedPayload from '../fixtures/pull_request.opened.complete.json' assert { type: 'json' };

function payload() {
  return {
    ...pullRequestOpenedPayload,
    repository: { 
      ...pullRequestOpenedPayload.repository, 
      name: 'test-repo', 
      owner: { login: 'test-org' } 
    },
    pull_request: { 
      ...pullRequestOpenedPayload.pull_request, 
      head: { 
        ...pullRequestOpenedPayload.pull_request.head, 
        sha: 'abc123def456789012345678901234567890abcd' 
      }, 
      changed_files: 5, 
      additions: 30, 
      deletions: 30 
    }
  };
}

describe('Spec-Gate Consistency Contract Tests', () => {
  it('1 gate configured → exactly 1 gate executes', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'gateConsistency1Gate',
      expectCheck: (params) => {
        assert.match(params.output.text, /Gates: 1 total/);
      }
    });
  });

  it('2 gates configured → exactly 2 gates execute', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'gateConsistency2Gates',
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.status, 'completed');
        assert.match(params.output.text, /\bGates:\s*2\s+total\b/);
      }
    });
  });

  it('3 gates configured → exactly 3 gates execute', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'gateConsistency3Gates',
      expectCheck: (params) => {
        assert.match(params.output.text, /Gates: 3 total/);
      }
    });
  });

  it('2 gates without review_limits → exactly 2 gates execute', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'gateConsistency2GatesNoLimits',
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.status, 'completed');
        assert.match(params.output.text, /\bGates:\s*2\s+total\b/);
      }
    });
  });
});