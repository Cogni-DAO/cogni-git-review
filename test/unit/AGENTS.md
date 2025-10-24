# Unit Tests Directory

## What Goes Here
Tests for individual functions and components in isolation, without external dependencies.

## Focus Areas
- **Spec loading and validation**: Repository configuration parsing
- **Gate logic**: Individual gate behavior and error handling  
- **Model selection**: Environment-based AI model configuration
- **Utility functions**: Helper functions and shared logic
- **Provider adapters**: GitLab and GitHub payload transformation and interface compliance

## Testing Principles
- Test one component at a time
- Mock external dependencies and GitHub API calls
- Use shared fixtures to avoid duplication
- Cover both success and failure scenarios

## Environment Configuration in Tests
Tests can access `process.env` directly (ESLint exempted) and may mock environment variables. The centralized `/src/env.js` module provides validated configuration via the `environment` export. Unit tests primarily test isolated logic rather than full environment validation.

## Current Test Files
- `agents-sync.test.js` - AGENTS.md synchronization gate tests
- `ai-provider.test.js` - AI provider contract validation with observation handling and noopLogger parameters
- `ai-rule-input-validation.test.js` - AI rule input assembly and validation tests
- `budget-calculation.test.js` - Budget calculation logic tests for review-limits integration with AI workflows
- `check-contract.min.test.js` - Enforce github Check name follows environment-aware pattern (prod locked, others get suffix). Tests for `fail_on_error` flag behavior in `mapStatusToConclusion` function
- `config-extraction-debug.test.js` - Configuration extraction debugging
- `eval-criteria.test.js` - Success criteria evaluation logic tests for multi-metric evaluation
- `forbidden-scopes-stub.test.js` - Forbidden scopes gate stub tests
- `gitlab-payload-transform.test.js` - GitLab payload transformation (7 tests)
- `gitlab-router.test.js` - GitLab router core logic (2 tests)
- `gitlab-vcs-interface.test.js` - GitLab VCS interface (6 tests)
- `goal-declaration-stub.test.js` - Goal declaration gate stub tests
- `governance-policy.test.js` - Governance policy gate workflow validation tests MVP with shared mock utilities
- `make-llm-client.test.js` - LLM client factory whitelist behavior tests
- `model-selector.test.js` - Environment-based model selection tests, mocking env.app
- `pr-structure-validation.test.js` - Pull request structure validation tests
- `probot-context-interface.test.js` - Validates Probot context implements BaseContext interface
- `rules-gate-code-aware.test.js` - AI rule gate code-aware enhancement tests
- `rules-gate-neutral.test.js` - AI rule gate neutral case handling tests
- `runallgates-real-webhook-payload.test.js` - End-to-end gate validation using real GitHub webhook fixtures
- `spec-loader.test.js` - Repository specification loading tests
- `summary-adapter.test.js` - Summary formatting and operator symbol mapping tests
- `webhook-spec-debug.test.js` - Webhook specification debugging tests
- `workflow-registry.test.js` - AI workflow registry functionality tests for unified goal-evaluations workflow

## Host Abstraction Interface Tests
Tests validate the host abstraction layer:
- **Interface compatibility**: Probot context implements BaseContext interface
- **Adapter functionality**: github.js correctly wraps Probot into CogniBaseApp interface  
- **Real-world validation**: Gate orchestrator works with actual GitHub webhook payloads
- **GitLab adapter validation**: GitLab context implements BaseContext interface with proper VCS method signatures