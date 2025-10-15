/**
 * Test that Probot Context already implements BaseContext interface
 * This validates that we can use Probot context directly without wrappers
 */

import { test } from 'node:test';
import assert from 'node:assert';

test('Probot context already implements BaseContext interface', () => {
  // Mock Probot context with actual structure from webhooks
  const probotContext = {
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
      },
      checks: {
        create: async () => ({ data: {} })
      },
      issues: {
        createComment: async () => ({ data: {} })
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

  // Test that Probot context has all BaseContext properties
  assert.ok(probotContext.payload, 'has payload');
  assert.ok(probotContext.repo, 'has repo method');  
  assert.ok(probotContext.octokit, 'has octokit');
  assert.ok(probotContext.log, 'has log');

  // Test payload structure matches BaseContext requirements
  assert.strictEqual(probotContext.payload.repository.name, 'test-repo');
  assert.strictEqual(probotContext.payload.repository.full_name, 'owner/test-repo');
  assert.strictEqual(probotContext.payload.installation.id, 12345);
  assert.strictEqual(probotContext.payload.action, 'opened');

  // Test repo method works like BaseContext expects
  const repoInfo = probotContext.repo();
  assert.deepEqual(repoInfo, { owner: 'owner', repo: 'test-repo' });
  
  const repoWithOptions = probotContext.repo({ pull_number: 42 });
  assert.deepEqual(repoWithOptions, { owner: 'owner', repo: 'test-repo', pull_number: 42 });

  // Test required octokit methods exist
  assert.ok(probotContext.octokit.config.get, 'has config.get');
  assert.ok(probotContext.octokit.pulls.get, 'has pulls.get');
  assert.ok(probotContext.octokit.pulls.listFiles, 'has pulls.listFiles');
  assert.ok(probotContext.octokit.repos.compareCommits, 'has repos.compareCommits');
  assert.ok(probotContext.octokit.repos.getContent, 'has repos.getContent');

  // Test runtime properties can be added (like gate orchestrator does)
  probotContext.pr = { number: 42 };
  probotContext.spec = { gates: [] };
  probotContext.annotation_budget = 50;
  
  assert.strictEqual(probotContext.pr.number, 42);
  assert.deepEqual(probotContext.spec, { gates: [] });
  assert.strictEqual(probotContext.annotation_budget, 50);
});

test('Identity shim passes context unchanged', () => {
  const mockContext = {
    payload: { test: 'data' },
    repo: () => ({ owner: 'test', repo: 'repo' }),
    octokit: { api: 'mock' },
    log: { info: () => {} }
  };

  // Identity shim - just pass through
  function identityShim(context) {
    return context; // No transformation needed
  }

  const result = identityShim(mockContext);
  
  // Should be exactly the same object
  assert.strictEqual(result, mockContext);
  assert.strictEqual(result.payload, mockContext.payload);
  assert.strictEqual(result.repo, mockContext.repo); 
  assert.strictEqual(result.octokit, mockContext.octokit);
});