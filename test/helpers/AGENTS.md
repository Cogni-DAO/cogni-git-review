# Test Helpers Directory

## What Goes Here
Shared utilities that eliminate duplication in test setup and execution.

## Helper Types  
- **Probot setup**: Standardized bot instance creation for tests
- **Mock factories**: Common GitHub API mock configurations
- **Assertion utilities**: Shared validation helpers
- **Test environment**: Setup and cleanup functions

## Principles
- Extract common patterns from multiple test files
- Provide consistent setup across test suites
- Centralize configuration that changes frequently




---

### ⚠ Known Gaps (Deferred – do not “clean up” yet)

- **Spec loading mismatch:** Helper still assumes `octokit.config.get`; app now loads spec via **GitHub Contents API**. This can create **false greens/reds**.  
  _Deferred fix:_ stub `octokit.request('GET /repos/{owner}/{repo}/contents/.cogni/repo-spec.yaml')` / `rest.repos.getContent`.

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
