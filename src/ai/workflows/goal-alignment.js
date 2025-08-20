/**
 * Goal Alignment Workflow - Hardcoded Response
 * Called ONLY by src/ai/provider.js
 */

/**
 * Evaluate PR against statement - hardcoded for now
 * @param {Object} input - { statement, pr_title, pr_body, diff_summary }
 * @returns {Promise<Object>} { score, annotations, summary }
 */
export async function evaluate(input) {
  // Hardcoded response matching new I/O contract
  return {
    score: 0.9,
    annotations: [],
    summary: `PR "${input.pr_title}" aligns with statement: "${input.statement}"`
  };
}