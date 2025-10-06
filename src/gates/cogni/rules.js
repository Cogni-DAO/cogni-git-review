/**
 * Rules Gate - One Rule Per Gate Instance
 * 
 * Each gate instance loads exactly one rule file, enabling parallel execution
 * and individual pass/fail results per AI rule in GitHub UI.
 */

import { loadSingleRule } from '../../spec-loader.js';
import * as aiProvider from '../../ai/provider.js';
import { assertProviderResult } from '../../ai/schemas/validators.js';

export const type = 'ai-rule';


/**
 * Evaluate PR against the first enabled AI rule
 */
export async function run(ctx, gateConfig, logger) {
  const startTime = Date.now();
  const config = gateConfig.with || gateConfig; // Handle both formats

  try {
    // Step 1: Load single rule for this gate instance
    const ruleResult = await loadSingleRule(ctx, {
      rulesDir: config.rules_dir || '.cogni/rules',
      ruleFile: config.rule_file,
      blockingDefault: config.blocking_default !== false
    }, logger);

    // Step 2: Validate rule loading
    if (!ruleResult.ok) {
      return createNeutralResult(ruleResult.error.code.toLowerCase(),
        getErrorMessage(ruleResult.error), startTime);
    }

    const rule = ruleResult.rule;

    // Step 3: Validation
    // No-op:Rule schema validation now happens in spec-loader.js before internal properties are added

    // Step 4: Prepare clean workflow input - pass context and rule directly
    const workflowId = rule.workflow_id;
    const providerInput = {
      context: ctx,
      rule: rule
    };

    const providerResult = await aiProvider.evaluateWithWorkflow({
      workflowId,
      workflowInput: providerInput
    }, {
      timeoutMs: config.timeout_ms || 110000  // Leave 10s buffer for gate processing. TODO - make dynamic/configurable
    }, logger);

    // Runtime validation: Ensure provider result follows standard format
    try {
      assertProviderResult(providerResult);
    } catch (error) {
      console.error('🚨 Provider result validation failed:', error.message);
      if (error.details) {
        console.error('📋 Validation details:', JSON.stringify(error.details, null, 2));
      }
      return createNeutralResult('invalid_provider_result', `Provider result validation failed: ${error.message}`, startTime);
    }

    // Step 6: Make gate decision based on provider output
    return makeGateDecision(providerResult, rule, startTime);

  } catch (error) {
    console.error('Rules gate error:', error);

    const shouldBeNeutral = config.neutral_on_error !== false;
    if (shouldBeNeutral) {
      return createNeutralResult('internal_error', error.message, startTime);
    } else {
      return {
        status: 'fail',
        observations: [error.message],
        stats: { error: error.message },
        duration_ms: Date.now() - startTime
      };
    }
  }
}

/**
 * Standard criteria evaluator - supports require/any_of/neutral_on_missing_metrics
 * Exported for unit testing
 */
export function evalCriteria(metrics, criteria) {
  const req = criteria.require || [];
  const any = criteria.any_of || [];
  
  // Guard: Prevent silent PASS when no criteria are provided
  if (req.length === 0 && any.length === 0) {
    throw new Error('Empty success criteria: must specify at least one require or any_of criterion');
  }
  
  const missNeutral = criteria.neutral_on_missing_metrics === true;
  const val = (k) => (k in metrics ? metrics[k] : null);
  const cmp = (v, c) => (
    (c.gte != null && v >= c.gte) || (c.gt != null && v > c.gt) ||
    (c.lte != null && v <= c.lte) || (c.lt != null && v < c.lt) ||
    (c.eq != null && v === c.eq)
  );
  const failed = []; const passed = [];
  for (const c of req) {
    const v = val(c.metric);
    if (v == null) {
      if (missNeutral) return { status: 'neutral', failed: [`missing:${c.metric}`], passed };
      failed.push(`missing:${c.metric}`);
      continue;
    }
    (cmp(v, c) ? passed : failed).push(`${c.metric}=${v}`);
  }
  let anyOk = true;
  if (any.length) {
    anyOk = any.some(c => { const v = val(c.metric); return v != null && cmp(v, c); });
    (anyOk ? passed : failed).push('any_of');
  }
  const hardFails = failed.filter(m => !m.startsWith('missing:'));
  return { status: (hardFails.length === 0 && anyOk) ? 'pass' : 'fail', passed, failed };
}

/**
 * Make gate decision based on standardized evaluation
 */
function makeGateDecision(providerResult, rule, startTime) {
  const metricsRaw = providerResult.metrics || {};
  const metrics = {};
  
  // Extract values from new structure: {metricName: {value: x, observations: []}}
  for (const [key, metricData] of Object.entries(metricsRaw)) {
    metrics[key] = metricData.value;
  }
  
  const sc = rule.success_criteria;
  if (!sc) return createNeutralResult('missing_success_criteria', 'No success_criteria specified', startTime, providerResult, rule);

  const res = evalCriteria(metrics, sc);
  if (res.status === 'neutral') {
    return createNeutralResult('missing_metrics', res.failed.join('; '), startTime, providerResult, rule);
  }

  // Collect all observations from metrics
  const allObservations = [];
  for (const metricData of Object.values(metricsRaw)) {
    if (metricData.observations) {
      allObservations.push(...metricData.observations);
    }
  }

  return {
    status: res.status,
    passed: res.passed,
    failed: res.failed,
    observations: allObservations,
    res,
    providerResult,
    rule,
    provenance: providerResult.provenance,
    duration_ms: Date.now() - startTime
  };
}

/**
 * Create neutral result for error conditions
 */
function createNeutralResult(reason, message, startTime, providerResult = null, rule = null) {
  return {
    status: 'neutral',
    neutral_reason: reason,
    error: message,
    passed: [],
    failed: [],
    observations: [], // no observations in neutral results
    providerResult,
    rule,
    duration_ms: Date.now() - startTime
  };
}

/**
 * Get human-readable error message
 */
function getErrorMessage(error) {
  const messages = {
    'NO_RULE_FILE': 'No rule_file specified in gate config',
    'RULE_MISSING': 'Rule file not found',
    'RULE_INVALID': 'Invalid rule file',
    'RULE_LOAD_FAILED': error.message || 'Load failed'
  };
  return messages[error.code] || `Unknown error: ${error.code}`;
}