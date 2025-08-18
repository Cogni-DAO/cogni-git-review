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

  test('rules_gate_no_rules - zero valid rules → neutral', async () => {
    // Use existing no-valid-rules fixture - this should work without AI provider
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesMvpNoValidRules);
    
    const result = await runRulesGate(context, spec);
    
    assert.strictEqual(result.id, 'rules', 'Should have correct gate ID');
    assert.strictEqual(result.conclusion, 'neutral', 'No rules should result in neutral');
    assert.ok(result.summary.includes('No rules') || result.summary.includes('no errors') || result.summary.includes('No valid'), 'Should indicate no rules');
    assert.ok(typeof result.duration_ms === 'number', 'Should include duration');
  });

  test('rules_gate_invalid_directory - missing rules dir → neutral', async () => {
    // Test with invalid directory - should not require AI provider
    const context = createAIRulesContext('authFeaturePR');
    const invalidSpec = yaml.load(`schema_version: '0.2.1'
intent:
  name: test-project
  goals: ['Test goal']
  non_goals: ['Test non-goal']
gates:
  - id: rules
    with:
      rules_dir: /does/not/exist
      enable: [goal-alignment.yaml]
      neutral_on_error: true`);

    const result = await runRulesGate(context, invalidSpec);
    
    assert.strictEqual(result.conclusion, 'neutral', 'Invalid directory should result in neutral');
    assert.ok(result.summary.includes('No rules') || result.summary.includes('no errors'), 'Should indicate no rules');
  });

  test('rules_gate_basic_structure - verify gate structure without AI calls', async () => {
    setupTestRule();
    
    try {
      // Set up mock environment to bypass AI calls
      const originalEnv = process.env.AI_NEUTRAL_ON_ERROR;
      process.env.AI_NEUTRAL_ON_ERROR = 'true';
      
      const context = createAIRulesContext('authFeaturePR');
      const spec = yaml.load(SPEC_FIXTURES.rulesMvpIntegration.replace('.cogni/rules', testRulesDir));
      
      const result = await runRulesGate(context, spec);
      
      // Should have proper structure regardless of AI provider result
      assert.strictEqual(result.id, 'rules', 'Should have correct gate ID');
      assert.ok(['success', 'failure', 'neutral'].includes(result.conclusion), 'Should have valid conclusion');
      assert.ok(typeof result.title === 'string', 'Should have title');
      assert.ok(typeof result.summary === 'string', 'Should have summary');
      assert.ok(typeof result.text === 'string', 'Should have text');
      assert.ok(Array.isArray(result.annotations), 'Should have annotations array');
      assert.ok(typeof result.duration_ms === 'number', 'Should include duration');
      
      // Restore environment
      if (originalEnv) {
        process.env.AI_NEUTRAL_ON_ERROR = originalEnv;
      } else {
        delete process.env.AI_NEUTRAL_ON_ERROR;
      }
      
    } finally {
      cleanupTestRule();
    }
  });

  test('rules_gate_config_parsing - verify gate configuration parsing', async () => {
    const context = createAIRulesContext('authFeaturePR');
    const spec = yaml.load(SPEC_FIXTURES.rulesMvpIntegration);
    
    // This should work even if the directory doesn't exist
    const result = await runRulesGate(context, spec);
    
    // Should handle config gracefully
    assert.ok(result.id === 'rules', 'Should parse gate ID correctly');
    assert.ok(typeof result.duration_ms === 'number', 'Should track execution time');
  });
});