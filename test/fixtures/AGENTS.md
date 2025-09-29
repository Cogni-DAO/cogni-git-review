# Test Fixtures Directory

## What Goes Here
Reusable test data that eliminates duplication across test suites.

## Fixture Types
- **Repository specs**: YAML configurations for different test scenarios (repo-specs.js)
- **Webhook payloads**: Real GitHub webhook events (check_run, check_suite, pull_request, installation)
- **AI rule fixtures**: Mock AI evaluation data and contexts (ai-rules.js), matching real spec formats
  - **Goal Alignment v2 format**: Uses `success_criteria: { require: [{ metric: 'score', gte: X }] }`
  - **Reusable mocks**: `createMockAIGateResult()`, `MOCK_AI_GATE_PASS`, `MOCK_AI_GATE_FAIL`
- **Mock contexts**: GitHub API response simulations
- **Certificates**: Authentication test files

## Current Repository Spec Fixtures
- `minimal`, `full`, `bootstrap`, `advisory` - Basic gate configurations
- `behaviorTest30_100`, `behaviorTest10_50` - Review limit testing
- `gateConsistency1Gate`, `gateConsistency2Gates`, `gateConsistency3Gates` - Gate counting
- `legacy` - Legacy spec format testing
- `rulesSingleFile`, `rulesNoRuleFile`, `rulesInvalidFile` - AI rule configurations
- `multipleAIRules` - Multiple AI rule instances
- `agentsSync`, `agentsSyncWithCustomConfig`, `agentsSyncWithOtherGates` - AGENTS.md sync testing
- `governance`, `governanceNoContexts`, `governanceUnknownContext` - Governance policy testing MVP

## Principles
- Use fixtures instead of inline test data
- Maintain consistent IDs and structure across all fixtures
- Base webhook fixtures on real GitHub payloads
- Keep sensitive data sanitized
- Some fixtures use `${PR_REVIEW_NAME}` template literal for environment-aware check names