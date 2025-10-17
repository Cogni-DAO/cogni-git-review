# Context Interface Specification

## Two-Layer Interface Design

Cogni uses **two interface layers** for complete host abstraction:

1. **CogniBaseApp** (`base-app.d.ts`) - App/event system abstraction (app.on() method)
2. **BaseContext** (`base-context.d.ts`) - Context/payload abstraction ← **THIS DOCUMENT**

Both layers must be implemented by host adapters for full host independence.

---

This document defines the **BaseContext interface** - the minimal context interface that must be implemented for Cogni to work with any git hosting provider.

## Required Context Properties & Methods

### Core Interface

**`context.repo(options?)`**
- Returns: `{ owner: string, repo: string }`
- Usage: `context.repo()` or `context.repo({ pull_number: 123 })`
- Purpose: Provide repository identification

**`context.payload`** 
- Type: Object with GitHub webhook-like structure
- Required fields:
  - `context.payload.repository.name` - Repository name
  - `context.payload.repository.full_name` - Full repository name
  - `context.payload.installation.id` - Installation/context ID (can be synthetic)
  - `context.payload.pull_request.head.sha` - Head commit SHA (when applicable)

**`context.vcs`**
- Host-agnostic VCS interface (abstracts GitHub/GitLab/local git)
- Required methods:
  - `context.vcs.config.get({ owner, repo, path })` - Load configuration files
  - `context.vcs.pulls.get(repo({ pull_number }))` - Get PR metadata
  - `context.vcs.pulls.listFiles(repo({ pull_number }))` - Get changed files
  - `context.vcs.repos.compareCommits(repo({ base, head }))` - Get commit comparison
  - `context.vcs.repos.getContent({ owner, repo, path })` - Get file content (for setup only)
- Note: The GitHub adapter internally maps `context.vcs.*` calls to `context.octokit.*`

### Runtime Properties (Added by Gate Orchestrator)

These properties are added by the gate orchestrator and don't need to be implemented by context:

- `context.pr` - PR metadata extracted from webhook
- `context.spec` - Loaded repository specification  
- `context.annotation_budget` - GitHub annotation limits (50)
- `context.idempotency_key` - Unique execution identifier
- `context.reviewLimitsConfig` - Review limits configuration for AI budgets

## LocalContext Implementation Strategy

### Synthetic Payload Generation
```javascript
context.payload = {
  repository: {
    name: repoPath.split('/').pop(),
    full_name: repoPath,
  },
  installation: {
    id: 'local-git-installation'
  },
  pull_request: {
    head: { sha: headSha }
  }
};
```

### Git CLI to API Translation
```javascript
// context.vcs.pulls.listFiles() → git diff --name-status
// context.vcs.repos.compareCommits() → git diff + git show
// context.vcs.config.get() → fs.readFileSync() 
```

### Repository Information
```javascript
context.repo = (options = {}) => ({
  owner: 'local',
  repo: repoName,
  ...options
});
```

## Used Context Methods by Component

### Gates (`src/gates/cogni/`)
- **review-limits.js**: `context.vcs.pulls.get()`, `context.repo()`
- **governance-policy.js**: `context.repo()`, `context.vcs.repos.getContent()`, `context.spec`
- All gates: Runtime properties added by orchestrator

### AI Workflows (`src/ai/workflows/`)
- **goal-evaluations.js**: `context.pr.number`, `context.repo()`, `context.vcs.rest.pulls.listFiles()`, `context.reviewLimitsConfig`, `context.payload.repository.full_name`, `context.payload.installation.id`

### Spec Loader (`src/spec-loader.js`)
- `context.repo()`, `context.vcs.config.get()`

### Gate Orchestrator (`src/gates/index.js`)
- `context.payload.repository.name` - Used to build synthetic PR metadata
- Adds all runtime properties to context

## Implementation Verification

To verify LocalContext implements the interface correctly:

1. **Run existing tests** - All tests should pass with LocalContext
2. **Check method calls** - Grep for `context\.` usage patterns
3. **Validate synthetic data** - Ensure payload structure matches GitHub webhooks
4. **Test file operations** - Verify git CLI operations work correctly

## Error Handling

LocalContext should handle missing functionality gracefully:

- **Unimplemented methods**: Throw clear error messages
- **Missing files**: Return `null` or empty results as GitHub API does  
- **Git command failures**: Convert to appropriate API error responses
- **Network-only features**: Return neutral/skip responses

This interface ensures 100% compatibility between Probot context and LocalContext while keeping all existing gate logic unchanged.

## Files Requiring Import Updates

**JSDoc Type Annotation Updates (8 files):**
1. `src/gates/index.js:10` - `@param {import('probot').Context|object} context`
2. `src/spec-loader.js:5` - `@param {import('probot').Context} context`  
3. `src/spec-loader.js:22` - `@param {import('probot').Context} context`
4. `src/spec-loader.js:39` - `@param {import('probot').Context} context`
5. `src/gates/run-configured.js:47` - `@param {import('probot').Context} params.context`
6. `src/gates/cogni/forbidden-scopes-stub.js:12` - `@param {import('probot').Context} context`
7. `src/gates/cogni/goal-declaration-stub.js:12` - `@param {import('probot').Context} context` 
8. `src/gates/cogni/review-limits.js:11` - `@param {import('probot').Context} context`

**Recommended New Import Pattern:**
```javascript
// Instead of:
@param {import('probot').Context} context - Probot context

// Use:
@param {import('../context/base-context.js').BaseContext} context - Host context (GitHub/Local)
```

**Context Interface File Structure:**
```
src/context/
├── base-context.js     # TypeScript interface definition + JSDoc types
└── local-context.js    # LocalContext implementation
```

This maintains TypeScript compatibility while supporting multiple context implementations.

## Captured Webhook Fixtures

**Status**: ✅ **COMPLETED** - Webhook capture tool implemented and fixtures collected.

### Event Types and Actions Captured

Based on real GitHub webhook fixtures captured in `fixtures/github/`:

**Pull Request Events (`pull_request`)**:
- `opened` - New PR created
- `synchronize` - New commits pushed to existing PR
- `closed` - PR merged or closed

**Check Suite Events (`check_suite`)**:
- `requested` - New check suite initiated
- `completed` - Check suite finished
- `rerequested` - Manual re-run of checks (critical for Cogni rerun handling)

**Check Run Events (`check_run`)**:
- `created` - Individual check started
- `completed` - Individual check finished

**Workflow Run Events (`workflow_run`)**:
- `in_progress` - GitHub Actions workflow running

### Webhook Security Verification

**Signature Validation**: ✅ **VERIFIED**
```bash
# Signature verification successful with webhook secret:
# WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b
Expected:  sha256=34ba640e32d8041774b4467ed7327d21281b890ae177f4bab6e609bcf775fa17
Computed:  sha256=34ba640e32d8041774b4467ed7327d21281b890ae177f4bab6e609bcf775fa17
Match: true
```

**Probot Signature Handling**: Probot automatically verifies `x-hub-signature-256` headers using the configured `WEBHOOK_SECRET_GITHUB`. The raw body is HMAC-SHA256 signed and verified before payload parsing. LocalContext will bypass this verification since it generates synthetic payloads locally.

### Critical Payload Fields for LocalContext

Based on captured fixtures, LocalContext must synthesize these key fields:

```javascript
// From fixtures/github/pull_request/*.json
context.payload = {
  action: "opened|synchronize|closed",
  number: 123,
  pull_request: {
    id: 2907114512,
    number: 123,
    state: "open",
    title: "PR Title",
    head: { 
      sha: "abc123...",
      repo: { name: "repo-name", full_name: "owner/repo-name" }
    },
    base: { 
      sha: "def456...",
      repo: { name: "repo-name", full_name: "owner/repo-name" }
    },
    changed_files: 5,
    additions: 42,
    deletions: 13
  },
  repository: {
    name: "repo-name",
    full_name: "owner/repo-name"
  },
  installation: {
    id: 2010729
  }
};
```

### Fixture-Based Testing Strategy

The captured fixtures enable comprehensive LocalContext validation:
1. **Payload Structure Tests** - Verify LocalContext generates compatible payload shapes
2. **Field Mapping Tests** - Ensure all gate-required fields are present
3. **Action Coverage Tests** - Test all captured event/action combinations
4. **Signature Skip Tests** - Verify LocalContext bypasses signature verification gracefully

## Context Implementation Testing

**Two Interface Validation Tests:**

1. **GitHub adapter function** - The github.js adapter directly passes Probot contexts to the core application logic.

2. **`test/unit/probot-context-interface.test.js`** - Tests that Probot context **directly implements BaseContext interface** without any wrapper needed. Validates that existing Probot contexts already have all required properties and methods.

**Key Insight**: Test #2 proves that **Probot context IS BaseContext**. No wrapper classes needed - we can pass Probot contexts directly to core logic. This validates the JSON specification's principle that "Context is already the interface." LocalContext simply needs to implement the same interface that Probot context already provides.