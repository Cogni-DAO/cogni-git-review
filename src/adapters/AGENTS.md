# Host Abstraction Layer

## Overview
The adapters directory implements the host abstraction architecture that enables Cogni to run on different platforms (GitHub, GitLab, Forgejo, Bitbucket, Gerrit, Radicle, local git CLI) with identical gate evaluation logic. The gateway architecture enables multiple providers to share a single process with unified handler registration.

## Architecture: Two-Layer Interface Design

**See complete design documentation:**
- **[LOCAL_GIT_ADAPTER_DESIGN.md](./LOCAL_GIT_ADAPTER_DESIGN.md)** - Complete architecture overview, implementation order, and success criteria
- **[CONTEXT_INTERFACE_SPEC.md](./CONTEXT_INTERFACE_SPEC.md)** - BaseContext interface definition with captured webhook fixtures  
- **[OCTOKIT_INTERFACE_ANALYSIS.md](./OCTOKIT_INTERFACE_ANALYSIS.md)** - Analysis of how the GitHub adapter maps VCS interface to octokit internally
- **[MINIMAL_PAYLOAD_SPEC.md](./MINIMAL_PAYLOAD_SPEC.md)** - Minimal subset of webhook payload fields required by gates

## Current Implementation Status

### ✅ Gateway Architecture: Multi-Provider Support
- **../gateway.js**: Express server with shared handler registration via `runCogniApp(handlerCapture)`
- **github.js**: Dual-mode adapter - factory pattern for gateway, default export for standalone
- **gitlab/**: GitLab webhook router with payload transformation to BaseContext

### ✅ Step 2 Complete: Probot Abstraction
- **base-app.d.ts**: CogniBaseApp interface (app.on() abstraction)
- **base-context.d.ts**: BaseContext interface (context abstraction) 
- **../index.js**: Host-agnostic app core accepting CogniBaseApp interface
- **../../github.js**: Legacy standalone Probot entry point

### ✅ Step 3 Complete: Local CLI Implementation  
- **local-cli.js**: CLI entry point implementing CogniBaseApp interface
  - Accepts git references (baseRef, headRef) and repository path
  - Registers handlers with core app, then simulates PR event
  - Sets `context.log` with structured bindings
- **local-cli/local-context.js**: LocalContext class implementing BaseContext interface
  - Direct implementation (no inheritance) with minimal payload
  - VCS operations backed by git CLI and filesystem
- **local-cli/local-app.js**: LocalCogniApp class for event simulation
  - Stores registered handlers for later execution
  - Simulates pull_request.opened events to trigger gates
- **local-cli/git-utils.js**: Git CLI operations and parsing utilities
  - Parse git diff output for statistics and file changes
  - Safe command execution with error handling

## Key Design Principles

1. **Zero Logic Changes**: App core (`../index.js`) unchanged, only receives different interfaces
2. **Interface Compatibility**: LocalContext implements exact same BaseContext interface as Probot context
3. **Host Agnostic**: Gate evaluation, AI workflows, and all business logic work identically on any host
4. **Adapter Pattern**: Entry points (github.js, cli.js) adapt host-specific APIs to common interfaces

## File Structure
```
src/adapters/
├── AGENTS.md                    # This file - architecture overview
├── base-app.d.ts               # CogniBaseApp interface (app abstraction)
├── base-context.d.ts           # BaseContext interface (context abstraction)
├── github.js                   # GitHub adapter with gateway factory + standalone default
├── gitlab/                     # GitLab adapter implementation (→ AGENTS.md)
│   ├── gitlab-router.js        # Express router with webhook validation
│   ├── gitlab-context.js       # GitLab BaseContext implementation
│   ├── payload-transform.js    # GitLab MR → GitHub PR mapping
│   ├── APP-SETUP.md            # GitLab app configuration guide
│   └── AUTH.md                 # GitLab authentication documentation
├── local-cli.js                # Local CLI adapter implementation
├── local-cli/                  # Local CLI implementation details (→ AGENTS.md)
│   ├── local-context.js        # LocalContext class (BaseContext impl)
│   ├── local-app.js            # LocalCogniApp class (CogniBaseApp impl)
│   └── git-utils.js            # Git CLI utility functions
├── MINIMAL_PAYLOAD_SPEC.md      # Essential payload fields and usage analysis
├── LOCAL_GIT_ADAPTER_DESIGN.md # Complete design specification
├── CONTEXT_INTERFACE_SPEC.md   # Interface definition + webhook fixtures  
└── OCTOKIT_INTERFACE_ANALYSIS.md # Octokit method analysis + implementation strategy
```

## Integration Points

**Gateway Mode:**
- `../gateway.js` - Captures shared handlers via `runCogniApp(handlerCapture)`
- `github.js` - Exports `createGitHubApp(sharedHandlers)` factory for gateway
- `gitlab/gitlab-router.js` - Creates Express router consuming shared handlers

**Standalone Mode (Legacy):**
- `../../github.js` - Direct Probot entry point
- `github.js` default export - Probot → CogniBaseApp wrapper  
- `local-cli.js` - Local git CLI → CogniBaseApp wrapper

**Core Integration:**
- `../index.js` - Receives CogniBaseApp, handlers receive BaseContext
- `../gates/index.js` - Gate orchestrator adds runtime context properties
- All gate implementations work unchanged with BaseContext interface

## Testing Strategy
- `../../test/unit/probot-context-interface.test.js` - Validates Probot context implements BaseContext
- github.js adapter validates CogniBaseApp interface implementation  
- `../../test/unit/runallgates-real-webhook-payload.test.js` - End-to-end validation with real fixtures

Result: Identical gate behavior across GitHub and future local git implementations.

## Multi-Platform Roadmap

### Next: Extend BaseContext for Platform Diversity
**Schema Changes Required:**
- Add `provider: string` and `review` object (generic PR/MR abstraction)
- Add `vcs.capabilities` for platform feature detection  
- Standardize `vcs.checks.create()` for commit status across platforms
- Alias `vcs.reviews = vcs.pulls` for backward compatibility

### Platform Support Matrix
| Platform | Reviews | Commit Status | External Checks | Compare | Ref Write |
|----------|---------|---------------|-----------------|---------|-----------|
| GitHub   | ✅      | ✅             | ✅              | ✅       | ✅        |
| GitLab   | ✅      | ✅             | ✅              | ✅       | ✅        |
| Forgejo  | ✅      | ✅             | ❌              | ✅       | ✅        |
| Bitbucket| ✅      | ✅             | ❌              | ✅       | ❌        |
| Gerrit   | ✅      | ✅             | ❌              | ❌       | ❌        |
| Radicle  | ✅      | ✅             | ❌              | ❌       | ❌        |
| Local CLI| ❌      | ❌             | ❌              | ✅       | ❌        |

**Implementation Pattern:** Each adapter maps platform webhooks → BaseContext + handles `vcs.checks.create()` via platform APIs.