/**
 * Root Gate Aggregator - Stable import point for handlers
 * Orchestrates all gate evaluations (Cogni, External, etc.)
 */

import { runCogniGates } from './cogni/index.js';

/**
 * Run all gate evaluations for a PR
 * @param {import('probot').Context} context - Probot context
 * @param {object} pr - Pull request object from webhook  
 * @param {object} spec - Full repository specification
 * @returns {Promise<{violations: Array, stats: object, oversize: boolean}>}
 */
export async function runAllGates(context, pr, spec) {
  // For MVP: only Cogni gates
  const cogniResults = await runCogniGates(context, pr, spec);
  
  // Future: aggregate Cogni + External results
  // const externalResults = await runExternalGates(context, pr, spec);
  // return aggregateGateResults([cogniResults, externalResults]);
  
  return cogniResults;
}