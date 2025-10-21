# E2E Helpers - Test Configuration and Utilities

Shared utilities for Playwright E2E tests supporting both GitHub and GitLab providers.

## Key Files
- `test-config.js` - Environment validation and configuration exports for GitLab tests

## Configuration

### GitHub E2E Environment Variables
GitHub tests use environment variables directly in test files:
- `TEST_REPO_GITHUB_PAT` - GitHub PAT for API access
- `TEST_REPO` - Target repository (default: `Cogni-DAO/test-repo`)
- `APP_ENV` - Environment name for check name computation
- `TIMEOUT_SEC` - Webhook processing timeout (default: 480 seconds)
- `SLEEP_MS` - Poll interval for check status (default: 5000ms)

### GitLab E2E Environment Variables
GitLab tests validate configuration through `test-config.js`:
- `GITLAB_E2E_TEST_REPO_PAT` - GitLab PAT for API access
- `GITLAB_E2E_TEST_REPO` - Target repository (e.g., `username/repo`)  
- `GITLAB_E2E_APP_DEPLOYMENT_URL` - App deployment to test against

**Purpose**: Centralized config validation with fail-fast behavior and provider-specific configuration management.