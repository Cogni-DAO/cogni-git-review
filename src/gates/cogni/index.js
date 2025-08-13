/**
 * Cogni Gate Evaluation Manager - Orchestrates all gate evaluations
 * Future-proof design: receives full spec, delegates to specific gate evaluators
 */

import { evaluateReviewLimits } from './review-limits.js';

/**
 * Run Cogni gate evaluations for a PR
 * @param {import('probot').Context} context - Probot context
 * @param {object} pr - Pull request object from webhook  
 * @param {object} spec - Full repository specification
 * @returns {Promise<{violations: Array, stats: object, oversize: boolean}>}
 */
export async function runCogniGates(context, pr, spec) {
  // Extract review_limits from spec
  const limits = spec?.gates?.review_limits;
  
  // If no limits defined, pass (no violations)
  if (!limits) {
    return {
      violations: [],
      stats: {
        changed_files: pr.changed_files ?? 0,
        total_diff_kb: 0
      },
      oversize: false
    };
  }
  
  // Delegate to review limits gate evaluator
  return await evaluateReviewLimits(context, pr, limits);
  
  // Future gates can be added here:
  // const denyPathResults = await evaluateDenyPaths(context, pr, spec.gates.deny_paths);
  // const externalResults = await evaluateExternalScanners(context, pr, spec.gates.external_scanners);
  // return aggregateResults([reviewResults, denyPathResults, externalResults]);
}