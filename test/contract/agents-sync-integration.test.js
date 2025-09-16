/**
 * AGENTS.md Synchronization Gate Integration Tests
 * Tests the gate within the launcher framework with real-world scenarios
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { runConfiguredGates } from '../../src/gates/run-configured.js';
import yaml from 'js-yaml';

describe('AGENTS.md Sync Gate Integration Tests', () => {

  function createTestSpec(gateConfig = {}) {
    return {
      schema_version: '0.1.4',
      intent: {
        name: 'agents-md-sync-test-project',
        goals: ['Test AGENTS.md synchronization'],
        non_goals: ['Missing documentation']
      },
      gates: [
        {
          type: 'agents-md-sync',
          id: 'agents_sync',
          with: gateConfig
        }
      ]
    };
  }

  function createRunContext(changedFiles, spec = createTestSpec()) {
    return {
      spec,
      pr: { 
        number: 123,
        changed_files: changedFiles.length,
        additions: 50,
        deletions: 10
      },
      repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
      octokit: {
        pulls: {
          listFiles: async () => ({ data: changedFiles })
        }
      },
      logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || ''),
      abort: new AbortController().signal
    };
  }

  test('gate fails when code changes lack AGENTS.md updates', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/auth/utils.js', status: 'modified' }
    ];

    const runCtx = createRunContext(changedFiles);
    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    assert.strictEqual(gateResult.id, 'agents_sync');
    assert.strictEqual(gateResult.status, 'fail');
    assert.strictEqual(gateResult.violations.length, 1);
    assert.strictEqual(gateResult.violations[0].code, 'MISSING_AGENTS_UPDATE');
    assert(gateResult.violations[0].message.includes('src/auth/AGENTS.md'));
    assert(typeof gateResult.duration_ms === 'number');
  });

  test('gate passes when code changes include AGENTS.md updates', async () => {
    const changedFiles = [
      { filename: 'src/gates/new-gate.js', status: 'added' },
      { filename: 'src/gates/AGENTS.md', status: 'modified' },
      { filename: 'test/unit/new-gate.test.js', status: 'added' },
      { filename: 'test/unit/AGENTS.md', status: 'modified' }
    ];

    const runCtx = createRunContext(changedFiles);
    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    assert.strictEqual(gateResult.id, 'agents_sync');
    assert.strictEqual(gateResult.status, 'pass');
    assert.strictEqual(gateResult.violations.length, 0);
    assert(gateResult.stats.code_changes_found > 0);
    assert(gateResult.stats.directories_checked >= 1);
  });

  test('gate passes when only documentation files are changed', async () => {
    const changedFiles = [
      { filename: 'README.md', status: 'modified' },
      { filename: 'docs/setup.md', status: 'added' },
      { filename: 'CHANGELOG.md', status: 'modified' }
    ];

    const runCtx = createRunContext(changedFiles);
    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    assert.strictEqual(gateResult.id, 'agents_sync');
    assert.strictEqual(gateResult.status, 'pass');
    assert.strictEqual(gateResult.violations.length, 0);
    assert.strictEqual(gateResult.stats.code_changes_found, 0);
  });

  test('gate handles custom configuration correctly', async () => {
    const customConfig = {
      code_patterns: ['custom/**/*.py', 'scripts/*.sh'],
      doc_pattern: 'DOCUMENTATION.md'
    };

    const changedFiles = [
      { filename: 'custom/module.py', status: 'added' },
      { filename: 'custom/DOCUMENTATION.md', status: 'modified' }
    ];

    const spec = createTestSpec(customConfig);
    const runCtx = createRunContext(changedFiles, spec);
    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    assert.strictEqual(gateResult.status, 'pass');
    assert.strictEqual(gateResult.violations.length, 0);
  });

  test('gate handles multiple directory violations', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/gates/new-gate.js', status: 'added' },
      { filename: 'lib/utils.js', status: 'modified' }
      // No AGENTS.md updates in any directory
    ];

    const runCtx = createRunContext(changedFiles);
    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    assert.strictEqual(gateResult.status, 'fail');
    assert.strictEqual(gateResult.violations.length, 3); // One per directory
    assert.strictEqual(gateResult.stats.directories_checked, 3);
    
    const expectedPaths = ['src/auth/AGENTS.md', 'src/gates/AGENTS.md', 'lib/AGENTS.md'];
    const actualPaths = gateResult.violations.map(v => v.meta.expected_doc_path);
    
    for (const expectedPath of expectedPaths) {
      assert(actualPaths.includes(expectedPath), `Should include ${expectedPath}`);
    }
  });

  test('gate returns neutral on GitHub API errors', async () => {
    const runCtx = {
      spec: createTestSpec(),
      pr: { number: 123, changed_files: 1 },
      repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
      octokit: {
        pulls: {
          listFiles: async () => {
            throw new Error('GitHub API rate limit');
          }
        }
      },
      logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || ''),
      abort: new AbortController().signal
    };

    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    assert.strictEqual(gateResult.id, 'agents_sync');
    assert.strictEqual(gateResult.status, 'neutral');
    assert.strictEqual(gateResult.neutral_reason, 'api_error');
    assert.strictEqual(gateResult.violations.length, 0);
    assert(gateResult.stats.error.includes('GitHub API rate limit'));
  });

  test('gate integrates with timeout handling', async () => {
    const changedFiles = [
      { filename: 'src/module.js', status: 'added' }
    ];

    // Create pre-aborted signal to simulate timeout
    const abortController = new AbortController();
    abortController.abort();

    const runCtx = createRunContext(changedFiles);
    runCtx.abort = abortController.signal;

    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    // Should return empty results due to timeout before gate execution
    assert.strictEqual(results.length, 0);
  });

  test('gate ID normalization works correctly', async () => {
    const changedFiles = [
      { filename: 'src/module.js', status: 'added' }
    ];

    const runCtx = createRunContext(changedFiles);
    const launcherResult = await runConfiguredGates(runCtx);
    const results = launcherResult.results;

    assert.strictEqual(results.length, 1);
    const gateResult = results[0];
    
    // ID should be normalized to spec configuration
    assert.strictEqual(gateResult.id, 'agents_sync');
    assert(gateResult.hasOwnProperty('duration_ms'));
    assert(Array.isArray(gateResult.violations));
    assert(typeof gateResult.stats === 'object');
  });
});