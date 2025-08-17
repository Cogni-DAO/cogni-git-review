// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

import { loadRepoSpec } from './src/spec-loader.js';
import { runAllGates } from './src/gates/index.js';

const PR_REVIEW_NAME = "Cogni Git PR Review";

// In-memory check state management for MVP
// Maps head_sha -> { checkId, spec } for idempotent updates with consistent spec
const checkStateMap = new Map();

// Export for testing cleanup
global.checkStateMap = checkStateMap;

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  if (process.env.LOG_ALL_EVENTS === '1') {
    app.onAny((context) => {
      console.log(`🔍 EVENT: ${context.name}.${context.payload.action || 'no-action'}`);
    });
  }

  // Always log rerun events for debugging
  app.on("check_run", (context) => {
    if (context.payload.action === 'rerequested') {
      console.log(`🔍 RERUN EVENT: check_run.rerequested received for check: "${context.payload.check_run?.name}"`);
    }
  });

  app.on("check_suite", (context) => {
    if (context.payload.action === 'rerequested') {
      console.log(`🔍 RERUN EVENT: check_suite.rerequested received for suite: ${context.payload.check_suite?.id}`);
    }
  });

  app.on("check_suite.rerequested", handleCheckRerun);
  app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], handlePullRequest);
  app.on("workflow_run.completed", handleWorkflowComplete);

  async function createCheckOnSha(context, options) {
    const { sha, conclusion, summary, text } = options;
    const started_at = new Date();
    return context.octokit.checks.create(context.repo({
      name: PR_REVIEW_NAME,
      head_sha: sha,
      status: "completed",
      started_at,
      conclusion,
      completed_at: new Date(),
      output: { title: PR_REVIEW_NAME, summary, text }
    }));
  }

  async function createCompletedCheck(context, runResult, headSha, startTime) {
    const conclusion = mapStatusToConclusion(runResult.overall_status);
    const { summary, text } = formatGateResults(runResult);

    const checkResult = await context.octokit.checks.create(context.repo({
      name: PR_REVIEW_NAME,
      head_sha: headSha,
      status: "completed",
      started_at: startTime,
      conclusion,
      completed_at: new Date(),
      output: { title: PR_REVIEW_NAME, summary, text }
    }));

    console.log(`📝 Created completed check ${checkResult.data.id} for SHA ${headSha} with conclusion: ${conclusion}`);
    return checkResult;
  }

  async function evaluateAndCreateCheck(context, pull_request, workflowRunId = null) {
    const startTime = new Date();
    try {
      const { spec, source } = await loadRepoSpec(context);
      console.log(`📄 Spec loaded from ${source} for PR #${pull_request.number}`);

      const runResult = await runAllGates(context, pull_request, spec, { 
        workflowRunId,
        deadlineMs: 30000 // Standard timeout for all gates
      });
      
      // Map tri-state to GitHub check conclusions
      const conclusion = mapStatusToConclusion(runResult.overall_status);
      
      // Generate summary and text from gate results
      const { summary, text } = formatGateResults(runResult);

      return context.octokit.checks.create(context.repo({
        name: PR_REVIEW_NAME,
        head_sha: pull_request.head.sha,
        status: "completed",
        started_at: startTime,
        conclusion,
        completed_at: new Date(),
        output: {
          title: PR_REVIEW_NAME,
          summary,
          text
        }
      }));
    } catch (error) {
      console.error(`📄 Spec load failed for PR #${pull_request.number}:`, error);

      const isMissing = error?.code === 'SPEC_MISSING';
      const isInvalid = error?.code === 'SPEC_INVALID';

      const conclusion = (isMissing || isInvalid) ? 'failure' : 'neutral';
      const summary = isMissing
        ? 'No .cogni/repo-spec.yaml found'
        : (isInvalid ? 'Invalid .cogni/repo-spec.yaml' : 'Spec could not be loaded (transient error)');
      const text = isMissing
        ? 'Add `.cogni/repo-spec.yaml` to configure this required check.'
        : (isInvalid
            ? `Repository spec validation failed: ${error.message || 'Unknown error'}`
            : 'GitHub API/network issue while loading the spec. Re-run the check or try again.');

      return context.octokit.checks.create(context.repo({
        name: PR_REVIEW_NAME,
        head_sha: pull_request.head.sha,
        status: "completed",
        started_at: startTime,
        conclusion,
        completed_at: new Date(),
        output: { title: PR_REVIEW_NAME, summary, text }
      }));
    }
  }

  /**
   * Map tri-state status to GitHub check conclusion
   */
  function mapStatusToConclusion(status) {
    switch (status) {
      case 'pass': return 'success';
      case 'fail': return 'failure';
      case 'neutral': return 'neutral';
      default: return 'neutral';
    }
  }

  /**
   * Format gate results into summary and text for GitHub check
   */
  function formatGateResults(runResult) {
    const { gates, early_exit, duration_ms } = runResult;
    
    const failedGates = gates.filter(g => g.status === 'fail');
    const neutralGates = gates.filter(g => g.status === 'neutral');
    const passedGates = gates.filter(g => g.status === 'pass');
    
    // Summary
    let summary;
    if (gates.length === 0) {
      summary = 'No gates configured';
    } else if (failedGates.length > 0) {
      summary = `Gate failures: ${failedGates.length}`;
    } else if (neutralGates.length > 0) {
      const reasons = [...new Set(neutralGates.map(g => g.neutral_reason).filter(Boolean))];
      summary = `Gates neutral: ${reasons.join(', ')}`;
    } else {
      summary = 'All gates passed';
    }
    
    if (early_exit) {
      summary += ' (early exit)';
    }
    
    // Text - detailed breakdown
    let text = `Gates: ${gates.length} total | Duration: ${duration_ms}ms\n\n`;
    
    // Show gate status breakdown
    text += `✅ Passed: ${passedGates.length} | ❌ Failed: ${failedGates.length} | ⚠️ Neutral: ${neutralGates.length}\n\n`;
    
    // Show failed gates first
    if (failedGates.length > 0) {
      text += '**Failures:**\n';
      failedGates.forEach(gate => {
        text += `• **${gate.id}**: ${gate.violations.length} violation(s)\n`;
        gate.violations.slice(0, 3).forEach(v => { // Limit violations shown
          text += `  - ${v.code}: ${v.message}\n`;
        });
        if (gate.violations.length > 3) {
          text += `  - ...and ${gate.violations.length - 3} more\n`;
        }
      });
      text += '\n';
    }
    
    // Show neutral gates
    if (neutralGates.length > 0) {
      text += '**Neutral:**\n';
      neutralGates.forEach(gate => {
        text += `• **${gate.id}**: ${gate.neutral_reason || 'reason unknown'}\n`;
      });
      text += '\n';
    }
    
    // Show passed gates summary
    if (passedGates.length > 0) {
      text += `**Passed:** ${passedGates.map(g => g.id).join(', ')}\n\n`;
    }
    
    // Add stats from review limits if available
    const reviewGate = gates.find(g => g.id === 'review_limits');
    if (reviewGate?.stats) {
      text += `**Stats:** files=${reviewGate.stats.changed_files || 0} | diff_kb=${reviewGate.stats.total_diff_kb || 0}`;
    }
    
    return { summary, text };
  }

  async function handlePullRequest(context) {
    const pr = context.payload.pull_request;
    console.log(`📝 PR Event: ${context.payload.action} for PR #${pr.number}, SHA: ${pr.head.sha}`);
    
    // Create check with in_progress status, skip external gates
    const startTime = new Date();
    try {
      const { spec, source } = await loadRepoSpec(context);
      console.log(`📄 Spec loaded from ${source} for PR #${pr.number}`);

      // Run all gates
      const runResult = await runAllGates(context, pr, spec);
      
      if (runResult.pendingExternalGates?.length > 0) {
        // Has external gates - Subscribe & Wait pattern
        const checkResult = await context.octokit.checks.create(context.repo({
          name: PR_REVIEW_NAME,
          head_sha: pr.head.sha,
          status: "in_progress",
          started_at: startTime,
          output: {
            title: PR_REVIEW_NAME,
            summary: 'Evaluating gates...',
            text: `Running ${spec.gates?.length || 0} gates. Waiting for external workflow completion.`
          }
        }));

        // Store check_id AND spec for later updates  
        checkStateMap.set(pr.head.sha, { 
          checkId: checkResult.data.id,
          spec: spec
        });
        console.log(`📝 Created in_progress check ${checkResult.data.id} for SHA ${pr.head.sha} (pending: ${runResult.pendingExternalGates.join(', ')})`);
        
        return checkResult;
      } else {
        // Internal only - immediate completion
        return createCompletedCheck(context, runResult, pr.head.sha, startTime);
      }
      
    } catch (error) {
      console.error(`📄 Spec load failed for PR #${pr.number}:`, error);
      
      const isMissing = error?.code === 'SPEC_MISSING';
      const isInvalid = error?.code === 'SPEC_INVALID';
      
      const conclusion = (isMissing || isInvalid) ? 'failure' : 'neutral';
      const summary = isMissing
        ? 'No .cogni/repo-spec.yaml found'
        : (isInvalid ? 'Invalid .cogni/repo-spec.yaml' : 'Spec could not be loaded (transient error)');
      const text = isMissing
        ? 'Add `.cogni/repo-spec.yaml` to configure this required check.'
        : (isInvalid
            ? `Repository spec validation failed: ${error.message || 'Unknown error'}`
            : 'GitHub API/network issue while loading the spec. Re-run the check or try again.');

      return context.octokit.checks.create(context.repo({
        name: PR_REVIEW_NAME,
        head_sha: pr.head.sha,
        status: "completed",
        started_at: startTime,
        conclusion,
        completed_at: new Date(),
        output: { title: PR_REVIEW_NAME, summary, text }
      }));
    }
  }

  async function handleCheckRerun(context) {
    const checkSuite = context.payload.check_suite;
    const { head_sha: headSha } = checkSuite;

    console.log(`🔄 RERUN: Received check_suite.rerequested for suite, SHA: ${headSha}`);

    // Get PR number from check_suite.pull_requests, then fetch full PR data
    const prRef = checkSuite.pull_requests?.find(pr => pr.state === 'open') || 
                  checkSuite.pull_requests?.[0];

    if (!prRef) {
      console.log(`🔄 RERUN: No PRs found in check_suite.pull_requests`);
      return createCheckOnSha(context, {
        sha: headSha,
        conclusion: 'failure',
        summary: 'No associated PR found',
        text: 'This check only runs on PR commits. Ensure the commit belongs to an open pull request.'
      });
    }

    console.log(`🔄 RERUN: Found PR #${prRef.number} in check_suite, fetching full PR data`);
    
    try {
      // Fetch full PR data with file/diff statistics
      const { data: fullPR } = await context.octokit.pulls.get(
        context.repo({ pull_number: prRef.number })
      );
      
      console.log(`🔄 RERUN: Got full PR data - files=${fullPR.changed_files}, additions=${fullPR.additions}, deletions=${fullPR.deletions}`);
      return evaluateAndCreateCheck(context, fullPR); // Rerun with all gates
    } catch (error) {
      console.error(`🔄 Failed to fetch full PR data for PR #${prRef.number}:`, error);
      return createCheckOnSha(context, {
        sha: headSha,
        conclusion: 'neutral',
        summary: 'Could not fetch PR data',
        text: 'GitHub API issue while fetching PR details. Re-run the check or try again.'
      });
    }
  }

  /**
   * Handle workflow_run.completed events for external gate evaluation
   */
  async function handleWorkflowComplete(context) {
    const workflowRun = context.payload.workflow_run;
    console.log(`🏃 Workflow completed: ${workflowRun.name} (${workflowRun.id}), SHA: ${workflowRun.head_sha}`);

    // Find open PR matching this head_sha
    try {
      const { data: openPRs } = await context.octokit.pulls.list(context.repo({ state: 'open' }));
      const matchingPR = openPRs.find(pr => pr.head.sha === workflowRun.head_sha);
      
      if (!matchingPR) {
        console.log(`🏃 No open PR found for SHA ${workflowRun.head_sha}, skipping`);
        return;
      }

      // Staleness guard - ensure PR head hasn't changed
      const { data: currentPR } = await context.octokit.pulls.get(
        context.repo({ pull_number: matchingPR.number })
      );
      
      if (currentPR.head.sha !== workflowRun.head_sha) {
        console.log(`🏃 Stale workflow run - PR head is now ${currentPR.head.sha}, ignoring ${workflowRun.head_sha}`);
        return;
      }

      // Check if we have a check to update
      const storedState = checkStateMap.get(workflowRun.head_sha);
      if (!storedState) {
        console.log(`🏃 No check found for SHA ${workflowRun.head_sha}, creating new one`);
        return evaluateAndCreateCheck(context, currentPR, workflowRun.id);
      }

      // Add missing PR information to workflow context
      context.payload.pull_request = currentPR;
      context.storedSpec = storedState.spec;
      context.storedCheckId = storedState.checkId;
      
      // Update existing check with external gates enabled  
      await updateCheckWithExternalGates(context);
      
    } catch (error) {
      console.error(`🏃 Failed to handle workflow completion:`, error);
    }
  }

  /**
   * Update existing check run with external gate results
   */
  async function updateCheckWithExternalGates(context) {
    const startTime = new Date();
    try {
      // Extract information from enhanced context
      const pr = context.payload.pull_request;
      const spec = context.storedSpec;
      const checkId = context.storedCheckId;
      const workflowRunId = context.payload.workflow_run.id;
      
      console.log(`📄 Using stored spec for workflow update, PR #${pr.number}`);

      // Run all gates with workflow context for artifact resolution
      const runResult = await runAllGates(context, pr, spec, { 
        workflowRunId, // Pass workflow run ID for artifact resolution
        deadlineMs: 30000 // Standard timeout (30 seconds)
      });
      
      const conclusion = mapStatusToConclusion(runResult.overall_status);
      const { summary, text } = formatGateResults(runResult);
      
      // Prepare annotations (limit to 50 for MVP)
      const annotations = [];
      for (const gate of runResult.gates) {
        if (gate.violations) {
          for (const violation of gate.violations.slice(0, 50 - annotations.length)) {
            if (violation.path && violation.line) {
              annotations.push({
                path: violation.path,
                start_line: violation.line,
                end_line: violation.line,
                start_column: violation.column || 1,
                end_column: violation.column || 1,
                annotation_level: violation.level === 'error' ? 'failure' : 'warning',
                message: `${violation.code}: ${violation.message}`
              });
            }
          }
          if (annotations.length >= 50) break;
        }
      }

      // Add truncation note if needed
      const totalViolations = runResult.gates.reduce((sum, gate) => sum + (gate.violations?.length || 0), 0);
      if (totalViolations > 50) {
        text += `\n\n📝 **Note**: Showing first 50 of ${totalViolations} findings. Re-run check to see all results.`;
      }

      // Update the existing check
      await context.octokit.checks.update({
        ...context.repo(),
        check_run_id: checkId,
        status: "completed",
        conclusion,
        completed_at: new Date(),
        output: {
          title: PR_REVIEW_NAME,
          summary,
          text,
          annotations
        }
      });

      console.log(`🏃 Updated check ${checkId} with ${annotations.length} annotations, status: ${conclusion}`);
      
    } catch (error) {
      const checkId = context.storedCheckId;
      console.error(`🏃 Failed to update check ${checkId}:`, error);
      
      // Update check with error status
      await context.octokit.checks.update({
        ...context.repo(),
        check_run_id: checkId,
        status: "completed",
        conclusion: "neutral",
        completed_at: new Date(),
        output: {
          title: PR_REVIEW_NAME,
          summary: "External gate evaluation failed",
          text: `Error evaluating external gates: ${error.message}`
        }
      });
    }
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};