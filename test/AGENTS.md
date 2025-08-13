# Test Structure - Cogni Git Review Bot

## Testing Philosophy: DRY Tests with Reusable Fixtures

**Key Principle**: Reuse and build reusable test fixtures whenever possible. Avoid duplicating YAML specs, mock contexts, or test data.

## Current Test Architecture

### **Unit Tests** - Spec Loader
**Location**: `test/simple-spec-test.js`  
**Coverage**: Spec loading, caching, error handling with direct mocking  
**Status**: ✅ 8 tests passing  

### **Integration Tests** - Webhook Flow
**Location**: `test/integration/simple-integration.test.js`  
**Coverage**: Complete webhook → spec loading → check creation flow  
**Status**: ✅ 2 tests passing  

### **Legacy Tests** - Original Mock Integration  
**Location**: `test/mock-integration/webhook-handlers.test.js`  
**Status**: ⚠️ Outdated (pre-spec-loading era)  

## DRY Test Fixtures 🎯

### **Repo Spec Fixtures** - NEW!
**Location**: `test/fixtures/repo-specs.js`  
**Purpose**: Reusable YAML specs and mock contexts to eliminate duplication  
**Usage**: Import and use across all tests

### **CRITICAL: Always Use Fixtures - No Inline YAML**

**❌ WRONG:**
```javascript
const badSpec = `schema_version: '0.2.1'...`;
```

**✅ RIGHT:**  
```javascript
const spec = SPEC_FIXTURES.minimal;
```

**Available Fixtures**:
```javascript
import { SPEC_FIXTURES, createMockContext } from './fixtures/repo-specs.js';

SPEC_FIXTURES.minimal           // Basic working spec
SPEC_FIXTURES.customName        // Custom check name
SPEC_FIXTURES.behaviorTest30_100 // 30 files, 100KB limits
SPEC_FIXTURES.invalidYaml       // Malformed YAML
SPEC_FIXTURES.invalidStructure  // Missing sections

createMockContext("org", "repo", "success")   // Working API
createMockContext("org", "repo", "not_found") // 404 response
```

### **Webhook Fixtures** - Existing
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

**All Tests**:
```bash
npm test  # All tests passing: 29/30 (1 skipped)
```

**Individual Test Suites**:
```bash
npx node --test test/simple-spec-test.js           # Unit tests (8 tests)
npx node --test test/integration/simple-integration.test.js  # Integration (2 tests)
```

## Test Development Guidelines

### **DO** ✅
- **Reuse fixtures**: Always use `test/fixtures/repo-specs.js` for spec-related tests
- **DRY principle**: Create reusable mock factories rather than inline duplicates
- **Clear test names**: `loadRepoSpec parses valid minimal spec` vs `test spec loading`
- **Focus on behavior**: Test what the function does, not how it does it
- **Use working tests as templates**: Copy from `test/simple-spec-test.js` patterns

### **DON'T** ❌  
- **Duplicate YAML strings**: Use `SPEC_FIXTURES.*` instead
- **Inline mock contexts**: Use `createMockContext()` factories
- **Complex HTTP mocking**: Use direct function mocking when possible
- **Vague assertions**: Be specific about expected behavior
- **Skip cleanup**: Always clear caches and mocks in test teardown

**All working tests should pass** before committing changes.