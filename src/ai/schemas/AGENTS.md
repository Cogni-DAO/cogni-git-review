# AGENTS.md - AI Schemas Directory

## Purpose
JSON schema definitions for AI evaluation rules and outputs. MVP implementation providing basic validation for the AI rule gate system.

## Files

### rule-spec.schema.json
**JSON Schema for AI Rule Specifications (MVP)**
- Validates `.cogni/rules/*.yaml` files used by the `ai-rule` gate
- Required fields: `id`, `schema_version`, `prompt`, `success_criteria`
- Recently added `patternProperties: {"^x_": {}}` to allow experimental vendor-prefixed fields
- Currently supports `x_capabilities` and `x_budgets` for code-aware evidence gathering
- Added `evaluation-statement` field and `statement` template variable
- Supports `x_capabilities: ['diff_summary', 'file_patches']` for enhanced evidence
- Budget controls: `x_budgets.{max_files, max_patch_bytes_per_file, max_patches}`

### goal-evaluation-output.json
**JSON Schema for AI Provider Response Format**
- Validates responses from AI providers evaluating pull requests
- Ensures consistent output format with score, observations, and summary fields

## Current State
This is MVP schema validation. The vendor-prefixed extension approach is a short-term solution for experimenting with code-aware capabilities while the overall AI rule system is in development.

## Related Components
- **AI Rules Gate** (`src/gates/cogni/rules.js`): Consumes rule-spec schema
- **Rule Files** (`.cogni/rules/*.yaml`): Validated against rule-spec schema  
- **AI Providers**: Return data validated against goal-evaluation-output schema