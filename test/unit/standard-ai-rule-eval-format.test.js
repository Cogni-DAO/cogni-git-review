import { test } from 'node:test';
import assert from 'node:assert';
import { assertRuleSchema, assertProviderResultShape } from '../../src/schemas/standard-ai-rule-eval-format.js';
import { VALID_RULE_WITH_THRESHOLD, MATRIX_RULE_BASIC, RULE_MISSING_SUCCESS_CRITERIA } from '../fixtures/ai-rules.js';

test('assertRuleSchema: matrix format rule passes', () => {
  assert.doesNotThrow(() => assertRuleSchema(MATRIX_RULE_BASIC));
});

test('assertRuleSchema: legacy threshold format fails', () => {
  assert.throws(
    () => assertRuleSchema(VALID_RULE_WITH_THRESHOLD),
    (error) => error.message.includes('uses legacy format')
  );
});

test('assertRuleSchema: missing success_criteria fails', () => {
  assert.throws(
    () => assertRuleSchema(RULE_MISSING_SUCCESS_CRITERIA),
    (error) => error.message.includes('missing success_criteria')
  );
});

test('assertProviderResultShape: valid standard_ai_rule_eval passes', () => {
  const validResult = {
    metrics: { score: 0.85 },
    observations: ['Good alignment'],
    summary: 'Test passed',
    provenance: { runId: 'test-123' }
  };
  assert.doesNotThrow(() => assertProviderResultShape(validResult));
});

test('assertProviderResultShape: missing metrics fails', () => {
  const invalidResult = { observations: [] };
  assert.throws(
    () => assertProviderResultShape(invalidResult),
    (error) => error.message.includes('missing required "metrics" object')
  );
});

test('assertProviderResultShape: missing observations fails', () => {
  const invalidResult = { metrics: { score: 0.8 } };
  assert.throws(
    () => assertProviderResultShape(invalidResult),
    (error) => error.message.includes('missing required "observations" array')
  );
});