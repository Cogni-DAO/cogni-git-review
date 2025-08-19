/**
 * MVP Tests for Rules Gate - Following DRY Architecture
 * 
 * Tests the minimal working gate using SPEC_FIXTURES pattern
 * and integration-style testing to avoid ES module mocking issues
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { run as runRulesGate } from '../../src/gates/cogni/rules.js';
import { SPEC_FIXTURES, createAIRulesContext } from '../fixtures/repo-specs.js';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

describe('Rules Gate MVP Tests', () => {
  const testRulesDir = path.join(process.cwd(), 'test-rules-tmp-mvp');
  
  // Setup test rule file
  function setupTestRule() {
    if (!fs.existsSync(testRulesDir)) {
      fs.mkdirSync(testRulesDir, { recursive: true });
    }
    
    // Create a minimal valid rule
    const validRule = {
      id: 'goal-alignment',
      schema_version: '0.1',
      blocking: true,
      selectors: {
        paths: ['**'],
        diff_kinds: ['add', 'modify', 'delete']
      },
      evidence: {
        include: ['diff_summary']
      },
      prompt: {
        template: '.cogni/prompts/goal-alignment.md',
        variables: ['goals', 'non_goals', 'diff_summary']
      },
      success_criteria: {
        metric: 'score',
        threshold: 0.7
      }
    };
    
    const yamlContent = `# Test rule for MVP
id: goal-alignment
schema_version: '0.1'
blocking: true
selectors:
  paths: ['**']
  diff_kinds: ['add', 'modify', 'delete']
evidence:
  include: ['diff_summary']
prompt:
  template: .cogni/prompts/goal-alignment.md
  variables: ['goals', 'non_goals', 'diff_summary']
success_criteria:
  metric: score
  threshold: 0.7
`;
    fs.writeFileSync(path.join(testRulesDir, 'goal-alignment.yaml'), yamlContent);
  }
  
  function cleanupTestRule() {
    if (fs.existsSync(testRulesDir)) {
      fs.rmSync(testRulesDir, { recursive: true });
    }
  }

  test('rules_gate_no_rules - missing rule_file → neutral', async () => {
    // Use existing rulesNoRuleFile fixture - should result in neutral
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesNoRuleFile);
    context.spec = spec;
    
    // Extract the rules gate config
    const gateConfig = spec.gates?.find(g => g.id === 'rules') || {};
    
    const result = await runRulesGate(context, gateConfig);
    
    assert.strictEqual(result.status, 'neutral', 'No rule_file should result in neutral');
    assert.strictEqual(result.neutral_reason, 'no_rule_file', 'Should have no_rule_file reason');
    assert.ok(Array.isArray(result.violations), 'Should have violations array');
    assert.ok(result.stats && typeof result.stats === 'object', 'Should have stats object');
    assert.ok(typeof result.duration_ms === 'number', 'Should include duration');
  });

  test('rules_gate_invalid_rule_file - nonexistent rule file → neutral', async () => {
    // Use existing rulesInvalidFile fixture - should result in neutral  
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesInvalidFile);
    context.spec = spec;
    
    // Extract the rules gate config
    const gateConfig = spec.gates?.find(g => g.id === 'rules') || {};

    const result = await runRulesGate(context, gateConfig);
    
    assert.strictEqual(result.status, 'neutral', 'Invalid rule file should result in neutral');
    assert.strictEqual(result.neutral_reason, 'rule_missing', 'Should have rule_missing reason');
  });

  test('rules_gate_basic_structure - verify gate structure without AI calls', async () => {
    // Use existing rulesSingleFile fixture for basic structure test
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesSingleFile);
    context.spec = spec;
    
    // Extract the rules gate config
    const gateConfig = spec.gates?.find(g => g.id === 'rules') || {};
    
    try {
      const result = await runRulesGate(context, gateConfig);
      
      // Should have proper registry structure
      assert.ok(['pass', 'fail', 'neutral'].includes(result.status), 'Should have valid status');
      assert.ok(Array.isArray(result.violations), 'Should have violations array');
      assert.ok(result.stats && typeof result.stats === 'object', 'Should have stats object');
      assert.ok(typeof result.duration_ms === 'number', 'Should include duration');
      
    } catch (error) {
      // Expected - rule file won't exist, but structure should still be validated
      assert.ok(error.message.includes('ENOENT') || error.message.includes('not found'), 'Should fail on missing file, not structure');
    }
  });

  test('rules_gate_config_parsing - verify gate configuration parsing', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesSingleFile);
    context.spec = spec;
    
    // Extract the rules gate config
    const gateConfig = spec.gates?.find(g => g.id === 'rules') || {};
    
    // This should work even if the rule file doesn't exist - should return neutral
    const result = await runRulesGate(context, gateConfig);
    
    // Should handle config gracefully - registry format
    assert.ok(['pass', 'fail', 'neutral'].includes(result.status), 'Should have valid status');
    assert.ok(typeof result.duration_ms === 'number', 'Should track execution time');
  });
});