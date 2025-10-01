/**
 * AI Provider - SINGLE AI ENTRYPOINT ROUTER
 * 
 * Pure shell that forwards I/O to workflows. No extraction or interpretation.
 */

import { ChatOpenAI } from "@langchain/openai";
import { CallbackHandler } from "langfuse-langchain";
import { getWorkflow } from './workflows/registry.js';
import { selectModel, buildContext } from './model-selector.js';
import { ENV } from '../constants.js';

// Models we explicitly want temperature=0 for determinism
const DETERMINISTIC_MODELS = new Set([
  "4o-mini",
  "gpt-4o-mini"
]);

const PROVIDER_VERSION = '1.1.0';

export function makeLLMClient({ model }) {
  if (!model) throw new Error("makeLLMClient: 'model' is required");

  const opts = { model };
  const tempPolicy = DETERMINISTIC_MODELS.has(model) ? "0" : "default(omitted)";
  if (tempPolicy === "0") opts.temperature = 0; // otherwise omit temperature

  const client = new ChatOpenAI(opts);
  return { client, meta: { model, tempPolicy } }; // side-effect free
}

/**
 * Generic AI workflow router - NEW INTERFACE
 * 
 * @param {Object} config - Workflow configuration
 * @param {string} config.workflowId - Workflow identifier (e.g., 'single-statement-evaluation')
 * @param {Object} config.workflowInput - Input data for the workflow
 * @param {Object} options - Configuration options
 * @param {number} options.timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns {Promise<Object>} Raw workflow output + provenance wrapper
 */
export async function evaluateWithWorkflow({ workflowId, workflowInput }, { timeoutMs = 60000 } = {}) {
  const startTime = Date.now();
  
  try {
    // Get workflow from registry
    const evaluate = getWorkflow(workflowId);
    
    // Select model based on environment
    const modelConfig = selectModel(buildContext());
    console.log('🤖 AI Provider: ModelConfig:', modelConfig);
    
    // Create LLM client with temperature policy
    const { client } = makeLLMClient({ model: modelConfig.model });
    
    // Create Langfuse callback handler if configured
    const callbacks = [];
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      callbacks.push(new CallbackHandler({
        environment: ENV
      }));
    }
    
    // Route to selected workflow - preserve exact return format
    const result = await evaluate(workflowInput, { timeoutMs, client, callbacks });
    
    // Add provenance wrapper with resolved model info
    return {
      ...result, // Raw workflow output
      provenance: {
        runId: generateRunId(),
        durationMs: Date.now() - startTime,
        providerVersion: PROVIDER_VERSION,
        workflowId,
        modelConfig: modelConfig  // Include entire modelConfig object
      }
    };
    
  } catch (error) {
    console.error('AI Provider error:', error.message);
    return createErrorResponse('ai_provider_error', `AI evaluation failed: ${error.message}`, startTime);
  }
}

// Removed: review() function - no backward compatibility
// All callers must use evaluateWithWorkflow() interface


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
      providerVersion: PROVIDER_VERSION
    }
  };
}

/**
 * Generate unique run identifier
 */
function generateRunId() {
  return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}