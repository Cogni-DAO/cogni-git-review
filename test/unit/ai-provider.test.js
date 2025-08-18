/**
 * Contract tests for AI Provider - Single Entrypoint  
 * Tests the review() function with deterministic fixtures
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as aiProvider from '../../src/ai/provider.js';
import prAligned from '../fixtures/ai/pr-aligned.json' with { type: 'json' };
import prScopeCreep from '../fixtures/ai/pr-scope-creep.json' with { type: 'json' };

describe('AI Provider Contract Tests', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('review() function contract', () => {
    it('should return valid structure for aligned PR', async () => {
      const input = {
        goals: prAligned.spec.intent.goals,
        non_goals: prAligned.spec.intent.non_goals,
        pr: prAligned.pr,
        diffSummary: `${prAligned.pr.changed_files.length} files changed`,
        rule: { id: 'goal-alignment', severity: 'error', success_criteria: { metric: 'score', threshold: 0.7 } }
      };

      const result = await aiProvider.review(input);

      // Contract validation
      assert(result, 'Result should be defined');
      assert.strictEqual(typeof result.verdict, 'string');
      assert(['success', 'failure', 'neutral'].includes(result.verdict));
      assert(Array.isArray(result.annotations));
      assert(Array.isArray(result.violations));
      assert.strictEqual(typeof result.provenance, 'object');
      assert.strictEqual(typeof result.provenance.runId, 'string');
      assert.strictEqual(typeof result.provenance.durationMs, 'number');
    });

    it('should handle complex PR input without crashing', async () => {
      const input = {
        goals: prScopeCreep.spec.intent.goals,
        non_goals: prScopeCreep.spec.intent.non_goals,
        pr: prScopeCreep.pr,
        diffSummary: `${prScopeCreep.pr.changed_files.length} files changed, ML components added`,
        rule: { id: 'goal-alignment', severity: 'error', success_criteria: { metric: 'score', threshold: 0.7 } }
      };

      const result = await aiProvider.review(input);

      // Provider is now a dumb pipe - LangGraph workflow determines verdict
      // With mock workflow, expect neutral or any valid verdict
      assert(['success', 'failure', 'neutral'].includes(result.verdict));
      assert(Array.isArray(result.violations));
      assert(result.provenance.runId.startsWith('ai-'));
    });

    it('should be deterministic - same input produces same output', async () => {
      const input = {
        goals: prAligned.spec.intent.goals,
        non_goals: prAligned.spec.intent.non_goals,
        pr: prAligned.pr,
        diffSummary: 'deterministic test input',
        rule: { id: 'goal-alignment', severity: 'error', success_criteria: { metric: 'score', threshold: 0.7 } }
      };

      const result1 = await aiProvider.review(input);
      const result2 = await aiProvider.review(input);

      // Results should be structurally similar (allowing for different runIds)
      assert.strictEqual(result1.verdict, result2.verdict);
      assert.strictEqual(result1.violations.length, result2.violations.length);
      if (result1.violations.length > 0) {
        assert.strictEqual(result1.violations[0].code, result2.violations[0].code);
      }
    });

    it('should handle timeout gracefully', async () => {
      const input = {
        goals: ['test goal'],
        non_goals: [],
        pr: { title: 'test', body: 'test', changed_files: [] },
        diffSummary: 'test',
        rule: { id: 'test', severity: 'error', success_criteria: { metric: 'score', threshold: 0.7 } }
      };

      const result = await aiProvider.review(input, { timeoutMs: 1 }); // Very short timeout

      // Should return valid verdict, not crash (mock workflow completes quickly)
      assert(['success', 'neutral', 'failure'].includes(result.verdict));
      assert.strictEqual(typeof result.provenance.durationMs, 'number');
      assert(result.provenance.durationMs >= 0);
    });

    it('should handle missing input gracefully', async () => {
      const result1 = await aiProvider.review(null);
      const result2 = await aiProvider.review({});
      const result3 = await aiProvider.review({ goals: [] });

      [result1, result2, result3].forEach(result => {
        assert.strictEqual(result.verdict, 'neutral');
        assert(result.violations.length > 0);
        assert.strictEqual(result.violations[0].code, 'invalid_input');
      });
    });

    it('should respect AI_NEUTRAL_ON_ERROR environment variable', async () => {
      process.env.AI_NEUTRAL_ON_ERROR = 'false';

      // Force an error condition
      const result = await aiProvider.review({
        goals: null, // Invalid input
        pr: null
      });

      // With AI_NEUTRAL_ON_ERROR=false, should still be neutral for invalid input
      assert.strictEqual(result.verdict, 'neutral');
      assert.strictEqual(result.violations[0].code, 'invalid_input');
    });
  });

  describe('provenance tracking', () => {
    it('should include required provenance fields', async () => {
      const input = {
        goals: ['test'],
        non_goals: [],
        pr: { title: 'test', changed_files: [] },
        diffSummary: 'test',
        rule: { id: 'test', severity: 'error', success_criteria: { metric: 'score', threshold: 0.7 } }
      };

      const result = await aiProvider.review(input);

      assert(result.provenance);
      assert.strictEqual(typeof result.provenance.runId, 'string');
      assert(result.provenance.runId.startsWith('ai-'));
      assert.strictEqual(typeof result.provenance.durationMs, 'number');
      assert(result.provenance.durationMs >= 0);
      assert.strictEqual(typeof result.provenance.providerVersion, 'string');
    });

    it('should generate unique run IDs', async () => {
      const input = {
        goals: ['test'],
        non_goals: [],
        pr: { title: 'test', changed_files: [] },
        diffSummary: 'test',
        rule: { id: 'test', severity: 'error', success_criteria: { metric: 'score', threshold: 0.7 } }
      };

      const result1 = await aiProvider.review(input);
      const result2 = await aiProvider.review(input);

      assert.notStrictEqual(result1.provenance.runId, result2.provenance.runId);
    });
  });
});