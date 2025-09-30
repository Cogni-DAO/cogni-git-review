# AI Workflows Directory

## Purpose
LangGraph workflow implementations called only by `src/ai/provider.js`. Contains AI reasoning logic.

## standard_ai_rule_eval Contract
Each workflow returns standard_ai_rule_eval format: `{ metrics, observations, summary?, provenance? }`

```javascript
import { evaluate } from './single-statement-evaluation.js';
import { makeLLMClient } from '../provider.js';

// Client creation handled by provider.js
const { client } = makeLLMClient({ model: 'gpt-4o-mini' });

const result = await evaluate({
  statement: "Deliver AI-powered advisory review to keep repo aligned",
  pr_title: 'Add LangGraph integration', 
  pr_body: 'This PR implements...',
  diff_summary: '3 files changed (+45 -12)'
}, { 
  timeoutMs: 60000, 
  client
});

// Returns: { metrics: { score: {value: 0.85, observations: ["Good alignment"]} }, summary: "Brief assessment" }
```

## Implementation Details
- **Client**: Pre-built ChatOpenAI client passed from provider.js (handles model + temperature policy)
- **Schema**: Zod validation for structured output (score, observations, summary)
- **Prompt**: Hardcoded template in single-statement-evaluation.js
- **Registry**: Workflows registered explicitly in registry.js (manual registration, unlike gate auto-discovery)
- **Boundary**: Clean separation enables potential future extraction to separate AI service repo
- **Requirements**: OPENAI_API_KEY environment variable
- **Agent Creation**: Uses pre-configured client (no model selection in workflow)

## Constraints
- Only called by provider.js
- Must return standard_ai_rule_eval format with metrics object
- TODO: Add AbortController timeout support

## Future Improvements
- External prompt templates (move from hardcoded)
- Timeout handling with AbortController signals