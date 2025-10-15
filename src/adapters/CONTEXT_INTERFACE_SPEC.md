# Context Interface Specification

This document defines the minimal context interface that must be implemented for Cogni to work with any git hosting provider.

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

**`context.octokit`**
- Subset of GitHub Octokit client interface
- Required methods:
  - `context.octokit.config.get({ owner, repo, path })` - Load configuration files
  - `context.octokit.pulls.get(repo({ pull_number }))` - Get PR metadata
  - `context.octokit.pulls.listFiles(repo({ pull_number }))` - Get changed files
  - `context.octokit.repos.compareCommits(repo({ base, head }))` - Get commit comparison
  - `context.octokit.repos.getContent({ owner, repo, path })` - Get file content (for setup only)

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
// context.octokit.pulls.listFiles() → git diff --name-status
// context.octokit.repos.compareCommits() → git diff + git show
// context.octokit.config.get() → fs.readFileSync() 
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
- **review-limits.js**: `context.octokit.pulls.get()`, `context.repo()`
- **governance-policy.js**: `context.repo()`, `context.octokit.repos.getContent()`, `context.spec`
- All gates: Runtime properties added by orchestrator

### AI Workflows (`src/ai/workflows/`)
- **goal-evaluations.js**: `context.pr.number`, `context.repo()`, `context.octokit.rest.pulls.listFiles()`, `context.reviewLimitsConfig`, `context.payload.repository.full_name`, `context.payload.installation.id`

### Spec Loader (`src/spec-loader.js`)
- `context.repo()`, `context.octokit.config.get()`

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

## Future Enhancement: Fixture Capture

**Note**: Consider implementing fixture capture endpoint (similar to cogni-git-admin) to capture real GitHub webhook payloads for:

- **Payload Structure Validation** - Ensure LocalContext synthetic payloads match real GitHub webhooks exactly
- **Edge Case Discovery** - Identify payload variations across different GitHub events
- **Test Data Generation** - Create comprehensive test fixtures for LocalContext validation
- **Schema Evolution** - Track changes in GitHub webhook payload structure over time

**Suggested Implementation:**
- Capture `pull_request.opened`, `pull_request.synchronize`, `check_suite.rerequested` events
- Store sanitized payloads (remove sensitive data) as test fixtures
- Use captured payloads to validate LocalContext.payload structure
- Automate payload compatibility tests

This would significantly improve confidence in LocalContext GitHub API compatibility.