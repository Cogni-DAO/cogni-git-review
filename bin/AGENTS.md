# bin/AGENTS.md

CLI executables for Cogni operations.

## E2E Testing CLI
- `e2e-runner.js` - E2E testing CLI that uses `.env` file locally

### For Agents:
```bash
# Run E2E test (loads .env automatically)
npm run e2e

# The CLI:
# - Loads environment variables from .env file (via dotenv)
# - Delegates to lib/e2e-runner.js for core logic
# - Returns exit code 0 (success) or 1/2 (failure)
# - Outputs JSON summary of test results

# Check names are environment-specific:
# APP_ENV=dev → "Cogni Git PR Review (dev)"
# APP_ENV=preview → "Cogni Git PR Review (preview)"  
# APP_ENV=prod → "Cogni Git PR Review" (locked)
```