# Cogni Git Review - Extensible AI Rules System Design

## Overview

Cogni provides a single required GitHub Check that enforces deterministic PR hygiene plus extensible AI-powered rules. Repository owners can define custom AI evaluation rules without modifying Cogni code.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GitHub PR Event                                      │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────────┐
│                        Gate Orchestrator                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│  │review_limits│ │goal_declara-│ │ai_rules     │ │ai_single_entrypoint         │ │
│  │(deterministic)│ │tion (fast)  │ │(main AI)    │ │(static enforcement)         │ │
│  └─────────────┘ └─────────────┘ └─────┬───────┘ └─────────────────────────────┘ │
└───────────────────────────────────────────┼─────────────────────────────────────┘
                                            │
                              ┌─────────────▼──────────────┐
                              │        ai-rules gate       │
                              │                            │
                              │ 1. Load .cogni/rules/*.yaml│
                              │ 2. Select applicable rules │
                              │ 3. Build evidence bundle   │
                              │ 4. For each rule:          │
                              │    → call provider.review()│
                              │ 5. Aggregate results       │
                              └─────────────┬──────────────┘
                                            │
                              ┌─────────────▼──────────────┐
                              │    ai/provider.js          │
                              │                            │
                              │ ⚠️  DUMB PIPE TO LLMs ⚠️   │
                              │                            │
                              │ • Load prompt template     │
                              │ • Substitute variables     │
                              │ • Call LLM (temp=0)        │
                              │ • Validate JSON schema     │
                              │ • Return structured output │
                              │                            │
                              │ NO BUSINESS LOGIC!         │
                              └─────────────┬──────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
          ┌─────────▼──────────┐  ┌────────▼────────┐   ┌─────────▼──────────┐
          │.cogni/rules/       │  │.cogni/prompts/  │   │LangGraph Workflow  │
          │goal-alignment.yaml │  │goal-alignment.md│   │(called by provider)│
          │                    │  │                 │   │                    │
          │• selectors         │  │• LLM prompt     │   │• AnalyzePR         │
          │• evidence needs    │  │• variable slots │   │• EvaluateAlignment │
          │• success criteria  │  │• rubric         │   │• FormatViolations  │
          └────────────────────┘  └─────────────────┘   └────────────────────┘

                              ┌─────────────▲──────────────┐
                              │     Single Required        │
                              │    GitHub Check Result     │
                              │                            │
                              │ ✅ PASS / ❌ FAIL / ⚪ NEUTRAL │
                              │                            │
                              │ • Aggregated violations    │
                              │ • Inline annotations       │
                              │ • Roll-up summary          │
                              └────────────────────────────┘
```

### Key Separation of Concerns

- **ai-rules gate**: Rule logic, evidence building, result aggregation
- **provider.js**: Pure LLM interface - NO business logic
- **Rules (.cogni/rules/)**: Declarative configuration 
- **Prompts (.cogni/prompts/)**: LLM instructions
- **LangGraph workflows**: AI reasoning chains (called by provider only)

## Core Architecture

### Single AI Entrypoint Pattern
- **ONLY** `src/ai/provider.js` makes LLM calls
- All other modules call `provider.review()` 
- Enforced by `ai-single-entrypoint` static gate

### Four-Gate System
1. **`review_limits`** - File count and diff size limits
2. **`goal_declaration`** - Fast-path check for goals/non-goals presence  
3. **`ai_rules`** - Main AI coordinator (loads RuleSpec, calls provider)
4. **`ai_single_entrypoint`** - Static enforcement of architecture boundaries
5. **`forbidden_scopes`** - Scope boundary validation

### Extensible Rules System
- Rules defined in `.cogni/rules/*.yaml`
- Prompts in `.cogni/prompts/*.md`
- Evidence: `diff_summary` + `file_snippets` (MVP scope)
- Provider input: goals, non-goals, PR data, evidence, rule config

## Data Flow

```
PR Event → Load RuleSpec → Select Rules → Build Evidence → provider.review() → Aggregate → Single Check
```

### Rule Selection
Rules apply based on selectors:
- `paths`: Glob patterns matching changed files
- `diff_kinds`: `add`, `modify`, `delete`, `rename`

### Evidence Building (MVP)
- **diff_summary**: PR title, file counts, additions/deletions
- **file_snippets**: ±20 lines around each change hunk
- **External signals**: OUT OF SCOPE for MVP

### Tri-State Aggregation
- **Precedence**: `fail > neutral > pass`
- **Blocking rules**: `blocking: true` → overall FAIL if rule fails
- **Error handling**: Provider timeout/error → NEUTRAL (if `AI_NEUTRAL_ON_ERROR=true`)

## Configuration

### Environment Variables
```bash
AI_BLOCKING=true              # Whether AI failures block PRs
AI_TIMEOUT_MS=180000         # Per-evaluation timeout  
AI_NEUTRAL_ON_ERROR=true     # Neutral vs fail on AI errors
AI_MODEL=gpt-4o-mini         # Model selection
```

### Repository Structure
```
.cogni/
├── repo-spec.yaml           # Goals, gates order
├── rules/
│   └── goal-alignment.yaml  # Rule definitions
└── prompts/
    └── goal-alignment.md    # Prompt templates

src/ai/
├── provider.js              # Single AI entrypoint
├── schemas/
│   └── rule-spec.schema.json
└── workflows/               # LangGraph implementation

src/gates/cogni/
├── ai-rules.js              # Main AI coordinator
├── goal-declaration.js      # Fast goal presence check
├── ai-single-entrypoint.js  # Static enforcement
├── review-limits.js         # File/size limits
└── forbidden-scopes.js      # Scope validation
```

### Rule Schema (MVP)
```yaml
id: goal-alignment
title: "Goal Alignment Check"  
blocking: true
severity: error
selectors:
  paths: ["src/**", "docs/**"]
  diff_kinds: [add, modify]
evidence:
  include: [diff_summary, file_snippets]
prompt:
  template: .cogni/prompts/goal-alignment.md
  variables: [goals, non_goals, diff_summary, snippets]
success_criteria:
  metric: score
  threshold: 0.7
```

## Provider Contract

### Input Shape
```typescript
{
  goals: string[],
  non_goals: string[],
  pr: { number, author, changed_files },
  diff_summary: string,
  snippets: [{ path, start, end, code }],
  rule: { id, severity, blocking, success_criteria }
}
```

### Output Shape  
```typescript
{
  verdict: 'pass' | 'fail' | 'neutral',
  violations: Violation[],
  annotations: Annotation[],
  provenance: { runId, durationMs, model, providerVersion }
}
```

## Security & Determinism

### Architecture Boundaries
- No direct LLM imports outside `src/ai/provider.js`
- Static gate (`ai-single-entrypoint`) enforces this
- No arbitrary code execution - declarative YAML only

### Deterministic Output
- `temperature=0` for consistent results
- JSON Schema validation of provider outputs
- Same input → same evaluation (within model limits)

### Error Handling
- Provider timeout → NEUTRAL with diagnostic
- Schema validation failure → NEUTRAL with diagnostic  
- Respect `AI_NEUTRAL_ON_ERROR` policy flag

## Testing Strategy

### Contract Tests
- Provider input/output schema validation
- Deterministic behavior on fixtures
- Timeout and error handling

### Integration Tests
- Aligned PR → PASS
- Scope-creep PR → FAIL  
- Forbidden import → FAIL (static gate)
- Forced timeout → NEUTRAL

### Rule Extensibility
- Adding new rule without code changes
- Rule selection by selectors
- Evidence building and prompt variable substitution

## MVP Scope

### Included
- Single `goal-alignment` rule
- Basic evidence: diff_summary + file_snippets  
- Static enforcement gate
- Environment-based configuration

### Excluded (Future)
- SARIF/JSON external signals ingestion
- Multiple rule files
- Advanced selectors beyond paths/diff_kinds
- Override/approval UX
- Rule marketplace/sharing

## Risk Controls

| Risk | Mitigation |
|------|------------|
| Annotation flood | Cap per-file annotations; roll-up summary |
| LLM JSON flakiness | Schema validation + repair attempt → NEUTRAL |
| Latency spikes | Per-call timeout ≤90s; small snippet windows |
| Architecture drift | Static gate enforces single entrypoint |

## Success Criteria

- ✅ Single required Cogni check (PASS/FAIL/NEUTRAL)
- ✅ Aligned PR passes; scope-creep PR fails  
- ✅ Static gate prevents LLM usage outside provider
- ✅ Provider timeout → NEUTRAL (configurable)
- ✅ Extensible: Add rule via YAML + prompt only