/**
 * AI Provider - SINGLE AI ENTRYPOINT ROUTER
 * 
 * Pure shell that forwards I/O to workflows. No extraction or interpretation.
 */

import { ChatOpenAI } from "@langchain/openai";
import { evaluate } from './workflows/goal-alignment.js';
import { selectModel, buildContext } from './model-selector.js';

// Models we explicitly want temperature=0 for determinism
const DETERMINISTIC_MODELS = new Set([
  "4o-mini",
  "gpt-4o-mini"
]);

export function makeLLMClient({ model }) {
  if (!model) throw new Error("makeLLMClient: 'model' is required");

  const opts = { model };
  const tempPolicy = DETERMINISTIC_MODELS.has(model) ? "0" : "default(omitted)";
  if (tempPolicy === "0") opts.temperature = 0; // otherwise omit temperature

  const client = new ChatOpenAI(opts);
  return { client, meta: { model, tempPolicy } }; // side-effect free
}

/**
 * Single AI entrypoint router for all gate evaluations
 * 
 * @param {Object} input - Standardized input format
 * @param {string} input.statement - Statement to evaluate PR against
 * @param {string} input.pr_title - Pull request title
 * @param {string} input.pr_body - Pull request body
 * @param {string} input.diff_summary - Summary of PR changes
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns {Promise<Object>} { score: number, observations: [], summary: string, provenance: {} }
 */
export async function review(input, { timeoutMs = 60000 } = {}) {
  const startTime = Date.now();
  
  try {
    // Select model based on environment
    const modelConfig = selectModel(buildContext());
    console.log('🤖 AI Provider: ModelConfig:', modelConfig);
    
    // Create LLM client with temperature policy
    const { client, meta } = makeLLMClient({ model: modelConfig.model });
    console.log(`🤖 LLM Client: model=${meta.model}, temp=${meta.tempPolicy}`);
    
    // Forward to goal-alignment workflow with pre-built client
    const result = await evaluate(input, { timeoutMs, client });
    
    // Add provenance wrapper with resolved model info
    return {
      ...result,
      provenance: {
        runId: generateRunId(),
        durationMs: Date.now() - startTime,
        providerVersion: '1.0.0',
        modelConfig: modelConfig  // Include entire modelConfig object
      }
    };
    
  } catch (error) {
    console.error('AI Provider error:', error.message);
    return createErrorResponse('ai_provider_error', `AI evaluation failed: ${error.message}`, startTime);
  }
}


/**
 * Create standardized error response
 */
function createErrorResponse(code, message, startTime) {
  return {
    score: null,
    observations: [{
      code,
      message,
      path: null,
      meta: {}
    }],
    summary: 'Error during evaluation',
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
  return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}