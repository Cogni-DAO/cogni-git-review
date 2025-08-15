/**
 * Goal Declaration Stub Gate - Simple stub that passes if repo spec has goals
 * Part of Cogni Gate Evaluation system (Wave 1 - deterministic stub only)
 */

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
        annotation: 'Repository specification must define at least one goal in intent.goals[]'
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