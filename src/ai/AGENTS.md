# AI Directory - Single Entrypoint Pattern

## Architecture Principle
**CRITICAL**: Only `provider.js` makes LLM calls. All AI functionality flows through the single `review()` function. This is a boundary to enable this repo to stay scoped, clean, and refactorable.

## Directory Structure
```
src/ai/
├── provider.js           # Single AI entrypoint - review() function
├── workflows/            # LangGraph workflows (called by provider only)
├── prompts/             # LLM prompt templates
└── schemas/             # JSON Schema validation
```

## Provider Contract
```javascript
const result = await provider.review({
  goals: ['repo goal'],
  non_goals: ['repo non-goal'],
  pr_title: 'PR title',
  pr_body: 'PR description', 
  diff_summary: 'Change summary',
  rule: { id: 'rule-name', success_criteria: { threshold: 0.7 } }
});

// Returns: { score: 0.85, violations: [], provenance: {} }
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