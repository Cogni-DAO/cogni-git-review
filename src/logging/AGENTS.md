# Logger Usage for Agents

**Purpose:** Consistent, structured logging that scales. One root logger, request-scoped children, dependency injection everywhere. No `console.*`.

## Goals

- JSON logs in prod. Pretty logs in dev.
- Stable keys for indexing: time, level, msg, plus your bindings.
- Redaction for secrets and cookies.
- Request correlation via reqId.

## Setup

Create a central factory and an app logger:
- `/src/logging/logger.js`
- `/src/logging/index.js`

## How to use

### 1) Create a request-scoped child in handlers

```javascript
// src/webhooks/pull_request.js
import { appLogger } from "../logging/index.js";

export async function handlePullRequest(context) {
  const logger = (context.log?.child ? context.log : appLogger)
    .child({ route: "pull_request", reqId: context.id, repo: context.payload.repository.full_name });

  // inject for downstream functions
  context.logger = logger;

  logger.info({ action: context.payload.action }, "pull_request received");
  await runGates({ context, logger });
}
```

### 2) Accept a logger in modules and gates

```javascript
// src/gates/review-limits.js
import { noop as noopLogger } from "../logging/index.js";

export async function reviewLimits({ logger = noopLogger, prNumber, config }) {
  const log = logger.child({ module: "gates/review-limits" });
  log.info({ pr: prNumber }, "start");
  // ... implementation ...
  log.info({ pr: prNumber, allowed: true }, "pass");
}
```

### 3) Utilities without request context

```javascript
// src/util/hash.js
import { appLogger } from "../logging/index.js";
const log = appLogger.child({ module: "util/hash" });

export function sha(input) {
  log.debug({ len: input?.length }, "hashing");
  // ...
}
```

### 4) Tests

Default to silence. Use noopLogger or a mocked shape.

If you need assertions, pass a jest mock.

```javascript
// example.test.ts
const mockLogger = {
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  child() { return this; },
};

await reviewLimits({ logger: mockLogger, prNumber: 42, config: {} });
expect(mockLogger.info).toHaveBeenCalledWith({ pr: 42 }, "start");
```

### 5) Probot compatibility

If Probot provides `context.log`, it is already a Pino child. Prefer it, then `.child({...})` per request. Otherwise use appLogger.

```javascript
const base = context?.log?.child ? context.log : appLogger;
const logger = base.child({ reqId: context.id });
```

## Logging patterns

**Call signature:** `(metaObject, messageString)`

Use structured fields. Avoid string concatenation.

```javascript
logger.info({ gate: "avoid-duplication", duration_ms: 3200 }, "gate finished");
logger.warn({ missing: ["AGENTS.md"] }, "policy file missing");
logger.error({ err }, "gate failed");
```

## Redaction and PII

- Add new sensitive paths in REDACT only.
- Never log raw headers, tokens, or cookies.
- Log IDs, counts, and hashes, not full payloads.

## Levels

- **info:** normal control flow.
- **debug:** noisy internals, disabled in prod by level.
- **warn:** recoverable issues or degraded behavior.
- **error:** failures requiring operator attention.

## Do / Don't

### Do

- Create one appLogger.
- Derive children per request and per module.
- Inject logger via function params.
- Keep messages short and consistent.
- Bind reqId, route, module, gate, pr, repo.

### Don't

- Don't `console.log`.
- Don't instantiate a logger at the top of every file that has request context.
- Don't log secrets or entire payloads.
- Don't build dynamic method names; call `.info/.warn/.error/.debug`.

## Environment

- **NODE_ENV=development:** pretty output via pino-pretty.
- **NODE_ENV=production:** JSON to stdout for shipping to OpenSearch or similar.
- **NODE_ENV=test:** `enabled: false` keeps tests quiet unless you inject a mock.

## Minimal integration checklist

1. Add `/src/logging/logger.js` and `/src/logging/index.js`.
2. Replace any `console.*` with injected logger.
3. In each webhook handler, set `context.logger = base.child({ reqId, route })`.
4. Update gates and utilities to accept `{ logger }`.
5. Verify redaction by logging a request with headers in dev and confirming they are censored.

That's it. One root. Children per request. DI through the stack. Clean, safe, indexable logs.