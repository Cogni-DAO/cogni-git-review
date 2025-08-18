/**
 * P0 Tests for Rule Loader - Critical Functionality Validation
 * 
 * These tests validate the core rule loading system that all AI rules depend on.
 * MUST PASS before any integration testing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { loadRules, validateRuleConsistency } from '../../src/rules/loader.js';

// Test rule fixtures following DRY principle
const RULE_FIXTURES = {
  validRule: {
    id: 'test-rule',
    title: 'Test Rule',
    schema_version: '0.1',
    blocking: true,
    selectors: {
      paths: ['src/**'],
      diff_kinds: ['add', 'modify']
    },
    evidence: {
      include: ['diff_summary', 'file_snippets']
    },
    prompt: {
      template: '.cogni/prompts/test.md',
      variables: ['goals', 'non_goals', 'diff_summary', 'file_snippets']
    },
    success_criteria: {
      metric: 'score',
      threshold: 0.7
    }
  },

  duplicateRule1: {
    id: 'duplicate-id',
    title: 'First Rule',
    schema_version: '0.1',
    blocking: true,
    selectors: { paths: ['src/**'], diff_kinds: ['modify'] },
    evidence: { include: ['diff_summary'] },
    prompt: { template: '.cogni/prompts/test.md', variables: ['goals'] },
    success_criteria: { metric: 'score', threshold: 0.5 }
  },

  duplicateRule2: {
    id: 'duplicate-id', // Same ID!
    title: 'Second Rule',
    schema_version: '0.1',
    blocking: false,
    selectors: { paths: ['docs/**'], diff_kinds: ['add'] },
    evidence: { include: ['diff_summary'] },
    prompt: { template: '.cogni/prompts/test2.md', variables: ['goals'] },
    success_criteria: { metric: 'score', threshold: 0.8 }
  },

  invalidVariableRule: {
    id: 'bad-variables',
    title: 'Bad Variables Rule',
    schema_version: '0.1',
    blocking: true,
    selectors: { paths: ['**'], diff_kinds: ['modify'] },
    evidence: { include: ['diff_summary'] },
    prompt: {
      template: '.cogni/prompts/test.md',
      variables: ['goals', 'unsupported_variable', 'file_snippets'] // unsupported_variable is invalid
    },
    success_criteria: { metric: 'score', threshold: 0.5 }
  },

  incompleteRule: {
    // Missing required fields
    title: 'Incomplete Rule'
  }
};

describe('Rule Loader - P0 Critical Tests', () => {
  const testDir = path.join(process.cwd(), 'test-rules-tmp');
  
  // Setup test directory
  function setupTestRules() {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  }
  
  function cleanupTestRules() {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }
  
  function writeTestRule(filename, ruleData) {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, yaml.dump(ruleData));
    return filePath;
  }

  test('loader_valid_rule_passes - Basic YAML→rule loading', async () => {
    setupTestRules();
    
    try {
      writeTestRule('valid-rule.yaml', RULE_FIXTURES.validRule);
      
      // Load rules
      const result = await loadRules({
        rules_dir: testDir,
        enabled: ['valid-rule.yaml'],
        blocking_default: true
      });
      
      // Validate results
      assert.strictEqual(result.rules.length, 1, 'Should load exactly 1 rule');
      assert.strictEqual(result.rules[0].rule_key, 'test-rule', 'Rule key should match id');
      assert.strictEqual(result.rules[0].blocking, true, 'Should preserve blocking flag');
      assert.strictEqual(result.rules[0].title, 'Test Rule', 'Should preserve title');
      assert.strictEqual(result.diagnostics.length, 0, 'Should have no diagnostics for valid rule');
      
    } finally {
      cleanupTestRules();
    }
  });

  test('loader_duplicate_rule_key_rejected - Duplicate detection working', async () => {
    setupTestRules();
    
    try {
      writeTestRule('rule1.yaml', RULE_FIXTURES.duplicateRule1);
      writeTestRule('rule2.yaml', RULE_FIXTURES.duplicateRule2);
      
      // Load rules
      const result = await loadRules({
        rules_dir: testDir,
        enabled: ['rule1.yaml', 'rule2.yaml'],
        blocking_default: true
      });
      
      // Validate rejection
      assert.strictEqual(result.rules.length, 1, 'Should only load first rule');
      assert.strictEqual(result.rules[0].title, 'First Rule', 'Should keep first rule');
      
      // Check diagnostic
      const duplicateError = result.diagnostics.find(d => d.type === 'duplicate_rule_key');
      assert.ok(duplicateError, 'Should have duplicate_rule_key diagnostic');
      assert.strictEqual(duplicateError.severity, 'error', 'Duplicate should be error severity');
      assert.ok(duplicateError.message.includes('duplicate-id'), 'Error should mention rule key');
      
    } finally {
      cleanupTestRules();
    }
  });

  test('loader_unmapped_prompt_variable_fails - Variable validation working', async () => {
    setupTestRules();
    
    try {
      writeTestRule('bad-rule.yaml', RULE_FIXTURES.invalidVariableRule);
      
      // Load rules
      const result = await loadRules({
        rules_dir: testDir,
        enabled: ['bad-rule.yaml'],
        blocking_default: true
      });
      
      // Should fail to load due to schema validation (unsupported_variable not in enum)
      assert.strictEqual(result.rules.length, 0, 'Rule should fail schema validation');
      
      // Should have schema validation error diagnostic
      const schemaError = result.diagnostics.find(d => 
        d.type === 'rule_load_failed' && d.message.includes('Schema validation failed')
      );
      assert.ok(schemaError, 'Should have schema validation error diagnostic');
      
    } finally {
      cleanupTestRules();
    }
  });

  test('loader_zero_rules_diagnostic - Handle zero valid rules case', async () => {
    setupTestRules();
    
    try {
      writeTestRule('invalid.yaml', RULE_FIXTURES.incompleteRule);
      
      // Try to load
      const result = await loadRules({
        rules_dir: testDir,
        enabled: ['invalid.yaml'],
        blocking_default: true
      });
      
      // Validate zero rules result
      assert.strictEqual(result.rules.length, 0, 'Should load zero rules');
      
      const zeroRulesDiagnostic = result.diagnostics.find(d => d.type === 'no_valid_rules');
      assert.ok(zeroRulesDiagnostic, 'Should have no_valid_rules diagnostic');
      assert.strictEqual(zeroRulesDiagnostic.severity, 'warning', 'Should be warning severity');
      
    } finally {
      cleanupTestRules();
    }
  });

  test('loader_missing_directory - Handle missing rules directory gracefully', async () => {
    const nonExistentDir = path.join(process.cwd(), 'does-not-exist');
    
    const result = await loadRules({
      rules_dir: nonExistentDir,
      enabled: ['any-file.yaml'],
      blocking_default: true
    });
    
    assert.strictEqual(result.rules.length, 0, 'Should return zero rules');
    
    const missingDirDiagnostic = result.diagnostics.find(d => d.type === 'directory_missing');
    assert.ok(missingDirDiagnostic, 'Should have directory_missing diagnostic');
    assert.strictEqual(missingDirDiagnostic.severity, 'info', 'Should be info severity');
  });
});