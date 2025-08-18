# AI Workflows Directory

## Purpose
Contains LangGraph.js workflow definitions that implement AI reasoning patterns. These workflows are **ONLY** called from `src/ai/provider.js` - never directly by gates or other modules.

## Current Workflows
- **goal-alignment.js**: 3-node workflow for evaluating PR alignment with repository goals

## LangGraph Workflow Pattern
All workflows follow this structure:
```javascript
import { StateGraph } from '@langchain/langgraph';

export async function createGoalAlignmentWorkflow() {
  const workflow = new StateGraph({
    channels: {
      goals: { reducer: (x, y) => y },
      non_goals: { reducer: (x, y) => y },
      pr_data: { reducer: (x, y) => y },
      // ... other state channels
    }
  });
  
  // Add nodes: AnalyzePR → EvaluateAlignment → FormatViolations
  workflow.addNode("analyzePR", analyzePRNode);
  workflow.addNode("evaluateAlignment", evaluateAlignmentNode); 
  workflow.addNode("formatViolations", formatViolationsNode);
  
  // Define edges
  workflow.addEdge("analyzePR", "evaluateAlignment");
  workflow.addEdge("evaluateAlignment", "formatViolations");
  
  return workflow.compile();
}
```

## Node Implementation Guidelines
- **Deterministic**: Use temperature=0 for all LLM calls
- **Timeout Aware**: Respect AbortController signals
- **Schema Validated**: Validate JSON outputs against schemas
- **Error Handling**: Return structured errors, not exceptions

## Integration Contract
Workflows are invoked ONLY by `provider.review()`:
```javascript
// In provider.js
const workflow = await createGoalAlignmentWorkflow();
const result = await workflow.invoke(input, { signal: abortController.signal });
```

## Testing Strategy
- **Unit tests**: Test individual nodes with mock inputs
- **Integration tests**: Test complete workflow through provider.review()
- **Contract tests**: Golden fixtures ensuring deterministic output