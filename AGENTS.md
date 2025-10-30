# AGENTS.md - Cogni Git Review Bot

## Project Overview
**cogni-git-review** - CogniDAO's GitHub App that automatically evaluates pull requests against repository-defined quality gates, providing fast feedback on code changes, with the goal of keeping the codebase clean, consistent, and aligned with the project's goals.

## Core Function
The bot reads `.cogni/repo-spec.yaml` from repositories and evaluates configured quality gates on every PR/MR. Detailed results appear as GitHub check runs or GitLab commit statuses with pass/fail/neutral status, and a brief summary is commented on the PR/MR. 

## Architecture Overview
- **Host-Agnostic Core**: App logic abstracted from VCS providers via interface layers
- **Two-Layer Interface Design**: CogniBaseApp (app abstraction) + BaseContext (context abstraction)
- **Gateway Architecture**: Single Express server handling multiple providers at `/api/v1/webhooks/{provider}`
- **Framework**: Multi-provider gateway with shared handler registration
- **Unified Gate System**: All gates execute immediately
- **Dynamic Gate Discovery**: Registry-based discovery with timeout handling
- **Events**: `pull_request.opened/synchronize/reopened`, `check_suite.rerequested`
- **AI Provider Architecture**: Generic workflow router with no domain-specific logic
- **Centralized Logging**: Grafana Cloud Loki integration for production log aggregation
- **Auto Smee Proxy**: Gateway automatically launches smee clients for webhook proxying in dev mode

## Agent Team
You are on a team full of specialized agents. If you have access use agents, do it!
- code-reviewer.md
- docs-synchronizer.md
- senior-developer.md
- system-architect.md
- test-strategist.md
- validation-engineer.md

### Key Resources
- [Probot Framework Docs](https://probot.github.io/docs/)
- [GitHub Checks API](https://docs.github.com/en/rest/checks)
- **[Architecture Design](docs/DESIGN.md)** - Core extensible AI rules system
- **[Host Abstraction Design](src/adapters/LOCAL_GIT_ADAPTER_DESIGN.md)** - Two-layer interface architecture enabling local git CLI integration
- Architecture details in AGENTS.md files throughout the repository
- README.md - basic overview and installation instructions for humans.

## Context Architecture

### Context Object Architecture
All webhook handlers receive a `context` object containing:
- **context.payload**: GitHub webhook payload (varies by event type)  
- **context.vcs**: Host-agnostic VCS interface (abstracts GitHub/GitLab/local git)
- **context.repo()**: Method returning `{ owner, repo }` from payload
- **context.log**: Structured logger with child bindings

**Logging Architecture**: Adapters initialize `context.log` with structured bindings (id, repo, route) at the framework boundary. Components use `context.log.child()` to add module-specific bindings, maintaining structured context throughout the execution chain.

**VCS Interface**: The `context.vcs.*` interface provides host-agnostic access to version control operations. The GitHub adapter internally maps these calls to `context.octokit.*`, while future adapters will implement the same interface for other hosts.

### Context Variations by Event Type

**PR Events** (`pull_request.*`):
```javascript
context.payload = {
  action: "opened|synchronize|reopened",
  pull_request: { /* complete PR data */ },
  repository: { /* repo info */ }
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

### Rerun Event Handling
`check_suite.rerequested` events lack PR association data. The rerun handler:
```javascript
// Use VCS interface to find PR associated with commit SHA
const { data: assoc } = await context.vcs.repos.listPullRequestsAssociatedWithCommit(
  context.repo({ commit_sha: headSha })
);
const pr = assoc.find(pr => pr.state === 'open') || assoc[0];
// Enhance context and delegate to PR handler
context.payload.pull_request = pr;
```

### Context Enrichment by Gate Orchestrator
The gate orchestrator (`src/gates/index.js`) enriches the Probot context with execution metadata:
```javascript
context.pr = { /* PR metadata extracted from payload */ }
context.spec = spec  // Repository specification
context.annotation_budget = 50  // GitHub annotation limit
context.idempotency_key = /* unique execution key */
context.reviewLimitsConfig = /* review-limits gate configuration */
```

The `reviewLimitsConfig` property provides review-limits gate configuration to AI workflows, enabling budget-aware evidence gathering that respects repository-configured file limits.


## Repository Structure
```
├── index.js                    # Host-agnostic app core with DAO integration support (passes context object with data relevant to each run)
├── github.js                   # GitHub/Probot standalone entry point (legacy)
├── src/
│   ├── gateway.js             # Multi-provider gateway server
│   ├── env.js                 # Centralized environment configuration with Zod validation
│   ├── spec-loader.js         # Repository specification loading
│   ├── adapters/              # Host abstraction layer (→ AGENTS.md)
│   │   ├── github.js          # GitHub adapter with factory pattern
│   │   └── gitlab/            # GitLab adapter implementation
│   ├── logging/               # Repo-wide logging setup with Loki integration (→ AGENTS.md)
│   └── gates/                 # Gate evaluation system (→ AGENTS.md)
│       ├── cogni/             # Built-in quality gates (→ AGENTS.md)
├── bin/                       # CLI executables directory 
├── e2e/                       # Unified Playwright E2E testing framework
│   ├── tests/                 # GitHub and GitLab E2E test specifications (→ AGENTS.md)
│   ├── helpers/               # Shared test configuration and utilities (→ AGENTS.md)
│   │   └── github-e2e-helper.js # GitHub test utilities: createTestPR, waitForCogniCheck, cleanupTestResources
│   └── artifacts/             # Test reports, videos, and traces (gitignored)
├── playwright.config.js       # Unified Playwright E2E test configuration with E2E_GITLAB_DEPLOYMENT_URL baseURL
├── test/                      # Test suites and fixtures (→ AGENTS.md)
│   ├── fixtures/              # Reusable test data (→ AGENTS.md)
│   ├── contract/              # End-to-end tests, using test harness without HTTP (→ AGENTS.md)
│   ├── helpers/               # Test utilities and harnesses (→ AGENTS.md)
│   ├── unit/                  # Isolated component tests (→ AGENTS.md)
│   └── e2e/                   # Preview environment E2E tests (→ AGENTS.md)
├── .github/workflows/         # CI/CD pipeline workflows
│   ├── e2e-test-preview.yml   # E2E testing after preview deployment
│   └── promote-to-prod-branch.yml # Auto-promotion after green E2E
└── .cogni/
    ├── repo-spec.yaml         # This repository's quality gates
    └── repo-spec-template.yaml # Template for new repositories
```

## Gate Configuration
Quality gates are configured in each repository's `.cogni/repo-spec.yaml`:
```yaml
# GitHub Check Behavior Control
fail_on_error: false     # Default: cogni Github response is Neutral when the app/gate hits errors 
                         # true: neutral errors become failure (blocking)

gates:
  # Built-in gates with explicit type + id
  - type: review-limits
    id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100
  - type: goal-declaration
    id: goal_declaration
  - type: forbidden-scopes
    id: forbidden_scopes
    
  # AI rule with auto-derived ID
  - type: ai-rule
    with:
      rule_file: goal-alignment.yaml  # id auto-derives to "goal-alignment"
      
  # Multiple AI rules with explicit IDs
  - type: ai-rule
    id: scope_check
    with:
      rule_file: scope-creep-evaluation.yaml
```
**Principles**: 
- Only gates listed in the spec execute ("presence = enabled")
- `type` specifies which gate implementation to run
- `id` identifies the gate instance (auto-derived from `rule_file` for ai-rule when omitted)
- Multiple instances of the same gate type are supported

## Key Features
- **Multi-provider support**: Single gateway process handles GitHub and GitLab webhooks
- **Shared handler architecture**: Event handlers registered once, used by all providers
- **Dynamic gate discovery**: Gates auto-discovered from filesystem
- **All gates run immediately**: Gates execute directly
- **Smart check creation**: Creates completed check for all specs
- **Graceful timeout handling**: Individual gate timeouts return neutral status while allowing remaining gates to execute
- **Enhanced diagnostics**: Detailed execution summaries with per-gate timeout attribution, pass/fail/neutral counts, and conclusion reasoning
- **Universal gate logging**: Every gate logs start and completion with status, duration, and diagnostic context
- **Configurable neutral handling**: `fail_on_error` flag controls whether gate errors/timeouts block merges (failure) or allow them (neutral)

## CI/CD Artifact Collection

### GitHub Actions E2E Artifacts
GitHub Actions workflows collect comprehensive E2E test artifacts for debugging:
- **Artifact Name**: `e2e-artifacts`
- **Contents**: Playwright reports, test results JSON, videos on failure, trace files
- **Collection**: Automatic upload even on failure via `actions/upload-artifact@v4`
- **Retention**: 7 days
- **Environments**: Both preview and production E2E tests

## Docker Build Optimization

### Production Container Build
Docker builds use allowlist-only approach in `.dockerignore`:
- **Strategy**: Ignore everything (`*`), then explicitly include production essentials
- **Included**: `package.json`, `package-lock.json`, `src/`, `index.js`, Dockerfile
- **Benefits**: Minimal container size, no test/dev files in production image

## Environment Configuration

### Centralized Environment Management
All environment variables are managed through `/src/env.js` with Zod schema validation. The system validates all environment variables on startup with fail-fast behavior.

**Key Features:**
- **Single source of truth**: All environment variables defined in one place
- **Type-safe validation**: Zod schemas ensure correct types and formats
- **Pre-filtering**: Only declared variables are validated (prevents host pollution)
- **ESLint enforcement**: `n/no-process-env` rule prevents direct `process.env` access
- **Fail-fast behavior**: Invalid configuration stops the application immediately

**Adding New Environment Variables:**
1. Add the variable to the appropriate schema section in `/src/env.js`
2. Export through the `environment` object
3. Import and use via `import { environment } from './src/env.js'`

**Available Exports:**
- `environment` - Main frozen object with all validated configuration
- `env` - Legacy compatibility export (use during migration only)

**ESLint Exemptions:**
Direct `process.env` access allowed only in:
- `/src/env.js` - Environment definition file
- `/lib/e2e-runner.js` and `/bin/e2e-runner.js` - E2E test infrastructure
- `/test/**/*.js` - Test files may need direct environment access

## CogniDAO Integration

### Enabling Vote Proposal Links
To enable "Propose Vote to Merge" links for failed PR reviews:

1. **Configure Repository Spec**: Add `cogni_dao` section to `.cogni/repo-spec.yaml`:
   ```yaml
   cogni_dao:
     dao_contract: "0x1234..."      # DAO contract address
     plugin_contract: "0x5678..."   # Plugin contract address  
     signal_contract: "0x9abc..."   # Signal contract address
     chain_id: "11155111"           # Chain ID (e.g., Sepolia testnet)
     base_url: "https://proposal.cognidao.org"  # Auto-prepends https:// if missing
   ```

2. **Requirements**: All DAO configuration fields must be present - missing any field disables vote links

3. **Behavior**: Vote proposal links appear only for failed reviews (`overall_status: 'fail'`) and open in new tabs

**Prerequisites for Vote Proposal Service:**
- Vote proposal service running at configured `base_url` (see [cogni-proposal-launcher](https://github.com/Cogni-DAO/cogni-proposal-launcher) for self-hosted deployment)
- Service must handle `/merge-change` endpoint with blockchain parameters
- Repository must have complete DAO configuration in repo-spec

**Example Vote Proposal URL:**
```
https://proposal.cognidao.org/merge-change?dao=0xF480b40bF6d6C8765AA51b7C913cecF23c79E5C6&plugin=0xDD5bB976336145E8372C10CEbf2955c878a32308&signal=0x804CB616EAddD7B6956E67B1D8b2987207160dF7&chainId=11155111&repoUrl=https%3A//github.com/Cogni-DAO/preview-test-repo&pr=56&action=merge&target=change
```

### Governance Flow
1. **PR fails gates** → `overall_status: 'fail'` 
2. **Summary adapter checks DAO config** → `generateMergeChangeURL()` validates complete DAO configuration
3. **Vote link generated** → URL includes blockchain parameters and PR context
4. **Link appears in check output** → "🗳️ Propose Vote to Merge" with `target="_blank"`
5. **User clicks link** → Opens vote proposal service with pre-filled governance proposal

## Development

### Common Commands (for AI Agents)
```bash
# Essential development commands - run these frequently:
npm test                    # Run all tests (unit, contract, E2E unit tests)
npm run lint               # ESLint for JavaScript code  
npm run lint:workflows     # actionlint for GitHub Actions workflows
npm run e2e                # Run all E2E tests via Playwright (GitHub + GitLab)
npm run e2e:github         # Run GitHub E2E tests only
npm run e2e:gitlab         # Run GitLab E2E tests only

# Setup and running:
npm install                # Install dependencies
npm start                  # Start Local dev server. WARNING: this is a blocking command. Have the user run this themselves, not you. 
```

### Setup
```bash
npm install
npm start  # Starts gateway with auto smee proxy (if WEBHOOK_PROXY_URL_GITHUB/GITLAB set)
npm test   # Run tests
npm run lint  # ESLint for JavaScript code
npx playwright test        # Run E2E tests directly with Playwright CLI
npm run lint:workflows  # actionlint for GitHub Actions workflows
```

**Observability Configuration**: 
- **AI Tracing**: Configure `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` for AI tracing. The system validates these as a group - all must be set for tracing to enable.
- **Centralized Logging**: Configure `LOKI_URL`, `LOKI_USER`, and `LOKI_TOKEN` for Grafana Cloud Loki integration. These variables must all be set together or all be empty.


## Integration Strategy

**V0.2 Direction:** Integrate with OpenSSF Allstar for repository policies and GitHub Actions for standard CI checks (linting, builds, tests) rather than reimplementing these tools.

## Notes
**MVP Gate Implementation**: Current architecture is MVP implementation. Future design (work item `8f01ab04-922d-478f-ba1a-5bc1eca8b529`) targets unified async execution for all gates.

**Check Summary Format**: GitHub check output uses detailed per-gate markdown reports with emoji status indicators and comprehensive violation/observation display.

**Future Enforcement of Github Action Repo-rules:** Cogni Memory Project for Allstar integration, id: `f09702dd-0bc5-4a19-9a67-255f69fccb26`
