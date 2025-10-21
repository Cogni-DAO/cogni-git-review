# E2E - Playwright E2E Testing (GitLab PoC)

**Minimal proof of concept** for GitLab E2E testing using Playwright framework.

## Purpose
- GitLab webhook integration testing
- MR creation → Cogni processing → commit status validation
- Alternative to legacy CLI-based E2E runner (`lib/e2e-runner.js`)

## Key Files
- `tests/` - Playwright test specifications
- `helpers/` - Test configuration and utilities  
- `artifacts/` - Test reports and results (gitignored)

**Note**: Not used in CI/CD. Future work will migrate to Playwright-only testing.