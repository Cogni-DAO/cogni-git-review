# Structured Logging Architecture

**Principle**: Context-based logging via `context.log`. Adapters set structured logger, modules use `.child()` for scoping.

## Setup

- `src/logging/logger.js` - Pino factory with redaction, environment handling, and Loki transport configuration. Imports `environment` from `../env.js` for centralized configuration access.
- `src/logging/index.js` - Exports `makeLogger()` factory and `appLogger` singleton

## Core Pattern

### 1. Adapters - Set Context Logger with Structured Bindings

```javascript
// Adapters set context.log with request-scoped bindings
context.log = appLogger.child({ id, repo, route });
// OR for GitHub adapter: context.log = context.log.child({ id, repo, route });
```

**Adapter Responsibility**: Each adapter (GitHub, GitLab, local-cli) creates and attaches a structured logger to the context before passing it to core handlers.

### 2. Core Modules - Use Context Logger with Child Scoping

```javascript
// src/gates/index.js
export async function runAllGates(context, pr, spec) {
  const log = context.log.child({ module: 'gates' });
  return await runConfiguredGates({ context, pr, spec });
}

// Individual gates use context.log
export async function reviewLimitsGate({ context, config }) {
  const log = context.log.child({ module: 'gates/review-limits' });
  log.info({ max_files: config.max_files }, 'gate started');
}
```

### 3. Helper Functions - Use Context Logger

```javascript
// src/pr-comment.js  
export async function postPRCommentWithGuards(context, runResult, checkUrl, headSha, prNumber) {
  const log = context.log.child({ module: 'pr-comment', pr: prNumber });
  // Use log.info/error from context
}
```

### 4. Tests - Mock Context Logger

```javascript
const mockLogger = { 
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  child() { return this; } 
};

context.log = mockLogger;
await runAllGates(context, pr, spec);
```

## Logging Call Signature

**Pattern**: `log.level({ structured_data }, 'message')`

```javascript
log.info({ gate_id: 'review-limits', duration_ms: 250, violations: 0 }, 'gate completed');
log.error({ err: error, pr: prNumber }, 'gate failed');
```

## Environment Behavior

Logging behavior determined by centralized environment configuration from `/src/env.js`:

- **development** (`NODE_ENV=development`): Pretty printed logs via pino-pretty transport
- **production/preview** (`NODE_ENV=production` or `APP_ENV=preview`): 
  - With `environment.loki.enabled=true`: Logs sent to Grafana Cloud Loki for centralized aggregation
  - With `environment.loki.enabled=false`: JSON to stdout fallback
- **test** (`NODE_ENV=test`): Disabled (`enabled: false`) - use mock loggers in tests

### Loki Integration

Production and preview environments support centralized logging to Grafana Cloud Loki when configured.

**Configuration through `/src/env.js`:**
The centralized environment system validates Loki configuration as an all-or-nothing group:
- `LOKI_URL`: The Loki endpoint URL (validated as URL)
- `LOKI_USER`: Authentication username
- `LOKI_TOKEN`: Authentication token

All three variables must be set together or all must be empty. The logger accesses configuration through `environment.loki` which provides:
- `enabled`: Boolean flag indicating if Loki is configured
- `url`, `user`, `token`: Configuration values when enabled

**Loki Transport Features:**
- Batching enabled for efficient log transmission
- 5-second timeout for resilience
- Automatic labels: `app` (from PR_REVIEW_NAME constant) and `env` (from environment.APP_ENV)
- Falls back to JSON stdout when `environment.loki.enabled` is false

## Architecture Rules

✅ **Do:**
- Adapters set `context.log` with structured bindings before calling handlers
- Modules use `context.log.child({ module: '...' })` for scoped logging
- Log structured data with consistent keys
- Tests mock `context.log` instead of passing parameters

❌ **Don't:**
- Pass logger as function parameter (use context.log instead)
- Use `console.*` anywhere
- Create loggers in gates or helpers (use context.log)
- Log sensitive data (tokens, full payloads)

## Justification

### Why we use context.log pattern:

- **Centralized Logging**: All adapters use `appLogger` singleton ensuring consistent configuration across providers (GitHub, GitLab, CLI).

- **No Parameter Threading**: Functions access logger via context instead of parameter passing, reducing function signatures.

- **Adapter Control**: Each adapter sets appropriate structured bindings (id, repo, route) at the entry point.

- **Testability**: Tests simply mock `context.log` without complex parameter injection.

- **Policy in one place**: Redaction, transport selection (pino-pretty/Loki/JSON), fields, and levels live in our factory.

- **Unified Pipeline**: All application logs flow through the same configuration regardless of adapter.

## Probot vs App Logging

**Keep Probot's built-in logs unchanged** - Don't replace them. Use your logger for app events only.

**What you see in logs:**
- `(server)` and `(http)` lines = Probot internals (already Pino)
- `(event)` lines = Your app events from `context.log.child({ module: '...' })`

**Our structured event logs have:** `{id, repo, module, route, event, pr}`

**Development logging:**
```bash
npm start  # Pretty-printed logs via pino-pretty transport (automatic in dev environment)
```

**Dashboard views:**
- **App Events**: filter `module:*`
- **Platform Logs**: exclude `module:*` or filter Probot categories
- **Grafana Cloud**: Query Loki datasource with labels `{app="cogni-pr-review", env="prod|preview"}` in production environments