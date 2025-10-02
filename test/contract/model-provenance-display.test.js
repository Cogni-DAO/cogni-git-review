/**
 * Contract Tests - Model Provenance Display in GitHub Check Summary
 * Validates that AI rules show model information while non-AI rules don't
 * Uses direct gate testing pattern proven in multiple-ai-rules.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DONT_REBUILD_OSS_RULE, MOCK_AI_GATE_PASS, MOCK_AI_GATE_FAIL, MOCK_AI_GATE_DIFFERENT_MODEL } from '../fixtures/ai-rules.js';
import { runConfiguredGates } from '../../src/gates/run-configured.js';
import { renderCheckSummary } from '../../src/summary-adapter.js';
import { createGateTestContext } from '../helpers/handler-harness.js';

describe('Model Provenance Display Contract Tests', () => {

  test('AI rule results with provenance show model info in summary', async () => {
    // Create spec with one AI rule
    const spec = {
      schema_version: '0.1.4',
      intent: {
        name: 'model-provenance-test',
        goals: ['Test model display'],
        non_goals: ['Hide model info']
      },
      gates: [
        {
          type: 'review-limits',
          id: 'review_limits',
          with: { max_changed_files: 50, max_total_diff_kb: 200 }
        },
        {
          type: 'ai-rule',
          with: { rule_file: 'dont-rebuild-oss.yaml' }
        }
      ]
    };

    // Create run context with mock PR data 
    const runCtx = createGateTestContext({
      spec,
      pr: {
        title: 'Add authentication feature',
        body: 'Implements OAuth login',
        changed_files: 2,
        additions: 25,
        deletions: 5
      },
      octokit: {
        config: {
          get: async ({ path }) => {
            if (path === '.cogni/rules/dont-rebuild-oss.yaml') {
              return { config: DONT_REBUILD_OSS_RULE };
            }
            return { config: null };
          }
        }
      }
    });

    const launcherResult = await runConfiguredGates(runCtx);
    
    // Create mock gate results with provenance (simulating successful AI execution)
    const mockResults = launcherResult.results.map(result => {
      if (result.id === 'dont-rebuild-oss') {
        // Use structured mock AI gate result
        return { ...result, ...MOCK_AI_GATE_PASS };
      }
      return result; // Non-AI gates unchanged
    });

    // Create run result for summary adapter
    const runResult = {
      overall_status: 'pass',
      gates: mockResults,
      duration_ms: 2000
    };

    // Test the summary formatting
    const { text } = renderCheckSummary(runResult);
    
    // DEBUG: Uncomment to see actual output
    // console.log('=== RENDERED SUMMARY TEXT ===');
    // console.log(text);
    // console.log('=== END SUMMARY ===');
    
    // Verify AI rule shows model information
    assert(text.includes('**Model:**'), 'AI rule should show model information');
    assert(text.includes('openai / gpt-4o-mini'), 'Should show provider / model format');
    
    // Verify non-AI rule doesn't show model info
    const reviewLimitsSection = text.match(/### ✅ review_limits[\s\S]*?(?=### |$)/);
    assert(reviewLimitsSection, 'Should have review_limits section');
    assert(!reviewLimitsSection[0].includes('**Model:**'), 'Non-AI gate should not show model info');
  });

  test('non-AI gates only do not show model info', async () => {
    // Simple spec with only non-AI gate
    const spec = {
      schema_version: '0.1.4', 
      intent: { name: 'non-ai-test', goals: ['Test'], non_goals: [] },
      gates: [
        { type: 'review-limits', id: 'review_limits', with: { max_changed_files: 50 } }
      ]
    };

    const runCtx = createGateTestContext({
      spec,
      pr: { changed_files: 2, additions: 25, deletions: 5 },
      octokit: { config: { get: async () => ({ config: null }) } }
    });

    const launcherResult = await runConfiguredGates(runCtx);
    const runResult = {
      overall_status: 'pass',
      gates: launcherResult.results,
      duration_ms: 100
    };

    const { text } = renderCheckSummary(runResult);
    
    // Should not contain any model information
    assert(!text.includes('**Model:**'), 'Non-AI gates should not show model info');
  });

  test('mixed gates show model info only for AI rules', async () => {
    // Test with multiple gates including AI rules with different models
    const mockRunResult = {
      overall_status: 'pass',
      gates: [
        {
          id: 'review_limits',
          status: 'pass',
          violations: [],
          stats: { changed_files: 2 },
          duration_ms: 5
        },
        { ...MOCK_AI_GATE_PASS, id: 'dont-rebuild-oss', observations: ['Looks good'], duration_ms: 1200 },
        { ...MOCK_AI_GATE_FAIL, id: 'goal-alignment', observations: ['Issues found'], duration_ms: 1800, provenance: { modelConfig: { provider: 'openai', model: 'gpt-5-2025-08-07' } } }
      ],
      duration_ms: 3000
    };

    const { text } = renderCheckSummary(mockRunResult);
    
    // Count model info appearances
    const modelMatches = text.match(/\*\*Model:\*\*/g);
    assert.strictEqual(modelMatches?.length, 2, 'Should have exactly 2 model entries for AI rules');
    
    // Verify specific models are shown
    assert(text.includes('openai / gpt-4o-mini'), 'Should show first AI rule model');
    assert(text.includes('openai / gpt-5-2025-08-07'), 'Should show second AI rule model');
    
    // Verify review_limits section has no model info
    const reviewSection = text.match(/### ✅ review_limits[\s\S]*?(?=### |$)/);
    assert(!reviewSection[0].includes('**Model:**'), 'Non-AI gate should not show model');
  });
});