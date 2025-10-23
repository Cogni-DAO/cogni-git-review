/**
 * Forbidden Scopes Stub Gate - Simple stub that passes if repo spec has non_goals
 * Part of Cogni Gate Evaluation system (Wave 1 - deterministic stub only)
 */

// Gate registry contract exports
export const type = 'forbidden-scopes';

/**
 * Evaluate forbidden scopes requirement - STUB VERSION
 * Simply passes if repo spec has at least 1 non_goal defined
 * @param {import('../../adapters/base-context.d.ts').BaseContext} context - Base context interface (unused)
 * @param {object} pr - Pull request object from webhook (unused)
 * @param {object} spec - Repository specification
 * @returns {Promise<{violations: Array, stats: object, oversize: boolean}>}
 */
export async function evaluateForbiddenScopes(context, pr, spec) {
  try {
    const nonGoals = spec?.intent?.non_goals || [];
    const hasNonGoals = Array.isArray(nonGoals) && nonGoals.length > 0;
    
    const violations = [];
    
    // Stub logic: fail only if repo spec has no non_goals defined
    if (!hasNonGoals) {
      violations.push({
        rule: 'repo_has_no_non_goals',
        actual: 'No non_goals in repo spec',
        limit: 'At least 1 non_goal required',
        observation: 'Repository specification must define at least one non_goal in intent.non_goals[]'
      });
    }
    
    return {
      violations,
      stats: {
        repo_non_goals_count: nonGoals.length,
        repo_non_goals: nonGoals
      },
      oversize: false
    };
    
  } catch (error) {
    // Note: Using console.error temporarily - context.log not available in evaluateForbiddenScopes
    console.error('Failed to evaluate forbidden scopes stub:', error.message);
    return {
      violations: [],
      stats: { repo_non_goals_count: 0, repo_non_goals: [] },
      oversize: true
    };
  }
}

/**
 * Registry-compatible run function for forbidden_scopes gate
 * @param {object} ctx - Run context with spec, etc.
 * @param {object} gate - Gate configuration from spec
 * @returns {Promise<object>} Normalized gate result
 */
export async function run(ctx, _gate) {
  // Use existing legacy evaluator
  const legacyResult = await evaluateForbiddenScopes(ctx, ctx.pr, ctx.spec);

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