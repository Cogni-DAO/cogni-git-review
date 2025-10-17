/**
 * GitHub entry point - wraps Probot into CogniBaseApp interface
 * Maps context.vcs → context.octokit for GitHub compatibility
 */

import runCogniApp from '../../index.js';

/**
 * Create VCS interface that maps to Octokit
 * @param {any} octokit - Probot's octokit instance
 * @returns {any} VCS interface
 */
function createVCSInterface(octokit) {
  return {
    config: {
      get: (...args) => octokit.config.get(...args)
    },
    pulls: {
      get: (...args) => octokit.pulls.get(...args),
      listFiles: (...args) => octokit.pulls.listFiles(...args),
      create: (...args) => octokit.pulls.create(...args),
      list: (...args) => octokit.pulls.list(...args)
    },
    repos: {
      compareCommits: (...args) => octokit.repos.compareCommits(...args),
      getContent: (...args) => octokit.repos.getContent(...args),
      listPullRequestsAssociatedWithCommit: (...args) => octokit.repos.listPullRequestsAssociatedWithCommit(...args),
      get: (...args) => octokit.repos.get(...args),
      createOrUpdateFileContents: (...args) => octokit.repos.createOrUpdateFileContents(...args)
    },
    checks: {
      create: (...args) => octokit.checks.create(...args)
    },
    issues: {
      createComment: (...args) => octokit.issues.createComment(...args),
      addLabels: (...args) => octokit.issues.addLabels(...args)
    },
    git: {
      getRef: (...args) => octokit.git.getRef(...args),
      createRef: (...args) => octokit.git.createRef(...args)
    },
    rest: {
      pulls: {
        listFiles: (...args) => octokit.rest.pulls.listFiles(...args)
      }
    }
  };
}

/**
 * Wrap Probot context to add VCS interface
 * @param {any} context - Probot context
 * @returns {any} Enhanced context with VCS interface
 */
function wrapProbotContext(context) {
  // Don't create new object - just add vcs property to preserve method bindings
  context.vcs = createVCSInterface(context.octokit);
  return context;
}

/**
 * Create GitHub app factory for gateway
 * @param {Map<string, Function>} sharedHandlers - Shared handlers from gateway
 * @returns {Function} Probot app factory
 */
export const createGitHubApp = (sharedHandlers) => (app) => {
  for (const [eventName, handler] of sharedHandlers) {
    app.on(eventName, (context) => {
      const wrappedContext = wrapProbotContext(context);
      return handler(wrappedContext);
    });
  }
};

/**
 * Probot app entry point (standalone mode)
 * @param {import('probot').Probot} probotApp
 */
export default (probotApp) => {
  const cogniAppAdapter = {
    on(event, handler) {
      probotApp.on(event, (context) => {
        const wrappedContext = wrapProbotContext(context);
        return handler(wrappedContext);
      });
    }
  };
  return runCogniApp(cogniAppAdapter);
};