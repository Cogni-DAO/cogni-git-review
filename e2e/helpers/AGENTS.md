# E2E Helpers - Test Configuration and Utilities

Shared utilities for Playwright E2E tests.

## Key Files
- `test-config.js` - Environment validation and configuration exports

## Configuration
Validates required GitLab E2E environment variables:
- `GITLAB_E2E_TEST_REPO_PAT` - GitLab PAT for API access
- `GITLAB_E2E_TEST_REPO` - Target repository (e.g., `username/repo`)  
- `GITLAB_E2E_APP_DEPLOYMENT_URL` - App deployment to test against

**Purpose**: Centralized config validation with fail-fast behavior.