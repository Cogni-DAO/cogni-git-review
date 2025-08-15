/**
 * Forbidden Scopes Stub Gate - Simple stub that passes if repo spec has non_goals
 * Part of Cogni Gate Evaluation system (Wave 1 - deterministic stub only)
 */

/**
 * Evaluate forbidden scopes requirement - STUB VERSION
 * Simply passes if repo spec has at least 1 non_goal defined
 * @param {import('probot').Context} context - Probot context (unused)
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
        annotation: 'Repository specification must define at least one non_goal in intent.non_goals[]'
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
    console.error('Failed to evaluate forbidden scopes stub:', error.message);
    return {
      violations: [],
      stats: { repo_non_goals_count: 0, repo_non_goals: [] },
      oversize: true
    };
  }
}