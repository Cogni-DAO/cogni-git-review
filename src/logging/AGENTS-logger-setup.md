Current Logger Usage Report

  Current State

  Logger Infrastructure

  - ✅ Pino installed (pino: ^9.0.0)
  - ✅ Enhanced logger created (src/logging/logger.js) with proper redaction, environment handling
  - ✅ App logger exported (src/logging/index.js) with appLogger and noop
  - ✅ Probot uses Pino - context.log is a full Pino instance with .child() method

  Current Usage Patterns

  Main webhook handlers (index.js):
  - ❌ No proper logger setup - handlers use console.log extensively (19 occurrences)
  - ❌ No context.logger injection - missing request-scoped logger creation

  Gate system (src/gates/index.js):
  - ⚠️ Ad-hoc logger wrapper - Line 41: context.logger = (level, msg, meta) => context.log[level || 'info'](...)
  - ⚠️ Wrong call signature - Uses (level, msg, meta) instead of Pino's (meta, msg)
  - ✅ Uses context.log when available - Falls back appropriately

  Individual gates:
  - ❌ No logger dependency injection - Gates don't accept { logger } parameter
  - ❌ Direct context.log usage - Some gates access context.log directly
  - ❌ No module-scoped children - Missing logger.child({ module: "gates/..." })

  Console.log usage (73 total occurrences):
  - Main files: index.js (19), src/pr-comment.js (3), setup files (8), AI workflows (4)
  - Test files: Extensive console usage for debugging (39 occurrences)
  - Library/CLI: lib/e2e-runner.js (18), bin/e2e-runner.js (5)

  Test mocking:
  - ✅ Consistent mock pattern - Tests use (level, msg, meta) => console.log(...) pattern
  - ❌ Wrong signature - Should be Pino-compatible for consistency

  Exact Changes Needed

⏺ Update Todos
  ⎿  ☒ Re-read AGENTS.md logging documentation thoroughly 
     ☒ Research current logger usage across the repository
     ☒ Create report summary of current state
     ☐ Document exact changes needed

⏺ Priority 1: Core Infrastructure

  1. Create getRequestLogger() utility in /src/logging/index.js:
  export function getRequestLogger(context, bindings = {}) {
    const base = context?.log?.child ? context.log : appLogger;
    return base.child({
      reqId: context.id,
      repo: context.payload?.repository?.full_name,
      ...bindings
    });
  }
  2. Update webhook handlers in index.js:
    - Replace all console.log calls with proper logger usage
    - Add logger setup: context.logger = getRequestLogger(context, { route: "pull_request" })
    - Pass logger to downstream functions
  3. Fix gate system in src/gates/index.js:
    - Replace line 41's ad-hoc logger with: context.logger = getRequestLogger(context, { component: "gates" })
    - Update all context.logger() calls to use proper Pino signature: logger.info(meta, msg)

  Priority 2: Gate Integration

  4. Update all gates to accept { logger } parameter and use module children:
    - src/gates/cogni/*.js - Add logger param, create logger.child({ module: "gates/..." })
    - Update calls in src/gates/run-configured.js to pass logger
  5. Fix registry logging in src/gates/registry.js:
    - Import and use proper logger instead of console fallback

  Priority 3: Other Files

  6. Update non-webhook files:
    - src/pr-comment.js - Replace console.log with logger injection
    - src/setup/*.js - Replace console.log with appLogger usage
    - src/ai/workflows/goal-evaluations.js - Replace console.log
    - src/spec-loader.js - Replace console.log
  7. Update test mocks to Pino-compatible signature:
  const mockLogger = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    child: jest.fn(() => mockLogger)
  };

  Priority 4: Documentation

  8. Add missing /src/logging/index.js exports per AGENTS.md:
    - Export noop as noopLogger
    - Add type interface for logger shape
  9. Update AGENTS.md to note "In Probot v13+, context.log is Pino. We always prefer it."

  Total files to modify: ~15-20 files
  Console.log calls to replace: 73 occurrencesNew logger injections needed: 8 major handlers + all gates
