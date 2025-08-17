/**
 * Root Gate Orchestrator - Stable import point with state management
 * Orchestrates all gate evaluations (Cogni local, External, AI advisory)
 */

import { runConfiguredGates } from './run-configured.js';

/**
 * Run all gate evaluations for a PR with proper state management
 * @param {import('probot').Context} context - Probot context
 * @param {object} pr - Pull request object from webhook  
 * @param {object} spec - Full repository specification
 * @param {object} opts - Options { deadlineMs: 8000, workflowRunId?: number }
 * @returns {Promise<{overall_status: string, gates: Array, duration_ms: number, pendingExternalGates: string[]}>}
 */
export async function runAllGates(context, pr, spec, opts = { deadlineMs: 8000 }) {
  const started = Date.now();
  const abortCtl = new AbortController();
  
  // Create RunContext for this execution
  const runCtx = {
    repo: context.repo(),
    pr: { 
      number: pr.number,
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
    },
    workflow_run: context.payload.workflow_run ? {
      id: context.payload.workflow_run.id,
      head_sha: context.payload.workflow_run.head_sha,
      name: context.payload.workflow_run.name,
      status: context.payload.workflow_run.status,
      conclusion: context.payload.workflow_run.conclusion
    } : (opts.workflowRunId ? {
      id: opts.workflowRunId,
      head_sha: pr.head?.sha || pr.head_sha,
      name: 'unknown',
      status: 'completed',
      conclusion: 'success'
    } : undefined),
    spec,
    octokit: context.octokit,
    logger: (level, msg, meta) => context.log[level || 'info'](Object.assign({ msg }, meta || {})),
    log: context.log,
    deadline_ms: opts.deadlineMs,
    annotation_budget: 50,
    idempotency_key: `${context.payload.repository.full_name}:${pr.number}:${pr.head?.sha || pr.head_sha}:${spec?._hash || 'nospec'}`,
    abort: abortCtl.signal
  };

  // Set up timeout handler
  const timeoutId = setTimeout(() => {
    runCtx.logger('warn', 'Gate execution timeout, aborting remaining gates', { deadline_ms: opts.deadlineMs });
    abortCtl.abort();
  }, opts.deadlineMs);

  try {
    // 1) Run all configured local gates in spec order
    const launcherResult = await runConfiguredGates(runCtx);
    const allGates = launcherResult?.results || [];
    const pendingExternalGates = launcherResult?.pendingExternalGates || [];
    
    // Detect partial execution (timeout/abort)
    const expectedGateCount = spec.gates?.length || 0;
    const isPartial = allGates.length < expectedGateCount;
    const isAborted = runCtx.abort.aborted;
    const hasFail = allGates.some(r => r.status === 'fail');
    const hasNeutral = allGates.some(r => r.status === 'neutral');
    
    // Determine overall status
    const hasNoGates = allGates.length === 0;
    const overall_status = hasNoGates ? 'neutral'
                         : (isPartial && isAborted) ? 'neutral' 
                         : hasFail ? 'fail' 
                         : (hasNeutral ? 'neutral' : 'pass');

    clearTimeout(timeoutId);
    return { 
      overall_status, 
      gates: allGates,
      pendingExternalGates,
      duration_ms: Date.now() - started 
    };

  } catch (error) {
    clearTimeout(timeoutId);
    runCtx.logger('error', 'Gate orchestration failed', { error: error.message });
    
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

