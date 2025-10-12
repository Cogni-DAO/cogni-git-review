/**
 * Budget Calculation Unit Tests
 * Tests the budget logic that integrates review-limits with AI workflow evidence gathering
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Budget Calculation Unit Tests', () => {

  // Helper function that mimics the budget calculation logic from goal-evaluations.js
  function calculateBudgets(context, rule) {
    return {
      max_files: context.reviewLimitsConfig?.max_changed_files || 25,
      max_patch_bytes_per_file: 16000,
      max_patches: 3,
      ...rule.x_budgets
    };
  }

  test('PR over default (25): uses 25-file limit when no review-limits configured', () => {
    const context = {
      // No reviewLimitsConfig - simulates spec without review-limits gate
      reviewLimitsConfig: undefined
    };
    const rule = { x_budgets: {} };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 25, 'Should use 25-file default without review-limits');
    assert.strictEqual(budgets.max_patch_bytes_per_file, 16000);
    assert.strictEqual(budgets.max_patches, 3);
  });

  test('PR over configured (10): uses review-limits max_changed_files when configured', () => {
    const context = {
      reviewLimitsConfig: {
        max_changed_files: 10,
        max_total_diff_kb: 50
      }
    };
    const rule = { x_budgets: {} };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 10, 'Should use review-limits max_changed_files');
    assert.strictEqual(budgets.max_patch_bytes_per_file, 16000, 'Should preserve workflow defaults');
    assert.strictEqual(budgets.max_patches, 3, 'Should preserve workflow defaults');
  });

  test('PR under configured (10): same budget logic regardless of actual file count', () => {
    // Budget calculation doesn't depend on actual file count - that happens during file processing
    const context = {
      reviewLimitsConfig: {
        max_changed_files: 10
      }
    };
    const rule = { x_budgets: {} };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 10, 'Budget limit independent of actual file count');
  });

  test('PR under default (25): same budget logic regardless of actual file count', () => {
    const context = {
      reviewLimitsConfig: undefined
    };
    const rule = { x_budgets: {} };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 25, 'Budget limit independent of actual file count');
  });

  test('x_budgets rule override takes precedence over review-limits', () => {
    const context = {
      reviewLimitsConfig: {
        max_changed_files: 10  // Would normally set max_files to 10
      }
    };
    const rule = {
      x_budgets: {
        max_files: 40,          // Rule override wins
        max_patches: 5          // Can override other values too
      }
    };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 40, 'x_budgets should override review-limits');
    assert.strictEqual(budgets.max_patches, 5, 'x_budgets can override other defaults');
    assert.strictEqual(budgets.max_patch_bytes_per_file, 16000, 'Unspecified values use defaults');
  });

  test('partial x_budgets override preserves other review-limits values', () => {
    const context = {
      reviewLimitsConfig: {
        max_changed_files: 15
      }
    };
    const rule = {
      x_budgets: {
        max_patches: 8  // Only override one value
      }
    };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 15, 'Should use review-limits when not overridden');
    assert.strictEqual(budgets.max_patches, 8, 'Should use x_budgets override');
    assert.strictEqual(budgets.max_patch_bytes_per_file, 16000, 'Should use workflow default');
  });

  test('empty review-limits config falls back to default', () => {
    const context = {
      reviewLimitsConfig: {
        // Has config object but no max_changed_files
        max_total_diff_kb: 100
      }
    };
    const rule = { x_budgets: {} };
    
    const budgets = calculateBudgets(context, rule);
    
    assert.strictEqual(budgets.max_files, 25, 'Should fall back to default when max_changed_files missing');
  });
});