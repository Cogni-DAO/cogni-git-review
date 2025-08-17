# AGENTS.md - Cogni Git Review Bot

## Project Overview
**cogni-git-review** - CogniDAO's GitHub App that automatically evaluates pull requests against repository-defined quality gates, providing fast feedback on code changes, with the goal of keeping the codebase clean, consistent, and aligned with the project's goals.

## Core Function
The bot reads `.cogni/repo-spec.yaml` from repositories and evaluates configured quality gates on every PR. Built-in gates run directly (file limits, goal compliance, scope validation), while external gates ingest artifacts from GitHub Actions workflows. Results appear as GitHub check runs with pass/fail/neutral status.

## Architecture Overview
- **Framework**: Probot v13.4.7 (JavaScript ES modules)
- **Dynamic Gate System**: Registry-based discovery with timeout handling
- **Built-in Gates**: Direct execution within the bot process
- **External Gates**: Artifact ingestion from GitHub Actions (secure, no code execution)
- **Events**: `pull_request.opened/synchronize/reopened`, `check_suite.rerequested`, `workflow_run.completed`

## Context Architecture

### Probot Context Object
All webhook handlers receive a Probot `context` object containing:
- **context.payload**: GitHub webhook payload (varies by event type)  
- **context.octokit**: Authenticated GitHub API client
- **context.repo()**: Method returning `{ owner, repo }` from payload
- **context.log**: Structured logger

### Context Variations by Event Type

**PR Events** (`pull_request.*`):
```javascript
context.payload = {
  action: "opened|synchronize|reopened",
  pull_request: { /* complete PR data */ },
  repository: { /* repo info */ }
}
```

**Workflow Events** (`workflow_run.completed`):
```javascript  
context.payload = {
  action: "completed", 
  workflow_run: { /* workflow data */ },
  repository: { /* repo info */ }
  // NO pull_request!
}
```

**Check Events** (`check_suite.rerequested`):
```javascript
context.payload = {
  action: "rerequested",
  check_suite: { /* check data */ },
  repository: { /* repo info */ }
  // NO pull_request!
}
```

### Context Enhancement Pattern
When bridging between event types (e.g., workflow → PR gates), enhance context:
```javascript
// Add missing data to workflow context
context.payload.pull_request = prData;
context.storedSpec = spec;
// Now context has everything gates need
```

### Subscribe & Wait Pattern
External gates use an event-driven pattern:
1. **PR Event**: Create `in_progress` check, store state
2. **Workflow Event**: Retrieve stored state, update check with results
3. **Context Enhancement**: Bridge workflow context → gate execution context

## Repository Structure
```
├── index.js                    # Main bot webhook handlers
├── src/
│   ├── spec-loader.js         # Repository specification loading
│   └── gates/                 # Gate evaluation system (→ AGENTS.md)
│       ├── cogni/             # Built-in quality gates (→ AGENTS.md) 
│       └── external/          # Artifact-based linter integrations (→ AGENTS.md)
├── test/                      # Test suites and fixtures (→ AGENTS.md)
│   ├── fixtures/              # Reusable test data (→ AGENTS.md)
│   ├── integration/           # End-to-end tests (→ AGENTS.md)
│   ├── mock-integration/      # Webhook handler tests (→ AGENTS.md)
│   └── unit/                  # Isolated component tests (→ AGENTS.md)
└── .cogni/
    ├── repo-spec.yaml         # This repository's quality gates
    └── repo-spec-template.yaml # Template for new repositories
```

## Gate Configuration
Quality gates are configured in each repository's `.cogni/repo-spec.yaml`:
```yaml
gates:
  # Built-in gates (run directly)
  - id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100
  - id: goal_declaration
  - id: forbidden_scopes
  
  # External gates (ingest artifacts)
  - id: eslint
    source: external
    runner: artifact.json
    with:
      parser: eslint_json
      artifact_name: eslint-results
  - id: security-scan
    source: external
    runner: artifact.sarif
    with:
      artifact_name: security-scan
```
**Principle**: Only gates listed in the spec execute ("presence = enabled")

## Key Features
- **Dynamic gate discovery**: Gates auto-discovered from filesystem
- **Hybrid execution model**: Built-in gates run directly, external gates ingest artifacts
- **Security-first external gates**: No code execution, artifact-only ingestion
- **Timeout handling**: Partial results when execution times out
- **Robust error handling**: Gate crashes become neutral results
- **Universal linter support**: JSON/SARIF artifact ingestion for any linting tool
- **Comprehensive testing**: 102 tests covering edge cases and robustness

## Development

### Setup
```bash
npm install
npm start  # Local development with webhook proxy
npm test   # Run all 102 tests (99 pass, 2 fail, 1 skip)
```

### Key Resources
- [Probot Framework Docs](https://probot.github.io/docs/)
- [GitHub Checks API](https://docs.github.com/en/rest/checks)
- Architecture details in AGENTS.md files throughout the repository