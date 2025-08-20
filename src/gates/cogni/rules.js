/**
 * Rules Gate - One Rule Per Gate Instance
 * 
 * Each gate instance loads exactly one rule file, enabling parallel execution
 * and individual pass/fail results per AI rule in GitHub UI.
 */

import { loadSingleRule } from '../../spec-loader.js';
import * as aiProvider from '../../ai/provider.js';

export const id = 'rules';

/**
 * Evaluate PR against the first enabled AI rule
 */
export async function run(ctx, gateConfig) {
  const startTime = Date.now();
  const config = gateConfig.with || gateConfig; // Handle both formats
  
  try {
    // Step 1: Load single rule for this gate instance
    const ruleResult = await loadSingleRule(ctx, {
      rulesDir: config.rules_dir || '.cogni/rules',
      ruleFile: config.rule_file,
      blockingDefault: config.blocking_default !== false
    });
    
    if (!ruleResult.ok) {
      return createNeutralResult(ruleResult.error.code.toLowerCase(), 
        getErrorMessage(ruleResult.error), startTime);
    }
    
    const rule = ruleResult.rule;
    const pr = ctx.pr;
    
    // Step 2: Build PR context directly
    const fileCount = pr?.changed_files || 0;
    const totalAdditions = pr?.additions || 0;
    const totalDeletions = pr?.deletions || 0;
    
    // Step 3: Call AI provider with statement from rule
    const providerInput = {
      statement: rule['evaluation-statement'] || 'No statement defined',
      pr_title: pr?.title || '',
      pr_body: pr?.body || '',
      diff_summary: `PR "${pr?.title || 'Untitled'}" modifies ${fileCount} file${fileCount === 1 ? '' : 's'} (+${totalAdditions} -${totalDeletions} lines)`
    };
    
    const providerResult = await aiProvider.review(providerInput, {
      timeoutMs: config.timeout_ms || 60000
    });
    
    // Step 4: Make gate decision based on provider output
    return makeGateDecision(providerResult, rule, startTime);
    
  } catch (error) {
    console.error('Rules gate error:', error);
    
    const shouldBeNeutral = config.neutral_on_error !== false;
    
    return {
      status: shouldBeNeutral ? 'neutral' : 'fail',
      neutral_reason: shouldBeNeutral ? 'internal_error' : undefined,
      annotations: shouldBeNeutral ? [] : [error.message],
      stats: { error: error.message },
      duration_ms: Date.now() - startTime
    };
  }
}

/**
 * Make gate decision based on AI provider output
 */
function makeGateDecision(providerResult, rule, startTime) {
  const threshold = Number(rule.success_criteria?.threshold ?? 0.7);
  const score = providerResult.score;
  
  if (score === null || typeof score !== 'number') {
    return createNeutralResult('invalid_score', 'AI provider returned invalid score', startTime);
  }
  
  const status = score >= threshold ? 'pass' : 'fail';
  
  return {
    status,
    annotations: providerResult.annotations || [],
    stats: {
      score,
      threshold,
      rule_id: rule.id,
      statement: rule['evaluation-statement']
    },
    duration_ms: Date.now() - startTime
  };
}

/**
 * Create neutral result for error conditions
 */
function createNeutralResult(reason, message, startTime) {
  return {
    status: 'neutral',
    neutral_reason: reason,
    annotations: [],
    stats: { error: message },
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

