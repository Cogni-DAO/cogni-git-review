# Test Helpers Directory

## What Goes Here
Shared utilities that eliminate duplication in test setup and execution.

## Helper Types  
- **Probot setup**: Standardized bot instance creation for tests
- **Mock factories**: Common GitHub API mock configurations
- **Assertion utilities**: Shared validation helpers
- **Test environment**: Setup and cleanup functions
- **Summary format validators**: DRY assertions for detailed gate report format

## Current Helpers

### `handler-harness.js`
Shared integration test harness for direct handler testing with standardized logger support:
- `testEventHandler()` - Generic event handler testing with complete octokit mocking
- `createGateTestContext()` - DRY context creation for gate testing with noopLogger
- **Logger Support**: All helpers use `noopLogger` from `src/logging/logger.js` with proper `.child()` method support
- **Complete Mocking**: Includes `pulls.get`, `issues.createComment`, `config.get`, and `checks.create`
- Eliminates duplication across contract tests and provides consistent test setup

### `summary-format-validator.js`
DRY assertions for the detailed gate report format:
- `assertGateCountsFormat(text, expectedTotal)` - Validates "✅ X passed | ❌ Y failed | ⚠️ Z neutral" format
- Provides consistent format validation with clear error messages

## Principles
- Extract common patterns from multiple test files
- Provide consistent setup across test suites
- Centralize configuration that changes frequently




---

### ⚠ Known Gaps (Deferred – do not “clean up” yet)

- **Spec loading mismatch:** Helper still assumes `vcs.config.get`; app now loads spec via **VCS interface**. This can create **false greens/reds**.  
  _Deferred fix:_ stub `vcs.config.get()` or mock the appropriate VCS interface methods.

- **Event coverage is incomplete:** Captures only `pull_request.opened`. Missing `synchronize`, `reopened`, and `check_suite.rerequested`.  
  _Deferred fix:_ register and dispatch handlers for all relevant events.

- **Brittle copy assertions:** Some tests use strict `===` on human messages.  
  _Interim rule:_ prefer `includes()` or regex; centralize strings (e.g., `MISSING_SPEC_MSG`) later.

- **Spec cache gotchas:** When tests touch real loader, `clearSpecCache()` is required in `beforeEach` to avoid cross-test contamination.

- **Scope boundary:** This directory provides **local handler helpers**, not network wiring.  
  _Rule:_ no `nock`, no `Probot`/`ProbotOctokit` imports here.

- **Naming drift:** Parts of the suite called “mock-integration” behave as **service/contract** tests.  
  _Deferred fix:_ rename to `test/service/` once harness is upgraded.

**Temporary rules**
- Use this helper only for **service/contract** tests.  
- Keep tests deterministic (explicit SHAs, file counts, additions/deletions).  
- Avoid adding HTTP behaviors here; put real wiring checks in a small Probot+Nock suite later.
