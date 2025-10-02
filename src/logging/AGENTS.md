# Structured Logging Architecture

**Principle**: One logger per webhook handler, passed as parameters. No deep fetching.

## Setup

- `src/logging/logger.js` - Pino factory with redaction and environment handling
- `src/logging/index.js` - Exports `appLogger` and `getRequestLogger(context, bindings)`

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

- **dev**: Pretty printed logs via pino-pretty
- **prod/preview**: JSON to stdout for log aggregation  
- **test**: Disabled (`enabled: false`) - use mock loggers in tests

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

- **Decoupling**: Modules shouldn't know Probot. They depend on a small logging interface, not a large framework object.

- **Testability**: Unit tests inject a mock logger. No fake Probot context required.

- **Portability**: Same modules run in CLIs, queues, or workers that have no Probot.

- **Policy in one place**: Redaction, pretty vs JSON, fields, and levels live in our factory, not scattered.

- **Single source in code**: Downstream code uses only logger, never context.log. Fewer surprises.

## Probot vs App Logging

**Keep Probot's built-in logs unchanged** - Don't replace them. Use your logger for app events only.

**What you see in logs:**
- `(server)` and `(http)` lines = Probot internals (already Pino)
- `(event)` lines = Your app events from `getRequestLogger(context, ...).child(...)`

**Our structured event logs have:** `{id, repo, module, route, event, pr}`

**Development logging:**
```bash
npm start  # Raw JSON logs (production-ready for log aggregation)

# Manual pretty formatting when needed:
npm start | npx pino-pretty --singleLine --ignore pid,hostname
```

**Dashboard views:**
- **App Events**: filter `module:*`
- **Platform Logs**: exclude `module:*` or filter Probot categories