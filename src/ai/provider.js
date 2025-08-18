/**
 * AI Provider - SINGLE AI ENTRYPOINT
 * 
 * CRITICAL: This is the ONLY module that makes LLM calls in the entire codebase.
 * All AI functionality flows through the review() function.
 * 
 * ⚠️  DUMB PIPE TO LLMs - NO BUSINESS LOGIC! ⚠️
 * 
 * This module:
 * • Loads prompt templates
 * • Substitutes variables 
 * • Calls LLM with temperature=0
 * • Validates JSON schema output
 * • Returns structured results
 * 
 * This module does NOT:
 * • Make business decisions
 * • Implement rule logic
 * • Do heuristic analysis
 * • Apply scoring/thresholds
 */

import { createGoalAlignmentWorkflow } from './workflows/goal-alignment.js';

/**
 * Single AI entrypoint for all gate evaluations
 * Pure LLM interface - receives structured input, returns structured output
 * 
 * @param {Object} input - Standardized input format
 * @param {Array} input.goals - Repository goals from spec.intent.goals
 * @param {Array} input.non_goals - Repository non-goals from spec.intent.non_goals
 * @param {Object} input.pr - Pull request data
 * @param {string} input.diffSummary - Summary of PR changes
 * @param {Array} input.snippets - Code snippets from changed files
 * @param {Object} input.rule - Rule configuration (id, severity, success_criteria)
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default: 180000)
 * @returns {Promise<Object>} { verdict: 'success'|'failure'|'neutral', annotations: [], violations: [], provenance: {} }
 */
export async function review(input, { timeoutMs = 180000 } = {}) {
  const startTime = Date.now();
  
  try {
    // Input validation (structural only - no business logic)
    if (!input || !input.rule) {
      return createErrorResponse('invalid_input', 'Missing required input: rule configuration', startTime);
    }

    // Set up timeout handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      // Load and execute LangGraph workflow (ONLY place that calls LLMs)
      const workflow = await createGoalAlignmentWorkflow();
      const result = await workflow.invoke(input, { 
        signal: abortController.signal 
      });

      clearTimeout(timeoutId);

      // Return structured result (no business logic applied here)
      return {
        verdict: result.verdict || 'neutral',
        annotations: result.annotations || [],
        violations: result.violations || [],
        provenance: {
          model: result.model || process.env.AI_MODEL || 'unknown',
          runId: generateRunId(),
          durationMs: Date.now() - startTime,
          providerVersion: '1.0.0'
        }
      };

    } catch (workflowError) {
      clearTimeout(timeoutId);
      
      if (workflowError.name === 'AbortError') {
        return createTimeoutResponse(startTime);
      }
      
      throw workflowError;
    }
    
  } catch (error) {
    console.error('AI Provider error:', error.message);
    
    // Respect AI_NEUTRAL_ON_ERROR policy
    const neutralOnError = process.env.AI_NEUTRAL_ON_ERROR !== 'false';
    
    return {
      verdict: neutralOnError ? 'neutral' : 'failure',
      annotations: [],
      violations: [{
        code: 'ai_provider_error',
        message: `AI evaluation failed: ${error.message}`,
        path: null,
        meta: { error: error.message, neutralOnError }
      }],
      provenance: {
        model: null,
        runId: generateRunId(),
        durationMs: Date.now() - startTime,
        providerVersion: '1.0.0'
      }
    };
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(code, message, startTime) {
  return {
    verdict: 'neutral',
    annotations: [],
    violations: [{
      code,
      message,
      path: null,
      meta: {}
    }],
    provenance: {
      model: null,
      runId: generateRunId(),
      durationMs: Date.now() - startTime,
      providerVersion: '1.0.0'
    }
  };
}

/**
 * Create standardized timeout response
 */
function createTimeoutResponse(startTime) {
  const neutralOnError = process.env.AI_NEUTRAL_ON_ERROR !== 'false';
  
  return {
    verdict: neutralOnError ? 'neutral' : 'failure',
    annotations: [],
    violations: [{
      code: 'ai_provider_timeout',
      message: 'AI evaluation timed out',
      path: null,
      meta: { timeoutMs: Date.now() - startTime }
    }],
    provenance: {
      model: null,
      runId: generateRunId(),
      durationMs: Date.now() - startTime,
      providerVersion: '1.0.0'
    }
  };
}

/**
 * Generate unique run identifier
 */
function generateRunId() {
  return `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}