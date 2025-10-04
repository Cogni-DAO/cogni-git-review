# Structured Logging Architecture

**Principle**: One logger per webhook handler, passed as parameters. No deep fetching.

## Setup

- `src/logging/logger.js` - Pino factory with redaction, environment handling, and Loki transport configuration
- `src/logging/index.js` - Exports `appLogger` and `getRequestLogger(context, bindings)` which always uses appLogger

## Core Pattern

### 1. Webhook Handlers - Create Once, Pass Down

```javascript
// index.js
export async function handlePullRequest(context) {
  const log = getRequestLogger(context, { 
    module: 'webhook', route: 'pull_request', event: context.payload.action, pr: pr.number 
  });
  
  // Pass to all downstream functions
  const runResult = await runAllGates(context, pr, spec, log);
  await postPRCommentWithGuards(context, runResult, checkUrl, headSha, prNumber, log);
}
```

### 2. Gate System - Accept Logger, Create Module Children

```javascript
// src/gates/index.js
export async function runAllGates(context, pr, spec, logger) {
  const log = logger.child({ module: 'gates' });
  return await runConfiguredGates({ context, pr, spec, logger: log });
}

// Individual gates
export async function reviewLimitsGate({ context, config, logger }) {
  const log = logger.child({ module: 'gates/review-limits' });
  log.info({ max_files: config.max_files }, 'gate started');
}
```

### 3. Helper Functions - Accept Logger Parameter

```javascript
// src/pr-comment.js  
export async function postPRCommentWithGuards(context, runResult, checkUrl, headSha, prNumber, logger) {
  const log = logger.child({ module: 'pr-comment', pr: prNumber });
  // Use log.info/error - don't call getRequestLogger
}
```

### 4. Tests - Inject Mock Logger

```javascript
const mockLogger = { 
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  child() { return this; } 
};

await runAllGates(context, pr, spec, mockLogger);
```

## Logging Call Signature

**Pattern**: `log.level({ structured_data }, 'message')`

```javascript
log.info({ gate_id: 'review-limits', duration_ms: 250, violations: 0 }, 'gate completed');
log.error({ err: error, pr: prNumber }, 'gate failed');
```

## Environment Behavior

- **dev**: Pretty printed logs via pino-pretty transport
- **prod/preview**: 
  - With Loki configuration: Logs sent to Grafana Cloud Loki for centralized aggregation
  - Without Loki configuration: JSON to stdout fallback
- **test**: Disabled (`enabled: false`) - use mock loggers in tests

### Loki Integration

Production and preview environments support centralized logging to Grafana Cloud Loki when configured:

**Required Environment Variables:**
- `LOKI_URL`: The Loki endpoint URL
- `LOKI_USER`: Authentication username
- `LOKI_TOKEN`: Authentication token

**Loki Transport Features:**
- Batching enabled for efficient log transmission
- 5-second timeout for resilience
- Automatic labels: `app` (PR_REVIEW_NAME) and `env` (environment name)
- Falls back to JSON stdout if any Loki variable is missing

## Architecture Rules

✅ **Do:**
- Create logger in webhook handlers with `getRequestLogger()`
- Pass logger as function parameters 
- Use `.child({ module: '...' })` for module-specific logging
- Log structured data with consistent keys

❌ **Don't:**
- Call `getRequestLogger()` in gates or helper functions
- Use `console.*` anywhere
- Set `context.logger` (deprecated pattern)
- Log sensitive data (tokens, full payloads)

## Justification

### Why we pass our own logger even though `context.log` exists from Probot:

- **Centralized Logging**: `getRequestLogger()` always returns appLogger (with Loki transport) instead of Probot's context.log, ensuring all logs flow through our configured transports.

- **Decoupling**: Modules shouldn't know Probot. They depend on a small logging interface, not a large framework object.

- **Testability**: Unit tests inject a mock logger. No fake Probot context required.

- **Portability**: Same modules run in CLIs, queues, or workers that have no Probot.

- **Policy in one place**: Redaction, transport selection (pino-pretty/Loki/JSON), fields, and levels live in our factory, not scattered.

- **Single source in code**: Downstream code uses only logger, never context.log. All application logs go through the same pipeline.

## Probot vs App Logging

**Keep Probot's built-in logs unchanged** - Don't replace them. Use your logger for app events only.

**What you see in logs:**
- `(server)` and `(http)` lines = Probot internals (already Pino)
- `(event)` lines = Your app events from `getRequestLogger(context, ...).child(...)`

**Our structured event logs have:** `{id, repo, module, route, event, pr}`

**Development logging:**
```bash
npm start  # Pretty-printed logs via pino-pretty transport (automatic in dev environment)
```

**Dashboard views:**
- **App Events**: filter `module:*`
- **Platform Logs**: exclude `module:*` or filter Probot categories
- **Grafana Cloud**: Query Loki datasource with labels `{app="cogni-pr-review", env="prod|preview"}` in production environments