/**
 * Cogni Gate Evaluation Manager - Split for precheck + other gates
 * Supports early-exit pattern for oversize diffs
 */

import { evaluateReviewLimits } from './review-limits.js';
import { evaluateGoalDeclaration } from './goal-declaration-stub.js';
import { evaluateForbiddenScopes } from './forbidden-scopes-stub.js';

/**
 * Run Cogni precheck (review_limits only) - enables early exit
 * @param {object} runCtx - Run context with timing, abort signal, etc.
 * @returns {Promise<GateResult>} Single gate result
 */
export async function runCogniPrecheck(runCtx) {
  const started = Date.now();
  
  try {
    const limits = runCtx.spec?.gates?.review_limits;
    
    // If no limits defined, return passing result
    if (!limits) {
      return {
        id: 'review_limits',
        status: 'pass',
        violations: [],
        stats: {
          changed_files: runCtx.pr.changed_files ?? 0,
          total_diff_kb: 0,
          limits_defined: false
        },
        duration_ms: Date.now() - started
      };
    }
    
    // Convert legacy evaluateReviewLimits result to new format
    const legacyResult = await evaluateReviewLimits(runCtx, runCtx.pr, limits);
    
    return {
      id: 'review_limits',
      status: legacyResult.oversize ? 'neutral' : (legacyResult.violations.length > 0 ? 'fail' : 'pass'),
      neutral_reason: legacyResult.oversize ? 'oversize_diff' : undefined,
      violations: legacyResult.violations.map(v => ({
        code: v.rule,
        message: `${v.rule}: ${v.actual} > ${v.limit}`,
        path: null,
        meta: { actual: v.actual, limit: v.limit }
      })),
      stats: legacyResult.stats,
      duration_ms: Date.now() - started
    };
    
  } catch (error) {
    runCtx.logger('error', 'Review limits precheck failed', { error: error.message });
    return {
      id: 'review_limits',
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: Date.now() - started
    };
  }
}

/**
 * Run other local Cogni gates (goal declaration + forbidden scopes stubs)
 * @param {object} runCtx - Run context with timing, abort signal, etc.
 * @returns {Promise<GateResult[]>} Array of gate results
 */
export async function runOtherLocalGates(runCtx) {
  // Run remaining gates in parallel
  const [goalResult, scopeResult] = await Promise.all([
    runGoalDeclarationStub(runCtx),
    runForbiddenScopesStub(runCtx)
  ]);
  
  return [goalResult, scopeResult];
}

/**
 * Run goal declaration stub gate
 */
async function runGoalDeclarationStub(runCtx) {
  const started = Date.now();
  
  try {
    const legacyResult = await evaluateGoalDeclaration(runCtx, runCtx.pr, runCtx.spec);
    
    return {
      id: 'goal_declaration_stub',
      status: legacyResult.violations.length > 0 ? 'fail' : 'pass',
      violations: legacyResult.violations.map(v => ({
        code: v.rule,
        message: v.annotation || v.actual,
        path: null,
        meta: { actual: v.actual, limit: v.limit }
      })),
      stats: legacyResult.stats,
      duration_ms: Date.now() - started
    };
    
  } catch (error) {
    runCtx.logger('error', 'Goal declaration stub failed', { error: error.message });
    return {
      id: 'goal_declaration_stub',
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: Date.now() - started
    };
  }
}

/**
 * Run forbidden scopes stub gate
 */
async function runForbiddenScopesStub(runCtx) {
  const started = Date.now();
  
  try {
    const legacyResult = await evaluateForbiddenScopes(runCtx, runCtx.pr, runCtx.spec);
    
    return {
      id: 'forbidden_scopes_stub',
      status: legacyResult.violations.length > 0 ? 'fail' : 'pass',
      violations: legacyResult.violations.map(v => ({
        code: v.rule,
        message: v.annotation || v.actual,
        path: null,
        meta: { actual: v.actual, limit: v.limit }
      })),
      stats: legacyResult.stats,
      duration_ms: Date.now() - started
    };
    
  } catch (error) {
    runCtx.logger('error', 'Forbidden scopes stub failed', { error: error.message });
    return {
      id: 'forbidden_scopes_stub',
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: Date.now() - started
    };
  }
}