/**
 * Root Gate Orchestrator - Stable import point with state management
 * Orchestrates all gate evaluations (Cogni local, External, AI advisory)
 */

import { runConfiguredGates } from './run-configured.js';
import { resolveArtifact } from './external/artifact-resolver.js';
import { run as runEslint } from './external/artifact-json.js';

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
    const localResults = await runConfiguredGates(runCtx);
    
    // Detect partial execution (timeout/abort)
    const expectedGateCount = spec.gates?.length || 0;
    const isPartial = localResults.length < expectedGateCount;
    const isAborted = runCtx.abort.aborted;
    
    const hasFailLocal = localResults.some(r => r.status === 'fail');

    // 2) External gates - run when enabled (typically from workflow_run handler)
    let externalResults = [];
    if (opts.enableExternal) {
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
 * Run external gates with artifact resolution
 * @param {object} runCtx - Run context with workflowRunId
 * @returns {Promise<Array>} Array of external gate results
 */
async function runExternalGates(runCtx) {
  const startTime = Date.now();
  runCtx.logger('debug', 'Running external gates', { workflowRunId: runCtx.workflow_run?.id });
  
  // Find external gates in spec
  const externalGates = runCtx.spec.gates?.filter(gate => gate.source === 'external') || [];
  if (externalGates.length === 0) {
    runCtx.logger('debug', 'No external gates configured');
    return [];
  }

  const results = [];
  
  for (const gate of externalGates) {
    // Check for timeout before each gate
    if (runCtx.abort?.aborted) {
      runCtx.logger('warn', 'External gate execution aborted due to timeout', { gate_id: gate.id });
      break;
    }

    const gateStartTime = Date.now();
    try {
      let gateResult;
      
      if (gate.runner === 'artifact.json') {
        // Handle ESLint JSON artifacts
        const artifactName = gate.with?.artifact_name || 'eslint-report';
        const artifact = await resolveArtifact(
          runCtx.octokit,
          runCtx.repo,
          runCtx.workflow_run?.id,
          runCtx.pr.head.sha,
          artifactName
        );
        
        if (!artifact) {
          gateResult = {
            status: 'neutral',
            neutral_reason: 'artifact_not_found',
            violations: [{
              code: 'artifact_missing',
              message: `Artifact '${artifactName}' not found after workflow completion`,
              path: null,
              line: null,
              column: null,
              level: 'info'
            }],
            stats: { artifact_name: artifactName }
          };
        } else {
          // Parse artifact and run gate
          gateResult = await runEslint(runCtx, gate, artifact);
        }
      } else {
        // Unknown runner type
        gateResult = {
          status: 'neutral',
          neutral_reason: 'unknown_runner',
          violations: [{
            code: 'unknown_runner',
            message: `Unknown external gate runner: ${gate.runner}`,
            path: null,
            line: null,
            column: null,
            level: 'info'
          }],
          stats: { runner: gate.runner }
        };
      }
      
      // Ensure gate result has required fields
      const finalResult = {
        id: gate.id,
        status: gateResult.status || 'neutral',
        neutral_reason: gateResult.neutral_reason,
        violations: gateResult.violations || [],
        stats: gateResult.stats || {},
        duration_ms: Date.now() - gateStartTime
      };
      
      results.push(finalResult);
      runCtx.logger('debug', `External gate ${gate.id} completed`, { status: finalResult.status });
      
    } catch (error) {
      runCtx.logger('error', `External gate ${gate.id} crashed`, { error: error.message });
      
      results.push({
        id: gate.id,
        status: 'neutral',
        neutral_reason: 'internal_error',
        violations: [],
        stats: { error: error.message },
        duration_ms: Date.now() - gateStartTime
      });
    }
  }
  
  runCtx.logger('debug', `External gates completed: ${results.length} results`, { 
    duration_ms: Date.now() - startTime 
  });
  
  return results;
}