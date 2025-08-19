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
import pullRequestOpenedPayload from '../fixtures/pull_request.opened.complete.json' assert { type: 'json' };

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
      spec: 'rulesMvpIntegration',
      expectCheck: (params) => {
        // Minimal contract assertions
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
        assert.strictEqual(typeof params.output, 'object');
        // Optional: assert gate summary line exists
        assert.match(params.output.text || '', /\bGates:\s*\d+\s+total\b/);
      }
    });
  });

  test('missing rules dir → handles gracefully', async () => {
    const broken = SPEC_FIXTURES.rulesMvpIntegration.replace(
      'rules_dir: .cogni/rules',
      'rules_dir: /nonexistent/rules'
    );

    await testPullRequestHandler({
      payload: payload(),
      spec: yaml.load(broken),
      expectCheck: (params) => {
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
      }
    });
  });
});