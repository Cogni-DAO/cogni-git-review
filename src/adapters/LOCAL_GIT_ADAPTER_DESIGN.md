# Local-Git Adapter Design for Cogni

## Problem
GitHub flagged and blocked Cogni installs. Need host-agnostic policy enforcement with identical AI gates on any git remote.

## Solution: Host-Agnostic App Core
**Key Principle**: `index.js` exports THE APP (host-agnostic), not a host entry point. **5-7 days implementation**.

## Architecture: App Inversion with Host Entry Points
```
HOST ENTRY POINTS (adapters)
├── github.js (Probot setup) ──┐
└── cli.js (Commander setup) ──┤
                               │
                               ▼
                    APP CORE (index.js)
                    ├── runCogniApp(context, options)
                    ├── Zero host dependencies  
                    ├── Works with any BaseContext
                    └── Pure gate orchestration
                               │
                               ▼
                    CORE LOGIC (src/)
                    ├── Gate Orchestrator (src/gates/)
                    ├── AI Provider (src/ai/) 
                    ├── Spec Loader (src/spec-loader.js)
                    └── Context Implementations
                        ├── BaseContext (interface)
                        └── LocalContext (git CLI)
```

**Key Insight**: Probot context already IS BaseContext. LocalContext implements the same interface. Entry points are the adapters, not the app.

## File Changes Required

**New Files to Create:**
```javascript
// Host entry points (adapters)
github.js                        // Probot app setup → calls index.runCogniApp
cli.js                           // Thin CLI entry point (#!/usr/bin/env node)

// Context implementation  
src/context/base-context.d.ts    // TypeScript interface for BaseContext

// CLI adapter structure (keeps cli.js clean)
src/adapters/cli/
├── index.js                     // Main CLI logic and Commander setup
├── commands/
│   ├── check_suite             # check_suite event types
│   ├── installations.js         # installation event types
│   └── pull_request.js         # PR event types
└── local-context.js            # LocalContext implementation with git CLI
```

**Files to Refactor:**
```javascript
// App core (make host-agnostic)
index.js               // Extract runCogniApp, remove Probot imports
                       // OLD: export default (app) => {}
                       // NEW: export { runCogniApp }

// Update JSDoc imports (8 files):
src/gates/index.js     // @param {import('../context/base-context').BaseContext}
src/spec-loader.js     // @param {import('./context/base-context').BaseContext}  
src/gates/run-configured.js
src/gates/cogni/forbidden-scopes-stub.js
src/gates/cogni/goal-declaration-stub.js  
src/gates/cogni/review-limits.js
```

**Package Structure:**
```json
{
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./github": "./github.js", 
    "./cli": "./cli.js"
  },
  "bin": {
    "cogni": "./cli.js"
  },
  "peerDependencies": {
    "probot": "^13.0.0"
  }
}
```

## Context Interface Requirements

**📋 See [CONTEXT_INTERFACE_SPEC.md](./CONTEXT_INTERFACE_SPEC.md) for complete interface definition**

LocalContext must implement the same interface as Probot context:

**Core Properties:**
- `context.payload.*` - Synthetic GitHub-like webhook payload ([verified payload structures](./CONTEXT_INTERFACE_SPEC.md#captured-webhook-fixtures))
- `context.repo()` - Returns `{ owner, repo }` equivalent  
- `context.octokit.*` - Subset of GitHub API calls used by gates

**Gate Orchestrator Additions** (added at runtime):
- `context.pr` - PR metadata 
- `context.spec` - Repository specification
- `context.annotation_budget` - Annotation limits
- `context.idempotency_key` - Execution key
- `context.reviewLimitsConfig` - Budget configuration

## Local Git Features
- **CLI Commands**: `gate`, `report`, `dry-run`
- **Git Hooks**: pre-push (client), update (server) 
- **Outputs**: JSON reports in `.cogni/reports/`, git notes
- **Offline Mode**: AI toggle for zero-network operation

## Migration Strategy
1. **Create adapter interface** (1-2 days)
2. **Modify entry points** (1 day) 
3. **Implement LocalGitAdapter** (2-3 days)

## Success Criteria
- Zero GitHub dependencies
- <10s gate execution time
- 100% functional parity with GitHub gates
- One-line installation
- Deterministic outcomes