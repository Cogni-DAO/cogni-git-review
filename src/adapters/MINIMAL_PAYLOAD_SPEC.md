# Minimal Payload Specification

## Overview
This document defines the **minimal subset** of GitHub webhook payload fields required by Cogni gates and core logic. This ensures clean, predictable interfaces while avoiding over-engineering.

## Design Principles
- **Minimal**: Include only fields actually consumed by gates/core logic
- **Source**: Derived from `@octokit/webhooks-types` for compatibility  
- **Type-safe**: JSDoc `@typedef` consumption, never runtime `.d.ts` imports
- **CI-enforced**: Type-level subset checks prevent drift

## Required Payload Fields

### Core Structure
Based on analysis of `src/gates/index.js`, `index.js`, and gate implementations:

```typescript
interface MinimalPayload {
  // Used by: gates/index.js:43 (idempotency key)
  repository: {
    name: string;        // gates/index.js:31 (fallback repo name)
    full_name: string;   // gates/index.js:43 (idempotency key)  
  };

  // Used by: index.js:91 (logging event type)
  action: 'opened' | 'synchronize' | 'reopened';

  // Used by: index.js:89 (main PR handler)
  pull_request: {
    number: number;      // gates/index.js:25 (context.pr.number)
    title: string;       // gates/index.js:26 (context.pr.title)
    state: string;       // Standard field, minimal validation
    
    head: {
      sha: string;       // index.js:90, gates/index.js:29
      repo: {
        name: string;    // gates/index.js:31 (repo name fallback)
      };
    };
    
    base: {
      sha: string;       // gates/index.js:35 (context.pr.base.sha)
    };
  };

  // Basic installation context (not actively used but required for structure)
  installation: {
    id: string | number;
  };
}
```

## Implementation Examples

### Local CLI Adapter
```javascript
// src/adapters/local-cli/local-context.js
_createMinimalPayload() {
  const repoName = path.basename(this.repoPath);
  
  this.payload = {
    repository: {
      name: repoName,                           // ✅ Used by gates
      full_name: `local/${repoName}`           // ✅ Used for idempotency
    },
    action: 'opened',                          // ✅ Used by logging
    pull_request: {
      number: 1,                               // ✅ Used by context.pr
      title: `Local diff: ${this.baseRef}...${this.headRef}`, // ✅ Used by context.pr
      state: 'open',                           // ✅ Standard requirement
      head: {
        sha: this._getCommitSha(this.headRef), // ✅ Used by core logic
        repo: { name: repoName }               // ✅ Used as fallback
      },
      base: {
        sha: this._getCommitSha(this.baseRef)  // ✅ Used by context.pr
      }
    },
    installation: { id: 'local-cli' }         // ✅ Basic structure
  };
}
```

### GitHub Adapter (Reference)
```javascript
// GitHub webhook payloads naturally contain these fields
// No synthetic generation needed - they're provided by GitHub
```

## Fields NOT Required

These fields were initially included but analysis shows they're **not used** by core logic:

❌ **Not needed:**
- `pull_request.body` - Only used if explicitly set by orchestrator
- `pull_request.changed_files/additions/deletions` - Retrieved via VCS interface
- `pull_request.id` - Number is sufficient
- Complex repository metadata beyond name/full_name
- Installation metadata beyond basic ID
- GitHub-specific webhook metadata

## Validation Strategy

### TypeScript Compatibility Check
```typescript
// test/types/payload-compatibility.test.ts
import type { PullRequestOpenedEvent } from '@octokit/webhooks-types';

// Ensure MinimalPayload is a valid subset of GitHub payloads
const githubPayload: PullRequestOpenedEvent['payload'] = {} as any;
const minimalPayload: MinimalPayload = githubPayload; // ✅ Should compile
```

### Runtime Validation
```javascript
// Gates should work with minimal payload
const localContext = new LocalContext('main', 'HEAD', '/repo');
const gateResult = await reviewLimitsGate.run(localContext); // ✅ Should work
```

## Usage Patterns

### JSDoc Consumption (Recommended)
```javascript
/**
 * @typedef {import('../base-context.d.ts').BaseContext} BaseContext
 */

/**
 * Gate implementation
 * @param {BaseContext} context - Context with minimal payload
 */
async function myGate(context) {
  const { number, title } = context.payload.pull_request; // ✅ Available
  const repoName = context.payload.repository.name;       // ✅ Available
}
```

### What NOT to do
```javascript
// ❌ Never import .d.ts at runtime
import { BaseContext } from '../base-context.d.ts'; // Runtime error!

// ❌ Don't access undefined payload fields
const prBody = context.payload.pull_request.body; // Might be undefined
```

## Compatibility Notes

- **Source Compatibility**: Fields chosen are present in `@octokit/webhooks-types`
- **GitHub Adapter**: No changes needed - real webhooks contain all required fields
- **Local CLI**: Synthetic generation provides exactly these fields
- **Future Adapters**: Must provide these minimal fields, can add more if needed

## CI Enforcement

```yaml
# .github/workflows/type-check.yml
- name: Validate payload compatibility
  run: |
    npx tsc --noEmit test/types/payload-compatibility.test.ts
    npm test test/contract/minimal-payload.test.js
```

This ensures the minimal payload remains a valid subset of GitHub webhook payloads and that gates work with only these fields.