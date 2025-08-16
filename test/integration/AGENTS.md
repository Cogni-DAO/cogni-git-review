# Integration Tests - AGENTS.md

## Overview
Integration tests verify end-to-end webhook flows using Probot with mocked GitHub API calls. Tests simulate real webhook events and validate complete app behavior.

## Test Files
- `spec-aware-webhook.test.js` - Spec loading and validation scenarios (4 tests)
- `simple-integration.test.js` - Basic webhook handling with/without specs (2 tests)
- `hardened-launcher.test.js` - Gate launcher timeout handling and robustness (12 tests)
- `spec-gate-consistency.test.js` - Dynamic gate discovery and execution consistency (4 tests) 
- `cogni-evaluated-gates-behavior.test.js` - End-to-end gate evaluation behavior (4 tests)

## Test Structure
- **Framework**: Node.js native test runner + nock for HTTP mocking
- **Fixtures**: Real webhook payloads from GitHub in `../fixtures/`
- **Setup**: Each test creates fresh Probot instance, clears spec cache
- **Teardown**: Restore network connections, clean nock mocks

## Required Imports
```javascript
import nock from "nock";
import { Probot, ProbotOctokit } from "probot";
import myProbotApp from "../../index.js";
import { clearSpecCache } from "../../src/spec-loader.js";
```

## Test Pattern
```javascript
describe("Test Suite", () => {
  let probot;
  
  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache();
    probot = new Probot({ appId: 123, privateKey: testKey });
    probot.load(myProbotApp);
  });

  test("webhook creates expected check", async () => {
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, { token: "ghs_test_token" })
      .post("/repos/owner/repo/check-runs")
      .reply(200, { id: 123, status: "completed" });

    await probot.receive({ name: "pull_request", payload: webhookPayload });
    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});
```

## Best Practices
- **Use complete webhook payloads**: Copy real GitHub webhook JSON
- **Mock all GitHub API calls**: Authentication, content fetching, check creation
- **Verify nock consumption**: Ensure all mocks were called
- **Test error scenarios**: Missing specs, invalid YAML, API failures, timeout scenarios
- **Isolate tests**: Each test gets fresh Probot instance and cleared cache
- **Use SPEC_FIXTURES**: Import from `../fixtures/repo-specs.js` for DRY testing
- **Test robustness**: Include timeout, unknown gates, partial results scenarios

## Adding New Tests

### Webhook Integration Tests
1. Copy realistic webhook payload to `../fixtures/webhook-name.json`
2. Import payload and required test utilities
3. Mock expected GitHub API endpoints with nock
4. Use `probot.receive()` to simulate webhook delivery
5. Assert expected behavior and verify all mocks consumed

### Launcher Robustness Tests
1. Use `SPEC_FIXTURES` from `../fixtures/repo-specs.js`
2. Test timeout scenarios with `AbortController`
3. Test unknown gates, partial results, ID normalization
4. Use `runConfiguredGates()` directly for unit-style integration testing
5. Assert launcher behavior without full webhook simulation