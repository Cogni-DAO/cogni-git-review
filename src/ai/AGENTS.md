# AI Directory - Single Entrypoint Pattern

## Architecture Principle
**CRITICAL**: `provider.js` is a pure workflow router with no domain knowledge. All AI functionality flows through the `evaluateWithWorkflow()` function, which forwards the complete input directly to workflows without extraction or interpretation. This design enables external endpoint integration and supports any workflow type.

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
    context: probotContext,  // Full Probot context object
    rule: ruleObject         // Complete rule configuration
  }
}, {
  timeoutMs: 110000
}, logger);  // Logger parameter for structured logging

// Returns: { metrics: { "metric-id": {value: 0.9, observations: [...]} }, summary: "...", provenance: {} }
```

**Key Design Principles**:
- **No data extraction**: Provider passes input directly to workflows
- **Workflow-agnostic**: No knowledge of PR, rule, or domain concepts
- **Full context preservation**: Complete Probot context available to workflows
- **External endpoint ready**: Simple JSON serializable interface

**Observability**: All AI calls automatically traced to Langfuse when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are configured. Traces tagged with environment based on `env.app`.

Available workflows configured in `workflows/registry.js`:
- `goal-evaluations` - Dynamic evaluation workflow supporting 1 to N metrics
  - Handles evidence gathering from PR changes
  - Extracts PR metadata for Langfuse tracing
  - STUB: Manages rule capabilities and budget constraints

## Model Selection & Temperature Policy
Models selected automatically by environment via `model-selector.js`:
- **dev**: `gpt-4o-mini` (local development, no env.app) + `temperature=0`
- **preview**: `gpt-5-2025-08-07` (env.app=preview) + default temperature
- **prod**: `gpt-5-2025-08-07` (env.app=prod) + default temperature

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
- LLM client creation only via provider.js makeLLMClient() (enforces temperature policy)
- Provider.js contains no domain logic - workflows handle all domain concerns
- Workflows receive full context objects, not extracted properties