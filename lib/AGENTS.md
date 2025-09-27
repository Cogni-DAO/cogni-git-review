# lib/AGENTS.md  

Core library implementations for Cogni operations.

## E2E Testing
- `e2e-runner.js` - E2E testing implementation with JSDoc types and environment parsing

### Usage for Agents:
```bash
# Local development testing
npm run e2e  # Uses APP_ENV=dev by default

# The E2E system:
# 1. Imports PR_REVIEW_NAME from src/constants.js (environment-aware)
# 2. Clones test repo to OS temp directory  
# 3. Creates test PR to trigger Cogni check
# 4. Waits for environment-appropriate check name:
#    - dev: "Cogni Git PR Review (dev)"
#    - preview: "Cogni Git PR Review (preview)"  
#    - prod: "Cogni Git PR Review"
# 5. Reports success/failure and cleans up

# Required env vars: TEST_REPO_GITHUB_PAT, TEST_REPO
# Optional: APP_ENV (defaults to 'dev'), TIMEOUT_SEC, SLEEP_MS
```