# Local-Git Adapter Design for Cogni

## Problem
GitHub flagged and blocked Cogni installs. Need host-agnostic policy enforcement with identical AI gates on any git remote.

## Solution: Host-Agnostic App Core
**Key Principle**: `index.js` exports THE APP (host-agnostic), not a host entry point. **5-7 days implementation**.

## Architecture: Two-Layer Interface Abstraction
```
HOST ENTRY POINTS (adapters) - Implement both interfaces
├── github.js (Probot → CogniBaseApp + Probot Context → BaseContext) ──┐
└── cli.js (Commander → CogniBaseApp + LocalContext → BaseContext) ────┤
                                                                       │
                                                                       ▼
                             APP CORE (index.js) - UNCHANGED LOGIC!
                             ├── export default (app) => { app.on(...) }
                             ├── Receives CogniBaseApp interface (not Probot)
                             ├── Handlers receive BaseContext interface
                             ├── Zero host dependencies
                             └── Same event-driven logic as before
                                                       │
                                                       ▼
                             CORE LOGIC (src/) - UNCHANGED
                             ├── Gate Orchestrator (src/gates/)
                             ├── AI Provider (src/ai/)
                             ├── Spec Loader (src/spec-loader.js)
                             └── Interface Implementations
                                 ├── CogniBaseApp (app abstraction)
                                 ├── BaseContext (context abstraction)
                                 └── LocalContext (git CLI implementation)
```

**Key Insight**: Probot context already IS BaseContext. LocalContext implements the same interface. Entry points are the adapters, not the app.

## File Changes Required

**New Files to Create:**
```javascript
// Host entry points (adapters)
github.js                        // Probot app setup → calls index.runCogniApp
cli.js                           // Thin CLI entry point (#!/usr/bin/env node)

// Interface definitions (two layers)
src/adapters/base-app.d.ts       // CogniBaseApp interface (app.on() abstraction)  
src/context/base-context.d.ts    // BaseContext interface (context abstraction)

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
**🔍 See [OCTOKIT_INTERFACE_ANALYSIS.md](./OCTOKIT_INTERFACE_ANALYSIS.md) for analysis of GitHub adapter's VCS→octokit mapping**

LocalContext must implement the same interface as Probot context:

**Core Properties:**
- `context.payload.*` - Synthetic GitHub-like webhook payload ([verified payload structures](./CONTEXT_INTERFACE_SPEC.md#captured-webhook-fixtures))
- `context.repo()` - Returns `{ owner, repo }` equivalent  
- `context.vcs.*` - Host-agnostic VCS interface (same as what GitHub adapter provides)

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

## Critical Implementation Order ⚠️

**The order matters! Each step enables the next:**

### Step 1: Foundation ✅ COMPLETE
- ✅ Create `src/context/base-context.d.ts` interface
- ✅ Validate Probot context implements BaseContext  
- ✅ Prove `runAllGates` works with real webhook fixtures

### Step 2: Abstract Probot FIRST 🔄 **NEXT**
**Why First**: Creates host-agnostic app core with interface abstraction
- Create `src/adapters/base-app.d.ts` - CogniBaseApp interface
- Update `index.js` JSDoc: `@param {CogniBaseApp} app` (logic unchanged!)
- Create `github.js` with Probot wrapper: `probotApp → CogniBaseApp`
- Update `package.json` exports: `"./github": "./github.js"`
- **Result**: App core receives abstract interfaces, not Probot objects

### Step 3: LocalContext Implementation  
**Why After**: Now has host-agnostic `runCogniApp` to call
- Implement `src/adapters/cli/local-context.js` with git CLI
- Call the same `runCogniApp` that GitHub uses
- Test identical results between GitHub and local contexts

### Step 4: CLI Entry Point
**Why Last**: Needs LocalContext + runCogniApp to exist first  
- Create thin `cli.js` entry point
- Implement `src/adapters/cli/` command structure
- Package as executable: `cogni gate --base main --head feature`

**⚠️ WRONG ORDER = FAILURE**: Trying to build LocalContext before extracting `runCogniApp` leaves nowhere to plug it in.

## Success Criteria
- Zero GitHub dependencies
- <10s gate execution time
- 100% functional parity with GitHub gates
- One-line installation
- Deterministic outcomes