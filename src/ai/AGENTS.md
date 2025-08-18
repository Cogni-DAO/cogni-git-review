# AI Directory - Single Entrypoint Pattern

## Architecture Principle
**CRITICAL**: There is ONE AND ONLY ONE AI entrypoint in this codebase.

- **Single Entrypoint**: `provider.js` contains the ONLY function that makes LLM calls
- **All AI flows through**: `async function review(input, options) -> { verdict, annotations, violations, provenance }`
- **No direct LLM calls**: No other module may call OpenAI, Anthropic, or any LLM service directly

## Directory Structure
```
src/ai/
├── provider.js           # SINGLE AI ENTRYPOINT - review() function
├── workflows/            # LangGraph workflows (called by provider only)
├── prompts/             # LLM prompt templates
└── schemas/             # JSON Schema validation
```

## Contract Enforcement
- **API Surface**: Only `provider.review()` is exposed to gates
- **Deterministic**: Temperature=0, JSON Schema validation, structured output
- **Timeout Handling**: Centralized in provider with graceful fallback
- **Error Policy**: AI_NEUTRAL_ON_ERROR controls failure behavior

## Integration Pattern
Gates call provider like this:
```javascript
const result = await provider.review({
  goals: spec.intent.goals,
  non_goals: spec.intent.non_goals, 
  pr: prData,
  diffSummary: generateDiffSummary(pr)
}, { 
  timeoutMs: process.env.AI_TIMEOUT_MS || 180000 
});

// Map to existing violations format
violations.push(...normalizeToViolations(result));
```

## Configuration
Environment-based (no schema changes):
- `AI_BLOCKING=true|false` - Whether AI failures block PRs
- `AI_TIMEOUT_MS=180000` - Per-call timeout
- `AI_MODEL=gpt-4o-mini` - Model selection
- `AI_NEUTRAL_ON_ERROR=true` - Neutral on error vs fail
- `OPENAI_API_KEY` - Provider credentials

## Adding New AI Features
1. Extend `provider.review()` input/output contract
2. Update workflows within provider implementation
3. Maintain single entrypoint - NO direct LLM calls elsewhere
4. Add contract tests for new behavior