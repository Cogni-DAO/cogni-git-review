/**
 * AI Workflow Registry - Extensible workflow mapping
 * Tests and future repos can extend this registry
 */

import { evaluate as evalSingle } from './single-statement-evaluation.js';

// Note: goal-alignment-v2 will be added in Task 2
// import { evaluate as evalGoalsV2 } from './goal-alignment-v2.js';

export const WORKFLOWS = Object.freeze({
  "single-statement-evaluation": evalSingle,
  // "goal-alignment-v2": evalGoalsV2  // TODO: Add in Task 2
});

/**
 * Get workflow function by ID
 * @param {string} workflowId - Workflow identifier
 * @returns {Function} Workflow evaluate function
 * @throws {Error} If workflowId not found
 */
export function getWorkflow(workflowId) {
  if (!WORKFLOWS[workflowId]) {
    throw new Error(`Unknown workflowId: ${workflowId}`);
  }
  return WORKFLOWS[workflowId];
}

/**
 * Get list of available workflow IDs
 * @returns {string[]} Array of workflow IDs
 */
export function getAvailableWorkflows() {
  return Object.keys(WORKFLOWS);
}