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

  test('reproduce_rule_file_config_issue', async () => {
    // Load the EXACT same repo-spec.yaml that local is using
    const realRepoSpecContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const realSpec = yaml.load(realRepoSpecContent);
    
    console.log('🔍 TEST: Real repo-spec gates:', JSON.stringify(realSpec.gates, null, 2));
    
    // Find the rules gate config
    const rulesGateConfig = realSpec.gates?.find(g => g.id === 'rules')?.with || {};
    console.log('🔍 TEST: Rules gate config:', JSON.stringify(rulesGateConfig, null, 2));
    console.log('🔍 TEST: Rule file field:', rulesGateConfig.rule_file);
    console.log('🔍 TEST: Rule file type:', typeof rulesGateConfig.rule_file);
    
    // This should show goal-alignment.yaml
    assert.ok(rulesGateConfig.rule_file, 'Should have rule_file field');
    assert.strictEqual(rulesGateConfig.rule_file, 'goal-alignment.yaml', 'Should have goal-alignment.yaml');
    
    // Now test the actual gate with this spec
    const context = createAIRulesContext('authFeaturePR');
    // Add spec to context as expected by rules gate
    context.spec = realSpec;
    
    try {
      const result = await runRulesGate(context, rulesGateConfig);
      
      // If rule_file is working, we shouldn't get no_rule_file
      if (result.neutral_reason === 'no_rule_file') {
        console.log('🚨 TEST: Still getting no_rule_file with real spec!');
        console.log('🚨 TEST: Result:', JSON.stringify(result, null, 2));
      }
      
      // The result should not be no_rule_file if rule_file field exists
      assert.notStrictEqual(result.neutral_reason, 'no_rule_file', 'Should not return no_rule_file with proper config');
      
    } catch (error) {
      // This is fine - we expect errors from missing AI provider, etc.
      console.log('🔍 TEST: Expected error (no AI provider):', error.message);
      assert.ok(error.message.includes('not found') || error.message.includes('AI') || error.message.includes('ENOENT'), 'Should fail on AI or file, not config');
    }
  });

  test('test_config_extraction_directly', () => {
    // Test the exact config extraction logic in isolation
    const realRepoSpecContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const realSpec = yaml.load(realRepoSpecContent);
    
    // This is the exact same logic as in the rules gate
    const gateConfig = realSpec.gates?.find(g => g.id === 'rules')?.with || {};
    
    console.log('🔍 TEST: Direct extraction result:', JSON.stringify(gateConfig, null, 2));
    
    // Test the new single rule file logic
    const ruleFile = gateConfig.rule_file;
    console.log('🔍 TEST: Rule file after processing:', ruleFile);
    
    assert.ok(gateConfig.rule_file, 'Config should have rule_file field');
    assert.strictEqual(ruleFile, 'goal-alignment.yaml', 'Should extract goal-alignment.yaml');
    assert.strictEqual(typeof ruleFile, 'string', 'Rule file should be a string');
  });

  test('compare_fixture_vs_real_spec', () => {
    // Compare what tests use vs what real spec has
    const realRepoSpecContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const realSpec = yaml.load(realRepoSpecContent);
    
    const testFixtureSpec = yaml.load(`schema_version: '0.1.2'
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
      rule_file: goal-alignment.yaml`);

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
    
    // Both should have rule_file
    assert.ok(realConfig.rule_file, 'Real config should have rule_file');
    assert.ok(testConfig.rule_file, 'Test config should have rule_file');
    
    assert.deepStrictEqual(realConfig.rule_file, testConfig.rule_file, 'Rule files should match');
  });
});