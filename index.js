// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

import { loadRepoSpec } from './src/spec-loader.js';

const CHECK_NAME = "Cogni Git Commit Check";
const PR_REVIEW_NAME = "Cogni Git PR Review";
const SPEC_PATH = '.cogni/repo-spec.yaml';

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
  // Debug: Log ALL webhook events
  app.onAny((context) => {
    console.log(`🔍 EVENT: ${context.name}.${context.payload.action || 'no-action'}`);
  });

  app.on("check_suite.requested", handleCheckSuite);
  app.on("check_run.rerequested", handleCheckRerun);
  app.on(["pull_request.opened", "pull_request.synchronize"], handlePullRequest);

  async function handleCheckSuite(context) {
    const startTime = new Date();
    const { head_branch: headBranch, head_sha: headSha } =
      context.payload.check_suite;

    return context.octokit.checks.create(
      context.repo({
        name: CHECK_NAME,
        head_branch: headBranch,
        head_sha: headSha,
        status: "completed",
        started_at: startTime,
        conclusion: "success",
        completed_at: new Date(),
        output: {
          title: CHECK_NAME,
          summary: "MOCK Code review completed successfully!",
        },
      }),
    );
  }

  async function handleCheckRerun(context) {
    const startTime = new Date();
    const { head_sha: headSha } = context.payload.check_run;

    // TODO - no repeat logic. Directly call the handlechecksuite again
    return context.octokit.checks.create(
      context.repo({
        name: CHECK_NAME,
        head_sha: headSha,
        status: "completed",
        started_at: startTime,
        conclusion: "success",
        completed_at: new Date(),
        output: {
          title: CHECK_NAME,
          summary: "MOCK Code review re-run completed successfully!",
        },
      }),
    );
  }

  async function handlePullRequest(context) {
    const startTime = new Date();
    const { pull_request } = context.payload;

    // NEW: Load repository spec
    const { spec, source, error } = await loadRepoSpec(context, pull_request.head.sha);
    console.log(`📄 Spec loaded from ${source} for PR #${pull_request.number}`);
    
    // Determine check behavior based on spec
    const checkName = spec.gates.check_presentation?.name || PR_REVIEW_NAME;
    let conclusion = "success";
    let summary = `PR #${pull_request.number} reviewed by Cogni Git Review`;
    
    // Handle missing/invalid spec cases
    if (source === 'default' && spec.gates.on_missing_spec === 'neutral_with_annotation') {
      conclusion = "neutral";
      summary = error 
        ? `Spec validation failed: ${error}. Using default configuration.`
        : `No .cogni/repo-spec.yaml found. Using default configuration.`;
    }

    // For now, keep the existing mock behavior but with spec-aware messaging
    return context.octokit.checks.create(
      context.repo({
        name: checkName,
        head_sha: pull_request.head.sha,
        status: "completed",
        started_at: startTime,
        conclusion,
        completed_at: new Date(),
        output: {
          title: checkName,
          summary,
          text: source === 'file' 
            ? `✅ Repository spec loaded successfully from ${SPEC_PATH}\n\nMode: ${spec.gates.spec_mode}\nCurrent implementation: MOCK (local gates coming soon)`
            : `ℹ️ No repository spec found at ${SPEC_PATH}\n\nFalling back to default configuration.\n\nTo configure this repository, add a .cogni/repo-spec.yaml file.`
        },
      }),
    );
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
