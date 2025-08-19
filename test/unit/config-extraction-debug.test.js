/**
 * Debug Test for Config Extraction Issue
 * 
 * This reproduces the exact local issue where enabled files [] is empty
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import yaml from 'js-yaml';
import fs from 'fs';
import { run as runRulesGate } from '../../src/gates/cogni/rules.js';
import { createAIRulesContext } from '../fixtures/repo-specs.js';

describe('Config Extraction Debug Tests', () => {

  test('reproduce_empty_enabled_array_issue', async () => {
    // Load the EXACT same repo-spec.yaml that local is using
    const realRepoSpecContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const realSpec = yaml.load(realRepoSpecContent);
    
    console.log('🔍 TEST: Real repo-spec gates:', JSON.stringify(realSpec.gates, null, 2));
    
    // Find the rules gate config
    const rulesGateConfig = realSpec.gates?.find(g => g.id === 'rules')?.with || {};
    console.log('🔍 TEST: Rules gate config:', JSON.stringify(rulesGateConfig, null, 2));
    console.log('🔍 TEST: Enable field:', rulesGateConfig.enable);
    console.log('🔍 TEST: Enable type:', typeof rulesGateConfig.enable);
    console.log('🔍 TEST: Enable is array:', Array.isArray(rulesGateConfig.enable));
    
    // This should show [goal-alignment.yaml]
    assert.ok(rulesGateConfig.enable, 'Should have enable field');
    assert.ok(Array.isArray(rulesGateConfig.enable), 'Enable should be array');
    assert.strictEqual(rulesGateConfig.enable[0], 'goal-alignment.yaml', 'Should have goal-alignment.yaml');
    
    // Now test the actual gate with this spec
    const context = createAIRulesContext('authFeaturePR');
    
    try {
      const result = await runRulesGate(context, realSpec);
      
      // If enable is working, we shouldn't get no_rules
      if (result.neutral_reason === 'no_rules') {
        console.log('🚨 TEST: Still getting no_rules with real spec!');
        console.log('🚨 TEST: Result:', JSON.stringify(result, null, 2));
      }
      
      // The result should not be no_rules if enable field exists
      assert.notStrictEqual(result.neutral_reason, 'no_rules', 'Should not return no_rules with proper config');
      
    } catch (error) {
      // This is fine - we expect errors from missing AI provider, etc.
      console.log('🔍 TEST: Expected error (no AI provider):', error.message);
      assert.ok(error.message.includes('not found') || error.message.includes('AI'), 'Should fail on AI, not config');
    }
  });

  test('test_config_extraction_directly', () => {
    // Test the exact config extraction logic in isolation
    const realRepoSpecContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const realSpec = yaml.load(realRepoSpecContent);
    
    // This is the exact same logic as in the rules gate
    const gateConfig = realSpec.gates?.find(g => g.id === 'rules')?.with || {};
    
    console.log('🔍 TEST: Direct extraction result:', JSON.stringify(gateConfig, null, 2));
    
    // Test the logic that's failing
    const enabled = gateConfig.enable ? [gateConfig.enable[0]] : [];
    console.log('🔍 TEST: Enabled array after processing:', enabled);
    
    assert.ok(gateConfig.enable, 'Config should have enable field');
    assert.ok(enabled.length > 0, 'Enabled array should not be empty');
    assert.strictEqual(enabled[0], 'goal-alignment.yaml', 'Should extract goal-alignment.yaml');
  });

  test('compare_fixture_vs_real_spec', () => {
    // Compare what tests use vs what real spec has
    const realRepoSpecContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const realSpec = yaml.load(realRepoSpecContent);
    
    const testFixtureSpec = yaml.load(`schema_version: '0.2.1'
intent:
  name: rules-mvp-test-project
  goals:
    - Build secure authentication system
    - Maintain good documentation
  non_goals:
    - Complex legacy integration
    - Unsecured endpoints
gates:
  - id: rules
    with:
      engine: ai
      rules_dir: .cogni/rules
      enable: [goal-alignment.yaml]
      model: gpt-4o-mini
      timeout_ms: 60000
      neutral_on_error: true
      blocking_default: true`);

    const realConfig = realSpec.gates?.find(g => g.id === 'rules')?.with || {};
    const testConfig = testFixtureSpec.gates?.find(g => g.id === 'rules')?.with || {};
    
    console.log('🔍 TEST: Real config:', JSON.stringify(realConfig, null, 2));
    console.log('🔍 TEST: Test config:', JSON.stringify(testConfig, null, 2));
    
    // Find the differences
    const realKeys = Object.keys(realConfig);
    const testKeys = Object.keys(testConfig);
    
    console.log('🔍 TEST: Real config keys:', realKeys);
    console.log('🔍 TEST: Test config keys:', testKeys);
    
    const missingInReal = testKeys.filter(key => !realKeys.includes(key));
    const missingInTest = realKeys.filter(key => !testKeys.includes(key));
    
    console.log('🔍 TEST: Missing in real:', missingInReal);
    console.log('🔍 TEST: Missing in test:', missingInTest);
    
    // Both should have enable
    assert.ok(realConfig.enable, 'Real config should have enable');
    assert.ok(testConfig.enable, 'Test config should have enable');
    
    assert.deepStrictEqual(realConfig.enable, testConfig.enable, 'Enable arrays should match');
  });
});