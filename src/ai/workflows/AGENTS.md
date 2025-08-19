# AI Workflows Directory

## Purpose
LangGraph workflow implementations called only by `src/ai/provider.js`. Contains AI reasoning logic.

## Current State
- **goal-alignment.js**: Mock implementation returning score 0.9 or 0.3
- TODO: Replace mocks with actual LangGraph + LLM calls

## Workflow Contract
```javascript
const workflow = await createGoalAlignmentWorkflow();
const result = await workflow.invoke({
  goals: ['goal'],
  non_goals: ['non-goal'],
  pr_title: 'title',
  pr_body: 'body',
  diff_summary: 'summary'
});

// Returns: { score: 0.9, violations: [], annotations: [] }
```

## Current Mock Logic
- Returns score 0.9 (success) if no violations detected
- Returns score 0.3 (failure) if scope expansion flagged
- Scope expansion = PR title contains "refactor" + non-goals exist

## Constraints
- Only called by provider.js
- Must return score (0-1) not verdict
- Handle AbortController signals for timeouts