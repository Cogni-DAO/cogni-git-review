# AI Rule Definitions

## Purpose
This directory contains YAML rule definitions for AI-powered PR evaluation. Each rule specifies evaluation criteria and success thresholds.

## Current Implementation  
- **Single rule per gate instance**: Each `ai-rule` gate loads exactly one rule file
- **Multiple instances supported**: Same rule type can run multiple times with different rule files
- **Universal application**: Rules apply to all PRs (no file selectors in MVP)
- **Statement Evaluation Workflow**: Currently the only `workflow` supported. AI analyzed a matrix of statements with a 0-1 score, and the gate evaluates these against `success_criteria`

## Rule Schema v0.3
```yaml
id: rule-name                    # Unique identifier
schema_version: "0.3"            # Schema version  
workflow_id: goal-evaluations    # AI workflow to use
blocking: true                   # Whether failure blocks PR
evaluations:                     # Dynamic metric evaluations
  - code-quality: "PR maintains code quality standards"
  - security: "PR contains no security vulnerabilities"
success_criteria:
  require:
    - metric: code-quality
      gte: 0.8
    - metric: security  
      gte: 0.9

# Optional: Code-aware capabilities
x_capabilities: ['diff_summary', 'file_patches']
x_budgets:
  max_files: 25
  max_patches: 3
  max_patch_bytes_per_file: 16000
```

## AI Provider Input
Rules provide this input to the AI provider:
- `evaluations`: Array mapping metric IDs to evaluation statements
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