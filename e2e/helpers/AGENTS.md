# E2E Helpers - Test Configuration and Utilities

Shared utilities for Playwright E2E tests supporting both GitHub and GitLab providers.

## Key Files
- `test-config.js` - Environment validation and configuration exports for GitLab tests
- `github-e2e-helper.js` - GitHub E2E utilities including PR management, check polling, and dynamic DAO config fetching

## Configuration

### GitHub E2E Environment Variables
GitHub tests use environment variables directly in test files:
- `E2E_GITHUB_PAT` - GitHub PAT for API access
- `E2E_GITHUB_REPO` - Target repository (default: `Cogni-DAO/test-repo`)
- `APP_ENV` - Environment name for check name computation
- `TIMEOUT_SEC` - Webhook processing timeout (default: 480 seconds)
- `SLEEP_MS` - Poll interval for check status (default: 5000ms)

**Prerequisites for GitHub E2E Tests:**
- GitHub CLI (`gh`) installed and available in PATH
- Valid GitHub PAT with repo access
- Target repository accessible for PR creation/deletion

### GitLab E2E Environment Variables
GitLab tests validate configuration through `test-config.js`:
- `E2E_GITLAB_PAT` - GitLab PAT for API access
- `E2E_GITLAB_REPO` - Target repository (e.g., `username/repo`)  
- `E2E_GITLAB_DEPLOYMENT_URL` - App deployment to test against

**Purpose**: Centralized config validation with fail-fast behavior and provider-specific configuration management.

## GitHub Helper Functions

### Repository Configuration
- `fetchTestRepoSpec()` - Fetches DAO configuration from test repository's `.cogni/repo-spec.yaml` using GitHub API
- `extractCogniDaoConfig()` - Simple YAML parser for cogni_dao section (dao_contract, plugin_contract, signal_contract, chain_id)

### Dependencies
- GitHub CLI (`gh`) for API access
- Manual YAML parsing to avoid additional dependencies