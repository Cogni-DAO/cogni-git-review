import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { evaluateForbiddenScopes } from '../../src/gates/cogni/forbidden-scopes-stub.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';

describe('Forbidden Scopes Stub Gate', () => {
  test('passes when repo spec has non_goals defined', async () => {
    const specWithNonGoals = {
      intent: {
        goals: ['Something we do'],
        non_goals: ['Complex features']
      }
    };

    const result = await evaluateForbiddenScopes(null, null, specWithNonGoals);

    assert.strictEqual(result.violations.length, 0, 'Should have no violations');
    assert.strictEqual(result.oversize, false, 'Should not be oversize');
    assert.strictEqual(result.stats.repo_non_goals_count, 1, 'Should count 1 non_goal');
    assert.deepStrictEqual(result.stats.repo_non_goals, ['Complex features']);
  });

  test('fails when repo spec has no non_goals defined', async () => {
    const specWithoutNonGoals = {
      intent: {
        goals: ['Something we do']
        // non_goals missing
      }
    };

    const result = await evaluateForbiddenScopes(null, null, specWithoutNonGoals);

    assert.strictEqual(result.violations.length, 1, 'Should have 1 violation');
    assert.strictEqual(result.violations[0].rule, 'repo_has_no_non_goals');
    assert.strictEqual(result.violations[0].actual, 'No non_goals in repo spec');
    assert.strictEqual(result.stats.repo_non_goals_count, 0);
  });

  test('fails when repo spec has empty non_goals array', async () => {
    const specWithEmptyNonGoals = {
      intent: {
        goals: ['Something'],
        non_goals: [] // Empty array
      }
    };

    const result = await evaluateForbiddenScopes(null, null, specWithEmptyNonGoals);

    assert.strictEqual(result.violations.length, 1, 'Should fail on empty non_goals array');
    assert.strictEqual(result.stats.repo_non_goals_count, 0);
  });

  test('passes when repo spec has multiple non_goals', async () => {
    const specWithMultipleNonGoals = {
      intent: {
        goals: ['Primary goal'],
        non_goals: ['Heavy scanning', 'Secrets retention', 'External integrations']
      }
    };

    const result = await evaluateForbiddenScopes(null, null, specWithMultipleNonGoals);

    assert.strictEqual(result.violations.length, 0, 'Should pass with multiple non_goals');
    assert.strictEqual(result.stats.repo_non_goals_count, 3);
    assert.deepStrictEqual(result.stats.repo_non_goals, ['Heavy scanning', 'Secrets retention', 'External integrations']);
  });

  test('handles missing intent section', async () => {
    const specWithoutIntent = {
      gates: {
        review_limits: { max_changed_files: 10 }
      }
      // intent missing entirely
    };

    const result = await evaluateForbiddenScopes(null, null, specWithoutIntent);

    assert.strictEqual(result.violations.length, 1, 'Should fail when intent missing');
    assert.strictEqual(result.stats.repo_non_goals_count, 0);
  });

  test('handles null spec gracefully', async () => {
    // Pass null spec - this should be treated as missing non_goals
    const result = await evaluateForbiddenScopes(null, null, null);

    assert.strictEqual(result.violations.length, 1, 'Should fail when spec is null');
    assert.strictEqual(result.violations[0].rule, 'repo_has_no_non_goals');
    assert.strictEqual(result.oversize, false, 'Should not be oversize for null spec');
    assert.strictEqual(result.stats.repo_non_goals_count, 0);
  });
});