/**
 * E2E Test Configuration for GitLab Integration
 * 
 * Centralized configuration for GitLab E2E tests with environment validation
 */

import { PR_REVIEW_NAME } from '../../src/constants.js';

/**
 * Validate required environment variables
 * @param {string[]} requiredVars - Array of required environment variable names
 */
function validateEnvironment(requiredVars) {
  const missing = requiredVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(`Missing required E2E environment variables: ${missing.join(', ')}`);
  }
}

// Unified E2E Configuration with consistent naming
export const testConfig = {
  // GitHub E2E Configuration
  GITHUB_TOKEN: process.env.E2E_GITHUB_PAT,
  GITHUB_TEST_REPO: process.env.E2E_GITHUB_REPO || 'Cogni-DAO/test-repo',
  
  // GitLab E2E Configuration
  GITLAB_TOKEN: process.env.E2E_GITLAB_PAT,
  GITLAB_TEST_REPO: process.env.E2E_GITLAB_REPO,
  GITLAB_DEPLOYMENT_URL: process.env.E2E_GITLAB_DEPLOYMENT_URL,
  
  // Expected check name from constants
  EXPECTED_CHECK_NAME: PR_REVIEW_NAME,
  
  // Timeouts with defaults
  GITHUB_WEBHOOK_TIMEOUT_MS: parseInt(process.env.TIMEOUT_SEC || '480', 10) * 1000,
  GITHUB_POLL_INTERVAL_MS: parseInt(process.env.SLEEP_MS || '5000', 10),
  GITLAB_WEBHOOK_TIMEOUT_MS: parseInt(process.env.E2E_GITLAB_WEBHOOK_TIMEOUT_MS || '120000'),
  GITLAB_POLL_INTERVAL_MS: parseInt(process.env.E2E_GITLAB_POLL_INTERVAL_MS || '5000'),
  
  // Validate GitLab environment variables only
  validate() {
    validateEnvironment([
      'E2E_GITLAB_PAT',
      'E2E_GITLAB_REPO'
      // E2E_GITLAB_DEPLOYMENT_URL is optional (has default in playwright.config.js)
    ]);
  },
  
  // Validate both GitHub and GitLab environment variables for unified test runs
  validateAll() {
    validateEnvironment([
      'E2E_GITHUB_PAT',          // GitHub E2E
      'E2E_GITLAB_PAT',          // GitLab E2E
      'E2E_GITLAB_REPO'          // GitLab E2E
      // E2E_GITHUB_REPO has default, E2E_GITLAB_DEPLOYMENT_URL has default
    ]);
  }
};