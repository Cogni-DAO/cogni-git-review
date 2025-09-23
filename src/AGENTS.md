# Source Architecture

## Structure
```
src/
├── constants.js        # Global app constants (PR_REVIEW_NAME, CONTEXT_TO_WORKFLOW, RAILS_TEMPLATE_PATH)
├── spec-loader.js      # Repository configuration I/O layer
├── pr-comment.js       # PR comment publishing
├── summary-adapter.js  # Check run summary formatting
├── ai/                 # AI-specific evaluation files (→ AGENTS.md)
├── gates/              # Gate evaluation system (→ AGENTS.md)
└── setup/              # Installation and setup handlers (→ AGENTS.md)

```

## Core Modules

### Input Layer
- **spec-loader.js**: Repository `.cogni/*` file loading
  - `loadRepoSpec()` - Main repository specification loading
  - `loadSingleRule()` - AI rule file loading for gates
  - `clearSpecCache()`, `getSpecCacheStats()` - Cache management

### Output Layers  
- **pr-comment.js**: PR comment publishing with staleness guards
  - `postPRComment()` - Basic comment creation
  - `postPRCommentWithGuards()` - Comment with head SHA validation
- **summary-adapter.js**: Check run summary formatting (extracted from index.js)
  - `renderCheckSummary()` - Main check summary renderer
  - `formatGateResults()` - Detailed per-gate markdown sections
  - `formatRunSummaryJSON()` - Debug JSON output

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