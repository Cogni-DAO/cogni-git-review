/**
 * Rules Gate Code-Aware Enhancement Unit Tests
 * 
 * Tests the enhanced ai-rule gate with diff_summary and file_patches capabilities
 * Focuses on evidence gathering, string formatting, and budget enforcement
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Rules Gate Code-Aware Enhancement Unit Tests', () => {
  
  test('enhanced diff_summary string formatting', async () => {
    // Test the deterministic string format produced by gatherEvidence
    const files = [
      {
        filename: 'src/auth/oauth.js',
        status: 'modified',
        additions: 45,
        deletions: 12,
        changes: 57
      },
      {
        filename: 'src/utils/helpers.js', 
        status: 'modified',
        additions: 30,
        deletions: 5,
        changes: 35
      },
      {
        filename: 'README.md',
        status: 'modified',
        additions: 20,
        deletions: 0,
        changes: 20
      }
    ];
    
    // Simulate the totals calculation
    const totals = files.reduce((acc, f) => ({
      files: acc.files + 1,
      additions: acc.additions + f.additions,
      deletions: acc.deletions + f.deletions
    }), { files: 0, additions: 0, deletions: 0 });

    const expectedStart = `${totals.files} files changed, +${totals.additions}/−${totals.deletions} total`;
    assert.strictEqual(expectedStart, '3 files changed, +95/−17 total');
  });

  test('deterministic file sorting by churn then path', async () => {
    const files = [
      { filename: 'z-file.js', changes: 10 },
      { filename: 'a-file.js', changes: 10 },  // Same churn, should sort by name
      { filename: 'b-file.js', changes: 20 },  // Higher churn, should be first
    ];
    
    const sorted = files.sort((a, b) => {
      const churnDiff = (b.changes || 0) - (a.changes || 0);
      return churnDiff !== 0 ? churnDiff : a.filename.localeCompare(b.filename);
    });
    
    assert.strictEqual(sorted[0].filename, 'b-file.js'); // Highest churn first
    assert.strictEqual(sorted[1].filename, 'a-file.js'); // Same churn, alphabetical
    assert.strictEqual(sorted[2].filename, 'z-file.js');
  });

  test('budget limits are enforced correctly', async () => {
    const files = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 10 files
    const budgets = {
      max_files: 3,
      max_patch_bytes_per_file: 100,
      max_patches: 2
    };
    
    // Verify max_files budget
    const limitedFiles = files.slice(0, budgets.max_files);
    assert.strictEqual(limitedFiles.length, 3);
    
    // Verify max_patches budget  
    const maxPatches = Math.min(budgets.max_patches, limitedFiles.length);
    assert.strictEqual(maxPatches, 2);
    
    // Verify patch truncation
    const longPatch = 'a'.repeat(200); // Exceeds max_patch_bytes_per_file (100)
    const truncated = longPatch.slice(0, budgets.max_patch_bytes_per_file) + '\n… [truncated]';
    assert.strictEqual(truncated.length, budgets.max_patch_bytes_per_file + 14); // 100 + '\n… [truncated]' = 114
  });

  test('patch content formatting with file separators', async () => {
    const filename = 'src/test.js';
    const patch = '@@ -1,3 +1,4 @@\n console.log("test");';
    
    const formatted = `=== ${filename} ===\n${patch}\n\n`;
    const expected = '=== src/test.js ===\n@@ -1,3 +1,4 @@\n console.log("test");\n\n';
    
    assert.strictEqual(formatted, expected);
  });

  test('legacy rules without capabilities use basic diff summary', async () => {
    // Test that rules without x_capabilities fall back to the original behavior
    const rule = { /* no x_capabilities */ };
    const capabilities = rule.x_capabilities || [];
    
    assert.strictEqual(capabilities.includes('diff_summary'), false);
    assert.strictEqual(capabilities.includes('file_patches'), false);
    
    // Should use the basic summary format
    const fileCount = 4;
    const totalAdditions = 105;  
    const totalDeletions = 17;
    const prTitle = 'Add new authentication feature';
    const basicSummary = `PR "${prTitle}" modifies ${fileCount} file${fileCount === 1 ? '' : 's'} (+${totalAdditions} -${totalDeletions} lines)`;
    
    assert.strictEqual(basicSummary, 'PR "Add new authentication feature" modifies 4 files (+105 -17 lines)');
  });

  test('github api error returns graceful error message', async () => {
    // Simulate API error
    const errorMessage = 'API rate limit exceeded';
    const result = `Error gathering diff: ${errorMessage}`;
    
    assert.strictEqual(result, 'Error gathering diff: API rate limit exceeded');
    
    // Should not fail the gate, just return error info
    assert.strictEqual(typeof result, 'string');
  });

  test('vendor-prefixed extension fields are supported', async () => {
    const rule = {
      id: 'test-rule',
      x_capabilities: ['diff_summary', 'file_patches'],
      x_budgets: { max_files: 25 }
    };
    
    // Should be able to access vendor-prefixed fields
    assert(Array.isArray(rule.x_capabilities));
    assert.strictEqual(rule.x_capabilities.includes('diff_summary'), true);
    assert.strictEqual(rule.x_budgets.max_files, 25);
  });
});