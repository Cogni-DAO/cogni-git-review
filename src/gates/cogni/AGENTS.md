# Cogni Gates Directory

Gates are implemented by cogni-git-review. The .cogni/repo-spec.yml in a repository that has installed cogni-git-review can choose to enable+configure them.

## Implementation Principles
- **Self-contained**: No dependencies on other gates
- **Safe execution**: Handle missing/malformed config gracefully
- **Auto-discovery**: Export `id` and function matching `evaluate + PascalCase(id)` pattern

## Built-in Gates
- **review_limits**: File count and diff size validation
- **goal_declaration**: Ensures repository goals declared  
- **forbidden_scopes**: Ensures repository non-goals declared
- **rules**: AI-powered evaluation using declarative rules. This is the most configurable gate, allowing for multiple different rules files to be defined. see src/rules/AGENTS.md

## Gate Implementation Pattern
```javascript
export const id = 'gate_name';

export async function evaluateGateName(context, spec) {
  return {
    id: 'gate_name',
    conclusion: 'success'|'failure'|'neutral',
    title: 'Gate Title',
    summary: 'Brief result summary',
    text: 'Detailed markdown output',
    annotations: [],
    duration_ms: 123
  };
}
```

## Rules Gate
The `rules` gate loads YAML rules and calls AI provider:
- Loads rules from `.cogni/rules/*.yaml`
- Calls `src/ai/provider.js` for evaluation
- Decides pass/fail based on score vs threshold
- Returns structured check result
