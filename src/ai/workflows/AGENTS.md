# AI Workflows Directory

## Purpose
LangGraph workflow implementations called by `src/ai/provider.js`. Workflows contain all domain-specific logic and evidence gathering, while provider remains a pure router.

## Workflow Contract
Workflows receive: `{ context: probotContext, rule: ruleObject }` and `{ logger, ... }`
Workflows return: `{ metrics: { metricId: {value, observations} }, summary }`

The provider adds `provenance` wrapper with runtime metadata.

## Implementation Details
- **Domain Logic**: Workflows handle all PR-specific logic and evidence gathering
- **Evidence Gathering**: Workflows access VCS API via context.vcs interface
- **Dynamic Schema**: Zod schema generated from rule's `evaluations` array
- **Dynamic Prompts**: AI instructions generated based on metric count and statements  
- **Registry**: Workflows registered in registry.js for discovery
- **Environment**: Uses centralized `/src/env.js` for configuration. OPENAI_API_KEY validation handled at module level.
- **Observability**: Langfuse callbacks with provider metadata. Workflows extend with PR-specific context (repo, PR number, commit SHA)
- **Unified Approach**: Single `goal-evaluations` workflow handles 1 to N evaluations
- **Capability Handling**: Workflows interpret rule capabilities (`x_capabilities`)

## Budget Calculation
The `goal-evaluations` workflow calculates evidence gathering budgets with the following precedence:
1. **Review-limits configuration** (`context.reviewLimitsConfig.max_changed_files`) - used as `max_files`
2. **Workflow defaults** - fallback values (25 files, 16KB patches, 3 patches)

This integration ensures AI workflows respect repository-configured review limits consistently across all rules.