# AI Rule Definitions

## Purpose
This directory contains YAML rule definitions for AI-powered PR evaluation. Each rule specifies evaluation criteria and success thresholds.

## Current Implementation  
- **Single rule per gate instance**: Each `ai-rule` gate loads exactly one rule file
- **Multiple instances supported**: Same rule type can run multiple times with different rule files
- **Universal application**: Rules apply to all PRs (no file selectors in MVP)

## Rule Schema (MVP)
```yaml
id: rule-name                    # Unique identifier
schema_version: '0.1'            # Schema version
blocking: true                   # Whether failure blocks PR
evaluation-statement: "Evaluate XYZ"  # Statement passed to AI provider
success_criteria:
  metric: score                  # Only 'score' supported
  threshold: 0.7                 # Pass threshold (0-1)

# Optional: Code-aware capabilities (experimental)
x_capabilities: ['diff_summary', 'file_patches']
x_budgets:
  max_files: 25
  max_patches: 3
  max_patch_bytes_per_file: 16000
```

## AI Provider Input
Rules provide this input to the AI provider:
- `statement`: The evaluation-statement from the rule
- `pr_title`: Pull request title
- `pr_body`: Pull request description  
- `diff_summary`: Auto-generated change summary (basic or enhanced based on x_capabilities)

## Gate Integration
Repository configures AI rules in `.cogni/repo-spec.yaml`:
```yaml
gates:
  - type: ai-rule
    with:
      rule_file: goal-alignment.yaml    # ID auto-derives to "goal-alignment"
  - type: ai-rule
    id: custom-check
    with:
      rule_file: other-rule.yaml
```

## Current Rule Files
- `dont-rebuild-oss.yaml` - Prevents reimplementation of mature OSS tools
- `single-check-pr-verdict.yaml` - Ensures deterministic PR verdicts
- `code-aware-lite.yaml` - **New**: Code-aware PR evaluation with actual file changes

## Code-Aware Enhancement
Rules with `x_capabilities: ['diff_summary', 'file_patches']` receive enhanced diff_summary containing actual file changes and patch content, subject to budget limits.