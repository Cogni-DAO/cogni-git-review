# Rules Directory - AI Evaluation Rules

## Purpose
YAML rule definitions for AI-powered PR evaluation. Rules define evaluation criteria and success thresholds.

## Rule Format
```yaml
id: goal-alignment
schema_version: '0.1'
blocking: true
prompt:
  template: .cogni/prompts/goal-alignment.md
  variables: [goals, non_goals, pr_title, pr_body, diff_summary]
success_criteria:
  metric: score
  threshold: 0.7
```

## Available Variables
- `goals`: Repository goals from repo-spec.yaml
- `non_goals`: Repository non-goals from repo-spec.yaml  
- `pr_title`: PR title text
- `pr_body`: PR description text
- `diff_summary`: Generated summary of changes

## Constraints
- Rules apply to all PRs (no selectors in MVP)
- Prompts must request `score` (0-1) not `verdict`
- Only supported variables allowed in schema
- Rule failures respect `blocking` flag