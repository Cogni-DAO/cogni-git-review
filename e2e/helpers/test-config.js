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
    throw new Error(`Missing required GitLab E2E environment variables: ${missing.join(', ')}`);
  }
}

export const testConfig = {
  // GitLab E2E Configuration (from environment)
  GITLAB_TOKEN: process.env.GITLAB_E2E_TEST_REPO_PAT,
  GITLAB_TEST_REPO: process.env.GITLAB_E2E_TEST_REPO,
  GITLAB_E2E_APP_DEPLOYMENT_URL: process.env.GITLAB_E2E_APP_DEPLOYMENT_URL,
  
  // Expected check name from constants (consistent with GitHub e2e)
  EXPECTED_CHECK_NAME: PR_REVIEW_NAME,
  
  // Timeouts with defaults
  GITLAB_WEBHOOK_TIMEOUT_MS: parseInt(process.env.GITLAB_E2E_WEBHOOK_TIMEOUT_MS || '120000'),
  GITLAB_POLL_INTERVAL_MS: parseInt(process.env.GITLAB_E2E_POLL_INTERVAL_MS || '5000'),
  
  // Validate environment on import
  validate() {
    validateEnvironment([
      'GITLAB_E2E_TEST_REPO_PAT',
      'GITLAB_E2E_TEST_REPO', 
      'GITLAB_E2E_APP_DEPLOYMENT_URL'
    ]);
  }
};