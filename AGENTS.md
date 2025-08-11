# AGENTS.md - Cogni Git Review Bot

## Project Overview
**cogni-git-review** - CogniDAO's GitHub App built with Probot for automated code review and PR management.

This bot is incredibly new, immature, and is in its infancy. beware.

## Current Architecture
- **Framework**: Probot v13.4.7
- **Language**: JavaScript (ES modules)
- **Main Entry**: `index.js`
- **Events**: `check_suite`, `check_run`, `pull_request`

## Key Components

### Bot Functionality
- Creates "Cogni Git Review" checks on PRs
- Status progression: `in_progress` → `completed` 
- Handles re-runs via `check_run.rerequested`

### GitHub Webhook Events

#### **check_suite** Events:
- **`check_suite.requested`** - GitHub says "please run checks on this commit"
  - **Triggers**: New commit pushed, PR opened/updated 
  - **Bot creates**: "Cogni Git Commit Check"
  - **Handler**: `handleCheckSuite`

- **`check_suite.rerequested`** - User clicked "Re-run all checks"
  - **Not implemented** in current bot

- **`check_suite.completed`** - All checks in suite finished
  - **Not implemented** in current bot

#### **check_run** Events:
- **`check_run.created`** - A check run was just created (usually ignore)

- **`check_run.rerequested`** - User clicked "Re-run" on ONE specific check
  - **Bot creates**: "Cogni Git Commit Check" (re-run)
  - **Handler**: `handleCheckRerun`

- **`check_run.requested_action`** - User clicked a button in check output
  - **Not applicable** to current simple bot

#### **pull_request** Events:
- **`pull_request.opened`** - New PR created
- **`pull_request.synchronize`** - New commits pushed to PR branch
  - **Bot creates**: "Cogni Git PR Review"  
  - **Handler**: `handlePullRequest`

#### **Expected Event Flow**:
1. **Commit pushed** → `check_suite.requested` → "Cogni Git Commit Check" ✅
2. **PR opened** → `pull_request.opened` → "Cogni Git PR Review" ✅  
3. **PR updated** → `pull_request.synchronize` → "Cogni Git PR Review" ✅

### Configuration
- **Webhooks**: Configured in `app.yml` 
- **Permissions**: `checks: write`, `pull_requests: read`, `metadata: read`
- **Local Dev**: Uses smee.io proxy for webhook forwarding


**Important Note from app.yml:**
```yaml
# NOTE: changing this file will not update your GitHub App settings.
# You must visit github.com/settings/apps/your-app-name to edit them.
```
**Human Intervention Required**: for any feature that requires a change in permission. Human must update app permissions, and then installations must accept the new permissions.

## Development Workflow

### Setup
```bash
npm install
npm start  # Starts on localhost:3000 with smee proxy
```

### Testing

**Testing Implementation Guidelines**: cogni memory block id: 80320208-7d7c-4859-bbbf-07e96b3c92d4

https://probot.github.io/docs/testing/?utm_source=chatgpt.com

**Debugging webhook delivery**: Check smee.io URL directly: https://smee.io/LhGHiP1UNnaXgLGi

```bash
npm test  # Runs Node.js native tests with nock mocks
```

### Files Structure
- `index.js` - Main bot logic
- `app.yml` - GitHub App manifest (permissions/events)
- `test/` - Test fixtures and specs
- `test/fixtures/` - Mock webhook payloads and certs


## Resources
- [Probot Docs](https://probot.github.io/docs/)
- [GitHub Checks API](https://docs.github.com/en/rest/checks)