# Test Structure - Cogni Git Review Bot

## Current Test Architecture

**Type**: Mocked-integration tests (in-process)  
**Location**: `test/mock-integration/webhook-handlers.test.js`  
**Coverage**: Webhook handlers exercised via `probot.receive()` with outbound GitHub API mocked by `nock`

### What These Tests Do

Tests the complete **webhook → event handler → GitHub API** flow:
- Receive realistic GitHub webhook payloads
- Process through bot event handlers  
- Mock GitHub API responses
- Verify correct API calls are made

### Test Categories

**Webhook Handler Tests** (4 tests):
- `pull_request.opened` → Creates "Cogni Git PR Review" check
- `pull_request.synchronize` → Creates "Cogni Git PR Review" check  
- `check_run.rerequested` → Creates "Cogni Git Commit Check"
- `check_suite.requested` → Creates "Cogni Git Commit Check"

**Payload Validation Tests** (4 tests):
- Verify webhook payloads have required fields for each event type

## Test Fixtures

**Location**: `test/fixtures/`  
**Naming**: `<event>.<action>.complete.json` (e.g., `pull_request.opened.complete.json`)  
**Source**: Sanitized real webhook payloads (no secrets)  
**Consistency**:
- `installation.id`: `12345678`
- `repository`: `derekg1729/cogni-git-review`
- `appId` in tests: `123456`

## Test Guarantees

- Real HTTP is blocked: `nock.disableNetConnect()`
- Every outbound GitHub call is asserted (URL, method, **headers**, and body)
- After each test: assert `mock.pendingMocks() === []` and then clean mocks

## Adding New Tests

### When to Add Tests
- New webhook event handler added to `index.js`
- New GitHub API calls within existing handlers
- Changed webhook payload requirements

### Steps to Add a Test

1. **Create fixture** (if needed):
   ```bash
   # Create: test/fixtures/new_event.action.complete.json
   # Use realistic GitHub webhook structure
   # Maintain consistent IDs with existing fixtures
   ```

2. **Add webhook handler test**:
   ```javascript
   test("new_event.action webhook creates ExpectedCheck", async () => {
     const mock = nock("https://api.github.com")
       .post("/app/installations/12345678/access_tokens")
       .reply(200, { token: "test_token", permissions: {...} })
       .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
         // Verify API call structure
         assert.strictEqual(body.name, "Expected Check Name");
         // ... other assertions
         return true;
       })
       .reply(200, { id: 999999, status: "completed" });

     await probot.receive({ name: "new_event", payload: newEventFixture });
     assert.deepStrictEqual(mock.pendingMocks(), []);
   });
   ```

3. **Add payload validation test**:
   ```javascript
   test("validates webhook payload structure - new_event action", async () => {
     assert(newEventFixture.action === "action");
     assert(typeof newEventFixture.required_field === "expected_type");
     // ... validate all fields used by handler
   });
   ```

## Adding or Refreshing Fixtures

1. **GitHub → App → Webhook deliveries** → open payload → copy JSON (within 3 days) → sanitize → save to `test/fixtures/`
2. Add a payload-validation test for fields your handler reads
3. Add a mocked-integration test that calls `probot.receive({ name, payload })` and asserts the check-run request

## Edge Cases to Cover

- **Duplicate delivery**: dispatch the same payload twice; handler should be idempotent
- **Missing `installation.id`**: handler must skip outbound calls
- **Missing `pull_request.head.sha`**: handler must skip outbound calls

### Best Practices

**Do**:
- Use complete, realistic GitHub webhook payloads
- Test the API request body structure, not just the call
- Maintain consistent fixture data (IDs, repo names)
- Add payload validation for webhook fields you use
- Clear test names describing webhook → outcome

**Don't**:
- Create minimal/synthetic webhook payloads  
- Mock only the API URL without validating request body
- Mix different installation IDs or repo names in fixtures
- Skip payload structure validation
- Write vague test names like "test webhook handling"

## Running Tests

Current setup:
```bash
npm test  # Run all tests (8/8 currently passing)
```

Recommended `package.json` scripts for future organization:
```json
{
  "scripts": {
    "test:unit": "node --test test/unit",
    "test:mocked": "node --test test/mock-integration",
    "test": "npm run test:mocked"
  }
}
```

**All tests should pass** before committing changes.