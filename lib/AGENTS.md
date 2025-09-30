# lib/AGENTS.md  

Core library implementations for Cogni operations. Currently, just an e2e test runner.

## E2E Testing
- `e2e-runner.js` - Creates test PRs, waits for Cogni checks, reports results, and always cleans up test PRs/branches. Outputs JSON with `cogniFullOutput`

## Environment
```bash
    ghToken: env('TEST_REPO_GITHUB_PAT')
    testRepo: env('TEST_REPO', 'Cogni-DAO/test-repo')
    checkName: PR_REVIEW_NAME
```

### Usage for Agents:
```bash
# Local development testing
npm run e2e

# The E2E system:
# 1. Sets up env
# 2. Clones TEST_REPO to OS temp directory  
# 3. Creates test PR to trigger Cogni check
# 4. Waits for Cogni check completion
# 5. Reports success/failure 
# 6. Always cleans up test PR and branch
# 7. Cleans up temp directory

# Required env vars: TEST_REPO_GITHUB_PAT, TEST_REPO
# Optional: TIMEOUT_SEC (default: 120), SLEEP_MS (default: 10000)
```