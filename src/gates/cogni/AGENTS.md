# Cogni Gates Directory

Gates are implemented by cogni-git-review. The .cogni/repo-spec.yml in a repository that has installed cogni-git-review can choose to enable+configure them.

## Implementation Principles
- **Self-contained**: No dependencies on other gates
- **Safe execution**: Handle missing/malformed config gracefully
- **Auto-discovery**: Export `type` for gate registration and `run` function

## Built-in Gate Types
- **review-limits**: File count and diff size validation
- **goal-declaration**: Repository goals validation
- **forbidden-scopes**: Repository non-goals validation  
- **ai-rule**: AI-powered evaluation using declarative rules (supports multiple instances)

## Gate Implementation Pattern
```javascript
export const type = 'gate-type-name';

export async function run(context, gateConfig) {
  return {
    status: 'pass'|'fail'|'neutral',
    neutral_reason?: 'error_code',
    violations: [{code, message, path?, meta?}],
    stats: {},
    duration_ms: 123
  };
}
```

## AI Rule Gate
The `ai-rule` gate type supports multiple instances:
- Each instance loads one rule from `.cogni/rules/*.yaml`
- Calls `src/ai/provider.js` for LangGraph evaluation
- Decides pass/fail based on AI score vs rule threshold
- Instance ID auto-derives from `rule_file` basename (without .yaml)
