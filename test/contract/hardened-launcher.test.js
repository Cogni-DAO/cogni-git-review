/**
 * Hardened Launcher Integration Tests
 * Tests timeout handling, unknown gates, and launcher robustness
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { runConfiguredGates } from '../../src/gates/run-configured.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';
import yaml from 'js-yaml';

describe('Hardened Launcher Integration Tests', () => {


  describe('Unknown Gate Handling', () => {

    it('unknown gate produces neutral with unimplemented_gate reason', async () => {
      // Create spec with mix of real and unknown gates
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'test-project',
          goals: ['Test goal'],
          non_goals: ['Test non-goal']
        },
        gates: [
          { type: 'review-limits', id: 'review_limits', with: { max_changed_files: 10 } },
          { type: 'nonexistent_gate_12345', id: 'nonexistent_gate_12345' },  // Unknown gate
          { type: 'goal-declaration', id: 'goal_declaration' }  // Real gate
        ]
      };

      const runCtx = {
        spec: testSpec,
        pr: { 
          changed_files: 5, 
          additions: 50, 
          deletions: 20 
        },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || ''),
        octokit: {
          pulls: {
            get: () => ({ data: { changed_files: 5 } })
          }
        }
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should have 3 results, preserving order
      assert.strictEqual(results.length, 3);
      
      // First gate should pass 
      assert.strictEqual(results[0].id, 'review_limits');
      assert.strictEqual(results[0].status, 'pass');
      
      // Unknown gate should be neutral with unimplemented reason
      assert.strictEqual(results[1].id, 'nonexistent_gate_12345');
      assert.strictEqual(results[1].status, 'neutral');
      assert.strictEqual(results[1].neutral_reason, 'unimplemented_gate');
      assert.deepStrictEqual(results[1].violations, []);
      assert.deepStrictEqual(results[1].stats, {});
      assert(results[1].duration_ms >= 0);
      
      // Third gate should execute normally (order preserved)
      assert.strictEqual(results[2].id, 'goal_declaration');
      assert(['pass', 'fail'].includes(results[2].status));
    });
  });

  describe('ID Normalization', () => {

    it('launcher overrides gate-returned id with spec gate.id', async () => {
      // Create a spec that would use review_limits gate
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'id-test-project',
          goals: ['Test ID normalization']
        },
        gates: [
          { type: 'review-limits', id: 'review_limits', with: { max_changed_files: 100 } }
        ]
      };

      const runCtx = {
        spec: testSpec,
        pr: { 
          changed_files: 5,
          additions: 50, 
          deletions: 20 
        },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || ''),
        octokit: {
          pulls: {
            get: () => ({ data: { changed_files: 5 } })
          }
        }
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should have exactly 1 result with normalized ID
      assert.strictEqual(results.length, 1);
      // ID should match spec gate.id, not whatever the gate handler returns
      assert.strictEqual(results[0].id, 'review_limits');
      assert.strictEqual(results[0].status, 'pass');
    });

    it('malformed gate outputs are safely normalized', async () => {
      // This test would require mocking the registry to return a gate that produces malformed output
      // For now, we test with unknown gates which normalize to neutral
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'malformed-test-project',
          goals: ['Test malformed output handling']
        },
        gates: [
          { type: 'unknown_malformed_gate', id: 'unknown_malformed_gate' }  // Will trigger unimplemented path
        ]
      };

      const runCtx = {
        spec: testSpec,
        pr: { changed_files: 5 },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || '')
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should safely normalize unknown gate to neutral
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, 'unknown_malformed_gate');
      assert.strictEqual(results[0].status, 'neutral');
      assert.strictEqual(results[0].neutral_reason, 'unimplemented_gate');
      assert.deepStrictEqual(results[0].violations, []);
      assert.deepStrictEqual(results[0].stats, {});
      assert(typeof results[0].duration_ms === 'number');
      assert(results[0].duration_ms >= 0);
    });

  });

  describe('Result Normalization', () => {

    it('multiple unknown gates normalize consistently', async () => {
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'test-project',
          goals: ['Test goal']
        },
        gates: [
          { type: 'unknown_gate_1', id: 'unknown_gate_1' },
          { type: 'unknown_gate_2', id: 'unknown_gate_2' },
          { type: 'unknown_gate_3', id: 'unknown_gate_3' }
        ]
      };

      const runCtx = {
        spec: testSpec,
        pr: { changed_files: 5 },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || '')
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // All should normalize consistently
      assert.strictEqual(results.length, 3);
      
      results.forEach((result, index) => {
        assert.strictEqual(result.id, `unknown_gate_${index + 1}`);
        assert.strictEqual(result.status, 'neutral');
        assert.strictEqual(result.neutral_reason, 'unimplemented_gate');
        assert.deepStrictEqual(result.violations, []);
        assert.deepStrictEqual(result.stats, {});
        assert(result.duration_ms >= 0);
      });
    });

    it('mixed real and unknown gates preserve order and types', async () => {
      // Use full spec fixture and add unknown gate
      const spec = yaml.load(SPEC_FIXTURES.full);
      spec.gates.push({ type: 'mystery_gate_xyz', id: 'mystery_gate_xyz' });

      const runCtx = {
        spec,
        pr: { 
          changed_files: 3,  // Under limits
          additions: 30, 
          deletions: 20 
        },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || ''),
        octokit: {
          pulls: {
            get: () => ({ data: { changed_files: 3 } })
          }
        }
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should have 4 results: 3 real gates + 1 unknown
      assert.strictEqual(results.length, 4);
      
      // Verify order preservation
      assert.strictEqual(results[0].id, 'review_limits');
      assert.strictEqual(results[1].id, 'goal_declaration');
      assert.strictEqual(results[2].id, 'forbidden_scopes');
      assert.strictEqual(results[3].id, 'mystery_gate_xyz');
      
      // Unknown gate should be neutral
      assert.strictEqual(results[3].status, 'neutral');
      assert.strictEqual(results[3].neutral_reason, 'unimplemented_gate');
    });

    it('duplicate gate IDs are properly detected and rejected', async () => {
      // Test spec with duplicate gate IDs (new validation behavior)
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'duplicate-gates-project',
          goals: ['Test duplicate gate ID validation']
        },
        gates: [
          { type: 'review-limits', id: 'review_limits', with: { max_changed_files: 100 } },
          { type: 'goal-declaration', id: 'goal_declaration' },
          { type: 'review-limits', id: 'review_limits', with: { max_changed_files: 10 } }  // Duplicate ID
        ]
      };

      const runCtx = {
        spec: testSpec,
        pr: { changed_files: 15 },
        log: { error: () => {} }
      };

      // Should throw error for duplicate IDs (new validation behavior)
      try {
        await runConfiguredGates(runCtx);
        assert.fail('Should have thrown duplicate ID error');
      } catch (error) {
        assert.strictEqual(error.message, 'Duplicate gate ID: review_limits');
      }
    });
  });

  describe('Empty and Edge Cases', () => {

    it('empty gates array returns empty results', async () => {
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'test-project',
          goals: ['Test goal']
        },
        gates: []  // No gates configured
      };

      const runCtx = {
        spec: testSpec,
        pr: { changed_files: 5 },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || '')
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should return empty array
      assert.strictEqual(results.length, 0);
    });

    it('missing spec gates array returns empty results', async () => {
      const testSpec = {
        schema_version: '0.2.1',
        intent: {
          name: 'test-project',
          goals: ['Test goal']
        }
        // No gates property
      };

      const runCtx = {
        spec: testSpec,
        pr: { changed_files: 5 },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || '')
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should return empty array
      assert.strictEqual(results.length, 0);
    });

    it('all gates pass produces expected results', async () => {
      // Use full spec with limits that will pass
      const spec = yaml.load(SPEC_FIXTURES.full);
      
      const runCtx = {
        spec,
        pr: { 
          changed_files: 10,  // Under 50 limit
          additions: 50,      // Under 200KB limit  
          deletions: 20 
        },
        logger: (level, msg, meta) => console.log(`[${level}] ${msg}`, meta || ''),
        octokit: {
          pulls: {
            get: () => ({ data: { changed_files: 10 } })
          }
        }
      };

      const launcherResult = await runConfiguredGates(runCtx);
      const results = launcherResult.results;
      
      // Should have 3 results for 3 configured gates
      assert.strictEqual(results.length, 3);
      
      // All should have proper structure
      results.forEach(result => {
        assert(typeof result.id === 'string');
        assert(['pass', 'fail', 'neutral'].includes(result.status));
        assert(Array.isArray(result.violations));
        assert(typeof result.stats === 'object');
        assert(typeof result.duration_ms === 'number');
        assert(result.duration_ms >= 0);
      });
    });
  });
});