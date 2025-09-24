/**
 * Rules Gate Contract Tests
 * 
 * Tests rules gate functionality using service/contract test pattern
 * Following integration test pattern from test/integration/AGENTS.md
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { testPullRequestHandler } from '../helpers/handler-harness.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';
import yaml from 'js-yaml';
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

describe('Rules Gate Contract Tests', () => {
  test('rules gate enabled → creates check', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'rulesSingleFile',
      expectCheck: (params) => {
        // Minimal contract assertions
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
        assert.strictEqual(typeof params.output, 'object');
        // Optional: assert gate summary line exists
        // New format validation - accept any number of gates
        const match = (params.output.text || '').match(/✅\s*(\d+)\s+passed\s*\|\s*❌\s*(\d+)\s+failed\s*\|\s*⚠️\s*(\d+)\s+neutral/);
        assert(match, `Expected gate counts format in: ${params.output.text}`);
      }
    });
  });

  test('invalid rule file → handles gracefully', async () => {
    // Use rulesInvalidFile fixture which has nonexistent-rule.yaml
    await testPullRequestHandler({
      payload: payload(),
      spec: 'rulesInvalidFile',
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
      }
    });
  });
});