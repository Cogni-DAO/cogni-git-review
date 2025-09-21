/**
 * Goal Declaration Stub Gate - Simple stub that passes if repo spec has goals
 * Part of Cogni Gate Evaluation system (Wave 1 - deterministic stub only)
 */

// Gate registry contract exports  
export const type = 'goal-declaration';

/**
 * Evaluate goal declaration requirement - STUB VERSION
 * Simply passes if repo spec has at least 1 goal defined
 * @param {import('probot').Context} context - Probot context (unused)
 * @param {object} pr - Pull request object from webhook (unused)  
 * @param {object} spec - Repository specification
 * @returns {Promise<{violations: Array, stats: object, oversize: boolean}>}
 */
export async function evaluateGoalDeclaration(context, pr, spec) {
  try {
    const goals = spec?.intent?.goals || [];
    const hasGoals = Array.isArray(goals) && goals.length > 0;
    
    const violations = [];
    
    // Stub logic: fail only if repo spec has no goals defined
    if (!hasGoals) {
      violations.push({
        rule: 'repo_has_no_goals',
        actual: 'No goals in repo spec',
        limit: 'At least 1 goal required',
        observation: 'Repository specification must define at least one goal in intent.goals[]'
      });
    }
    
    return {
      violations,
      stats: {
        repo_goals_count: goals.length,
        repo_goals: goals
      },
      oversize: false
    };
    
  } catch (error) {
    console.error('Failed to evaluate goal declaration stub:', error.message);
    return {
      violations: [],
      stats: { repo_goals_count: 0, repo_goals: [] },
      oversize: true
    };
  }
}

/**
 * Registry-compatible run function for goal_declaration gate
 * @param {object} ctx - Run context with spec, etc.
 * @param {object} gate - Gate configuration from spec
 * @returns {Promise<object>} Normalized gate result
 */
export async function run(ctx, _gate) {
  // Use existing legacy evaluator
  const legacyResult = await evaluateGoalDeclaration(ctx, ctx.pr, ctx.spec);

  // Convert to normalized result shape (ID will be set by launcher)
  return {
    status: legacyResult.oversize ? 'neutral' : (legacyResult.violations.length > 0 ? 'fail' : 'pass'),
    neutral_reason: legacyResult.oversize ? 'internal_error' : undefined,
    violations: legacyResult.violations.map(v => ({
      code: v.rule,
      message: v.observation || v.actual,
      path: null,
      meta: { actual: v.actual, limit: v.limit }
    })),
    stats: legacyResult.stats
  };
}