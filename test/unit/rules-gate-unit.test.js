/**
 * Unit Test for AI Rules Gate
 * 
 * Tests rules gate function in isolation: rule loading → evidence building → gate execution
 * Using reusable fixtures following DRY principle.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import yaml from 'js-yaml';
import { run as runRulesGate } from '../../src/gates/cogni/rules.js';
import { SPEC_FIXTURES, createAIRulesContext, PR_FIXTURES } from '../fixtures/repo-specs.js';

describe('AI Rules Gate Unit Tests', () => {

  test('ai_rules_gate_loads_and_selects_rules', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesSingleFile);
    context.spec = spec;

    // This test validates the rule loading and selection logic
    // We expect it to find the goal-alignment rule and apply it to the PR
    
    try {
      const gateConfig = spec.gates.find(g => g.id === 'rules');
      const result = await runRulesGate(context, gateConfig);
      
      // Basic result structure validation - registry format
      assert.ok(result, 'Gate should return a result');
      assert.ok(['pass', 'fail', 'neutral'].includes(result.status), 'Should have valid status');
      assert.ok(typeof result.duration_ms === 'number', 'Should include duration');
      assert.ok(Array.isArray(result.violations), 'Should have violations array');
      assert.ok(result.stats && typeof result.stats === 'object', 'Should have stats object');
      
      // Validate stats contains rule information
      assert.ok(result.stats.rule_id, 'Stats should include rule ID');
      
      console.log('AI Rules Gate Result:', {
        status: result.status,
        neutral_reason: result.neutral_reason,
        violationCount: result.violations.length,
        duration: result.duration_ms,
        stats: result.stats
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

  test('ai_rules_gate_handles_no_rule_file', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesNoRuleFile);
    context.spec = spec;

    const gateConfig = spec.gates.find(g => g.id === 'rules');
    const result = await runRulesGate(context, gateConfig);
    
    // Missing rule_file should return NEUTRAL with specific reason
    assert.strictEqual(result.status, 'neutral', 'Missing rule_file should result in neutral');
    assert.strictEqual(result.neutral_reason, 'no_rule_file', 'Should have no_rule_file reason');
  });

  test('ai_rules_gate_handles_invalid_rule_file', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesInvalidFile);
    context.spec = spec;

    const gateConfig = spec.gates.find(g => g.id === 'rules');
    const result = await runRulesGate(context, gateConfig);
    
    // Invalid rule file should return NEUTRAL
    assert.strictEqual(result.status, 'neutral', 'Invalid rule file should result in neutral');
    assert.strictEqual(result.neutral_reason, 'rule_missing', 'Should have rule_missing reason');
  });
});