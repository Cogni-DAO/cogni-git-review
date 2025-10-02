# AI Workflows Directory

## Purpose
LangGraph workflow implementations called by `src/ai/provider.js`. Workflows contain all domain-specific logic and evidence gathering, while provider remains a pure router.

## Workflow Contract
Workflows receive: `{ context: probotContext, rule: ruleObject }` and `{ logger, ... }`
Workflows return: `{ metrics: { metricId: {value, observations} }, summary }`

The provider adds `provenance` wrapper with runtime metadata.

## Implementation Details
- **Domain Logic**: Workflows handle all PR-specific logic and evidence gathering
- **Evidence Gathering**: Workflows directly access GitHub API via context.octokit
- **Dynamic Schema**: Zod schema generated from rule's `evaluations` array
- **Dynamic Prompts**: AI instructions generated based on metric count and statements  
- **Registry**: Workflows registered in registry.js for discovery
- **Requirements**: OPENAI_API_KEY environment variable
- **Observability**: Langfuse callbacks with provider metadata. Workflows extend with PR-specific context (repo, PR number, commit SHA)
- **Unified Approach**: Single `goal-evaluations` workflow handles 1 to N evaluations
- **Capability Handling**: Workflows interpret rule capabilities (`x_capabilities`) and budgets (`x_budgets`)