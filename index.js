// Github Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

import { loadRepoSpec } from './src/spec-loader.js';
import { runAllGates } from './src/gates/index.js';
import { postPRCommentWithGuards } from './src/pr-comment.js';
import { renderCheckSummary } from './src/summary-adapter.js';
import { handleInstallationAdded } from './src/setup/installation-handler.js';
import { PR_REVIEW_NAME } from './src/constants.js';
import { getRequestLogger } from './src/logging/index.js';


/**
 * Host-agnostic Cogni app core
 * @param {import('./src/adapters/base-app.d.ts').CogniBaseApp} app
 */
export default (app) => {
  const short = (sha) => sha?.slice(0, 7) || 'unknown';

  // Always log rerun events for debugging
  app.on("check_run", (context) => {
    if (context.payload.action === 'rerequested') {
      const log = getRequestLogger(context, { module: 'webhook', code: 'rerun' });
      log.info({ check_name: context.payload.check_run?.name }, 'check_run rerequested');
    }
  });

  app.on("check_suite", (context) => {
    if (context.payload.action === 'rerequested') {
      const log = getRequestLogger(context, { module: 'webhook', code: 'rerun' });
      log.info({ suite_id: context.payload.check_suite?.id }, 'check_suite rerequested');
    }
  });

  app.on("check_suite.rerequested", handleCheckRerun);
  app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], handlePullRequest);
  app.on("installation_repositories.added", handleInstallationAdded);

  async function createCheckOnSha(context, options) {
    const { sha, conclusion, summary, text } = options;
    const started_at = new Date();
    return context.vcs.checks.create(context.repo({
      name: PR_REVIEW_NAME,
      head_sha: sha,
      status: "completed",
      started_at,
      conclusion,
      completed_at: new Date(),
      output: { title: PR_REVIEW_NAME, summary, text }
    }));
  }

  async function createCompletedCheck(context, runResult, headSha, startTime, log) {
    const conclusion = mapStatusToConclusion(runResult.overall_status, context.spec.fail_on_error);
    const { summary, text } = renderCheckSummary(runResult);

    const checkResult = await context.vcs.checks.create(context.repo({
      name: PR_REVIEW_NAME,
      head_sha: headSha,
      status: "completed",
      started_at: startTime,
      conclusion,
      completed_at: new Date(),
      output: { title: PR_REVIEW_NAME, summary, text }
    }));

    log.info({ check_id: checkResult.data.id, sha: short(headSha), conclusion }, 'created completed check');
    return checkResult;
  }


  /**
   * Map tri-state status to GitHub check conclusion
   */
  function mapStatusToConclusion(status, errorOnNeutral) {
    const default_response = errorOnNeutral ? 'failure' : 'neutral';

    switch (status) {
      case 'pass': return 'success';
      case 'fail': return 'failure';
      case 'neutral': return default_response;
      default: return default_response;
    }
  }


  async function handlePullRequest(context) {
    const started = Date.now();
    const pr = context.payload.pull_request;
    const headShaStart = pr.head.sha;
    const log = getRequestLogger(context, { module: 'webhook', code: 'pr-handler', route: 'pull_request', event: context.payload.action, pr: pr.number });
    log.info({ sha: short(headShaStart) }, 'PR handler started');
    
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
      log.info('spec loaded from probot_config');

      // Run all gates and create completed check
      const runResult = await runAllGates(context, pr, spec, log);
      const checkResult = await createCompletedCheck(context, runResult, pr.head.sha, startTime, log);
      
      // Post PR comment always
      await postPRCommentWithGuards(context, runResult, checkResult.data.html_url, headShaStart, pr.number, log);
      
      log.info({ duration_ms: Date.now() - started, conclusion: mapStatusToConclusion(runResult.overall_status) }, 'PR handler completed');
      return checkResult;
      
    } catch (error) {
      const conclusion = error?.code === 'SPEC_MISSING' ? 'neutral' : (error?.code === 'SPEC_INVALID' ? 'failure' : 'neutral');
      log.error({ err: error, duration_ms: Date.now() - started, conclusion }, 'PR handler failed');
      
      // Handle spec errors by creating informative checks (these are application conditions, not HTTP errors)
      if (error?.code === 'SPEC_MISSING' || error?.code === 'SPEC_INVALID') {
        const isMissing = error?.code === 'SPEC_MISSING';
        const summary = isMissing
          ? 'Cogni needs a repo-spec'
          : 'Invalid .cogni/repo-spec.yaml';
        const text = isMissing
          ? 'Please merge the Welcome PR to configure Cogni, or add `.cogni/repo-spec.yaml` manually.'
          : `Repository spec validation failed: ${error.message || 'Unknown error'}`;

        return await createCheckOnSha(context, {
          sha: pr.head.sha,
          conclusion,
          summary,
          text
        });
      }
      
      // For real errors (network, auth, etc.), rethrow to maintain gateway HTTP error handling
      throw error;
    }
  }

  async function handleCheckRerun(context) {
    const started = Date.now();
    const checkSuite = context.payload.check_suite;
    const { head_sha: headSha } = checkSuite;
    const log = getRequestLogger(context, { module: 'webhook', code: 'rerun-handler', route: 'check_suite', event: 'rerequested' });

    log.info({ sha: short(headSha) }, 'check rerun handler started');

    // Rerun does NOT have PR information, just the head SHA. 
    // Find associated PR(s) for this commit SHA using GitHub API
    const { data: assoc } = await context.vcs.repos.listPullRequestsAssociatedWithCommit(
      context.repo({ commit_sha: headSha })
    );
    const prRef = assoc.find(pr => pr.state === 'open') || assoc[0];

    if (!prRef) {
      log.info({ sha: short(headSha), duration_ms: Date.now() - started }, 'check rerun handler completed: no PR found');
      return createCheckOnSha(context, {
        sha: headSha,
        conclusion: 'failure',
        summary: 'No associated PR found',
        text: 'This check only runs on PR commits. Ensure the commit belongs to an open pull request.'
      });
    }

    log.info({ pr: prRef.number }, 'found PR for rerun, fetching full data');
    
    try {
      // Fetch full PR data with file/diff statistics
      const { data: fullPR } = await context.vcs.pulls.get(
        context.repo({ pull_number: prRef.number })
      );
      
      log.info({ files: fullPR.changed_files, additions: fullPR.additions, deletions: fullPR.deletions }, 'got full PR data for rerun');
      
      // Enhance context to look like a PR event (following context enhancement pattern)
      context.payload.pull_request = fullPR;
      context.payload.action = 'rerequested';
      
      // Delegate to existing PR handler - it already has all the logic we need
      const result = await handlePullRequest(context);
      log.info({ duration_ms: Date.now() - started }, 'check rerun handler completed');
      return result;
      
    } catch (error) {
      log.error({ err: error, pr: prRef.number, duration_ms: Date.now() - started }, 'check rerun handler failed');
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