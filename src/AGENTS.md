# Source Architecture

## Structure
```
src/
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

### Environment Management
- **env.js**: Centralized environment configuration
  - Schema-based validation using Zod with fail-fast behavior
  - Pre-filters environment to only validate declared variables
  - Exports two objects:
    - `environment` - Frozen object with all validated configuration including helper properties (isDev, isTest, isProd, isPreview, loki, langfuse)
  - All-or-nothing validation for grouped variables (Loki, Langfuse)
  - Type coercion for numeric values (PORT, APP_ID)
  - URL validation with optional empty string handling
  - ESLint `n/no-process-env` rule enforces usage of this module

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
- **summary-adapter.js**: Check run summary formatting
  - `renderCheckSummary()` - Main check summary renderer using `overall_status` for consistency
  - `formatGateResults()` - Detailed per-gate markdown sections with model info for AI rules
  - `formatRunSummaryJSON()` - Debug JSON output
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