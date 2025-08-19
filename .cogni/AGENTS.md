# .cogni Directory - Repository Policy Configuration

## Purpose
Configuration directory for repository-specific PR evaluation policies. Defines goals, gates, and AI rules using declarative YAML files.

Everything within this directory is DOGFOODING. This is what a 3rd party would use, if cogni-git-review was installed into their own repository.

## Directory Structure
```
.cogni/
├── repo-spec.yaml         # Gate configuration and repository intent
├── rules/                 # AI evaluation rules (YAML)
└── prompts/               # LLM prompt templates
```

## Adding AI Rules
1. Create rule YAML in `rules/` with ID and prompt template
2. Create prompt template in `prompts/` requesting score (0-1)
3. Enable rule in `repo-spec.yaml` rules gate
4. Test on PR

## Configuration
- **repo-spec.yaml**: Gates, goals, non-goals
- **rules/*.yaml**: Rule definitions with score thresholds
- **prompts/*.md**: LLM templates with variable substitution

## Constraints
- Rules cannot be created at runtime
- Each repository's `.cogni/` directory is isolated
- All changes tracked in git history