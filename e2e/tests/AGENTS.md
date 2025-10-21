# E2E Tests - Playwright Test Specifications

Test files for GitHub and GitLab E2E workflow validation.

## Current Tests
- `github-pr-review.spec.js` - Complete GitHub PR → Cogni check workflow (ported from legacy)
- `gitlab-mr-review.spec.js` - Complete GitLab MR → Cogni status workflow

## Test Pattern
1. Create test PR/MR in repository
2. Wait for Cogni webhook processing
3. Poll API for check/status updates
4. Validate expected conclusion
5. Cleanup: close PR/MR, delete branch

## Commands
- `npm run e2e` - Run all E2E tests (GitHub + GitLab)
- `npm run e2e:github` - Run GitHub tests only
- `npm run e2e:gitlab` - Run GitLab tests only