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
- **agents-md-sync**: Ensures AGENTS.md files are updated when code changes
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

## AGENTS.md Sync Gate
The `agents-md-sync` gate enforces documentation synchronization:
- Analyzes PR file changes using GitHub API (`context.octokit.pulls.listFiles`)
- When code files change in a directory, requires corresponding `AGENTS.md` to be updated
- Configurable code patterns (default: `**/*.*`) and doc pattern (default: `AGENTS.md`)
- Uses `micromatch` library for robust glob pattern matching
- Excludes documentation files (.md, README, CHANGELOG) from triggering violations
- Returns neutral status on GitHub API errors to avoid blocking PRs

Configuration example:
```yaml
gates:
  - type: agents-md-sync
    id: agents_md_sync
    with:
      code_patterns: ["src/**/*.js", "lib/**/*.ts"]  # Optional
      doc_pattern: "AGENTS.md"                       # Optional
```

## AI Rule Gate
The `ai-rule` gate type supports multiple instances:
- Each instance loads one rule from `.cogni/rules/*.yaml`
- Calls `src/ai/provider.js` for LangGraph evaluation
- Decides pass/fail based on AI score vs rule threshold
- Instance ID auto-derives from `rule_file` basename (without .yaml)
