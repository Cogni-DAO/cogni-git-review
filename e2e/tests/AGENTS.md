# E2E Tests - Playwright Test Specifications

Test files for GitLab E2E workflow validation.

## Current Tests
- `gitlab-mr-review.spec.js` - Complete GitLab MR → Cogni status workflow

## Test Pattern
1. Create test MR in GitLab repository
2. Wait for Cogni webhook processing
3. Poll GitLab API for commit status updates
4. Validate expected status conclusion
5. Cleanup: close MR, delete branch

**Run**: `npm run e2e:gitlab`