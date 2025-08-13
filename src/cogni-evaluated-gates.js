/**
 * Cogni Evaluated Gates - Review Limits Validation
 * Evaluates PR against review limits defined in repo spec
 */

/**
 * Evaluate local gates for a PR against configured limits
 * @param {import('probot').Context} context - Probot context
 * @param {object} pr - Pull request object from webhook
 * @param {object} limits - review_limits from repo spec
 * @returns {Promise<{violations: Array, stats: object, oversize: boolean}>}
 */
export async function evaluateLocalGates(context, pr, limits) {
  // Get changed files count - prefer PR data, fallback to API call
  const changed_files = pr.changed_files ?? 
    (await context.octokit.pulls.get(context.repo({pull_number: pr.number}))).data.changed_files;
  
  // Calculate diff size heuristic from additions/deletions
  const {additions, deletions} = pr;
  const total_diff_kb = Math.ceil(((additions||0)+(deletions||0))/3);
  
  // Check violations against limits
  const violations = [];
  
  if (limits?.max_changed_files != null && changed_files > limits.max_changed_files) {
    violations.push({
      rule: 'max_changed_files', 
      actual: changed_files, 
      limit: limits.max_changed_files
    });
  }
  
  if (limits?.max_total_diff_kb != null && total_diff_kb > limits.max_total_diff_kb) {
    violations.push({
      rule: 'max_total_diff_kb', 
      actual: total_diff_kb, 
      limit: limits.max_total_diff_kb
    });
  }
  
  return {
    violations,
    stats: {changed_files, total_diff_kb},
    oversize: false // MVP: always false, can add logic later for extreme cases
  };
}