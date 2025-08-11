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

### Configuration
- **Webhooks**: Configured in `app.yml` 
- **Permissions**: `checks: write`, `pull_requests: read`, `metadata: read`
- **Local Dev**: Uses smee.io proxy for webhook forwarding

## Development Workflow

### Setup
```bash
npm install
npm start  # Starts on localhost:3000 with smee proxy
```

### Testing

**Testing Implementation Guidelines**: cogni memory block id: 80320208-7d7c-4859-bbbf-07e96b3c92d4

https://probot.github.io/docs/testing/?utm_source=chatgpt.com

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