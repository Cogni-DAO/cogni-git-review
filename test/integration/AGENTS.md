# Integration Tests

## Purpose
End-to-end webhook flows using Probot with mocked GitHub API calls. Tests complete app behavior from webhook to check creation.

## Test Files
- `cogni-evaluated-gates-behavior.test.js` - End-to-end gate evaluation behavior
- `simple-integration.test.js` - Basic webhook handling with/without specs  
- `spec-aware-webhook.test.js` - Spec loading and validation scenarios
- `hardened-launcher.test.js` - Gate launcher timeout handling and robustness
- `spec-gate-consistency.test.js` - Dynamic gate discovery and execution consistency
- `ai-rules-integration.test.js` - AI rules gate integration testing

## Test Structure
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

## Requirements
- Use SPEC_FIXTURES from `../fixtures/repo-specs.js` for DRY testing
- Mock all GitHub API calls with nock
- Verify all mocks consumed with `assert.deepStrictEqual(mocks.pendingMocks(), [])`
- Test timeout scenarios and unknown gate handling