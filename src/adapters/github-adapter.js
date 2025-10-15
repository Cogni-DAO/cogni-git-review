/**
 * GitHub Adapter - Implements Context interface by delegating to Probot context
 * Preserves existing GitHub functionality while providing host abstraction
 * @typedef {import('./base-context.d.ts').BaseContext} BaseContext
 */

/**
 * GitHub implementation of BaseContext interface
 * @implements {BaseContext}
 */
export class GitHubAdapter {
  /**
   * @param {import('probot').Context} probotContext - Probot context from webhook
   */
  constructor(probotContext) {
    this._probotContext = probotContext;
  }

  // Delegate payload directly to Probot context
  get payload() {
    return this._probotContext.payload;
  }

  // Delegate repo method directly to Probot context
  repo(options = {}) {
    return this._probotContext.repo(options);
  }

  // Delegate octokit directly to Probot context
  get octokit() {
    return this._probotContext.octokit;
  }

  // Delegate logging directly to Probot context
  get log() {
    return this._probotContext.log;
  }

  // Runtime properties (set by gate orchestrator)
  pr = undefined;
  spec = undefined;
  annotation_budget = undefined;
  idempotency_key = undefined;
  reviewLimitsConfig = undefined;

  // Backward compatibility helper
  getProbotContext() {
    return this._probotContext;
  }
}