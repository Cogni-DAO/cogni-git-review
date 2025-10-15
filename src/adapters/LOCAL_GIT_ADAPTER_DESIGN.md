# Local-Git Adapter Design for Cogni

## Problem
GitHub flagged and blocked Cogni installs. Need host-agnostic policy enforcement with identical AI gates on any git remote.

## Solution: Facade Pattern 
Simple adapter layer wrapping existing Probot dependencies. **5-7 days implementation** vs 3-4 weeks for full hexagonal architecture.

## Architecture: Context as Interface
```
EXISTING CORE (Unchanged)
├── Gate Orchestrator (src/gates/)
├── AI Provider (src/ai/) 
└── Spec Loader (src/spec-*)
           │
    CONTEXT IMPLEMENTATIONS
├── Probot Context (GitHub)
└── LocalContext (git CLI + synthetic payload)
```

**Key Insight**: Context is already the interface. Gates expect `context.octokit.*`, `context.repo()`, `context.payload.*`. We implement these same properties/methods in LocalContext.

## File Changes Required

**Files to Modify (10 files) - JSDoc imports only:**
- `src/gates/index.js` - Update JSDoc `@param {import('probot').Context}` 
- `src/spec-loader.js` - Update 3 JSDoc type annotations (lines 5, 22, 39)
- `src/gates/run-configured.js` - Update JSDoc `@param` (line 47)
- `src/gates/cogni/forbidden-scopes-stub.js` - Update JSDoc (line 12)  
- `src/gates/cogni/goal-declaration-stub.js` - Update JSDoc (line 12)
- `src/gates/cogni/review-limits.js` - Update JSDoc (line 11)
- `index.js` - Update JSDoc `@param {import('probot').Probot}` and create LocalContext
- `test/helpers/handler-harness.js` - Update test context references

**New Files to Create (3 files):**
- `src/context/base-context.js` - Context interface definition
- `src/context/local-context.js` - LocalContext implementation  
- `cli.js` - Local runner entry point

**Future Import Pattern:**
```javascript
// Old:
* @param {import('probot').Context} context - Probot context

// New: 
* @param {import('../context/base-context.js').BaseContext} context - Host context
```

## Context Interface Requirements
LocalContext must implement the same interface as Probot context:

**Core Properties:**
- `context.payload.*` - Synthetic GitHub-like webhook payload
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