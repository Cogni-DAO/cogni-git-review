# AI Directory - Single Entrypoint Pattern

## Architecture Principle
**CRITICAL**: `provider.js` is the single entrypoint router to AI functions. All AI functionality flows through the `review()` function, which delegates to workflows that make LLM calls. This is a clean I/O interface that maps to different workflows and enables future external providers.

## Directory Structure
```
src/ai/
├── provider.js           # Single entrypoint router - delegates to workflows with clear I/O
├── workflows/            # LangGraph workflows with clear I/O (make actual LLM calls)
└── schemas/              # JSON Schema validation
```

## Provider Contract
Clean interface for single statement evaluation:
```javascript
const result = await provider.review({
  statement: "Deliver AI-powered advisory review to keep repo aligned",
  pr_title: 'Add LangGraph integration',
  pr_body: 'This PR implements...', 
  diff_summary: '3 files changed (+45 -12)'
});

// Returns: { score: 0.85, observations: [], summary: "Brief assessment", provenance: {} }
```

## Environment Configuration
- `AI_TIMEOUT_MS=180000` - Per-call timeout
- `AI_MODEL=gpt-4o-mini` - Model selection
- `AI_NEUTRAL_ON_ERROR=true` - Error handling policy
- `OPENAI_API_KEY` - Provider credentials

## Constraints
- No direct LLM calls outside provider.js
- Gates decide pass/fail from score vs threshold
- Temperature=0 for deterministic output