# Gate Architecture

## Structure
```
src/gates/
├── index.js           # runAllGates() - root orchestrator with RunContext
├── cogni/
│   ├── index.js       # runCogniPrecheck() + runOtherLocalGates()
│   ├── review-limits.js
│   ├── goal-declaration-stub.js
│   └── forbidden-scopes-stub.js
└── external/
    └── index.js       # Future: third-party tools
```

## Current Gates
- **review_limits**: File count + diff size validation (precheck, early-exit capable)
- **goal_declaration_stub**: Passes if `spec.intent.goals` has ≥1 item
- **forbidden_scopes_stub**: Passes if `spec.intent.non_goals` has ≥1 item

## Root Contract
`runAllGates()` returns:
```javascript
{
  overall_status: "pass" | "fail" | "neutral",
  gates: [GateResult, ...],
  early_exit: boolean,
  duration_ms: number
}
```

## Gate Contract
All gates return `GateResult`:
```javascript
{
  id: "string",
  status: "pass" | "fail" | "neutral",
  neutral_reason?: "oversize_diff" | "internal_error" | "timeout" | ...,
  violations: [{code, message, path?, meta?}],
  stats: object,
  duration_ms: number
}
```

## Adding Gates
1. Create `src/gates/cogni/new-gate.js` with tri-state contract
2. Import + call in `src/gates/cogni/index.js` 
3. Add tests using `SPEC_FIXTURES`