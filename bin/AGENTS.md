# bin/AGENTS.md

CLI executables for Cogni operations.

## E2E Testing CLI
- `e2e-runner.js` - E2E testing CLI with direct `process.env` access (ESLint exempted)

### For Agents:
```bash
# Run E2E test
npm run e2e

# The CLI:
# - Has ESLint exemption for direct process.env access
# - Delegates to lib/e2e-runner.js for core logic
# - Returns exit code 0 (success) or 1/2 (failure)
# - Outputs JSON summary of test results
# - Environment variables loaded via centralized /src/env.js when imported

# Check names are environment-specific (controlled by APP_ENV):
# APP_ENV=dev → "Cogni Git PR Review (dev)"
# APP_ENV=preview → "Cogni Git PR Review (preview)"  
# APP_ENV=prod → "Cogni Git PR Review" (locked)
```