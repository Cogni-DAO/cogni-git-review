# Gate Architecture

## Structure
```
src/gates/
├── index.js           # runAllGates() - root orchestrator with timeout handling
├── run-configured.js  # Dynamic gate launcher with registry-based discovery
├── registry.js        # Gate discovery and loading system
├── cogni/
│   ├── review-limits.js
│   ├── goal-declaration-stub.js
│   └── forbidden-scopes-stub.js
└── external/
    └── index.js       # Future: third-party tools
```

## Available Gates
- **review_limits**: File count + diff size validation
- **goal_declaration**: Passes if `spec.intent.goals` has ≥1 item
- **forbidden_scopes**: Passes if `spec.intent.non_goals` has ≥1 item

**Important**: Only gates configured in `spec.gates[]` will execute. If a gate is not listed in the spec, it will not run.

## Root Contract
`runAllGates()` returns:
```javascript
{
  overall_status: "pass" | "fail" | "neutral",
  gates: [GateResult, ...],
  duration_ms: number
}
```

## Dynamic Gate Launcher
The launcher (`run-configured.js`) provides:
- **Registry-based discovery**: Gates auto-discovered from filesystem
- **Timeout handling**: AbortController integration with partial results
- **ID normalization**: Spec gate IDs always override gate-provided IDs  
- **Robust error handling**: Gates crashes become neutral results
- **Partial execution**: Returns results for completed gates when timeout occurs

## Gate Contract
Individual gates return `GateResult` (or `null` if not configured):
```javascript
{
  id: "string",
  status: "pass" | "fail" | "neutral",
  neutral_reason?: "oversize_diff" | "internal_error" | "unimplemented_gate" | ...,
  violations: [{code, message, path?, meta?}],
  stats: object,
  duration_ms: number
}
```
## Registry-Based Discovery
Gates are automatically discovered by scanning filesystem:
```javascript
// Registry scans src/gates/cogni/ and src/gates/external/
const registry = await buildRegistry(logger);
const handler = resolveHandler(registry, gateConfig);

// Spec gates are resolved dynamically:
for (const gate of spec.gates) {
  const handler = resolveHandler(registry, gate);
  // Gate executes with parameters from gate.with
}
```

## Timeout & Orchestration
- **Orchestrator** (`index.js`): Sets up AbortController, detects partial results, surfaces neutral status
- **Launcher** (`run-configured.js`): Checks abort signal before/during each gate, returns partial results  
- **Partial execution**: When timeout occurs, returns results for gates that completed
- **Overall status**: Partial + aborted = neutral, otherwise fail > neutral > pass

## Adding New Gates
1. Create `src/gates/cogni/new-gate.js` with tri-state contract
2. Export gate function - registry auto-discovers it
3. Add gate to spec template and test fixtures  
4. Add tests using `SPEC_FIXTURES` and hardened launcher patterns