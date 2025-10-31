# E2E - Unified Playwright E2E Testing Framework

**Production E2E testing framework** for GitHub and GitLab webhook integration validation.

## Purpose
- GitHub PR and GitLab MR webhook integration testing
- PR/MR creation → Cogni processing → check/status validation
- DAO vote proposal link validation for failed reviews
- Unified test runner replacing legacy CLI-based implementation

## Key Files
- `tests/` - GitHub and GitLab E2E test specifications
  - `github-pr-failing-vote-link.spec.js` - DAO vote proposal URL validation for failing PRs
- `helpers/` - Shared test configuration and utilities
  - `github-e2e-helper.js` - GitHub test utilities: createTestPR, waitForCogniCheck, cleanupTestResources
- `artifacts/` - Test reports, videos, and traces (gitignored)

## Test Configuration
- **Config File**: `playwright.config.js` at repository root
- **Projects**: Separate configurations for `github-e2e` and `gitlab-e2e`
- **Reporters**: HTML reports, JSON results, console output
- **Artifacts**: Collected on failure (videos, traces) for debugging

## CI/CD Integration
Used in GitHub Actions workflows for preview and production E2E validation. Artifacts automatically uploaded for debugging failed tests.