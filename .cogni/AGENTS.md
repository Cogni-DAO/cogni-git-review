# Repository Quality Configuration

## Current Structure
```
.cogni/
├── repo-spec.yaml         # Quality gates and repository intent  
└── rules/                 # AI rule definitions (YAML)
```

## Configuration

**repo-spec.yaml**: Defines gates and repository goals
```yaml
gates:
  - id: rules
    with:
      rule_file: goal-alignment.yaml
```

**rules/goal-alignment.yaml**: AI evaluation rule
```yaml
id: goal-alignment
threshold: 0.7
# Prompt inline in rule spec for MVP
```

## AI Gate Flow
1. `rules` gate loads single rule file
2. Builds evidence: PR title/body + diff summary + repo goals
3. Calls AI provider (MVP stub)
4. Applies threshold: score >= 0.7 → pass, else fail