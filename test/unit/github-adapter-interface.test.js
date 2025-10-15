/**
 * Test that GitHubAdapter correctly implements BaseContext interface
 * This validates our TypeScript definitions work correctly
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { GitHubAdapter } from '../../src/adapters/github-adapter.js';

test('GitHubAdapter implements BaseContext interface', () => {
  // Mock minimal Probot context
  const mockProbotContext = {
    payload: {
      repository: { name: 'test-repo', full_name: 'owner/test-repo' },
      installation: { id: 12345 },
      pull_request: {
        id: 123,
        number: 42,
        state: 'open',
        title: 'Test PR',
        head: { sha: 'abc123', repo: { name: 'test-repo', full_name: 'owner/test-repo' } },
        base: { sha: 'def456', repo: { name: 'test-repo', full_name: 'owner/test-repo' } },
        changed_files: 1,
        additions: 5,
        deletions: 2
      },
      action: 'opened'
    },
    repo: (options = {}) => ({ owner: 'owner', repo: 'test-repo', ...options }),
    octokit: {
      config: { get: async () => ({ config: null }) },
      pulls: { 
        get: async () => ({ data: {} }),
        listFiles: async () => ({ data: [] })
      },
      repos: {
        compareCommits: async () => ({ data: {} }),
        getContent: async () => ({ data: {} })
      }
    },
    log: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      child: () => ({ info: () => {}, error: () => {} })
    }
  };

  const adapter = new GitHubAdapter(mockProbotContext);

  // Test payload delegation
  assert.deepEqual(adapter.payload, mockProbotContext.payload);
  
  // Test repo method delegation
  assert.deepEqual(adapter.repo(), { owner: 'owner', repo: 'test-repo' });
  assert.deepEqual(adapter.repo({ pull_number: 42 }), { owner: 'owner', repo: 'test-repo', pull_number: 42 });
  
  // Test octokit delegation
  assert.strictEqual(adapter.octokit, mockProbotContext.octokit);
  
  // Test log delegation
  assert.strictEqual(adapter.log, mockProbotContext.log);
  
  // Test runtime properties are initially undefined
  assert.strictEqual(adapter.pr, undefined);
  assert.strictEqual(adapter.spec, undefined);
  assert.strictEqual(adapter.annotation_budget, undefined);
  
  // Test runtime properties can be set (like gate orchestrator does)
  adapter.pr = { number: 42, title: 'Test' };
  adapter.spec = { gates: [] };
  adapter.annotation_budget = 50;
  
  assert.deepEqual(adapter.pr, { number: 42, title: 'Test' });
  assert.deepEqual(adapter.spec, { gates: [] });
  assert.strictEqual(adapter.annotation_budget, 50);
  
  // Test backward compatibility
  assert.strictEqual(adapter.getProbotContext(), mockProbotContext);
});

test('GitHubAdapter preserves all payload fields from fixtures', () => {
  // Use actual fixture structure
  const fixturePayload = {
    action: "opened",
    number: 315,
    pull_request: {
      id: 2916082459,
      number: 315,
      state: "open", 
      title: "Test PR Title",
      head: {
        sha: "eeb67d6e0f131d27102080b6bb50be2ddae28cc3",
        repo: { name: "test-repo", full_name: "derekg1729/test-repo" }
      },
      base: {
        sha: "cf4f801049f678c0253179636aeabea6946de7e9",
        repo: { name: "test-repo", full_name: "derekg1729/test-repo" }
      },
      changed_files: 1,
      additions: 1,
      deletions: 0
    },
    repository: { name: "test-repo", full_name: "derekg1729/test-repo" },
    installation: { id: 87385964 }
  };

  const mockContext = {
    payload: fixturePayload,
    repo: () => ({ owner: 'derekg1729', repo: 'test-repo' }),
    octokit: {},
    log: {}
  };

  const adapter = new GitHubAdapter(mockContext);

  // Verify all fixture fields are accessible through adapter
  assert.strictEqual(adapter.payload.action, "opened");
  assert.strictEqual(adapter.payload.number, 315);
  assert.strictEqual(adapter.payload.pull_request.id, 2916082459);
  assert.strictEqual(adapter.payload.pull_request.head.sha, "eeb67d6e0f131d27102080b6bb50be2ddae28cc3");
  assert.strictEqual(adapter.payload.repository.full_name, "derekg1729/test-repo");
  assert.strictEqual(adapter.payload.installation.id, 87385964);
});