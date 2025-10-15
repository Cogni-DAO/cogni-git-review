/**
 * GitHub Adapter - Wraps Probot context for host abstraction
 * Minimal wrapper preserving existing GitHub functionality
 */

import { HostAdapter } from './host-adapter.js';

export class GitHubAdapter extends HostAdapter {
  constructor(probotContext) {
    super();
    this.context = probotContext;
  }

  async getFileList(prNumber) {
    const { owner, repo } = this.context.repo();
    const { data: files } = await this.context.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });
    return files;
  }

  async getDiff(baseRef, headRef) {
    const { data: comparison } = await this.context.octokit.repos.compareCommits(
      this.context.repo({ base: baseRef, head: headRef })
    );
    return comparison;
  }

  async loadConfig(path) {
    // Security: only allow .cogni/ prefix, forbid traversal
    if (!path.startsWith('.cogni/') || path.includes('..')) {
      throw new Error(`Invalid cogni path: ${path}`);
    }
    
    const { owner, repo } = this.context.repo();
    return await this.context.octokit.config.get({ owner, repo, path });
  }

  async publishResults(results) {
    // This will be implemented to maintain existing GitHub Checks API logic
    // For now, this is a placeholder that will delegate to existing check creation
    throw new Error('publishResults not yet implemented for GitHub adapter');
  }

  getLogger() {
    return this.context.log;
  }

  getRepoInfo() {
    return this.context.repo();
  }

  // Additional helper for backward compatibility
  getProbotContext() {
    return this.context;
  }
}