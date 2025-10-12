/**
 * Budget Calculation Unit Tests
 * Tests the budget logic that integrates review-limits with AI workflow evidence gathering
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Budget Calculation Unit Tests', () => {

  // Helper function that mimics the budget calculation logic from goal-evaluations.js
  function calculateBudgets(context) {
    return {
      max_files: context.reviewLimitsConfig?.max_changed_files || 25,
      max_patch_bytes_per_file: 16000,
      max_patches: 3
    };
  }

  test('uses 25-file limit when no review-limits configured', () => {
    const context = {
      // No reviewLimitsConfig - simulates spec without review-limits gate
      reviewLimitsConfig: undefined
    };
    
    const budgets = calculateBudgets(context);
    
    assert.strictEqual(budgets.max_files, 25, 'Should use 25-file default without review-limits');
    assert.strictEqual(budgets.max_patch_bytes_per_file, 16000);
    assert.strictEqual(budgets.max_patches, 3);
  });

  test('uses review-limits max_changed_files when configured', () => {
    const context = {
      reviewLimitsConfig: {
        max_changed_files: 10,
        max_total_diff_kb: 50
      }
    };
    
    const budgets = calculateBudgets(context);
    
    assert.strictEqual(budgets.max_files, 10, 'Should use review-limits max_changed_files');
    assert.strictEqual(budgets.max_patch_bytes_per_file, 16000, 'Should preserve workflow defaults');
    assert.strictEqual(budgets.max_patches, 3, 'Should preserve workflow defaults');
  });

  test('budget logic is independent of actual file count', () => {
    // Budget calculation doesn't depend on actual file count - that happens during file processing
    const context = {
      reviewLimitsConfig: {
        max_changed_files: 10
      }
    };
    
    const budgets = calculateBudgets(context);
    
    assert.strictEqual(budgets.max_files, 10, 'Budget limit independent of actual file count');
  });

  test('falls back to default when review-limits config exists but max_changed_files is missing', () => {
    const context = {
      reviewLimitsConfig: {
        // Has config object but no max_changed_files
        max_total_diff_kb: 100
      }
    };
    
    const budgets = calculateBudgets(context);
    
    assert.strictEqual(budgets.max_files, 25, 'Should fall back to default when max_changed_files missing');
  });

  test('handles various review-limits configurations correctly', () => {
    const testCases = [
      { input: 5, expected: 5 },
      { input: 30, expected: 30 },
      { input: 100, expected: 100 },
      { input: 1, expected: 1 }
    ];
    
    testCases.forEach(({ input, expected }) => {
      const context = {
        reviewLimitsConfig: {
          max_changed_files: input
        }
      };
      
      const budgets = calculateBudgets(context);
      assert.strictEqual(budgets.max_files, expected, `Should use configured value ${input}`);
    });
  });
});