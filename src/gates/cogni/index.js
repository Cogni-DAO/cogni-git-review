/**
 * Cogni Gate Evaluation Manager - Split for precheck + other gates
 * Supports early-exit pattern for oversize diffs
 */

import { evaluateReviewLimits } from './review-limits.js';
import { evaluateGoalDeclaration } from './goal-declaration-stub.js';
import { evaluateForbiddenScopes } from './forbidden-scopes-stub.js';

/**
 * Run all configured gates in spec order
 * @param {object} runCtx - Run context with timing, abort signal, etc.
 * @returns {Promise<GateResult[]>} Gate execution results
 */
export async function runConfiguredGates(runCtx) {
  const gateConfigs = runCtx.spec?.gates || [];
  const results = [];
  
  // Process gates in the order they appear in the spec
  for (const gateConfig of gateConfigs) {
    let gateResult = null;
    
    // Dynamic gate execution based on ID
    if (gateConfig.id === 'review_limits') {
      gateResult = await runReviewLimitsGate(runCtx, gateConfig);
    } else if (gateConfig.id === 'goal_declaration') {
      gateResult = await runGoalDeclarationGate(runCtx, gateConfig);
    } else if (gateConfig.id === 'forbidden_scopes') {
      gateResult = await runForbiddenScopesGate(runCtx, gateConfig);
    }
    
    if (gateResult) {
      results.push(gateResult);
    }
  }
  
  return results;
}

/**
 * Run review_limits gate with given configuration
 */
async function runReviewLimitsGate(runCtx, gateConfig) {
  const started = Date.now();
  
  try {
    const limits = gateConfig.with;
    
    // If no limits defined in the gate config, return passing result
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
    runCtx.logger('error', 'Review limits gate failed', { error: error.message });
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
 * Run goal_declaration gate
 */
async function runGoalDeclarationGate(runCtx, gateConfig) {
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
    runCtx.logger('error', 'Goal declaration gate failed', { error: error.message });
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
 * Run forbidden_scopes gate
 */
async function runForbiddenScopesGate(runCtx, gateConfig) {
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
    runCtx.logger('error', 'Forbidden scopes gate failed', { error: error.message });
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

