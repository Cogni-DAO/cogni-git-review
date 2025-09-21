// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

import { loadRepoSpec } from './src/spec-loader.js';
import { runAllGates } from './src/gates/index.js';
import { postPRCommentWithGuards } from './src/pr-comment.js';
import { renderCheckSummary } from './src/summary-adapter.js';
import { resolvePrRef, createNeutralCheckOnSha, handleCheckRunRerun } from './src/rerun-handlers.js';

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
  app.on("check_run.rerequested", (context) => handleCheckRunRerun(context, handlePullRequest));
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
    const { summary, text } = renderCheckSummary(runResult);

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


  async function handlePullRequest(context) {
    const pr = context.payload.pull_request;
    const headShaStart = pr.head.sha;
    console.log(`📝 PR Event: ${context.payload.action} for PR #${pr.number}, SHA: ${headShaStart}`);
    
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
      const checkResult = await createCompletedCheck(context, runResult, pr.head.sha, startTime);
      
      // Post PR comment if not neutral
      const conclusion = mapStatusToConclusion(runResult.overall_status);
      if (conclusion !== 'neutral') {
        await postPRCommentWithGuards(context, runResult, checkResult.data.html_url, headShaStart, pr.number);
      }
      
      return checkResult;
      
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
    const { head_sha: headSha, head_branch: headBranch } = checkSuite;

    console.log(`🔄 RERUN: Received check_suite.rerequested for suite, SHA: ${headSha}`);

    // Use deterministic PR resolution
    const prRef = await resolvePrRef(context, { headSha, headBranch });

    if (!prRef) {
      console.log(`🔄 RERUN: Ambiguous PR resolution for SHA ${headSha} - marking neutral`);
      return createNeutralCheckOnSha(context, headSha);
    }

    console.log(`🔄 RERUN: Found PR #${prRef.number} in check_suite, fetching full PR data`);
    
    try {
      // Fetch full PR data with file/diff statistics
      const { data: fullPR } = await context.octokit.pulls.get(
        context.repo({ pull_number: prRef.number })
      );
      
      console.log(`🔄 RERUN: Got full PR data - files=${fullPR.changed_files}, additions=${fullPR.additions}, deletions=${fullPR.deletions}`);
      
      // Enhance context to look like a PR event
      context.payload.pull_request = fullPR;
      context.payload.action = 'rerequested';
      
      // Delegate to existing PR handler
      return handlePullRequest(context);
      
    } catch (error) {
      console.error(`🔄 Failed to fetch full PR data for PR #${prRef.number}:`, error);
      return createNeutralCheckOnSha(context, headSha);
    }
  }



  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};