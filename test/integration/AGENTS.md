# Integration Test Directory - Service/Contract Test Pattern

## Overview
This directory contains **service/contract tests** that verify the bot's behavior by calling handlers directly with mocked contexts. These tests focus on the contract between the webhook handler and GitHub API without making real HTTP calls.

**Pattern:** Fast, stable service-level tests using the shared harness.

## Test Categories

### Service/Contract Tests (Current - Recommended)
- **Location**: `test/integration/` (consider renaming to `test/service/`)
- **Pattern**: Call handler directly with fake context + stubbed dependencies
- **Characteristics**: No HTTP, no Probot setup, fast & stable
- **Use**: Testing business logic, gate execution, spec handling

### True Integration Tests (Future)
- **Location**: `test/e2e/` (when implemented)  
- **Pattern**: Real GitHub webhooks → real bot instance → real GitHub API
- **Characteristics**: Slow, requires network, end-to-end validation
- **Use**: Deployment validation, critical path verification

## Required Pattern: Harness-Based Service Tests

### Standard Template

```javascript
/**
 * [Feature] Contract Tests
 * Tests [feature] functionality using service/contract test pattern
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { testPullRequestHandler } from '../helpers/integration-harness.js';
import pullRequestOpenedPayload from '../fixtures/pull_request.opened.complete.json' assert { type: 'json' };

function payload(overrides = {}) {
  return {
    ...pullRequestOpenedPayload,
    repository: { 
      ...pullRequestOpenedPayload.repository, 
      name: 'test-repo', 
      owner: { login: 'test-org' } 
    },
    pull_request: {
      ...pullRequestOpenedPayload.pull_request,
      head: { ...pullRequestOpenedPayload.pull_request.head, sha: 'abc123def456789012345678901234567890abcd' },
      changed_files: 5,
      additions: 30,
      deletions: 30,
      ...overrides
    }
  };
}

describe('[Feature] Contract Tests', () => {
  it('[scenario] → [expected behavior]', async () => {
    await testPullRequestHandler({
      payload: payload(),
      spec: 'fixtureKey', // or parsed object, or null
      expectCheck: (params) => {
        // ALWAYS assert these contract basics:
        assert.strictEqual(params.name, 'Cogni Git PR Review');
        assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
        assert.strictEqual(params.status, 'completed');
        assert(['success', 'failure', 'neutral'].includes(params.conclusion));
        
        // THEN assert specific behavior:
        assert.match(params.output.text, /\\bGates:\\s*\\d+\\s+total\\b/);
      }
    });
  });
});
```

### Key Requirements

#### ✅ DO Use:
- `testPullRequestHandler` from the shared harness
- Fixture keys (strings) when possible: `spec: 'minimal'`
- Deterministic payloads with explicit values (sha, files, additions, deletions)
- Standard contract assertions (name, head_sha, status, conclusion)
- Stricter regex patterns: `/\\bGates:\\s*N\\s+total\\b/`

#### ❌ DON'T Use:
- `nock` or any HTTP mocking
- `Probot`, `ProbotOctokit` imports
- Manual handler extraction (`mockApp`, `extractHandler`)
- `beforeEach`/`afterEach` for network/cache management
- Hardcoded real owner/repo values
- `clearSpecCache` calls

### Spec Parameter Options

```javascript
// Fixture key (preferred)
spec: 'minimal'
spec: 'gateConsistency2Gates'

// Missing spec
spec: null

// Parsed object (for modifications)
spec: yaml.load(SPEC_FIXTURES.minimal)
spec: { ...someObject, gates: [] }
```

### Standard Assertions

```javascript
expectCheck: (params) => {
  // Contract basics (ALWAYS include):
  assert.strictEqual(params.name, 'Cogni Git PR Review');
  assert.strictEqual(params.head_sha, 'abc123def456789012345678901234567890abcd');
  assert.strictEqual(params.status, 'completed');
  assert(['success', 'failure', 'neutral'].includes(params.conclusion));
  
  // Behavior-specific assertions:
  assert.match(params.output.text, /\\bGates:\\s*2\\s+total\\b/); // Gate count
  assert(params.output.summary.includes('Expected message')); // Summary content
}
```

## Examples

### Gate Count Validation
```javascript
it('3 gates configured → exactly 3 gates execute', async () => {
  await testPullRequestHandler({
    payload: payload(),
    spec: 'gateConsistency3Gates',
    expectCheck: (params) => {
      assert.strictEqual(params.name, 'Cogni Git PR Review');
      assert.strictEqual(params.status, 'completed');
      assert.match(params.output.text, /\\bGates:\\s*3\\s+total\\b/);
    }
  });
});
```

### Error Handling
```javascript
it('missing spec → creates failure check', async () => {
  await testPullRequestHandler({
    payload: payload(),
    spec: null,
    expectCheck: (params) => {
      assert.strictEqual(params.conclusion, 'failure');
      assert(params.output.summary.includes('No .cogni/repo-spec.yaml found'));
    }
  });
});
```

### Dynamic Modifications
```javascript
it('invalid rules dir → handles gracefully', async () => {
  const broken = SPEC_FIXTURES.rulesMvpIntegration.replace(
    'rules_dir: .cogni/rules',
    'rules_dir: /nonexistent/rules'
  );
  
  await testPullRequestHandler({
    payload: payload(),
    spec: yaml.load(broken),
    expectCheck: (params) => {
      assert(['success', 'failure', 'neutral'].includes(params.conclusion));
    }
  });
});
```

### Performance: 
Current pattern enables fast test execution - entire suite runs in ~2-3 seconds vs minutes with HTTP mocking.