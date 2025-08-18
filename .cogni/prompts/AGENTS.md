# Prompts Directory - AI Evaluation Templates

## Purpose
Contains prompt templates for AI rule evaluation. Each template corresponds to a rule in ../rules/ and defines how the AI should analyze PR changes.

## Goals
- **Variable Substitution**: Templates use {{variable}} syntax for dynamic content
- **Deterministic Output**: Clear instructions for consistent AI responses  
- **Structured Results**: JSON schema-compliant outputs required
- **Rule-Specific**: Each prompt tailored to its corresponding rule's purpose

## Non-Goals
- **Generic Prompts**: Each template purpose-built for specific rule logic
- **Arbitrary Variables**: Only variables produced by evidence system allowed
- **Unstructured Output**: All responses must match JSON schemas

## Template Structure
```markdown
# Rule Name Evaluation

Instructions for AI analysis...

## Input Variables
- **Goals**: {{goals}}
- **Non-Goals**: {{non_goals}}  
- **Diff Summary**: {{diff_summary}}
- **Code Snippets**: {{file_snippets}}

## Required Output Format
Return ONLY this JSON structure:
```json
{
  "verdict": "success|failure|neutral",
  "alignment_score": 0.75,
  "violations": [...],
  "summary": "Brief assessment"
}
```

**Critical**: Use temperature=0, validate against schema, provide rationale.
```

## Interaction Patterns

### Creating Rule Prompts
1. **Match Rule Variables**: Only use variables specified in rule YAML
2. **Clear Instructions**: Specific evaluation criteria and scoring rubric
3. **JSON Schema**: Ensure output matches goal-evaluation-output.json schema
4. **Determinism**: Include temperature=0 instruction for consistency

### Template Variables
- **Available**: goals, non_goals, diff_summary, file_snippets
- **Substitution**: Engine replaces {{variable}} with actual data
- **Validation**: Unmapped variables cause rule loading to fail

### Output Requirements
- **Structured**: Must return valid JSON matching schema
- **Deterministic**: Temperature=0 for consistent results
- **Scored**: Include alignment_score (0.0-1.0) when using score metric
- **Rationale**: Summary field explains reasoning

**MVP Status**: Currently contains goal-alignment template only.