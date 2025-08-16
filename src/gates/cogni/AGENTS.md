# Cogni Gates Directory

## Current Gates
Individual gate implementations that evaluate PR compliance. 

- **review_limits**: File count and diff size validation against configured limits
- **goal_declaration**: Ensures repository spec declares project goals  
- **forbidden_scopes**: Ensures repository spec declares non-goals/scope boundaries

## Implementing New Gates
Follow these patterns from existing gates:

### 1. Gate Module Structure
```javascript
// Export gate ID for registry discovery
export const id = 'your_gate_name';

// Main gate function - matching spec gate.id
export async function evaluateYourGateName(context, pr, config) {
  // Gate logic here
  return {
    violations: [...],  // Array of violation objects
    stats: {...},      // Gate execution metadata  
    oversize: boolean  // Optional: triggers neutral if true
  };
}
```

### 2. Implementation Principles
- **Self-contained**: No dependencies on other gates
- **Tri-state result**: violations determine pass/fail, oversize → neutral
- **Safe execution**: Handle missing/malformed config gracefully
- **Rich stats**: Include useful metadata for debugging

### 3. Registry Auto-Discovery
- Export `id` and gate function - registry finds it automatically
- Function name should match: `evaluate + PascalCase(id)`
- Update `.cogni/repo-spec-template.yaml` with configuration options