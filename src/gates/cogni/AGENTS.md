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
- **governance-policy**: Validates required GitHub Actions workflows exist and match context names
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

## Review Limits Gate
The `review-limits` gate enforces PR size constraints:
- Validates maximum number of changed files and total diff size
- Configurable thresholds for `max_changed_files` and `max_total_diff_kb`
- Uses GitHub API PR statistics (`changed_files`, `additions`, `deletions`)

## STUB: Goal Declaration Gate  
The `goal-declaration` gate validates repository intent specification:
- Ensures `.cogni/repo-spec.yaml` contains well-defined project goals
- Validates `intent.goals` array exists and is non-empty
- Stub implementation returns neutral pending full AI evaluation

## STUB: Forbidden Scopes Gate
The `forbidden-scopes` gate enforces project boundaries:
- Validates `.cogni/repo-spec.yaml` contains explicit non-goals
- Ensures `intent.non_goals` array exists and is non-empty  
- Stub implementation returns neutral pending full AI evaluation

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

## Governance Policy Gate
The `governance-policy` gate validates CI/CD workflow compliance:
- Verifies required GitHub Actions workflows exist at expected paths
- Ensures workflow names match required status context names
- Uses `CONTEXT_TO_WORKFLOW` mapping from constants.js
- Exempt from checking itself (`PR_REVIEW_NAME`)
- Returns violations for missing workflows or name mismatches

## AI Rule Gate
The `ai-rule` gate type supports multiple instances:
- Each instance loads one rule from `.cogni/rules/*.yaml`
- Calls `src/ai/provider.evaluateWithWorkflow()` using `workflow_id` from rule YAML
- Decides pass/fail based on AI score vs rule threshold
- Instance ID auto-derives from `rule_file` basename (without .yaml)
- **Provenance**: Includes model config (provider, model, environment) for audit trails
- **Recent Enhancement**: Added `gatherEvidence()` function for code-aware capabilities
  - When rules specify `x_capabilities: ['diff_summary', 'file_patches']`, provides actual file changes to AI
  - Uses GitHub API (`context.octokit.rest.pulls.listFiles`) to fetch file patches
  - Applies resource budgets (`x_budgets`) to prevent token/cost overruns
  - Maintains string-based `diff_summary` contract with AI providers

### Code-Aware Evidence Gathering Details

**Enhanced Diff Summary Format**:
```
File Changes Summary (2 files, 75 additions, 17 deletions):

1. src/auth/oauth.js (modified, 45 additions, 12 deletions)
   @@ -1,6 +1,12 @@
   function authenticate() {
   +  // Enhanced auth logic
     return token;
   }

2. src/utils/helpers.js (modified, 30 additions, 5 deletions)
   [Patch content when under budget limits]
```

**File Selection Algorithm**:
- Deterministic sorting by change count (descending), then filename (ascending)
- Respects `max_files` budget limit (default: 25)
- Includes patch content for top `max_patches` files (default: 3)
- Truncates patches exceeding `max_patch_bytes_per_file` (default: 16KB)

**Backward Compatibility**:
- Rules without `x_capabilities` receive simple diff_summary: "2 files changed, 75 additions, 17 deletions"
- No breaking changes to existing provider contract (string-based evidence)
- All existing rules continue working without modification

## Gate Output Fields

**Standard Result Structure**:
- **AI gates** (rules.js): Return `observations` array containing AI-generated insights
- **Stub gates** (goal-declaration-stub.js, forbidden-scopes-stub.js): Return violations with `observation` messages
- All gates return normalized `{status, violations[], stats, duration_ms}` format
