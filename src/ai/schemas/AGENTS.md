# AGENTS.md - AI Schemas Directory

## Purpose
AJV-based JSON schema validation for AI evaluation rules and provider outputs. Provides early validation in the spec-loader pipeline to prevent internal property conflicts and ensure standardized data formats.

## Files

### validators.js
**AJV-based Schema Validation Module**
- Pre-compiled schema validators using AJV with `allErrors: true, strict: true`
- `assertRuleSchema(data)` - Validates raw rule YAML before internal property injection
- `assertProviderResult(data)` - Validates AI provider response format
- `parseYAML(yamlString)` - YAML parsing utility
- Throws detailed validation errors with `error.details` containing AJV error array
- Called early in `spec-loader.js` to prevent `rule_key`/`_metadata` property conflicts

### rule-spec.schema.json
**JSON Schema for AI Rule Specifications v0.2/v0.3**
- Validates `.cogni/rules/*.yaml` files used by the `ai-rule` gate
- **Required fields**: `id`, `schema_version`, `workflow_id`, `success_criteria`
- **Schema v0.3**: Dynamic `evaluations` array maps metric IDs to statement text
- **Workflow routing**: `workflow_id` specifies AI workflow (typically `goal-evaluations`)
- **Success criteria**: `require` and `any_of` arrays with metric comparisons (`gte`, `gt`, `lte`, `lt`, `eq`)
- **Vendor extensions**: `x_capabilities`, `x_budgets` for code-aware evaluation and resource limits

### provider-result.schema.json
**JSON Schema for AI Provider Response Format**
- Validates responses from `aiProvider.evaluateWithWorkflow()` calls
- **Required fields**: `metrics`, `summary`, `provenance`
- **Metrics format**: Object with metrics as `{value: number, observations: string[]}` structure
- **Summary format**: Brief string explanation of the evaluation
- **Provenance format**: Execution metadata including `meta`, `runId`, `durationMs`, `workflowId`, `modelConfig`

## Validation Flow
1. **Early validation** in `spec-loader.js loadSingleRule()` on raw YAML data
2. **Schema validation** happens before `rule_key` and `_metadata` properties added
3. **Error handling** returns `RULE_SCHEMA_INVALID` with detailed AJV error arrays
4. **Provider validation** in `rules.js` after AI workflow execution with structured error logging

## Current State
WIP implementation supporting matrix-based success criteria evaluation. Note: Gate result standardization in progress for summary/comment adapters.

## Related Components
- **Spec Loader** (`src/spec-loader.js`): Calls `assertRuleSchema()` during rule loading
- **AI Rules Gate** (`src/gates/cogni/rules.js`): Calls `assertProviderResult()` after AI evaluation
- **Rule Files** (`.cogni/rules/*.yaml`): Must conform to v0.2 rule-spec schema
- **AI Workflows** (`src/ai/workflows/`): Return data validated against provider-result schema