# Unit Tests Directory

## What Goes Here
Tests for individual functions and components in isolation, without external dependencies.

## Focus Areas
- **Spec loading and validation**: Repository configuration parsing
- **Gate logic**: Individual gate behavior and error handling  
- **Utility functions**: Helper functions and shared logic

## Testing Principles
- Test one component at a time
- Mock external dependencies and GitHub API calls
- Use shared fixtures to avoid duplication
- Cover both success and failure scenarios

## Current Test Files
- `agents-sync.test.js` - AGENTS.md synchronization gate tests
- `ai-provider.test.js` - AI provider integration tests
- `config-extraction-debug.test.js` - Configuration extraction debugging
- `forbidden-scopes-stub.test.js` - Forbidden scopes gate stub tests
- `goal-alignment-workflow.test.js` - Goal alignment workflow tests
- `goal-declaration-stub.test.js` - Goal declaration gate stub tests
- `pr-structure-validation.test.js` - Pull request structure validation tests
- `rules-gate-code-aware.test.js` - **New**: AI rule gate code-aware enhancement tests
  - Tests gatherEvidence() function with GitHub API mocking
  - Verifies budget enforcement (max_files, max_patches, max_patch_bytes_per_file)
  - Tests deterministic file sorting by change count and filename
  - Validates enhanced diff_summary format with actual patch content
  - Ensures backward compatibility with legacy rules (no capabilities)
- `rules-gate-neutral.test.js` - AI rule gate neutral case handling tests
- `spec-loader.test.js` - Repository specification loading tests
- `webhook-spec-debug.test.js` - Webhook specification debugging tests