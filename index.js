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

  app.on("check_run.rerequested", handleCheckRerun);
  app.on(["pull_request.opened", "pull_request.synchronize"], handlePullRequest);

  async function createCheckOnSha(context, sha, conclusion, summary, text) {
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

  async function evaluateAndCreateCheck(context, pull_request) {
    const startTime = new Date();
    try {
      const { spec, source } = await loadRepoSpec(context);
      console.log(`📄 Spec loaded from ${source} for PR #${pull_request.number}`);

      const runResult = await runAllGates(context, pull_request, spec);
      
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
    const { overall_status, gates, early_exit, duration_ms } = runResult;
    
    const failedGates = gates.filter(g => g.status === 'fail');
    const neutralGates = gates.filter(g => g.status === 'neutral');
    const passedGates = gates.filter(g => g.status === 'pass');
    
    // Summary
    let summary;
    if (failedGates.length > 0) {
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
    return evaluateAndCreateCheck(context, context.payload.pull_request);
  }

  async function handleCheckRerun(context) {
    const { head_sha: headSha, name: checkName } = context.payload.check_run;

    if (checkName !== PR_REVIEW_NAME) {
      console.log(`🔄 Ignoring rerun for unrecognized check: ${checkName}`);
      return;
    }

    try {
      // Find associated PR(s) for this commit SHA
      const { data: assoc } = await context.octokit.repos.listPullRequestsAssociatedWithCommit(
        context.repo({ commit_sha: headSha })
      );

      const pull_request =
        assoc.find(pr => pr.state === 'open') || assoc[0];

      if (!pull_request) {
        // Surface a clear failure right on that SHA so users see why rerun did nothing
        return createCheckOnSha(
          context,
          headSha,
          'failure',
          'No associated PR found',
          'This check only runs on PR commits. Ensure the commit belongs to an open pull request.'
        );
      }

      return evaluateAndCreateCheck(context, pull_request);
    } catch (error) {
      console.error(`🔄 PR lookup failed during rerun for ${headSha}:`, error);
      return createCheckOnSha(
        context,
        headSha,
        'neutral',
        'Spec could not be loaded (transient error)',
        'GitHub API/network issue during rerun. Re-run the check or try again.'
      );
    }
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};