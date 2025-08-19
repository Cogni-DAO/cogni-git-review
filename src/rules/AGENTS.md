# Rules Directory - Rule Loading Infrastructure

## Purpose
Infrastructure for loading and validating YAML rule definitions from `.cogni/rules/` directory.

## Directory Structure
```
src/rules/
├── loader.js           # Load and validate .cogni/rules/*.yaml files
├── selector.js         # Filter rules by path/diff patterns (unused in MVP)
└── evidence.js         # Build evidence bundles (unused in MVP)
```

## Loader API
```javascript
import { loadRules } from './src/rules/loader.js';

const { rules, diagnostics } = await loadRules({
  rules_dir: '.cogni/rules',
  enabled: ['goal-alignment.yaml'],
  blocking_default: true
});
```

**Behavior**:
- Validates rules against MVP schema
- Rejects duplicate rule IDs
- Returns diagnostics for invalid files
- Zero valid rules → NEUTRAL gate result

## MVP Constraints
- Rules apply to all PRs (selector.js unused)
- Evidence is built by rules gate (evidence.js unused)
- Only `loadRules()` function used in MVP
  hunks_by_file: { 'src/foo.js': [...] }
});

// Returns: Array<Rule> - only rules whose selectors match PR changes
```

**Key Behaviors**:
- **Path Matching**: Glob patterns (`src/**`) against changed file paths
- **Diff Kind Normalization**: Maps GitHub events to {add, modify, delete, rename}
- **Rename Handling**: `renamed-only` → {rename}, `renamed+content` → {rename, modify}

### Evidence Builder (`evidence.js`)
**Purpose**: Extract code context and PR metadata for AI evaluation.

```javascript
import { buildEvidence } from '../rules/evidence.js';

const evidence = await buildEvidence({
  pr_meta: { title, body, additions, deletions },
  hunks_by_file: { 'src/foo.js': [{ start: 10, end: 20, lines: [...] }] },
  snippet_window: 20
});

// Returns: {
//   diff_summary: "Modified 1 file: +15 -3 lines",
//   snippets: [{ path, start, end, code }]
// }
```

**Key Behaviors**:
- **Snippet Windows**: Extract ±N lines around each change hunk
- **Overlap Merging**: Combine overlapping ranges to avoid duplication
- **Binary/Large File Handling**: Skip extraction but note presence in diff_summary

## Integration Pattern

### Used by ai_rules Gate
```javascript
// In src/gates/cogni/ai-rules.js
import { loadRules } from '../../rules/loader.js';
import { selectApplicableRules } from '../../rules/selector.js';
import { buildEvidence } from '../../rules/evidence.js';
import * as aiProvider from '../../ai/provider.js';

export async function evaluate(context, spec) {
  // 1. Load enabled rules from repo-spec
  const { rules, diagnostics } = await loadRules({
    rules_dir: spec.gates.ai_rules.rules_dir,
    enabled: spec.gates.ai_rules.enable,
    blocking_default: spec.gates.ai_rules.blocking_default
  });

  // 2. Filter by selectors  
  const applicable = selectApplicableRules(rules, context.pr);

  // 3. Build evidence once
  const evidence = await buildEvidence(context.pr, spec.gates.ai_rules.snippet_window);

  // 4. Evaluate each rule via provider
  for (const rule of applicable) {
    const result = await aiProvider.review({
      goals: spec.intent.goals,
      non_goals: spec.intent.non_goals,
      pr: context.pr,
      ...evidence,
      rule
    });
    // Collect and aggregate...
  }
}
```

## Configuration Sources

### Rule Schema (`src/ai/schemas/rule-spec.schema.json`)
Validates rule YAML structure:
- Required: `id`, `title`, `schema_version`, `blocking`, `severity`, `selectors`, `evidence`, `prompt`, `success_criteria`
- Selectors: `paths` (glob arrays), `diff_kinds` (enum arrays)
- Limits: `max_annotations_per_file`, `max_total_annotations`, `snippet_window` (override)

### Repo Spec Integration (`.cogni/repo-spec.yaml`)
```yaml
gates:
  - id: ai_rules
    with:
      rules_dir: .cogni/rules
      enable: [goal-alignment.yaml]  # Explicit activation
      model: gpt-4o-mini
      timeout_ms: 90000
      neutral_on_error: true
      blocking_default: true
      snippet_window: 20            # Default for all rules
```

## Error Handling Philosophy

### Graceful Degradation
- **Invalid YAML**: Skip file, log diagnostic, continue with valid rules
- **Schema Violations**: Skip rule, collect diagnostic for summary
- **No Valid Rules**: Return NEUTRAL with diagnostic (not PASS)
- **No Applicable Rules**: Return PASS (legitimate no-op)

### Fail-Fast Conditions  
- **Duplicate Rule IDs**: Reject entire rule set with clear error
- **Provider Schema Violation**: Single repair attempt, then NEUTRAL
- **Annotation Budget Overflow**: Cap per rule/file/total, add summary note

## Testing Strategy

### Unit Tests
- **Loader**: Valid/invalid YAML, schema validation, duplicate detection, diagnostic collection
- **Selector**: Path glob matching, diff kind normalization, rename event mapping
- **Evidence**: Snippet extraction, overlap merging, binary file skipping

### Integration Tests
- **End-to-end**: Rule loading → selection → evidence → provider → aggregation
- **Error Cases**: Invalid rules → NEUTRAL, no applicable rules → PASS
- **Budget Limits**: Annotation capping across multiple rules

## Security & Governance

### Schema Versioning
- Each rule specifies `schema_version: '0.1'`
- Loader validates version compatibility
- Breaking changes increment version and require migration

### Policy File Protection
- Changes to `.cogni/rules/**` or `.cogni/prompts/**` trigger governance gate
- Requires CODEOWNERS-approved review (like policy-bot pattern)
- Prevents unauthorized policy modifications

This directory provides the foundation for extensible, policy-as-code AI evaluation while maintaining deterministic behavior and robust error handling.