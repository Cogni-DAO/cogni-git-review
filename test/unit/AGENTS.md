# Unit Tests Directory

## What Goes Here
Tests for individual functions and components in isolation, without external dependencies.

## Focus Areas
- **Spec loading and validation**: Repository configuration parsing
- **Gate logic**: Individual gate behavior and error handling  
- **Model selection**: Environment-based AI model configuration
- **Utility functions**: Helper functions and shared logic

## Testing Principles
- Test one component at a time
- Mock external dependencies and GitHub API calls
- Use shared fixtures to avoid duplication
- Cover both success and failure scenarios

## Current Test Files
- `agents-sync.test.js` - AGENTS.md synchronization gate tests
- `ai-provider.test.js` - AI provider contract validation with observation handling and logger parameters
- `ai-rule-input-validation.test.js` - AI rule input assembly and validation tests
- `check-contract.min.test.js` - Enforce github Check name follows environment-aware pattern (prod locked, others get suffix)
- `config-extraction-debug.test.js` - Configuration extraction debugging
- `eval-criteria.test.js` - Success criteria evaluation logic tests for multi-metric evaluation
- `forbidden-scopes-stub.test.js` - Forbidden scopes gate stub tests
- `goal-declaration-stub.test.js` - Goal declaration gate stub tests
- `governance-policy.test.js` - Governance policy gate workflow validation tests MVP with shared mock utilities
- `make-llm-client.test.js` - LLM client factory whitelist behavior tests
- `model-selector.test.js` - Environment-based model selection tests, mocking env.app
- `pr-structure-validation.test.js` - Pull request structure validation tests
- `rules-gate-code-aware.test.js` - AI rule gate code-aware enhancement tests
- `rules-gate-neutral.test.js` - AI rule gate neutral case handling tests
- `spec-loader.test.js` - Repository specification loading tests
- `summary-adapter.test.js` - Summary formatting and operator symbol mapping tests
- `webhook-spec-debug.test.js` - Webhook specification debugging tests
- `workflow-registry.test.js` - AI workflow registry functionality tests for unified goal-evaluations workflow