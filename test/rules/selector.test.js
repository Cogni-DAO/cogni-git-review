/**
 * P0 Tests for Rule Selector - Path Matching and Diff Kind Logic
 * 
 * Tests the core logic for determining which rules apply to which file changes.
 * Critical for ensuring rules only run when they should.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { selectApplicableRules } from '../../src/rules/selector.js';

describe('Rule Selector - P0 Critical Tests', () => {
  
  // Helper to create test rule with selectors
  function createTestRule(id, pathGlobs, diffKinds) {
    return {
      rule_key: id,
      selectors: {
        paths: pathGlobs || ['**'],
        diff_kinds: diffKinds || ['add', 'modify', 'delete']
      }
    };
  }

  test('selector_paths_and_diff_kinds - Basic path matching working', async () => {
    const rules = [
      createTestRule('src-only', ['src/**'], ['add', 'modify']),
      createTestRule('docs-only', ['docs/**'], ['modify']),
      createTestRule('js-files', ['**/*.js'], ['add']),
      createTestRule('all-files', ['**'], ['delete'])
    ];

    const changedFiles = [
      { filename: 'src/app.js', status: 'added' },      // Should match: src-only, js-files
      { filename: 'docs/README.md', status: 'modified' }, // Should match: docs-only  
      { filename: 'package.json', status: 'removed' },   // Should match: all-files
      { filename: 'test/spec.py', status: 'modified' }   // Should match: none
    ];

    const applicable = selectApplicableRules(rules, { 
      changed_files: changedFiles,
      hunks_by_file: {} 
    });

    // Verify selections
    const selectedIds = applicable.map(r => r.rule_key);
    
    assert.ok(selectedIds.includes('src-only'), 'src-only should match src/app.js');
    assert.ok(selectedIds.includes('js-files'), 'js-files should match src/app.js'); 
    assert.ok(selectedIds.includes('docs-only'), 'docs-only should match docs/README.md');
    assert.ok(selectedIds.includes('all-files'), 'all-files should match package.json deletion');
    
    // Should have exactly 4 matches (src-only, js-files, docs-only, all-files)
    assert.strictEqual(applicable.length, 4, `Expected 4 matches, got ${applicable.length}: [${selectedIds.join(', ')}]`);
  });

  test('selector_diff_kinds_normalized - GitHub status mapping works', async () => {
    const rules = [
      createTestRule('add-only', ['**'], ['add']),
      createTestRule('modify-only', ['**'], ['modify']),  
      createTestRule('delete-only', ['**'], ['delete']),
      createTestRule('rename-only', ['**'], ['rename'])
    ];

    // Test GitHub status normalization
    const testCases = [
      { 
        files: [{ filename: 'new.js', status: 'added' }],
        expectedRules: ['add-only']
      },
      { 
        files: [{ filename: 'changed.js', status: 'modified' }],
        expectedRules: ['modify-only']
      },
      { 
        files: [{ filename: 'gone.js', status: 'removed' }], 
        expectedRules: ['delete-only']
      },
      {
        files: [{ filename: 'moved.js', status: 'renamed', previous_filename: 'old.js' }],
        expectedRules: ['rename-only']
      }
    ];

    for (const testCase of testCases) {
      const applicable = selectApplicableRules(rules, {
        changed_files: testCase.files,
        hunks_by_file: {}
      });

      const selectedIds = applicable.map(r => r.rule_key);
      
      for (const expected of testCase.expectedRules) {
        assert.ok(
          selectedIds.includes(expected), 
          `Rule ${expected} should match file ${testCase.files[0].filename} with status ${testCase.files[0].status}`
        );
      }
      
      // Should only match the expected rules
      assert.strictEqual(
        applicable.length, 
        testCase.expectedRules.length,
        `Expected ${testCase.expectedRules.length} matches for ${testCase.files[0].status}, got ${applicable.length}: [${selectedIds.join(', ')}]`
      );
    }
  });

  test('selector_no_matches - Empty result when no rules apply', async () => {
    const rules = [
      createTestRule('cpp-only', ['**/*.cpp', '**/*.hpp'], ['add', 'modify']),
      createTestRule('delete-only', ['**'], ['delete'])
    ];

    const changedFiles = [
      { filename: 'app.js', status: 'modified' }, // Wrong extension for cpp-only, wrong diff_kind for delete-only
      { filename: 'README.md', status: 'added' }  // Wrong extension for cpp-only, wrong diff_kind for delete-only
    ];

    const applicable = selectApplicableRules(rules, {
      changed_files: changedFiles,
      hunks_by_file: {}
    });

    assert.strictEqual(applicable.length, 0, 'Should return empty array when no rules match');
  });

  test('selector_complex_globs - Advanced glob patterns work', async () => {
    const rules = [
      createTestRule('src-js', ['src/**/*.js', 'lib/**/*.js'], ['modify']),
      createTestRule('test-files', ['test/**', 'tests/**', '**/*.test.js'], ['add']),
      createTestRule('config-files', ['*.json', '*.yaml', '*.yml', '.env*'], ['modify']),
      createTestRule('exclude-build', ['!build/**', '!dist/**', '**'], ['add'])
    ];

    const changedFiles = [
      { filename: 'src/utils/helper.js', status: 'modified' },     // Should match src-js
      { filename: 'test/unit/parser.test.js', status: 'added' },  // Should match test-files  
      { filename: 'package.json', status: 'modified' },           // Should match config-files
      { filename: 'build/output.js', status: 'added' },          // Should NOT match exclude-build (excluded)
      { filename: 'new-feature.js', status: 'added' }            // Should match exclude-build
    ];

    const applicable = selectApplicableRules(rules, {
      changed_files: changedFiles,
      hunks_by_file: {}
    });

    const selectedIds = applicable.map(r => r.rule_key);
    
    assert.ok(selectedIds.includes('src-js'), 'Should match src utils JavaScript file');
    assert.ok(selectedIds.includes('test-files'), 'Should match test file');
    assert.ok(selectedIds.includes('config-files'), 'Should match package.json');
    assert.ok(selectedIds.includes('exclude-build'), 'Should match new-feature.js (not in build/)');
    
    // Should have exactly 4 matches 
    assert.strictEqual(applicable.length, 4, `Expected 4 matches, got ${applicable.length}: [${selectedIds.join(', ')}]`);
  });

  test('selector_edge_cases - Handle malformed or missing selectors', async () => {
    const rules = [
      { rule_key: 'no-selectors' }, // Missing selectors entirely
      { rule_key: 'empty-paths', selectors: { paths: [] } }, // Empty paths
      { rule_key: 'null-diff-kinds', selectors: { paths: ['**'], diff_kinds: null } }, // Null diff_kinds
      { rule_key: 'valid-rule', selectors: { paths: ['**'], diff_kinds: ['modify'] } }
    ];

    const changedFiles = [
      { filename: 'test.js', status: 'modified' }
    ];

    const applicable = selectApplicableRules(rules, {
      changed_files: changedFiles,
      hunks_by_file: {}
    });

    // Only the valid rule should match
    assert.strictEqual(applicable.length, 1, 'Only valid rule should match');
    assert.strictEqual(applicable[0].rule_key, 'valid-rule', 'Should match the valid rule');
  });
});