# AI Workflows Directory

## Purpose
LangGraph workflow implementations called only by `src/ai/provider.js`. Contains AI reasoning logic.

## Single Statement Contract
Each workflow evaluates PR against one statement/requirement.

```javascript
const workflow = await createGoalAlignmentWorkflow();
const result = await workflow.invoke({
  statement: "Deliver AI-powered advisory review to keep repo aligned",
  pr_title: 'Add LangGraph integration', 
  pr_body: 'This PR implements...',
  diff_summary: '3 files changed (+45 -12)'
});

// Returns: { score: 0.85, annotations: [], summary: "Brief assessment" }
```

## Current State
- **goal-alignment.js**: Mock implementation (TODO: Replace with LangGraph + LLM)

## Constraints
- Only called by provider.js
- Must return score (0-1) not verdict
- Handle AbortController signals for timeouts