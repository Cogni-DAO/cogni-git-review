# AI Workflows Directory

## Purpose
LangGraph workflow implementations called by `src/ai/provider.js`. Dynamic AI evaluation logic.

## Workflow Contract
Workflows return: `{ metrics: { metricId: {value, observations} }, summary, provenance }`

```javascript
import { evaluate } from './goal-evaluations.js';

const result = await evaluate({
  evaluations: [
    { "code-quality": "PR maintains code quality standards" },
    { "security": "PR contains no security vulnerabilities" }
  ],
  pr_title: 'Add feature', 
  pr_body: 'Implementation details...',
  diff_summary: '3 files changed (+45 -12)'
}, { client, callbacks });

// Returns: { metrics: { "code-quality": {value: 0.9, observations: [...]}, "security": {value: 1.0, observations: [...]} }, summary: "..." }
```

## Implementation Details
- **Dynamic Schema**: Zod schema generated from `evaluations` array input
- **Dynamic Prompts**: AI instructions generated based on metric count and statements  
- **Registry**: Workflows registered in registry.js
- **Requirements**: OPENAI_API_KEY environment variable
- **Observability**: Langfuse callbacks automatically passed from provider.js
- **Unified Approach**: Single `goal-evaluations` workflow handles 1 to N evaluations