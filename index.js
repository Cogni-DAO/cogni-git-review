// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

import { loadRepoSpec } from './src/spec-loader.js';
import { runAllGates } from './src/gates/index.js';

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

    try {
      // Load repository spec (fail fast - throws on error)
      const { spec, source } = await loadRepoSpec(context, pull_request.head.sha);
      console.log(`📄 Spec loaded from ${source} for PR #${pull_request.number}`);
      
      // Valid spec loaded - evaluate local gates
      const checkName = spec.gates.check_presentation?.name || PR_REVIEW_NAME;
      
      // Run all gate evaluations
      const results = await runAllGates(context, pull_request, spec);
      
      // Map evaluation results to check conclusion
      let conclusion = 'success';
      if (results.oversize) {
        conclusion = 'neutral';
      } else if (results.violations.length) {
        conclusion = 'failure';
      }
      
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
            summary: results.violations.length ? 
              `Limit breaches: ${results.violations.length}` : 'Review limits OK',
            text: `files=${results.stats.changed_files} | diff_kb=${results.stats.total_diff_kb}\n\n` +
              (results.violations.length ? 
                `Violations:\n${results.violations.map(v => `• ${v.rule}: ${v.actual} > ${v.limit}`).join('\n')}` :
                '✅ All review limits satisfied')
          },
        }),
      );
    } catch (error) {
      // Spec loading failed - create neutral check with error details
      console.log(`📄 Spec loading failed for PR #${pull_request.number}: ${error.message}`);
      
      return context.octokit.checks.create(
        context.repo({
          name: PR_REVIEW_NAME, // Use default name when no spec
          head_sha: pull_request.head.sha,
          status: "completed",
          started_at: startTime,
          conclusion: "neutral",
          completed_at: new Date(),
          output: {
            title: PR_REVIEW_NAME,
            summary: error.message.includes('Not Found') 
              ? `No .cogni/repo-spec.yaml found`
              : `Invalid .cogni/repo-spec.yaml`,
            text: error.message.includes('Not Found')
              ? `No repository spec file found. Add .cogni/repo-spec.yaml to configure this check.`
              : `Repository spec validation failed: ${error.message}. Fix the spec file to enable enforcement.`
          },
        }),
      );
    }
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
