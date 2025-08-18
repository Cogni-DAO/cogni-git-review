/**
 * Debug Test for Webhook Spec Loading vs File Loading
 * 
 * Tests the difference between loading spec from GitHub API vs local filesystem
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import yaml from 'js-yaml';
import fs from 'fs';
import { run as runRulesGate } from '../../src/gates/cogni/rules.js';
import { createAIRulesContext } from '../fixtures/repo-specs.js';

describe('Webhook Spec Debug Tests', () => {

  test('compare_github_api_vs_filesystem_spec', async () => {
    // 1. Load from filesystem (like our working test)
    const filesystemContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const filesystemSpec = yaml.load(filesystemContent);
    
    // 2. Simulate GitHub API loading (base64 encoded like webhook does)
    const base64Content = Buffer.from(filesystemContent).toString('base64');
    const githubApiContent = Buffer.from(base64Content, 'base64').toString('utf8');
    const githubApiSpec = yaml.load(githubApiContent);
    
    console.log('🔍 TEST: Filesystem spec gates:', JSON.stringify(filesystemSpec.gates, null, 2));
    console.log('🔍 TEST: GitHub API spec gates:', JSON.stringify(githubApiSpec.gates, null, 2));
    
    // Extract configs
    const filesystemConfig = filesystemSpec.gates?.find(g => g.id === 'rules')?.with || {};
    const githubApiConfig = githubApiSpec.gates?.find(g => g.id === 'rules')?.with || {};
    
    console.log('🔍 TEST: Filesystem config:', JSON.stringify(filesystemConfig, null, 2));
    console.log('🔍 TEST: GitHub API config:', JSON.stringify(githubApiConfig, null, 2));
    
    // They should be identical
    assert.deepStrictEqual(filesystemConfig, githubApiConfig, 'Configs should be identical');
    
    // Both should have enable
    assert.ok(filesystemConfig.enable, 'Filesystem config should have enable');
    assert.ok(githubApiConfig.enable, 'GitHub API config should have enable');
  });

  test('test_gate_with_simulated_webhook_spec', async () => {
    // Simulate exact webhook loading process
    const filesystemContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    const base64Content = Buffer.from(filesystemContent).toString('base64');
    const webhookContent = Buffer.from(base64Content, 'base64').toString('utf8');
    const webhookSpec = yaml.load(webhookContent);
    
    console.log('🔍 TEST: Webhook spec structure:', Object.keys(webhookSpec));
    
    const context = createAIRulesContext('authFeaturePR');
    
    try {
      const result = await runRulesGate(context, webhookSpec);
      
      console.log('🔍 TEST: Gate result with webhook spec:', JSON.stringify({
        status: result.status,
        neutral_reason: result.neutral_reason,
        stats: result.stats
      }, null, 2));
      
      // Should not be no_rules if we have proper webhook spec
      if (result.neutral_reason === 'no_rules') {
        console.log('🚨 TEST: REPRODUCED THE BUG! Webhook spec gives no_rules');
      }
      
    } catch (error) {
      console.log('🔍 TEST: Error with webhook spec:', error.message);
    }
  });

  test('check_yaml_parsing_edge_cases', () => {
    // Test different YAML parsing scenarios
    const filesystemContent = fs.readFileSync('.cogni/repo-spec.yaml', 'utf-8');
    
    // Parse with different methods
    const directParse = yaml.load(filesystemContent);
    const bufferedParse = yaml.load(Buffer.from(filesystemContent).toString('utf8'));
    const base64Parse = yaml.load(Buffer.from(Buffer.from(filesystemContent).toString('base64'), 'base64').toString('utf8'));
    
    const directConfig = directParse.gates?.find(g => g.id === 'rules')?.with || {};
    const bufferedConfig = bufferedParse.gates?.find(g => g.id === 'rules')?.with || {};
    const base64Config = base64Parse.gates?.find(g => g.id === 'rules')?.with || {};
    
    console.log('🔍 TEST: Direct parse enable:', directConfig.enable);
    console.log('🔍 TEST: Buffered parse enable:', bufferedConfig.enable);
    console.log('🔍 TEST: Base64 parse enable:', base64Config.enable);
    
    // All should have the same enable field
    assert.deepStrictEqual(directConfig.enable, bufferedConfig.enable, 'Direct vs buffered should match');
    assert.deepStrictEqual(directConfig.enable, base64Config.enable, 'Direct vs base64 should match');
    
    assert.ok(directConfig.enable, 'Direct parse should have enable');
    assert.ok(bufferedConfig.enable, 'Buffered parse should have enable');
    assert.ok(base64Config.enable, 'Base64 parse should have enable');
  });
});