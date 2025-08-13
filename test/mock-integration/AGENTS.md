# Mock Integration Tests - AGENTS.md

## Overview
Mock integration tests verify webhook handling with hardcoded expectations. These test the basic flow from webhook event to check creation, without testing spec parsing or business logic variations.

## Test Files
- `webhook-handlers.test.js` - Basic webhook-to-check flows

## Difference from Full Integration Tests
**Mock Integration**: Tests assume current implementation behavior  
**Full Integration**: Tests spec loading, validation, and various scenarios

**Key distinction**: Mock integration tests expect specific hardcoded conclusions (like "success") while full integration tests vary behavior based on spec content.

## Required Imports
```javascript
import nock from "nock";
import { Probot, ProbotOctokit } from "probot";
import myProbotApp from "../../index.js";
import fs from "fs";
```

## Test Pattern
```javascript
describe("Webhook Handler Tests", () => {
  let probot;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123456,
      privateKey,
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    probot.load(myProbotApp);
  });

  test("webhook creates expected check", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, { token: "ghs_test_token" })
      .post("/repos/owner/repo/check-runs", (body) => {
        // Validate specific expected behavior
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Expected Title");
        return true;
      })
      .reply(200, { id: 123 });

    await probot.receive({ name: "pull_request", payload: webhookPayload });
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });
});
```

## Characteristics
- **Hardcoded expectations**: Tests expect specific conclusions/titles
- **Minimal mocking**: Only auth + check creation
- **Body validation**: Validates exact check parameters
- **Current behavior**: Tests what app currently does, not what it should do

## When to Use
- Smoke testing webhook mechanics
- Verifying check creation API calls
- Testing new webhook event types
- Quick validation during development

## When NOT to Use
Use full integration tests for:
- Testing spec loading and parsing
- Validating business logic with different specs  
- Error handling scenarios
- Behavior that varies based on repository configuration