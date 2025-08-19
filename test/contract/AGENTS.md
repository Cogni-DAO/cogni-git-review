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
  assert.strictEqual(params.name, 'Cogni Git PR Review');
  assert.strictEqual(params.head_sha, payload.pull_request.head.sha);
  assert.strictEqual(params.status, 'completed');
  assert(['success', 'failure', 'neutral'].includes(params.conclusion));
  assert.strictEqual(params.output.title, 'Cogni Git PR Review');
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
- `hardened-launcher.test.js` - Timeout/error scenarios
- `spec-aware-webhook.test.js` - Spec loading scenarios
- `spec-gate-consistency.test.js` - Gate counting validation
- `simple-integration.test.js` - Basic success/failure paths

## Known Issues

The `check_suite.rerequested` test currently fails due to a checkStateMap bug (Work Item: 18f6bdc8-052d-493a-8f2b-efa0ee478c2a). This is intentional - the test documents the bug.

## Adding Tests

1. Create `[feature].contract.test.js`
2. Import `testEventHandler` and fixtures
3. Use standard contract assertions
4. Test both success and failure paths