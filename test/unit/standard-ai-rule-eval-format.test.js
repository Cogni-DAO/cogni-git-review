import { test } from 'node:test';
import assert from 'node:assert';
import { assertRuleSchema, assertProviderResult } from '../../src/ai/schemas/validators.js';
// import { VALID_RULE_WITH_THRESHOLD, MATRIX_RULE_BASIC, RULE_MISSING_SUCCESS_CRITERIA } from '../fixtures/ai-rules.js'; // TODO: switch back to fixtures

test('assertRuleSchema: matrix format rule passes', () => {
  const validRule = {
    id: 'matrix-test-rule',
    schema_version: '0.2',
    workflow_id: 'single-statement-evaluation',
    success_criteria: {
      neutral_on_missing_metrics: true,
      require: [
        { metric: 'score', gte: 0.8 }
      ]
    }
  };
  assert.doesNotThrow(() => assertRuleSchema(validRule));
});

test('assertRuleSchema: legacy threshold format fails', () => {
  const legacyRule = {
    id: 'legacy-test',
    schema_version: '0.2',
    workflow_id: 'single-statement-evaluation',
    success_criteria: {
      metric: 'score',
      threshold: 0.8
    }
  };
  assert.throws(
    () => assertRuleSchema(legacyRule),
    (error) => error.message.includes('Rule schema invalid')
  );
});

test('assertRuleSchema: missing success_criteria fails', () => {
  const ruleWithoutCriteria = {
    id: 'no-criteria-test',
    schema_version: '0.2',
    workflow_id: 'single-statement-evaluation'
    // missing success_criteria
  };
  assert.throws(
    () => assertRuleSchema(ruleWithoutCriteria),
    (error) => error.message.includes('Rule schema invalid')
  );
});

test('assertProviderResult: valid standard_ai_rule_eval passes', () => {
  const validResult = {
    metrics: { score: 0.85 },
    observations: ['Good alignment'],
    summary: 'Test passed successfully with good alignment',
    provenance: { 
      runId: 'test-123',
      durationMs: 1500,
      providerVersion: '1.0.0',
      workflowId: 'single-statement-evaluation',
      modelConfig: { provider: 'test', model: 'test-model' }
    }
  };
  assert.doesNotThrow(() => assertProviderResult(validResult));
});

test('assertProviderResult: missing metrics fails', () => {
  const invalidResult = { observations: [] };
  assert.throws(
    () => assertProviderResult(invalidResult),
    (error) => error.message.includes('ProviderResult schema invalid')
  );
});

test('assertProviderResult: missing observations fails', () => {
  const invalidResult = { metrics: { score: 0.8 } };
  assert.throws(
    () => assertProviderResult(invalidResult),
    (error) => error.message.includes('ProviderResult schema invalid')
  );
});