import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { evaluateGoalDeclaration } from '../../src/gates/cogni/goal-declaration-stub.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';

describe('Goal Declaration Stub Gate', () => {
  test('passes when repo spec has goals defined', async () => {
    // Use DRY fixture that has goals
    const specWithGoals = {
      intent: {
        goals: ['Basic project functionality'],
        non_goals: ['Complex features']
      }
    };

    const result = await evaluateGoalDeclaration(null, null, specWithGoals);

    assert.strictEqual(result.violations.length, 0, 'Should have no violations');
    assert.strictEqual(result.oversize, false, 'Should not be oversize');
    assert.strictEqual(result.stats.repo_goals_count, 1, 'Should count 1 goal');
    assert.deepStrictEqual(result.stats.repo_goals, ['Basic project functionality']);
  });

  test('fails when repo spec has no goals defined', async () => {
    const specWithoutGoals = {
      intent: {
        non_goals: ['Something we do not do']
        // goals missing
      }
    };

    const result = await evaluateGoalDeclaration(null, null, specWithoutGoals);

    assert.strictEqual(result.violations.length, 1, 'Should have 1 violation');
    assert.strictEqual(result.violations[0].rule, 'repo_has_no_goals');
    assert.strictEqual(result.violations[0].actual, 'No goals in repo spec');
    assert.strictEqual(result.stats.repo_goals_count, 0);
  });

  test('fails when repo spec has empty goals array', async () => {
    const specWithEmptyGoals = {
      intent: {
        goals: [], // Empty array
        non_goals: ['Something']
      }
    };

    const result = await evaluateGoalDeclaration(null, null, specWithEmptyGoals);

    assert.strictEqual(result.violations.length, 1, 'Should fail on empty goals array');
    assert.strictEqual(result.stats.repo_goals_count, 0);
  });

  test('passes when repo spec has multiple goals', async () => {
    const specWithMultipleGoals = {
      intent: {
        goals: ['Primary goal', 'Secondary goal', 'Third goal']
      }
    };

    const result = await evaluateGoalDeclaration(null, null, specWithMultipleGoals);

    assert.strictEqual(result.violations.length, 0, 'Should pass with multiple goals');
    assert.strictEqual(result.stats.repo_goals_count, 3);
    assert.deepStrictEqual(result.stats.repo_goals, ['Primary goal', 'Secondary goal', 'Third goal']);
  });

  test('handles missing intent section', async () => {
    const specWithoutIntent = {
      gates: {
        review_limits: { max_changed_files: 10 }
      }
      // intent missing entirely
    };

    const result = await evaluateGoalDeclaration(null, null, specWithoutIntent);

    assert.strictEqual(result.violations.length, 1, 'Should fail when intent missing');
    assert.strictEqual(result.stats.repo_goals_count, 0);
  });

  test('handles null spec gracefully', async () => {
    // Pass null spec - this should be treated as missing goals
    const result = await evaluateGoalDeclaration(null, null, null);

    assert.strictEqual(result.violations.length, 1, 'Should fail when spec is null');
    assert.strictEqual(result.violations[0].rule, 'repo_has_no_goals');
    assert.strictEqual(result.oversize, false, 'Should not be oversize for null spec');
    assert.strictEqual(result.stats.repo_goals_count, 0);
  });
});