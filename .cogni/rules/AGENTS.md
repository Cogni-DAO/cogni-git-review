# AI Rule Definitions

## Purpose
This directory contains YAML rule definitions for AI-powered PR evaluation. Each rule specifies evaluation criteria, prompts, and success thresholds.

## Current Implementation  
- **Single rule per gate**: Each `rules` gate loads exactly one rule file
- **Universal application**: Rules apply to all PRs (no selectors)
- **AI provider**: Currently a stub for MVP testing

## Rule Schema
```yaml
id: rule-name                    # Unique identifier
schema_version: '0.1'            # Schema version
blocking: true                   # Whether failure blocks PR
prompt:
  template: .cogni/prompts/rule-name.md
  variables: [goals, non_goals, pr_title, pr_body, diff_summary]
success_criteria:
  metric: score                  # Only 'score' supported
  threshold: 0.7                 # Pass threshold (0-1)
```

## Evidence Variables
Rules receive these variables from the gate:
- `goals`: Repository goals from spec.intent.goals
- `non_goals`: Repository non-goals from spec.intent.non_goals
- `pr_title`: Pull request title
- `pr_body`: Pull request description  
- `diff_summary`: Auto-generated change summary

## Gate Integration
Repository configures rules in `.cogni/repo-spec.yaml`:
```yaml
gates:
  - id: rules
    with:
      rule_file: goal-alignment.yaml
```

## Prompt Requirements
- Must return JSON with `score` field (0-1 range)
- Score compared against `success_criteria.threshold`
- score >= threshold → pass, else fail