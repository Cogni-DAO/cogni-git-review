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
    
    // Find the first ai-rule gate config (updated for new type+id system)
    const aiRuleGate = realSpec.gates?.find(g => g.type === 'ai-rule');
    const rulesGateConfig = aiRuleGate?.with || {};
    console.log('🔍 TEST: AI rule gate config:', JSON.stringify(rulesGateConfig, null, 2));
    console.log('🔍 TEST: Rule file field:', rulesGateConfig.rule_file);
    console.log('🔍 TEST: Rule file type:', typeof rulesGateConfig.rule_file);
    
    // This should show the rule file from real spec
    assert.ok(rulesGateConfig.rule_file, 'Should have rule_file field');
    assert.ok(rulesGateConfig.rule_file.endsWith('.yaml'), 'Should have .yaml rule file');
    
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
    
    // This is the exact same logic as in the rules gate (updated for type+id system)
    const gateConfig = realSpec.gates?.find(g => g.type === 'ai-rule')?.with || {};
    
    console.log('🔍 TEST: Direct extraction result:', JSON.stringify(gateConfig, null, 2));
    
    // Test the new single rule file logic
    const ruleFile = gateConfig.rule_file;
    console.log('🔍 TEST: Rule file after processing:', ruleFile);
    
    assert.ok(gateConfig.rule_file, 'Config should have rule_file field');
    assert.ok(ruleFile.endsWith('.yaml'), 'Should extract a .yaml rule file');
    assert.strictEqual(typeof ruleFile, 'string', 'Rule file should be a string');
  });

});