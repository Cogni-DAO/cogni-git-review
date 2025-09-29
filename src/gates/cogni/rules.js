/**
 * Rules Gate - One Rule Per Gate Instance
 * 
 * Each gate instance loads exactly one rule file, enabling parallel execution
 * and individual pass/fail results per AI rule in GitHub UI.
 */

import { loadSingleRule } from '../../spec-loader.js';
import * as aiProvider from '../../ai/provider.js';
import { assertRuleSchema, assertProviderResultShape } from '../../schemas/standard-ai-rule-eval-format.js';

export const type = 'ai-rule';

/**
 * Gather evidence from PR changes based on rule capabilities
 * Self-contained helper for code-aware AI rules
 */
async function gatherEvidence(context, rule) {
  const capabilities = rule.x_capabilities || [];
  const budgets = rule.x_budgets || {};

  // If no diff_summary capability requested, return simple summary
  if (!capabilities.includes('diff_summary')) {
    return null;
  }

  try {
    const pullNumber = context.pr?.number;
    if (!pullNumber) {
      return 'No PR number available';
    }

    const { owner, repo } = context.repo();
    const { data: files } = await context.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber
    });

    const maxFiles = budgets.max_files || 25;
    const maxPatchBytes = budgets.max_patch_bytes_per_file || 16000;
    const maxPatches = budgets.max_patches || 3;

    // Sort files deterministically by churn (changes) then path
    const sortedFiles = files
      .slice(0, maxFiles)
      .sort((a, b) => {
        const churnDiff = (b.changes || 0) - (a.changes || 0);
        return churnDiff !== 0 ? churnDiff : a.filename.localeCompare(b.filename);
      });

    const totals = sortedFiles.reduce((acc, f) => ({
      files: acc.files + 1,
      additions: acc.additions + (f.additions || 0),
      deletions: acc.deletions + (f.deletions || 0)
    }), { files: 0, additions: 0, deletions: 0 });

    // Build deterministic diff summary string
    let summary = `${totals.files} file${totals.files === 1 ? '' : 's'} changed, +${totals.additions}/−${totals.deletions} total\n`;

    // Add file list
    for (const f of sortedFiles) {
      const status = f.status || 'modified';
      const adds = f.additions || 0;
      const dels = f.deletions || 0;
      summary += `• ${f.filename} (${status}) +${adds}/−${dels}\n`;
    }

    // Add patch content if file_patches capability requested
    if (capabilities.includes('file_patches') && maxPatches > 0) {
      summary += '\nTop patches (truncated):\n';

      const filesToPatch = sortedFiles.slice(0, maxPatches);
      for (const f of filesToPatch) {
        if (f.patch) {
          let patch = f.patch;
          if (patch.length > maxPatchBytes) {
            patch = patch.slice(0, maxPatchBytes) + '\n… [truncated]';
          }
          summary += `=== ${f.filename} ===\n${patch}\n\n`;
        }
      }
    }

    return summary.trim();

  } catch (error) {
    // Return error info but don't fail the gate
    return `Error gathering diff: ${error.message}`;
  }
}

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

    // Step 2: Validate rule loading
    if (!ruleResult.ok) {
      return createNeutralResult(ruleResult.error.code.toLowerCase(),
        getErrorMessage(ruleResult.error), startTime);
    }

    const rule = ruleResult.rule;

    // Step 3: Runtime validation - Ensure rule follows standard format
    try {
      assertRuleSchema(rule);
    } catch (error) {
      return createNeutralResult('invalid_rule_schema', error.message, startTime);
    }

    // Step 4: Build PR context with enhanced diff summary
    const pr = ctx.pr;
    console.log('🔍 PR Data Debug:', {
      title: pr?.title,
      body: pr?.body?.substring(0, 100),
      changed_files: pr?.changed_files,
      additions: pr?.additions,
      deletions: pr?.deletions
    });

    // Step 5: Gather evidence based on rule capabilities
    const enhancedDiffSummary = await gatherEvidence(ctx, rule);

    // Fall back to basic summary if evidence gathering disabled or failed
    let diff_summary;
    if (enhancedDiffSummary) {
      diff_summary = enhancedDiffSummary;
    } else {
      const fileCount = pr?.changed_files || 0;
      const totalAdditions = pr?.additions || 0;
      const totalDeletions = pr?.deletions || 0;
      diff_summary = `PR "${pr?.title || 'Untitled'}" modifies ${fileCount} file${fileCount === 1 ? '' : 's'} (+${totalAdditions} -${totalDeletions} lines)`;
    }

    // Step 6: Prepare generic workflow input
    const workflowId = rule.workflow_id || 'single-statement-evaluation';

    const providerInput = {
      pr_title: pr?.title || '',
      pr_body: pr?.body || '',
      diff_summary: diff_summary
    };

    // Add evaluation_statement if present (consistent snake_case)
    if (rule['evaluation-statement']) {
      providerInput.evaluation_statement = rule['evaluation-statement'];
    }

    const providerResult = await aiProvider.evaluateWithWorkflow({
      workflowId,
      workflowInput: providerInput
    }, {
      timeoutMs: config.timeout_ms || 110000  // Leave 10s buffer for gate processing. TODO - make dynamic/configurable
    });

    // Runtime validation: Ensure provider result follows standard_ai_rule_eval format
    try {
      assertProviderResultShape(providerResult);
    } catch (error) {
      return createNeutralResult('invalid_provider_result', `Provider result validation failed: ${error.message}`, startTime);
    }

    // Step 7: Make gate decision based on provider output
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
  const metrics = providerResult.metrics || {};
  const sc = rule.success_criteria;
  if (!sc) return createNeutralResult('missing_success_criteria', 'No success_criteria specified', startTime);

  const res = evalCriteria(metrics, sc);
  if (res.status === 'neutral') {
    return createNeutralResult('missing_metrics', res.failed.join('; '), startTime);
  }

  return {
    status: res.status,
    observations: providerResult.observations || [],
    stats: {
      rule_id: rule.id,
      statement: rule['evaluation-statement'],
      metrics,
      passed: res.passed,
      failed: res.failed
    },
    provenance: providerResult.provenance,
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
    observations: [],
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

