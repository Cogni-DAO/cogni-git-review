/**
 * GitLab entry point - minimal adapter like local-cli.js
 * Implements CogniBaseApp interface for GitLab integration
 */

import runCogniApp from '../../index.js';
import { GitLabCogniApp } from './gitlab/gitlab-app.js';
import { startWebhookServer } from './gitlab/webhook-server.js';

/**
 * Initialize GitLab adapter
 * @returns {GitLabCogniApp} GitLab app instance
 */
export default function initializeGitLabAdapter() {
  // Create GitLab app (implements CogniBaseApp interface)
  const gitLabApp = new GitLabCogniApp();
  
  // Register with core Cogni app
  runCogniApp(gitLabApp);
  
  // Start Express webhook server
  startWebhookServer(gitLabApp);
  
  return gitLabApp;
}