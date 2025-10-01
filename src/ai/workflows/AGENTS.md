# AI Workflows Directory

## Purpose
LangGraph workflow implementations called by `src/ai/provider.js`. Dynamic AI evaluation logic.

## Workflow Contract
Workflows return: `{ metrics: { metricId: {value, observations} }, summary, provenance }`

## Implementation Details
- **Dynamic Schema**: Zod schema generated from `evaluations` array input
- **Dynamic Prompts**: AI instructions generated based on metric count and statements  
- **Registry**: Workflows registered in registry.js
- **Requirements**: OPENAI_API_KEY environment variable
- **Observability**: Langfuse callbacks with base metadata passed from provider.js. Workflows can supplement by extending `metadata` with workflow-specific context
- **Unified Approach**: Single `goal-evaluations` workflow handles 1 to N evaluations