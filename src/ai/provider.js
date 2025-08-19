/**
 * AI Provider - SINGLE AI ENTRYPOINT (MVP STUB)
 * 
 * CRITICAL: This is the ONLY module that makes LLM calls in the entire codebase.
 * 
 * MVP: This is currently a STUB that returns hardcoded responses for testing.
 * Future: Will call LangGraph.js workflows for actual AI evaluation.
 */

/**
 * Single AI entrypoint for all gate evaluations
 * 
 * @param {Object} input - Standardized input format
 * @param {Array} input.goals - Repository goals from spec.intent.goals
 * @param {Array} input.non_goals - Repository non-goals from spec.intent.non_goals
 * @param {string} input.pr_title - Pull request title
 * @param {string} input.pr_body - Pull request body
 * @param {string} input.diff_summary - Summary of PR changes
 * @param {Object} input.rule - Rule configuration with success_criteria
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns {Promise<Object>} { score: number, violations: [], annotations: [], provenance: {} }
 */
export async function review(input, { timeoutMs = 60000 } = {}) {
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!input || !input.rule) {
      return createErrorResponse('invalid_input', 'Missing required input: rule configuration', startTime);
    }

    // MVP STUB: Return hardcoded response for testing
    // TODO: Replace with actual LangGraph.js workflow call
    const mockScore = calculateMockScore(input);
    
    // Validate score is in valid range
    if (typeof mockScore !== 'number' || !isFinite(mockScore) || mockScore < 0 || mockScore > 1) {
      return createErrorResponse('invalid_output', `Invalid score: ${mockScore} (must be finite number 0-1)`, startTime);
    }

    return {
      score: mockScore,
      violations: mockScore < 0.7 ? [`Goal alignment concern (score: ${mockScore.toFixed(2)})`] : [],
      annotations: [],
      provenance: {
        model: 'stub-model',
        runId: generateRunId(),
        durationMs: Date.now() - startTime,
        providerVersion: '1.0.0-stub'
      }
    };
    
  } catch (error) {
    console.error('AI Provider error:', error.message);
    return createErrorResponse('ai_provider_error', `AI evaluation failed: ${error.message}`, startTime);
  }
}

/**
 * MVP STUB: Calculate mock score for testing
 * TODO: Remove when LangGraph.js integration is complete
 */
function calculateMockScore(input) {
  // Simple heuristic for testing: score based on PR title/body content
  const content = `${input.pr_title} ${input.pr_body}`.toLowerCase();
  
  // Higher scores for goal-related keywords
  const goalKeywords = ['fix', 'improve', 'add', 'update', 'feature', 'enhance'];
  const hasGoalKeywords = goalKeywords.some(keyword => content.includes(keyword));
  
  // Lower scores for concerning keywords  
  const concernKeywords = ['hack', 'temporary', 'todo', 'fixme', 'broken'];
  const hasConcernKeywords = concernKeywords.some(keyword => content.includes(keyword));
  
  let score = 0.75; // Default neutral score
  if (hasGoalKeywords) score += 0.15;
  if (hasConcernKeywords) score -= 0.3;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Create standardized error response
 */
function createErrorResponse(code, message, startTime) {
  return {
    score: null,
    violations: [{
      code,
      message,
      path: null,
      meta: {}
    }],
    annotations: [],
    provenance: {
      model: null,
      runId: generateRunId(),
      durationMs: Date.now() - startTime,
      providerVersion: '1.0.0-stub'
    }
  };
}

/**
 * Generate unique run identifier
 */
function generateRunId() {
  return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}