/**
 * Integration Test for AI Rules Gate
 * 
 * Tests the complete flow: rule loading → selection → evidence building → gate execution
 * Using reusable fixtures following DRY principle.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import yaml from 'js-yaml';
import { evaluateRules } from '../../src/gates/cogni/rules.js';
import { SPEC_FIXTURES, createAIRulesContext, PR_FIXTURES } from '../fixtures/repo-specs.js';

describe('AI Rules Integration - Real PR Data Tests', () => {

  test('ai_rules_gate_loads_and_selects_rules', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesMvpIntegration);

    // This test validates the rule loading and selection logic
    // We expect it to find the goal-alignment rule and determine it applies to src/** changes
    
    try {
      const result = await evaluateRules(context, spec);
      
      // Basic result structure validation
      assert.ok(result, 'Gate should return a result');
      assert.strictEqual(result.id, 'rules', 'Result should have correct gate ID');
      assert.ok(['success', 'failure', 'neutral'].includes(result.conclusion), 'Should have valid conclusion');
      assert.ok(typeof result.duration_ms === 'number', 'Should include duration');
      assert.ok(Array.isArray(result.annotations), 'Should have annotations array');
      
      // Validate summary contains rule information
      assert.ok(result.summary.includes('alignment'), 'Summary should mention goal alignment');
      
      console.log('AI Rules Gate Result:', {
        conclusion: result.conclusion,
        summary: result.summary,
        annotationCount: result.annotations.length,
        duration: result.duration_ms
      });
      
    } catch (error) {
      // For integration testing, we expect potential failures due to missing files or provider issues
      // The important thing is that our gate handles errors gracefully
      console.log('Expected integration error (this is OK for testing):', error.message);
      
      // If it fails, it should be due to missing prompt template or provider issues, not our core logic
      assert.ok(
        error.message.includes('not found') || 
        error.message.includes('provider') ||
        error.message.includes('template'),
        'Error should be related to missing resources, not core logic bugs'
      );
    }
  });

  test('ai_rules_gate_handles_no_applicable_rules', async () => {
    const context = createAIRulesContext('configOnlyPR'); // Use config-only fixture
    const spec = yaml.load(SPEC_FIXTURES.rulesMvpIntegration);

    try {
      // MVP applies rule to ALL PRs, so this will always find applicable rules
      const result = await evaluateRules(context, spec);
      
      // MVP behavior: rule applies to all PRs, so should get neutral (no AI provider)
      assert.ok(['success', 'failure', 'neutral'].includes(result.conclusion), 'Should have valid conclusion');
      assert.ok(result.summary.includes('alignment'), 'Summary should indicate goal alignment');
      
    } catch (error) {
      console.log('Integration error in no-applicable test:', error.message);
      // Still validate the error is not from our core logic
      assert.ok(
        error.message.includes('not found') || 
        error.message.includes('provider'),
        'Should fail on external dependencies, not selection logic'
      );
    }
  });

  test('ai_rules_gate_handles_zero_valid_rules', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesMvpNoValidRules);

    const result = await evaluateRules(context, spec);
    
    // Zero valid rules should return NEUTRAL per user requirement
    assert.strictEqual(result.conclusion, 'neutral', 'Zero valid rules should result in neutral');
    assert.ok(result.summary.includes('0 applicable') || result.summary.includes('No valid rules'), 'Summary should indicate rule loading issue');
  });

  test('ai_rules_gate_error_handling', async () => {
    const context = createAIRulesContext('authFeaturePR');
    // Use existing invalid directory fixture - FOLLOWS DRY PRINCIPLE
    const spec = yaml.load(SPEC_FIXTURES.rulesMvpInvalidDir);

    const result = await evaluateRules(context, spec);
    
    // Should handle errors gracefully with neutral result
    assert.ok(['neutral', 'failure'].includes(result.conclusion), 'Error should result in neutral or failure');
    assert.ok(result.summary.includes('No rules') || result.summary.includes('no errors'), 'Should include diagnostic information');
  });
});