# Gate Architecture

## Structure
```
src/gates/
├── index.js           # runAllGates() - stable import
├── cogni/
│   ├── index.js       # runCogniGates() - Cogni orchestrator  
│   └── review-limits.js
└── external/
    └── index.js       # Future: third-party tools
```

## Current Gates
- **review_limits**: File count + diff size validation

## Gate Contract
All gates return:
```javascript
{
  violations: [{rule, actual, limit}],
  stats: {changed_files, total_diff_kb},
  oversize: boolean
}
```

## Adding Gates
1. Create `src/gates/cogni/new-gate.js` 
2. Import + call in `src/gates/cogni/index.js`
3. Add tests using `SPEC_FIXTURES`