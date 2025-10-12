# Gate Architecture

## Structure
```
src/gates/
├── index.js           # runAllGates() - root orchestrator
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
- **Universal gate logging**: All gates log start/completion with status, duration, and diagnostics
- **Robust error handling**: Gate crashes become neutral results with error details

## Gate Contract
Individual gates return `GateResult`:
```javascript
{
  id: "string",  // Instance identifier (derived or explicit)
  status: "pass" | "fail" | "neutral",
  neutral_reason?: "oversize_diff" | "internal_error" | "unimplemented_gate" | "wrapper_error" | ...,
  violations: [{code, message, path?, meta?}],  // Non-AI gates
  observations: [string],                       // AI gates
  stats?: object,                               // Non-AI gates only
  provenance?: object,                          // AI gates only - model config + audit info
  // AI rules structured format (Goal Alignment v2):
  providerResult?: {metrics: {score: number}},  // AI gates only
  rule?: {success_criteria: {require: [...]}},  // AI gates only
  res?: object,                                 // AI gates only - evaluation result
  passed?: [string],                            // AI gates only
  failed?: [string],                            // AI gates only
  duration_ms: number
}
```

**Result Normalization**: The launcher preserves structured data fields (`providerResult`, `rule`, `res`) for AI gates and `stats` for traditional gates during result processing.

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

## Orchestration
- **Orchestrator** (`index.js`): Coordinates gate execution and provides execution diagnostics
  - Enriches context with PR metadata and review-limits configuration
  - Passes `reviewLimitsConfig` to context for AI workflow budget calculations
- **Launcher** (`run-configured.js`): Sequential gate execution with robust error handling
- **Overall status logic**: Prioritizes failures over neutral conditions: `hasFail ? 'fail' : (hasNeutral ? 'neutral' : 'pass')`
- **Execution diagnostics**: Detailed logging of execution plan, per-gate outcomes, and summary statistics
- **Per-gate timeouts**: AI gates handle individual timeouts (110s), synchronous gates run without timeouts

## Gate Execution Logging
All gates produce consistent structured logs:
```
🚀 Gate {id} starting { type: '{type}' }
✅ Gate {id} completed { status: '{status}', duration_ms: {ms}, violations: {count} }
❌ Gate {id} crashed { error: '{message}', duration_ms: {ms}, type: '{type}' }
💥 Critical error in gate wrapper for {id} { error: '{message}', type: '{type}' }
```

Execution summary provides diagnostic context:
```
🎯 Starting gate execution { total_gates: N, gate_list: [...] }
📊 Gate execution summary { passed: N, failed: N, neutral: N, overall_status: '...', conclusion_reason: '...' }
```

## Adding New Gates
1. Create `src/gates/cogni/new-gate.js` with gate implementation:
   ```javascript
   export const type = 'new-gate-type';
   export async function run(ctx, gateConfig, logger) {
     const log = logger.child({ module: 'gates/new-gate-type' });
     // Implementation returns GateResult using structured logging
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