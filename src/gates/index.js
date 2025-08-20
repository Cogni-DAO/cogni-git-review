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
 * @param {object} opts - Options { deadlineMs: 8000 }
 * @returns {Promise<{overall_status: string, gates: Array, duration_ms: number}>}
 */

// hardcode 120s deadline for now, giving time for AI gate.
export async function runAllGates(context, pr, spec, opts = { deadlineMs: 120000 }) {
  const started = Date.now();
  const abortCtl = new AbortController();
  
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
  context.deadline_ms = opts.deadlineMs;
  context.annotation_budget = 50;
  context.idempotency_key = `${context.payload.repository.full_name}:${pr.number}:${pr.head?.sha || pr.head_sha}:${spec?._hash || 'nospec'}`;
  context.abort = abortCtl.signal;

  // Set up timeout handler
  const timeoutId = setTimeout(() => {
    context.logger('warn', 'Gate execution timeout, aborting remaining gates', { deadline_ms: opts.deadlineMs });
    abortCtl.abort();
  }, opts.deadlineMs);

  try {
    // 1) Run all configured gates in spec order
    const launcherResult = await runConfiguredGates(context);
    const allGates = launcherResult?.results || [];
    
    // Detect partial execution (timeout/abort)
    const expectedGateCount = spec.gates?.length || 0;
    const isPartial = allGates.length < expectedGateCount;
    const isAborted = context.abort.aborted;
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
    context.logger('error', 'Gate orchestration failed', { error: error.message });
    
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

