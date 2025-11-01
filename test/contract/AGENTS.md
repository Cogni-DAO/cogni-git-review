# Contract Tests - Webhook Handler Verification

Contract tests verify webhook handlers work correctly by calling them directly with fake GitHub payloads. No HTTP calls, no Probot setup, just handler logic validation.

## Quick Start

```javascript
import { testEventHandler } from '../helpers/handler-harness.js';
import payload from '../fixtures/pull_request.opened.complete.json' with { type: 'json' };

test('PR opened creates check', async () => {
  await testEventHandler({
    event: 'pull_request.opened',
    payload,
    spec: 'minimal', // or null, or parsed object
    expectCheck: (params) => {
      assert.strictEqual(params.conclusion, 'success');
      assert.strictEqual(params.output.summary, 'All gates passed');
    }
  });
});
```

## Supported Events

- `pull_request.opened`
- `pull_request.synchronize` 
- `pull_request.reopened`
- `check_suite.rerequested`

## Spec Options

```javascript
spec: 'minimal'           // Use SPEC_FIXTURES.minimal
spec: 'behaviorTest30_100' // File/size limit spec
spec: null                // Missing spec (triggers failure)
spec: yaml.load(rawYaml)  // Custom spec object
```

## Required Assertions

Every test must verify the check run contract:

```javascript
expectCheck: (params) => {
  assert.strictEqual(params.name, PR_REVIEW_NAME); // Environment-aware constant
  assert.strictEqual(params.head_sha, payload.pull_request.head.sha);
  assert.strictEqual(params.status, 'completed');
  assert(['success', 'failure', 'neutral'].includes(params.conclusion));
  assert.strictEqual(params.output.title, PR_REVIEW_NAME);
  // ... specific behavior assertions
}
```

## Common Patterns

### Test Missing Spec
```javascript
test('missing spec → failure', async () => {
  await testEventHandler({
    event: 'pull_request.opened',
    payload,
    spec: null,
    expectCheck: (params) => {
      assert.strictEqual(params.conclusion, 'failure');
      assert(params.output.summary.includes('No .cogni/repo-spec.yaml found'));
    }
  });
});
```

### Test Gate Count
```javascript
test('2 gates → exactly 2 execute', async () => {
  await testEventHandler({
    event: 'pull_request.opened', 
    payload,
    spec: 'gateConsistency2Gates',
    expectCheck: (params) => {
      assert.match(params.output.text || '', /\bGates:\s*2\s+total\b/);
    }
  });
});
```

### Test Rerun with API Call
```javascript
test('rerun fetches PR data', async () => {
  await testEventHandler({
    event: 'check_suite.rerequested',
    payload: checkSuitePayload,
    spec: 'minimal',
    extraOctokit: {
      pulls: { 
        get: async () => ({ data: { changed_files: 3, additions: 11 } }) 
      }
    },
    expectCheck: (params) => {
      assert.match(params.output.text || '', /\bfiles=3\b/);
    }
  });
});
```

## What NOT to Use

- ❌ `nock` (HTTP mocking)
- ❌ `Probot`, `ProbotOctokit` imports
- ❌ Manual handler extraction
- ❌ `beforeEach`/`afterEach` setup
- ❌ `clearSpecCache()` calls

## Performance

Contract tests run the entire suite in ~5 seconds vs 30+ with HTTP mocking.

## Current Test Files

- `webhook-handlers.test.js` - Basic webhook → check flows
- `cogni-evaluated-gates-behavior.test.js` - Gate execution behavior
- `gitlab-integration.test.js` - GitLab webhook integration (4 tests)
- `hardened-launcher.test.js` - Error handling scenarios
- `spec-aware-webhook.test.js` - Spec loading scenarios
- `spec-gate-consistency.test.js` - Gate counting validation
- `simple-integration.test.js` - Basic success/failure paths
- `code-aware-ai-gate.test.js` - Integration tests for code-aware AI rule capabilities
- `welcome-pr-creation.test.js` - Installation workflow verification MVP 
  - Tests creation of welcome branch, files, and PR for new repository onboarding
  - Validates AI rule templates are copied: pr-syntropy-coherence, patterns-and-docs, repo-goal-alignment
  - Includes filesystem mocks for all AI rule template files
- `installation-idempotency.test.js` - Installation retry scenarios
- `template-customization.test.js` - Template replacement validation (repo-spec + CODEOWNERS customization)
- `agents-sync-integration.test.js` - AGENTS.md synchronization gate integration tests
  - Tests the agents-md-sync gate within the launcher framework
  - Validates that code changes require corresponding AGENTS.md documentation updates
  - Uses VCS interface mock (`context.vcs.pulls.listFiles`) for file listing
- `model-provenance-display.test.js` - Model provenance display in GitHub Check summaries (uses structured AI gate mocks)
- `error-on-neutral.test.js` - Tests for `fail_on_error` flag behavior - validates that neutral gate results convert to failure/neutral conclusions based on flag setting
- `review-limits-budget-integration.test.js` - Integration of review-limits configuration with AI workflow budget calculations
  - Tests review-limits gate configuration with AI workflow budget-aware file listing
  - Handles non-deterministic AI rule gate behavior by accepting either 'neutral' or 'failure' conclusions for flaky scenarios

## Logger Requirements

Functions now require logger parameters with `.child()` method support. Use the `noopLogger` for tests:

```javascript
import { noopLogger } from '../../src/logging/logger.js';

// Function calls that need logger
await loadSingleRule(context, options, noopLogger);
await runAllGates(context, pr, spec, noopLogger);
await provider.evaluateWithWorkflow(config, options, noopLogger);

// Context objects for gate tests
const context = { 
  context: mockProbotContext, 
  logger: noopLogger 
};
```

**Key Points:**
- Always use `noopLogger` from the logging system (has proper `.child()` method)
- Never use simple mock objects like `{ info: () => {}, error: () => {} }` 
- Gate functions expect `(ctx, gateConfig, logger)` signature
- Provider functions expect logger as final parameter

## Known Issues

- Some tests still need logger parameter updates (tracked in todo list)
- Old mock loggers without `.child()` method will cause "logger.child is not a function" errors

## Adding Tests

1. Create `[feature].contract.test.js`
2. Import `testEventHandler` and fixtures
3. Use standard contract assertions
4. Test both success and failure paths