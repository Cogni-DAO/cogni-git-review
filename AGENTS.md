# AGENTS.md - Cogni Git Review Bot

## Project Overview
**cogni-git-review** - CogniDAO's GitHub App that automatically evaluates pull requests against repository-defined quality gates, providing fast feedback on code changes, with the goal of keeping the codebase clean, consistent, and aligned with the project's goals.

## Core Function
The bot reads `.cogni/repo-spec.yaml` from repositories and runs configured quality gates (file limits, goal compliance, scope validation) on every PR. Results appear as GitHub check runs with pass/fail/neutral status.

## Architecture Overview
- **Framework**: Probot v13.4.7 (JavaScript ES modules)
- **Dynamic Gate System**: Registry-based discovery with timeout handling
- **Events**: `pull_request`, `check_run`, `check_suite`

## Repository Structure
```
├── index.js                    # Main bot webhook handlers
├── src/
│   ├── spec-loader.js         # Repository specification loading
│   └── gates/                 # Gate evaluation system (→ AGENTS.md)
│       └── cogni/             # Built-in quality gates (→ AGENTS.md)
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
  - id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100
  - id: goal_declaration
  - id: forbidden_scopes
```
**Principle**: Only gates listed in the spec execute ("presence = enabled")

## Key Features
- **Dynamic gate discovery**: Gates auto-discovered from filesystem
- **Timeout handling**: Partial results when execution times out
- **Robust error handling**: Gate crashes become neutral results
- **Comprehensive testing**: 60 tests covering edge cases and robustness

## Development

### Setup
```bash
npm install
npm start  # Local development with webhook proxy
npm test   # Run all 60 tests (59 pass, 1 skip)
```

### Key Resources
- [Probot Framework Docs](https://probot.github.io/docs/)
- [GitHub Checks API](https://docs.github.com/en/rest/checks)
- Architecture details in AGENTS.md files throughout the repository