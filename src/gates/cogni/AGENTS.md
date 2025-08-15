# Cogni Gates Directory

## What Goes Here
Individual gate implementations that evaluate PR compliance according to CogniDAO's standards.

## Gate Types
- **Precheck gates**: Early validation (size limits, basic requirements)  
- **Content gates**: Code quality and structure validation
- **Policy gates**: Compliance with repository governance rules

## Principles
- Each gate is self-contained and testable
- All gates follow the same tri-state contract (pass/fail/neutral)
- Gates can trigger early exit to avoid unnecessary processing
- Local orchestration happens in `index.js`

## Template Alignment Requirement
When adding new gates, update `.cogni/repo-spec-template.yaml` to include gate configuration options.