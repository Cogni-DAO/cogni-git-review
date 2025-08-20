// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

import { loadRepoSpec } from './src/spec-loader.js';
import { runAllGates } from './src/gates/index.js';

const PR_REVIEW_NAME = "Cogni Git PR Review";


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
    
    // Add AI score if available. Temporary, only functional when only 1 AI rule. gate output needs refactoring. 
    const rulesGate = gates.find(g => g.id === 'rules');
    if (rulesGate?.stats?.score !== undefined) {
      text += reviewGate?.stats ? ` | AI score=${rulesGate.stats.score}` : `**Stats:** AI score=${rulesGate.stats.score}`;
    }
    
    return { summary, text };
  }

  async function handlePullRequest(context) {
    const pr = context.payload.pull_request;
    console.log(`📝 PR Event: ${context.payload.action} for PR #${pr.number}, SHA: ${pr.head.sha}`);
    
    // Create check with in_progress status, skip external gates
    const startTime = new Date();
    try {
      const result = await loadRepoSpec(context);
      if (!result.ok) {
        // Convert error to thrown format for existing error handling
        const error = new Error(`Spec loading failed: ${result.error.code}`);
        error.code = result.error.code;
        throw error;
      }
      const spec = result.spec;
      console.log(`📄 Spec loaded from probot_config for PR #${pr.number}`);

      // Run all gates and create completed check
      const runResult = await runAllGates(context, pr, spec);
      return createCompletedCheck(context, runResult, pr.head.sha, startTime);
      
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

    // Rerun does NOT have PR information, just the head SHA. 
    // Find associated PR(s) for this commit SHA using GitHub API
    const { data: assoc } = await context.octokit.repos.listPullRequestsAssociatedWithCommit(
      context.repo({ commit_sha: headSha })
    );
    const prRef = assoc.find(pr => pr.state === 'open') || assoc[0];

    if (!prRef) {
      console.log(`🔄 RERUN: No associated PR found for SHA ${headSha}`);
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
      
      // Enhance context to look like a PR event (following context enhancement pattern)
      context.payload.pull_request = fullPR;
      context.payload.action = 'rerequested';
      
      // Delegate to existing PR handler - it already has all the logic we need
      return handlePullRequest(context);
      
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


  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};