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
- **ai-rule**: AI-powered evaluation using declarative rules (supports multiple instances of AI-rules, each running as their own gate). Passes rich context (PR, repo, commit info) to AI workflows for langfuse tracing

## Gate Implementation Pattern
```javascript
export const type = 'gate-type-name';

export async function run(context, gateConfig, logger) {
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
The `ai-rule` gate supports dynamic AI evaluation with schema v0.3:
- Each instance loads a rule from `.cogni/rules/*.yaml` with `evaluations` array
- Passes complete `{context, rule}` directly to provider without extraction
- Uses `goal-evaluations` workflow for dynamic metric evaluation
- Workflow handles evidence gathering based on rule capabilities
- Calls `src/ai/provider.evaluateWithWorkflow()` which returns provider-result format
- Pass/fail based on `success_criteria` evaluation against returned metrics
- **Code-aware capabilities**: `x_capabilities: ['diff_summary', 'file_patches']` enables file changes access
- **Resource budgets**: `x_budgets` prevent token/cost overruns

### Code-Aware Evidence Gathering
**Handled by workflow**, not gate:
- Workflow reads `x_capabilities` from rule to determine evidence needs
- Deterministic file sorting by change count, then filename
- Respects budget limits: `max_files` (25), `max_patches` (3), `max_patch_bytes_per_file` (16KB)
- Enhanced diff includes file patches when under budget
- Simple diff summary when `x_capabilities` not specified
- Evidence gathering logic isolated in `goal-evaluations.js` workflow

## Gate Output Fields

**Standard Result Structure**:

- **AI gates** (rules.js): Return per-metric observations within providerResult.metrics structure
  - **Provenance tracking**: AI gate decisions now include `provenance: providerResult.provenance` to track which AI provider and model was used for evaluation (enables model/provider display in GitHub check summaries)
- **Stub gates** (goal-declaration-stub.js, forbidden-scopes-stub.js): Return violations with `observation` messages
- All gates return normalized `{status, violations[], stats, duration_ms}` format
