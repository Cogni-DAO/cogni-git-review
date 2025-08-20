/**
 * Unit Test for Goal Alignment Workflow  
 * Tests the hardcoded workflow response
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { evaluate } from '../../src/ai/workflows/goal-alignment.js';

describe('Goal Alignment Workflow Unit Tests', () => {

  test('workflow returns hardcoded response with correct structure', async () => {
    const input = {
      statement: "Deliver AI-powered advisory review to keep repo aligned",
      pr_title: "Add LangGraph integration",
      pr_body: "This PR implements LangGraph workflows for AI evaluation",
      diff_summary: "3 files changed (+45 -12 lines)"
    };

    const result = await evaluate(input);

    // Validate hardcoded response structure
    assert.strictEqual(result.score, 0.85, 'Should return hardcoded score');
    assert(Array.isArray(result.annotations), 'Should return annotations array');
    assert.deepStrictEqual(result.annotations, [], 'Should return empty annotations for hardcoded response');
    assert(typeof result.summary === 'string', 'Should return summary string');
  });

  test('workflow includes PR title and statement in summary', async () => {
    const input = {
      statement: "Test statement for evaluation",
      pr_title: "Fix critical bug",
      pr_body: "Addresses security vulnerability",
      diff_summary: "1 file changed (+5 -3 lines)"
    };

    const result = await evaluate(input);

    // Should include both PR title and statement in summary
    assert(result.summary.includes('Fix critical bug'), 'Summary should include PR title');
    assert(result.summary.includes('Test statement for evaluation'), 'Summary should include statement');
  });

  test('workflow handles minimal input', async () => {
    const input = {
      statement: "Minimal test",
      pr_title: "",
      pr_body: "",
      diff_summary: ""
    };

    const result = await evaluate(input);

    // Should still return valid structure with empty inputs
    assert.strictEqual(result.score, 0.85, 'Should return consistent score');
    assert.deepStrictEqual(result.annotations, [], 'Should return empty annotations');
    assert(typeof result.summary === 'string', 'Should return summary even with empty inputs');
  });
});