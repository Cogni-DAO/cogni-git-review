/**
 * Rules Gate - Minimal MVP Implementation
 * 
 * Loads ONE rule, applies to ALL PRs (ignores selectors), 
 * builds simple evidence (pr_title, pr_body, diff_summary only),
 * calls AI provider once, returns single check result.
 */

import { loadRules } from '../../rules/loader.js';
import * as aiProvider from '../../ai/provider.js';

export const id = 'rules';

/**
 * Evaluate PR against the first enabled AI rule
 */
export async function evaluateRules(context, spec) {
  const startTime = Date.now();
  const gateConfig = spec.gates?.find(g => g.id === 'rules')?.with || {};
  
  try {
    // Step 1: Load only the first enabled rule (MVP)
    const { rules, diagnostics } = await loadRules({
      rules_dir: gateConfig.rules_dir || '.cogni/rules',
      enabled: gateConfig.enable ? [gateConfig.enable[0]] : [], // Just first rule
      blocking_default: gateConfig.blocking_default !== false
    });
    
    // Handle no rules case
    if (rules.length === 0) {
      const errorCount = diagnostics.filter(d => d.severity === 'error').length;
      return {
        id: 'rules',
        conclusion: 'neutral',
        title: 'AI Rules',
        summary: errorCount > 0 ? `No valid rules loaded (${errorCount} errors)` : 'No rules enabled',
        text: buildDiagnosticsText(diagnostics, gateConfig.enable),
        annotations: [],
        duration_ms: Date.now() - startTime
      };
    }
    
    const rule = rules[0]; // Use first rule only
    
    // Step 2: Build minimal evidence (MVP - no selectors, no file snippets)
    const evidence = buildMinimalEvidence(context, spec);
    
    // Step 3: Call AI provider once
    const providerInput = {
      goals: spec.intent?.goals || [],
      non_goals: spec.intent?.non_goals || [],
      pr_title: evidence.pr_title,
      pr_body: evidence.pr_body,
      diff_summary: evidence.diff_summary,
      rule: {
        id: rule.rule_key,
        blocking: rule.blocking,
        success_criteria: rule.success_criteria
      }
    };
    
    const providerResult = await aiProvider.review(providerInput, {
      timeoutMs: gateConfig.timeout_ms || 60000,
      model: gateConfig.model || process.env.AI_MODEL || 'gpt-4o-mini'
    });
    
    // Step 4: Determine final conclusion
    const conclusion = determineConclusion(providerResult, rule);
    
    return {
      id: 'rules',
      conclusion,
      title: 'AI Rules',
      summary: `Goal alignment: ${conclusion} (score: ${(providerResult.score || 0).toFixed(2)})`,
      text: buildResultText(providerResult, rule),
      annotations: [], // No annotations in MVP
      duration_ms: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('Rules gate error:', error);
    
    return {
      id: 'rules',
      conclusion: gateConfig.neutral_on_error !== false ? 'neutral' : 'failure',
      title: 'AI Rules', 
      summary: `AI evaluation failed: ${error.message}`,
      text: `Rules gate encountered an error:\n\n\`\`\`\n${error.stack || error.message}\n\`\`\``,
      annotations: [],
      duration_ms: Date.now() - startTime
    };
  }
}

/**
 * Build minimal evidence for MVP (no file snippets, no selectors)
 */
function buildMinimalEvidence(context, spec) {
  const { pr } = context;
  const changedFiles = pr.changed_files || [];
  
  // Simple diff summary
  const fileCount = changedFiles.length;
  const totalAdditions = changedFiles.reduce((sum, f) => sum + (f.additions || 0), 0);
  const totalDeletions = changedFiles.reduce((sum, f) => sum + (f.deletions || 0), 0);
  
  const diffSummary = `PR "${pr.title || 'Untitled'}" modifies ${fileCount} file${fileCount === 1 ? '' : 's'} (+${totalAdditions} -${totalDeletions} lines)`;
  
  return {
    pr_title: pr.title || '',
    pr_body: pr.body || '',
    diff_summary: diffSummary
  };
}

/**
 * Determine final gate conclusion from provider result
 * CRITICAL: Gate decides pass/fail based on score vs threshold, NOT LLM verdict
 */
function determineConclusion(providerResult, rule) {
  const score = providerResult.score || 0;
  const threshold = rule.success_criteria.threshold || 0.7;
  
  if (score >= threshold) {
    return 'success'; // Score meets threshold
  } else if (rule.blocking) {
    return 'failure'; // Below threshold + blocking rule
  } else {
    return 'neutral'; // Below threshold + non-blocking rule
  }
}

/**
 * Build result text from provider output
 */
function buildResultText(providerResult, rule) {
  const score = providerResult.score || 0;
  const threshold = rule.success_criteria.threshold || 0.7;
  const verdict = score >= threshold ? 'PASS' : 'FAIL';
  
  const sections = [
    '## AI Rules Evaluation',
    '',
    `**Rule**: ${rule.rule_key}`,
    `**Score**: ${score.toFixed(2)} (threshold: ${threshold})`,
    `**Verdict**: ${verdict}`,
    `**Blocking**: ${rule.blocking ? 'Yes' : 'No'}`,
    ''
  ];
  
  if (providerResult.summary) {
    sections.push('**AI Summary**:', providerResult.summary, '');
  }
  
  if (providerResult.reasons && providerResult.reasons.length > 0) {
    sections.push('**Reasons**:');
    providerResult.reasons.forEach(reason => {
      sections.push(`- ${reason}`);
    });
  }
  
  return sections.join('\n');
}

/**
 * Build diagnostics text for no rules case
 */
function buildDiagnosticsText(diagnostics, enabledFiles) {
  const sections = [
    '## AI Rules Configuration',
    '',
    `**Enabled Files**: ${enabledFiles?.join(', ') || 'none'}`,
    `**Valid Rules Loaded**: 0`,
    ''
  ];
  
  if (diagnostics.length > 0) {
    sections.push('**Diagnostics**:');
    diagnostics.forEach(d => {
      sections.push(`- **${d.type}** (${d.severity}): ${d.message}`);
    });
  } else {
    sections.push('No rule files were enabled in the gate configuration.');
  }
  
  return sections.join('\n');
}