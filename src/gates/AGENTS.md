# Gate Architecture

## Structure
```
src/gates/
├── index.js           # runAllGates() - root orchestrator with timeout handling
├── run-configured.js  # Dynamic gate launcher with registry-based discovery
├── registry.js        # Gate discovery and loading system
└── cogni/
    ├── review-limits.js
    ├── goal-declaration-stub.js
    └── forbidden-scopes-stub.js
```

## Available Gate Types
- **review-limits**: File count and diff size validation
- **goal-declaration**: Repository goals validation  
- **forbidden-scopes**: Repository non-goals validation
- **ai-rule**: AI-powered evaluation using declarative rules

**Important**: Only gates configured in `spec.gates[]` will execute. Multiple instances of the same gate type are supported.

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
- **Registry-based discovery**: Gates auto-discovered by `type` from filesystem
- **Multiple instances**: Same gate type can run multiple times with different configurations
- **Instance ID derivation**: Auto-derive IDs from `rule_file` for ai-rule, explicit IDs for clarity
- **Duplicate detection**: Error on duplicate instance IDs, no silent suffixing
- **Timeout handling**: AbortController integration with partial results
- **Robust error handling**: Gate crashes become neutral results

## Gate Contract
Individual gates return `GateResult`:
```javascript
{
  id: "string",  // Instance identifier (derived or explicit)
  status: "pass" | "fail" | "neutral",
  neutral_reason?: "oversize_diff" | "internal_error" | "unimplemented_gate" | ...,
  violations: [{code, message, path?, meta?}],  // Non-AI gates
  observations: [string],                       // AI gates  
  stats: object,
  provenance?: object,                          // AI gates only - model config + audit info
  duration_ms: number
}
```

**Result Normalization**: The launcher preserves both `violations` (non-AI gates) and `observations` (AI gates) fields during result processing.

## Registry-Based Discovery
Gates are automatically discovered by `type` from filesystem:
```javascript
// Registry scans src/gates/cogni/ for modules with 'type' export
const registry = await buildRegistry(logger);
const handler = resolveHandler(registry, gateConfig);

// Spec gates resolved by type:
for (const gate of spec.gates) {
  const handler = resolveHandler(registry, gate);  // Uses gate.type
  const instanceId = deriveGateId(gate);           // Derives unique ID
  // Gate executes with parameters from gate.with
}
```

## Timeout & Orchestration
- **Orchestrator** (`index.js`): Sets up AbortController, detects partial results, surfaces neutral status
- **Launcher** (`run-configured.js`): Checks abort signal before/during each gate, returns partial results  
- **Partial execution**: When timeout occurs, returns results for gates that completed
- **Overall status**: Partial + aborted = neutral, otherwise fail > neutral > pass

## Adding New Gates
1. Create `src/gates/cogni/new-gate.js` with gate implementation:
   ```javascript
   export const type = 'new-gate-type';
   export async function run(ctx, gateConfig) {
     // Implementation returns GateResult
   }
   ```
2. Registry auto-discovers gates by `type` export
3. Add gate to spec template using `type` + optional `id`
4. Add tests using `SPEC_FIXTURES` and hardened launcher patterns

## Gate Instance Configuration
```yaml
# Explicit type + id
- type: new-gate-type
  id: custom_name
  with: { param: value }

# Auto-derived ID (for ai-rule only)  
- type: ai-rule
  with: { rule_file: my-rule.yaml }  # id = "my-rule"
```