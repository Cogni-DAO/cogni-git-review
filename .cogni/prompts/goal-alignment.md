# Goal Alignment Evaluation

You are evaluating whether a pull request aligns with the repository's stated goals and avoids its non-goals.

## Repository Context

**Goals**: {{goals}}

**Non-Goals**: {{non_goals}}

## Pull Request to Evaluate

**Title**: {{pr_title}}

**Description**: {{pr_body}}

**Changes Summary**: {{diff_summary}}

## Evaluation Instructions

Analyze the pull request changes against the repository goals and non-goals. Consider:

1. **Goal Alignment**: Does this PR advance any of the stated goals?
2. **Non-Goal Avoidance**: Does this PR avoid the stated non-goals?
3. **Scope Appropriateness**: Are the changes appropriate for this repository's purpose?
4. **Quality Indicators**: Does the PR demonstrate good engineering practices?

## Required Output Format

Return ONLY this JSON structure with no additional text:

```json
{
  "verdict": "success|failure|neutral",
  "alignment_score": 0.85,
  "violations": [],
  "summary": "Brief assessment of goal alignment"
}
```

**Scoring Guidelines**:
- **0.9-1.0**: Strongly advances goals, clearly avoids non-goals
- **0.7-0.89**: Generally aligns with goals, minimal concerns
- **0.5-0.69**: Some alignment issues or unclear purpose
- **0.3-0.49**: Poor alignment or conflicts with goals
- **0.0-0.29**: Directly conflicts with goals or advances non-goals

**Critical**: Use temperature=0 for consistent results. Focus on goal alignment, not code quality details.