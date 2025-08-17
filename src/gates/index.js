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
 * @param {object} opts - Options { enableExternal: false, deadlineMs: 8000 }
 * @returns {Promise<{overall_status: string, gates: Array, duration_ms: number}>}
 */
export async function runAllGates(context, pr, spec, opts = { enableExternal: false, deadlineMs: 8000 }) {
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
    const localResults = await runConfiguredGates(runCtx);
    
    // Detect partial execution (timeout/abort)
    const expectedGateCount = spec.gates?.length || 0;
    const isPartial = localResults.length < expectedGateCount;
    const isAborted = runCtx.abort.aborted;
    
    const hasFailLocal = localResults.some(r => r.status === 'fail');

    // 2) External gates (v2) - skip if local failure or partial execution
    let externalResults = [];
    if (!hasFailLocal && !isPartial && opts.enableExternal) {
      externalResults = await runExternalGates(runCtx);
    }

    // 3) Aggregate all results
    const allGates = [...localResults, ...externalResults];
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

/**
 * Stub for external gates (v2) - returns empty array for MVP
 * @param {object} runCtx - Run context
 * @returns {Promise<Array>} Empty array of gate results
 */
async function runExternalGates(runCtx) {
  runCtx.logger('debug', 'External gates disabled for MVP');
  return [];
}