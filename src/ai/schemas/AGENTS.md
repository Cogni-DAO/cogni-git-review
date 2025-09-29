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
**JSON Schema for AI Rule Specifications v0.2**
- Validates `.cogni/rules/*.yaml` files used by the `ai-rule` gate
- **Required fields**: `id`, `schema_version`, `workflow_id`, `success_criteria`
- **Schema version**: `"0.2"` (updated from `"0.1"`)
- **Workflow routing**: `workflow_id` field specifies AI workflow (e.g., `"single-statement-evaluation"`)
- **Matrix success criteria**: `require` and `any_of` arrays with metric comparisons (`gte`, `gt`, `lte`, `lt`, `eq`)
- **Evaluation statement**: `evaluation-statement` field passed as `evaluation_statement` parameter to workflows
- **Vendor extensions**: `patternProperties: {"^x_": {}}` allows experimental fields like `x_capabilities`, `x_budgets`
- **Code-aware capabilities**: `x_capabilities: ['diff_summary', 'file_patches']` for enhanced evidence gathering
- **Budget controls**: `x_budgets: {max_files, max_patch_bytes_per_file, max_patches}` for resource limits

### provider-result.schema.json
**JSON Schema for AI Provider Response Format**
- Validates responses from `aiProvider.evaluateWithWorkflow()` calls
- **Required fields**: `metrics`, `observations`, `summary`, `provenance`
- **Metrics format**: Object with required `score` (0-1) plus additional metrics for matrix evaluation
- **Observations format**: Array of string insights from AI evaluation
- **Summary format**: Brief string explanation of the evaluation
- **Provenance format**: Execution metadata including `runId`, `durationMs`, `workflowId`, `modelConfig`

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