/**
 * Root Gate Orchestrator - Stable import point with state management
 * Orchestrates all gate evaluations (Cogni local, External, AI advisory)
 */

import { runConfiguredGates, deriveGateId } from './run-configured.js';

/**
 * Run all gate evaluations for a PR with proper state management
 * @param {import('probot').Context} context - Probot context
 * @param {object} pr - Pull request object from webhook  
 * @param {object} spec - Full repository specification
 * @returns {Promise<{overall_status: string, gates: Array, duration_ms: number}>}
 */

// No global timeout - gates handle their own timeouts individually
export async function runAllGates(context, pr, spec) {
  const started = Date.now();
  
  // Add execution metadata to context
  // Note: pr parameter might be the same object as context.payload.pull_request for rerun events
  // TODO - this PR context building is a hack for 'rerequested' events, we need to investigate a better way.
  context.pr = { 
    number: pr.number,
    title: pr.title,
    body: pr.body,
    head: {
      sha: pr.head?.sha || pr.head_sha,
      repo: { 
        name: pr.head?.repo?.name || context.payload.repository.name 
      }
    },
    base: {
      sha: pr.base?.sha
    },
    changed_files: pr.changed_files, 
    additions: pr.additions, 
    deletions: pr.deletions
  };
  context.spec = spec;
  context.logger = (level, msg, meta) => context.log[level || 'info'](Object.assign({ msg }, meta || {}));
  context.annotation_budget = 50;
  context.idempotency_key = `${context.payload.repository.full_name}:${pr.number}:${pr.head?.sha || pr.head_sha}:${spec?._hash || 'nospec'}`;


  try {
    // Log execution plan
    const expectedGateCount = spec.gates?.length || 0;
    const gateList = spec.gates?.map(g => deriveGateId(g)) || [];
    context.logger('info', `🎯 Starting gate execution`, {
      total_gates: expectedGateCount,
      gate_list: gateList
    });

    // 1) Run all configured gates in spec order
    const launcherResult = await runConfiguredGates(context);
    const allGates = launcherResult?.results || [];
    
    // Detect partial execution 
    const isPartial = allGates.length < expectedGateCount;
    const hasFail = allGates.some(r => r.status === 'fail');
    const hasNeutral = allGates.some(r => r.status === 'neutral');
    
    // Create execution summary
    const passCount = allGates.filter(r => r.status === 'pass').length;
    const failCount = allGates.filter(r => r.status === 'fail').length;
    const neutralCount = allGates.filter(r => r.status === 'neutral').length;
    const timeoutCount = allGates.filter(r => r.neutral_reason === 'timeout').length;
    
    const summary = {
      expected: expectedGateCount,
      completed: allGates.length,
      passed: passCount,
      failed: failCount,
      neutral: neutralCount,
      timed_out: timeoutCount,
      partial_execution: isPartial,
      total_duration_ms: Date.now() - started
    };
    
    // Determine overall status - prioritize failures over partial execution
    const hasNoGates = allGates.length === 0;
    let overall_status;
    let conclusion_reason;
    
    if (hasNoGates) {
      overall_status = 'neutral';
      conclusion_reason = 'no_gates_executed';
    } else if (hasFail) {
      overall_status = 'fail';
      conclusion_reason = 'gates_failed';
    } else if (hasNeutral) {
      overall_status = 'neutral';
      conclusion_reason = timeoutCount > 0 ? 'gate_timeouts' : 'gates_neutral';
    } else {
      overall_status = 'pass';
      conclusion_reason = 'all_gates_passed';
    }
    
    // Log execution results
    context.logger('info', `📊 Gate execution summary`, {
      ...summary,
      overall_status,
      conclusion_reason,
      gates_summary: `✅${passCount} ❌${failCount} ⚠️${neutralCount}`
    });

    return { 
      overall_status, 
      gates: allGates,
      duration_ms: Date.now() - started,
      execution_summary: summary,
      conclusion_reason
    };

  } catch (error) {
    context.logger('error', 'Gate orchestration failed', { error: error?.message || error });
    
    // Return neutral with internal error
    return {
      overall_status: 'neutral',
      gates: [{
        id: 'orchestrator',
        status: 'neutral',
        neutral_reason: 'internal_error',
        violations: [],
        stats: { error: error.message },
        duration_ms: Date.now() - started
      }],
      duration_ms: Date.now() - started
    };
  }
}

