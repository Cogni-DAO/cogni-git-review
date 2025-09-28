# AI Workflows Directory

## Purpose
LangGraph workflow implementations called only by `src/ai/provider.js`. Contains AI reasoning logic.

## Single Statement Contract
Each workflow execution evaluates PR against one statement/requirement, defined in each `.cogni/rules/rule.yaml` file

```javascript
import { evaluate } from './goal-alignment.js';

const result = await evaluate({
  statement: "Deliver AI-powered advisory review to keep repo aligned",
  pr_title: 'Add LangGraph integration', 
  pr_body: 'This PR implements...',
  diff_summary: '3 files changed (+45 -12)'
}, { 
  timeoutMs: 60000, 
  modelConfig: { model: 'gpt-5-2025-08-07', environment: 'prod', provider: 'openai' }
});

// Returns: { score: 0.85, observations: ["Good alignment", "Clear scope"], summary: "Brief assessment" }
```

## Implementation Details
- **Model**: Passed via modelConfig parameter from provider.js
- **Schema**: Zod validation for structured output (score, observations, summary)
- **Prompt**: Hardcoded template in goal-alignment.js
- **Requirements**: OPENAI_API_KEY environment variable
- **Agent Creation**: Dynamic per-request with selected model

## Constraints
- Only called by provider.js
- Must return score (0-1) not verdict
- TODO: Add AbortController timeout support

## Future Improvements
- External prompt templates (move from hardcoded)
- Timeout handling with AbortController signals