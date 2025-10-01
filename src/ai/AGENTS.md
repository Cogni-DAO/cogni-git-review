# AI Directory - Single Entrypoint Pattern

## Architecture Principle
**CRITICAL**: `provider.js` is the single entrypoint router to AI functions. All AI functionality flows through the `evaluateWithWorkflow()` function, which delegates to registered workflows that make LLM calls. This is a clean I/O interface that maps to different workflows and enables future external providers.

## Directory Structure
```
src/ai/
├── provider.js           # Single entrypoint router - delegates to workflows with clear I/O
├── model-selector.js     # Environment-based model selection
├── workflows/            # LangGraph workflows with clear I/O (make actual LLM calls)
│   └── registry.js       # Workflow discovery and routing registry
└── schemas/              # JSON Schema validation
```

## Provider Contract
Generic workflow routing interface with automatic Langfuse tracing:
```javascript
const result = await provider.evaluateWithWorkflow({
  workflowId: 'goal-evaluations',
  workflowInput: {
    evaluations: [
      { "code-quality": "PR maintains code quality standards" },
      { "security": "PR contains no security vulnerabilities" }
    ],
    pr_title: 'Add feature',
    pr_body: 'Implementation details...',
    diff_summary: '3 files changed (+45 -12)'
  }
});

// Returns: { metrics: { "code-quality": {value: 0.9, observations: [...]}, "security": {value: 1.0, observations: [...]} }, summary: "...", provenance: {} }
```

**Observability**: All AI calls automatically traced to Langfuse when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are configured.

Available workflows configured in `workflows/registry.js`:
- `goal-evaluations` - Dynamic evaluation workflow supporting 1 to N metrics

## Model Selection & Temperature Policy
Models selected automatically by environment via `model-selector.js`:
- **dev**: `gpt-4o-mini` (local development, no APP_ENV) + `temperature=0`
- **preview**: `gpt-5-2025-08-07` (APP_ENV=preview) + default temperature
- **prod**: `gpt-5-2025-08-07` (APP_ENV=prod) + default temperature

**Temperature Policy**: 
- **Whitelisted models** (`gpt-4o-mini`, `4o-mini`): `temperature=0` for deterministic, repeatable results
- **All other models**: Use model default (omit parameter) - safer for reasoning models and new releases

LLM client creation centralized in `provider.js makeLLMClient({ model })` with explicit whitelist approach.

Future: Per-rule model overrides from `.cogni/rules/*.yaml` configuration.

## Environment Configuration
- `APP_ENV=preview|prod` - Environment detection (dev is default)
- `AI_TIMEOUT_MS=180000` - Per-call timeout
- `AI_NEUTRAL_ON_ERROR=true` - Error handling policy
- `OPENAI_API_KEY` - Provider credentials
- `LANGFUSE_PUBLIC_KEY` - Langfuse observability (optional)
- `LANGFUSE_SECRET_KEY` - Langfuse observability (optional)
- `LANGFUSE_BASE_URL` - Langfuse host (optional, defaults to cloud.langfuse.com)

## Constraints
- No direct LLM calls outside provider.js
- Gates decide pass/fail from score vs threshold
- LLM client creation only via provider.js makeLLMClient() (currently, enforces temperature policy. Future: more robust)