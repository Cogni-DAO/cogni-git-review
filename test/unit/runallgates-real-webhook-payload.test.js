/**
 * Test runAllGates with real GitHub webhook payload
 * Validates that the core gate orchestrator works with authentic webhook data
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { runAllGates } from '../../src/gates/index.js';

test('runAllGates processes real GitHub webhook payload without errors', async () => {
  // Load real webhook fixture  
  const fixturePath = 'fixtures/github/pull_request/pull_request.opened.json';
  const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf8'));
  
  // Decode the real GitHub payload
  const webhookPayload = JSON.parse(Buffer.from(fixtureData.body_raw_base64, 'base64').toString());
  
  // Verify this is the payload we expect
  assert.strictEqual(webhookPayload.action, 'opened');
  assert.strictEqual(webhookPayload.pull_request.number, 315);
  assert.strictEqual(webhookPayload.repository.full_name, 'derekg1729/test-repo');
  
  // Create BaseContext with real payload + minimal mocks (what Probot provides)
  const baseContext = {
    payload: webhookPayload, // Real GitHub webhook payload
    repo: (options = {}) => ({ 
      owner: 'derekg1729', 
      repo: 'test-repo', 
      ...options 
    }),
    vcs: {
      // Minimal mocks for required methods
      config: { get: async () => ({ config: null }) },
      pulls: { 
        get: async () => ({ data: webhookPayload.pull_request }),
        listFiles: async () => ({ data: [] })
      },
      repos: {
        compareCommits: async () => ({ data: { files: [] } }),
        getContent: async () => ({ data: { content: 'bW9jay1jb250ZW50' } }) // base64 'mock-content'
      },
      checks: { create: async (params) => ({ data: { id: 123, html_url: 'https://mock.url' } }) },
      issues: { createComment: async () => ({ data: { id: 456 } }) }
    },
    log: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      child: (meta) => ({
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        child: () => ({ info: () => {}, error: () => {} })
      })
    }
  };

  // Extract PR from payload (what current index.js does)
  const pr = webhookPayload.pull_request;
  
  // Empty spec for testing (no gates = neutral result)
  const spec = {
    gates: [],
    fail_on_error: false,
    _hash: 'test-hash-step2'
  };

  // Mock logger compatible with current code  
  const logger = {
    info: () => {},
    error: () => {},
    child: (meta) => ({
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    })
  };

  // THE KEY TEST: This should work without throwing errors
  const result = await runAllGates(baseContext, pr, spec, logger);

  // Basic result validation - proves the interface works
  assert.ok(result, 'runAllGates returns result');
  assert.strictEqual(typeof result.overall_status, 'string', 'has overall_status string');
  assert.ok(Array.isArray(result.gates), 'has gates array'); 
  assert.ok(typeof result.duration_ms === 'number', 'has duration_ms number');

  // Verify context was enhanced (what runAllGates does internally)
  assert.ok(baseContext.pr, 'context.pr was added');
  assert.strictEqual(baseContext.pr.number, 315, 'context.pr has correct number');
  assert.ok(baseContext.spec, 'context.spec was added');
  assert.strictEqual(typeof baseContext.annotation_budget, 'number', 'context.annotation_budget was added');
  assert.ok(baseContext.idempotency_key, 'context.idempotency_key was added');

  console.log('✅ VALIDATED: runAllGates works with real GitHub webhook payload');
  console.log(`   - Action: ${webhookPayload.action}`);  
  console.log(`   - PR: #${pr.number} on ${webhookPayload.repository.full_name}`);
  console.log(`   - Result: ${result.overall_status} (${result.gates.length} gates, ${result.duration_ms}ms)`);
});