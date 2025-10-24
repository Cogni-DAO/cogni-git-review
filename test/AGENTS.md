# Test Structure - Cogni Git Review Bot

## Testing Philosophy: DRY Tests with Reusable Fixtures

**Key Principle**: Reuse and build reusable test fixtures whenever possible. Avoid duplicating YAML specs, mock contexts, or test data.

## Environment Configuration in Tests

**Test Environment Handling:**
- Tests are exempted from the ESLint `n/no-process-env` rule and may access `process.env` directly
- The centralized `/src/env.js` module sets `NODE_ENV=test` by default when testing
- Mock environment values can be set directly in test files when needed
- The `environment` object from `/src/env.js` provides `isTest` flag for test detection

## Current Test Architecture

### **Unit Tests** - Spec Loader & Gates
**Location**: `test/unit/*.test.js`  
**Coverage**: Spec loading, caching, error handling + individual gate logic  
**Status**: ✅ 15 tests passing (9 spec loader + 6 gate stubs)  

### **Integration Tests** - Webhook Flow & Launcher Hardening
**Location**: `test/integration/*.test.js`  
**Coverage**: Complete webhook → spec loading → gate evaluation → check creation + launcher robustness  
**Status**: ✅ 21+ tests passing (4 behavior + 2 simple + 3 spec-aware + 12 hardened launcher)  

### **Mock Integration Tests** - Basic Webhook Mechanics
**Location**: `test/mock-integration/webhook-handlers.test.js`  
**Coverage**: Basic webhook-to-check flows with hardcoded expectations  
**Status**: ✅ 8 tests passing  

## DRY Test Fixtures 🎯

### **Repo Spec Fixtures** - NEW!
**Location**: `test/fixtures/repo-specs.js`  
**Purpose**: Reusable YAML specs and mock contexts to eliminate duplication  
**Usage**: Import and use across all tests

### **Hardened Launcher Testing**
**Location**: `test/integration/hardened-launcher.test.js` (12 tests)  
**Coverage**: Timeout handling, unknown gates, partial results, ID normalization, duplicate gates  
**Key scenarios**:
- Timeout before/during gate execution → partial results
- Unknown gate handling → neutral with unimplemented_gate reason
- ID normalization → spec gate.id always wins over handler-provided ID
- Malformed gate outputs → safely normalized
- Duplicate gates → run in spec order as separate results

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
import { SPEC_FIXTURES } from './fixtures/repo-specs.js';
import { testEventHandler, createGateTestContext } from './helpers/handler-harness.js';

// Spec fixtures
SPEC_FIXTURES.minimal           // Basic working spec
SPEC_FIXTURES.customName        // Custom check name  
SPEC_FIXTURES.behaviorTest30_100 // 30 files, 100KB limits
SPEC_FIXTURES.invalidYaml       // Malformed YAML
SPEC_FIXTURES.invalidStructure  // Missing sections

// Test harness helpers (with standardized logger support)
testEventHandler({ event, payload, spec, expectCheck })     // Complete webhook testing
createGateTestContext({ spec, pr, vcs })                    // Gate testing with noopLogger
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
npm test  # All tests: 60 total, 59 pass, 1 skip
```

**Individual Test Suites**:
```bash
# Unit Tests
npx node --test test/unit/goal-declaration-stub.test.js      # Gate stub (6 tests)
npx node --test test/unit/forbidden-scopes-stub.test.js     # Gate stub (6 tests)  

# Integration Tests  
npx node --test test/integration/cogni-evaluated-gates-behavior.test.js  # Behavior (4 tests)
npx node --test test/integration/simple-integration.test.js             # Basic flow (2 tests)
npx node --test test/integration/spec-aware-webhook.test.js             # Spec scenarios (4 tests)
npx node --test test/integration/hardened-launcher.test.js              # Launcher robustness (12 tests)
npx node --test test/integration/spec-gate-consistency.test.js          # Gate consistency (4 tests)

# Mock Integration
npx node --test test/mock-integration/webhook-handlers.test.js           # Basic webhooks (9 tests)

# Spec Loader Unit Tests  
npx node --test  # Spec loader tests are in main suite (9 tests)
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

## Linting Fix Best Practices

When ESLint flags unused variables, choose the best fix based on the situation:

### **Preferred Approaches** (Best to Worst)

#### 1. **Don't Create What You Don't Use** ✅ BEST
```javascript
// ❌ Bad: Extract then ignore
const { overall_status: _overall_status, gates, early_exit } = runResult;

// ✅ Good: Only extract what you need  
const { gates, early_exit } = runResult;
```

#### 2. **Don't Compute What You Don't Use** ✅ BETTER
```javascript
// ❌ Bad: Compute then ignore
const _hasNeutralLocal = localResults.some(r => r.status === 'neutral');

// ✅ Good: Remove the unused computation entirely
// (just delete the line)
```

#### 3. **Underscore for Interface Compliance** ✅ ACCEPTABLE
```javascript  
// ✅ Acceptable: Required by interface but unused by implementation
export async function myFunction(ctx, _options) {
  // options param required by interface but this implementation doesn't use it
}
```

### **When to Use Each Approach**

- **Don't extract/compute**: When value is genuinely not needed by the function
- **Underscore prefix**: When parameter is required by interface/API but unused by specific implementation
- **Consider refactoring**: If many functions have unused params, maybe the interface needs improvement

### **Red Flags** ❌
- **Multiple underscores in same function**: Suggests over-extraction or poor design
- **Computing unused values**: Waste of CPU cycles and cognitive load
- **Underscore for laziness**: When you could easily restructure the code

**Goal**: Clean, intentional code where every line serves a purpose.