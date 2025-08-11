// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

const CHECK_NAME = "Cogni Git Review";

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default (app) => {
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
          summary: "Code review completed successfully!",
        },
      }),
    );
  }

  async function handleCheckRerun(context) {
    const startTime = new Date();
    const { head_sha: headSha } = context.payload.check_run;
    
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
          summary: "Code review re-run completed successfully!",
        },
      }),
    );
  }

  async function handlePullRequest(context) {
    const startTime = new Date();
    const { pull_request } = context.payload;
    
    // Mock: Create and immediately complete check run
    return context.octokit.checks.create(
      context.repo({
        name: CHECK_NAME,
        head_sha: pull_request.head.sha,
        status: "completed",
        started_at: startTime,
        conclusion: "success",
        completed_at: new Date(),
        output: {
          title: CHECK_NAME,
          summary: `Pull request #${pull_request.number} reviewed and approved by Git Cogni v1.0`,
        },
      }),
    );
  }

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
