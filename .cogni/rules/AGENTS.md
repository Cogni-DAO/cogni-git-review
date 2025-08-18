# Rules Directory - Declarative AI Evaluation Rules

## Purpose
Contains YAML rule definitions that specify when and how AI evaluates PRs. Each rule defines selectors (when to apply), evidence requirements, and success criteria.

## Goals
- **Declarative Rules**: All rule logic expressed in YAML without code changes
- **Selector-Based**: Rules only apply to matching file paths and change types
- **Evidence-Driven**: Rules specify exactly what data AI needs to make decisions
- **Threshold-Based**: Clear success criteria with numeric scoring

## Non-Goals
- **Imperative Logic**: No procedural code - purely declarative YAML
- **Global Application**: Rules must have selectors to avoid evaluating everything
- **Arbitrary Variables**: Only supported evidence types (diff_summary, file_snippets)

## Rule Structure
```yaml
id: rule-name                    # Unique identifier (or use filename)
title: "Human Readable Name"
schema_version: '0.1'           # Breaking change management
blocking: true                  # Whether failures block PR
selectors:
  paths: ["src/**", "docs/**"]   # Glob patterns for file paths
  diff_kinds: [add, modify]     # Change types: add/modify/delete/rename
evidence:
  include: [diff_summary, file_snippets]  # Data provided to AI
prompt:
  template: .cogni/prompts/rule-name.md   # Corresponding prompt file
  variables: [goals, non_goals, diff_summary, file_snippets]  # Available vars
success_criteria:
  metric: score                  # 'score' for 0-1 threshold
  threshold: 0.7                # Minimum score for success
limits:
  max_annotations_per_file: 10  # Prevent annotation flooding
  max_total_annotations: 50     # Global cap across all rules
```

## Interaction Patterns

### Creating New Rules
1. **Define Selectors**: Specify which files/changes trigger the rule
2. **Choose Evidence**: Select from available evidence types  
3. **Write Prompt**: Create corresponding template in ../prompts/
4. **Set Thresholds**: Define success criteria and limits
5. **Enable in repo-spec.yaml**: Add to ai_rules gate configuration

### Rule Selection Logic
- Rules only evaluate when PR changes match ALL specified selectors
- Path matching uses glob patterns (e.g., `src/**` matches `src/foo/bar.js`)
- Diff kinds normalized: GitHub status → {add, modify, delete, rename}
- No selectors = matches everything (usually not desired)

### Variable Mapping
- `goals`: Repository goals from repo-spec.yaml intent section
- `non_goals`: Repository non-goals from repo-spec.yaml intent section  
- `diff_summary`: Auto-generated PR change summary
- `file_snippets`: Code context around change hunks

## Error Handling
- **Invalid YAML**: Rule skipped, diagnostic logged
- **Schema Violations**: Rule rejected with specific error details
- **Missing Prompts**: Rule fails consistency check
- **Unmapped Variables**: Prompt variables not in evidence → error

**MVP Scope**: Single goal-alignment rule, basic evidence types only.