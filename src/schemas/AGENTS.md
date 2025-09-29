# src/schemas/ - Runtime Validation Guards

**Purpose**: Runtime validation functions that assert data conforms to expected schemas.

**Scope**: 
- Validate AI rule formats (standardized `success_criteria` only, no legacy threshold)
- Validate provider results follow `standard_ai_rule_eval` contract
- Throw descriptive errors on format violations for early detection

**Usage**: Import guards in gate logic to validate inputs/outputs before processing.

**Files**:
- `standard-ai-rule-eval-format.js` - Guards for AI rule evaluation pipeline