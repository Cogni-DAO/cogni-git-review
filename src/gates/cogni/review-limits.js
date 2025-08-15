/**
 * Review Limits Gate - File count and diff size validation
 * Part of Cogni Gate Evaluation system
 */

/**
 * Evaluate review limits for a PR against configured limits
 * @param {import('probot').Context} context - Probot context
 * @param {object} pr - Pull request object from webhook
 * @param {object} limits - review_limits from repo spec
 * @returns {Promise<{violations: Array, stats: object, oversize: boolean}>}
 */
export async function evaluateReviewLimits(context, pr, limits) {
  try {
    // Get changed files count - prefer PR data, fallback to API call
    const changed_files = pr.changed_files ?? 
      (await context.octokit.pulls.get(context.repo({pull_number: pr.number}))).data.changed_files;
    
    // Calculate diff size heuristic from additions/deletions (cast to numbers)
    const additions = Number(pr.additions || 0);
    const deletions = Number(pr.deletions || 0);
    const total_diff_kb = Math.ceil((additions + deletions) / 3); // Rough heuristic: ~3 chars per KB
    
    // Check violations against limits (use > not >= so equals passes)
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
    
  } catch (error) {
    // If GitHub API fails, return oversize so caller can mark neutral
    console.error('Failed to fetch PR data:', error.message);
    return {
      violations: [],
      stats: {changed_files: 0, total_diff_kb: 0},
      oversize: true
    };
  }
}