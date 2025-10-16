# Host Abstraction Layer

## Overview
The adapters directory implements the host abstraction architecture that enables Cogni to run on different platforms (GitHub, local git CLI) with identical gate evaluation logic.

## Architecture: Two-Layer Interface Design

**See complete design documentation:**
- **[LOCAL_GIT_ADAPTER_DESIGN.md](./LOCAL_GIT_ADAPTER_DESIGN.md)** - Complete architecture overview, implementation order, and success criteria
- **[CONTEXT_INTERFACE_SPEC.md](./CONTEXT_INTERFACE_SPEC.md)** - BaseContext interface definition with captured webhook fixtures  
- **[OCTOKIT_INTERFACE_ANALYSIS.md](./OCTOKIT_INTERFACE_ANALYSIS.md)** - Analysis of how the GitHub adapter maps VCS interface to octokit internally

## Current Implementation Status

### ✅ Step 2 Complete: Probot Abstraction
- **base-app.d.ts**: CogniBaseApp interface (app.on() abstraction)
- **base-context.d.ts**: BaseContext interface (context abstraction) 
- **../index.js**: Host-agnostic app core accepting CogniBaseApp interface
- **../../github.js**: Probot adapter implementing CogniBaseApp interface

### ✅ Step 3 Complete: Local CLI Implementation  
- **local-cli.js**: CLI entry point implementing CogniBaseApp interface
- **local-cli/local-context.js**: LocalContext class implementing BaseContext interface
- **local-cli/local-app.js**: LocalCogniApp class for event simulation
- **local-cli/git-utils.js**: Git CLI operations and parsing utilities

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
├── github.js                   # GitHub/Probot adapter implementation
├── local-cli.js                # Local CLI adapter implementation
├── local-cli/                  # Local CLI implementation details (→ AGENTS.md)
│   ├── local-context.js        # LocalContext class (BaseContext impl)
│   ├── local-app.js            # LocalCogniApp class (CogniBaseApp impl)
│   └── git-utils.js            # Git CLI utility functions
├── LOCAL_GIT_ADAPTER_DESIGN.md # Complete design specification
├── CONTEXT_INTERFACE_SPEC.md   # Interface definition + webhook fixtures  
└── OCTOKIT_INTERFACE_ANALYSIS.md # Octokit method analysis + implementation strategy
```

## Integration Points

**Entry Points (adapters):**
- `github.js` - Probot → CogniBaseApp wrapper  
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