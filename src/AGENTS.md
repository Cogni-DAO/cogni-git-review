# Source Architecture

## Structure
```
src/
├── gateway.js          # Multi-provider gateway server with shared handler registration
├── constants.js        # Global app constants (environment-aware PR_REVIEW_NAME, CONTEXT_TO_WORKFLOW for CI/Security, RAILS_TEMPLATE_PATH)
├── env.js              # Centralized environment configuration with Zod validation and type-safe exports
├── spec-loader.js      # Repository configuration I/O layer
├── pr-comment.js       # PR comment publishing
├── summary-adapter.js  # Check run summary formatting
├── adapters/           # Host abstraction layer (→ AGENTS.md)
├── ai/                 # AI-specific evaluation files (→ AGENTS.md)
├── gates/              # Gate evaluation system (→ AGENTS.md)
├── logging/            # Structured logging system (→ AGENTS.md)
└── setup/              # Installation and setup handlers (→ AGENTS.md)

```

## Core Modules

### Gateway Architecture
- **gateway.js**: Multi-provider webhook gateway
  - Captures shared handlers at boot via `runCogniApp(handlerCapture)`
  - Mounts provider-specific middleware:
    - GitHub: `/api/v1/webhooks/github` via Probot `createNodeMiddleware`
    - GitLab: `/api/v1/webhooks/gitlab` via custom Express router
  - OAuth endpoints at `/oauth/:provider/callback`
  - Health check at `/api/v1/health` with handler inventory
  - Auto-launches smee proxy clients in dev mode when `WEBHOOK_PROXY_URL_GITHUB` or `WEBHOOK_PROXY_URL_GITLAB` are set
  - Handles private key base64 decoding for Probot integration
  - Uses centralized `appLogger` from logging system for all gateway operations

### Environment Management
- **env.js**: Centralized environment configuration
  - Schema-based validation using Zod with fail-fast behavior
  - Pre-filters environment to only validate declared variables
  - Exports frozen `environment` object with all validated configuration including helper properties (isDev, isTest, isProd, isPreview, loki, langfuse)
  - All-or-nothing validation for grouped variables (Loki, Langfuse, GitLab)
  - Type coercion for numeric values (PORT, APP_ID)
  - URL validation with optional empty string handling
  - ESLint `n/no-process-env` rule enforces usage of this module
  - Multi-provider webhook secrets (both required for now): `WEBHOOK_SECRET_GITHUB`, `WEBHOOK_SECRET_GITLAB`
  - Multi-provider proxy URLs: `WEBHOOK_PROXY_URL_GITHUB`, `WEBHOOK_PROXY_URL_GITLAB`
  - GitLab configuration: `GITLAB_BASE_URL` (supports self-hosted, defaults to gitlab.com), `GITLAB_PAT` (Personal Access Token for PoC)
  - GitLab OAuth variables: `GITLAB_OAUTH_APPLICATION_ID`, `GITLAB_OAUTH_APPLICATION_SECRET`
  - E2E testing configuration: `E2E_GITHUB_REPO`, `E2E_GITHUB_PAT` for unified environment variable naming

### Input Layer
- **spec-loader.js**: Repository `.cogni/*` file loading
  - `loadRepoSpec()` - Main repository specification loading
  - `loadSingleRule()` - AI rule file loading with schema validation for gates
  - `clearSpecCache()`, `getSpecCacheStats()` - Cache management

### Output Layers  
- **pr-comment.js**: PR comment publishing with staleness guards
  - `postPRComment()` - Basic comment creation using `overall_status` for verdict consistency
  - `postPRCommentWithGuards()` - Comment with head SHA validation
  - **AI rule display**: Uses structured format (`gate.providerResult.metrics` + `gate.rule.success_criteria`) with fallback to legacy `stats`
  - **Success criteria support**: Handles both `require` and `any_of` criteria types for comprehensive rule metric display
  - **Verdict logic**: Uses `runResult.overall_status` directly instead of recalculating from gate counts
- **summary-adapter.js**: Check run summary formatting with DAO integration
  - `renderCheckSummary()` - Main check summary renderer using `overall_status` for consistency
  - `formatGateResults()` - Detailed per-gate markdown sections with model info for AI rules
  - `generateMergeChangeURL()` - CogniDAO vote proposal URL generation for failed reviews with automatic https:// protocol prepending
  - `formatRunSummaryJSON()` - Debug JSON output
  - **DAO Configuration**: Requires complete DAO spec (`dao_contract`, `plugin_contract`, `signal_contract`, `chain_id`) from repo-spec
  - **Vote Proposal Links**: Generates merge-change URLs with target="_blank" for failed reviews when DAO is configured
  - **Protocol Handling**: Auto-prepends https:// to base_url values missing protocol scheme
  - **AI rule formatting**: Displays "metric: value operator threshold" with mathematical symbols (>=, <=, >, <, =) from structured data
  - **Success criteria support**: Handles both `require` and `any_of` criteria types for complete rule metric display
  - **Status consistency**: Both summary title and verdict use `runResult.overall_status` from gate orchestrator

### Processing Layers
- **ai/**: AI evaluation system with provider routing and workflows (→ AGENTS.md)
- **gates/**: Gate evaluation system with dynamic discovery (→ AGENTS.md)

## Architecture Flow
```
index.js
├── spec-loader.js      → Load .cogni/repo-spec.yaml
├── gates/              → Execute configured gates
│   └── ai/             → AI rule evaluation via provider
├── summary-adapter.js  → Format check run output
└── pr-comment.js       → Post developer summary
```