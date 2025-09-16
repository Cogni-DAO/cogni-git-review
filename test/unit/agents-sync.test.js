import { describe, test } from 'node:test';
import assert from 'node:assert';
import { run } from '../../src/gates/cogni/agents-md-sync.js';

describe('AGENTS.md Synchronization Gate', () => {
  
  function createMockContext(changedFiles) {
    return {
      pr: { number: 123 },
      repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
      octokit: {
        pulls: {
          listFiles: async () => ({ data: changedFiles })
        }
      }
    };
  }

  test('passes when no code files are changed', async () => {
    const changedFiles = [
      { filename: 'README.md', status: 'modified' },
      { filename: 'docs/setup.md', status: 'added' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.code_changes_found, 0);
  });

  test('fails when code file changed but AGENTS.md not updated', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/auth/utils.js', status: 'modified' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].code, 'MISSING_AGENTS_UPDATE');
    assert.strictEqual(result.violations[0].meta.expected_doc_path, 'src/auth/AGENTS.md');
    assert.strictEqual(result.stats.code_changes_found, 2);
    assert.strictEqual(result.stats.directories_checked, 1);
  });

  test('passes when code file changed and AGENTS.md updated', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/auth/AGENTS.md', status: 'modified' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.code_changes_found, 1);
    assert.strictEqual(result.stats.directories_checked, 1);
  });

  test('handles multiple directories correctly', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/gates/new-gate.js', status: 'added' },
      { filename: 'src/auth/AGENTS.md', status: 'modified' }
      // Missing src/gates/AGENTS.md
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].meta.expected_doc_path, 'src/gates/AGENTS.md');
    assert.strictEqual(result.stats.code_changes_found, 2);
    assert.strictEqual(result.stats.directories_checked, 2);
  });

  test('ignores removed files', async () => {
    const changedFiles = [
      { filename: 'src/old-module.js', status: 'removed' },
      { filename: 'src/new-module.js', status: 'added' }
      // Missing src/AGENTS.md update
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.stats.code_changes_found, 1); // Only new-module.js counted
  });

  test('ignores AGENTS.md files in code change detection', async () => {
    const changedFiles = [
      { filename: 'src/AGENTS.md', status: 'modified' },
      { filename: 'test/AGENTS.md', status: 'added' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.code_changes_found, 0);
  });

  test('respects custom code patterns configuration', async () => {
    const changedFiles = [
      { filename: 'custom/module.py', status: 'added' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const config = {
      with: {
        code_patterns: ['custom/**/*.py'],
        doc_pattern: 'AGENTS.md'
      }
    };
    
    const result = await run(ctx, config);

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].meta.expected_doc_path, 'custom/AGENTS.md');
  });

  test('respects custom doc pattern configuration', async () => {
    const changedFiles = [
      { filename: 'src/module.js', status: 'added' },
      { filename: 'src/README.md', status: 'modified' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const config = {
      with: {
        doc_pattern: 'README.md'
      }
    };
    
    const result = await run(ctx, config);

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
  });

  test('handles GitHub API errors gracefully', async () => {
    const ctx = {
      pr: { number: 123 },
      repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
      octokit: {
        pulls: {
          listFiles: async () => {
            throw new Error('API rate limit exceeded');
          }
        }
      }
    };
    
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'neutral');
    assert.strictEqual(result.neutral_reason, 'api_error');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.error, 'API rate limit exceeded');
  });

  test('avoids duplicate directory checks', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/auth/utils.js', status: 'modified' },
      { filename: 'src/auth/helpers.js', status: 'modified' }
      // All in same directory
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1); // Only one violation for the directory
    assert.strictEqual(result.stats.directories_checked, 1);
    assert.strictEqual(result.stats.code_changes_found, 3);
  });

  test('handles root directory changes', async () => {
    const changedFiles = [
      { filename: 'index.js', status: 'modified' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const result = await run(ctx, {});

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations[0].meta.expected_doc_path, 'AGENTS.md');
    assert.strictEqual(result.violations[0].meta.directory, '.');
  });

  test('respects CLAUDE.md as custom doc pattern', async () => {
    const changedFiles = [
      { filename: 'src/auth/oauth.js', status: 'added' },
      { filename: 'src/auth/CLAUDE.md', status: 'modified' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const config = {
      with: {
        doc_pattern: 'CLAUDE.md'
      }
    };
    
    const result = await run(ctx, config);

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.code_changes_found, 1);
    assert.strictEqual(result.stats.directories_checked, 1);
  });

  test('fails when code changes but CLAUDE.md not updated', async () => {
    const changedFiles = [
      { filename: 'src/utils/helper.js', status: 'modified' },
      { filename: 'src/components/Button.js', status: 'added' }
    ];
    
    const ctx = createMockContext(changedFiles);
    const config = {
      with: {
        doc_pattern: 'CLAUDE.md'
      }
    };
    
    const result = await run(ctx, config);

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 2);
    assert.strictEqual(result.violations[0].meta.expected_doc_path, 'src/utils/CLAUDE.md');
    assert.strictEqual(result.violations[1].meta.expected_doc_path, 'src/components/CLAUDE.md');
    assert.strictEqual(result.stats.code_changes_found, 2);
    assert.strictEqual(result.stats.directories_checked, 2);
  });

  test('respects README.md as custom doc pattern with specific code patterns', async () => {
    const changedFiles = [
      { filename: 'lib/core/engine.ts', status: 'modified' },
      { filename: 'lib/core/README.md', status: 'modified' },
      { filename: 'src/unrelated.js', status: 'added' }  // Should be ignored due to code_patterns
    ];
    
    const ctx = createMockContext(changedFiles);
    const config = {
      with: {
        code_patterns: ['lib/**/*.ts'],
        doc_pattern: 'README.md'
      }
    };
    
    const result = await run(ctx, config);

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.code_changes_found, 1);  // Only the .ts file matches
    assert.strictEqual(result.stats.directories_checked, 1);
  });
});