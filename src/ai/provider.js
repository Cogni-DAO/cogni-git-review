/**
 * AI Provider - SINGLE AI ENTRYPOINT ROUTER
 * 
 * Pure shell that forwards I/O to workflows. No extraction or interpretation.
 */

import { ChatOpenAI } from "@langchain/openai";
import { CallbackHandler } from "langfuse-langchain";
import { getWorkflow } from './workflows/registry.js';
import { selectModel } from './model-selector.js';
import { environment } from '../env.js';

// Use explicit OpenRouter slugs
const DETERMINISTIC_MODELS = new Set([
  "openai/gpt-4o-mini",
  "openai/gpt-4.1-mini"
]);

const PROVIDER_VERSION = '1.1.0';

const OR_BASE_URL = "https://openrouter.ai/api/v1";
const OR_HEADERS = {
  ...(environment.OPENROUTER_SITE_URL ? { "HTTP-Referer": environment.OPENROUTER_SITE_URL } : {}),
  ...(environment.OPENROUTER_APP_TITLE ? { "X-Title": environment.OPENROUTER_APP_TITLE } : {}),
};

export function makeLLMClient({ model }) {
  if (!model) throw new Error("makeLLMClient: 'model' is required");

  const opts = { 
    model,
    apiKey: environment.OPENROUTER_API_KEY,
    configuration: {
      baseURL: OR_BASE_URL,
      defaultHeaders: OR_HEADERS
    }
  };
  const tempPolicy = DETERMINISTIC_MODELS.has(model) ? "0" : "default(omitted)";
  if (tempPolicy === "0") opts.temperature = 0;

  const client = new ChatOpenAI(opts);
  return { client, meta: { model, tempPolicy } };
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
export async function evaluateWithWorkflow({ workflowId, workflowInput }, { timeoutMs = 180000 } = {}, logger) {
  const startTime = Date.now();
  const log = logger?.child({ module: 'ai-provider' });
  
  try {
    // Get workflow from registry
    const evaluate = getWorkflow(workflowId);
    
    // Select model based on environment
    const modelConfig = selectModel();
    log?.debug({ model_config: modelConfig, workflow_id: workflowId }, 'AI provider initialized');
    
    // Create LLM client with temperature policy
    const { client } = makeLLMClient({ model: modelConfig.model });
    
    // Create Langfuse callback handler if configured
    const callbacks = [];
    if (environment.langfuse.enabled) {
      callbacks.push(new CallbackHandler({
        environment: environment.APP_ENV
      }));
    }

    // Generic provider metadata - workflow-agnostic
    const providerMeta = {
      workflow_id: workflowId,
      model: modelConfig.model,
      environment: environment.APP_ENV,
    };
    const tags = [
      `workflow:${workflowId}`,
      `model:${modelConfig.model}`
    ].filter(Boolean);
    const runnableConfig = {
      callbacks,
      tags,
      metadata: providerMeta,
      configurable: {}
    };
    
    // Route to selected workflow - preserve exact return format
    const result = await evaluate(workflowInput, { timeoutMs, client, logger: log, ...runnableConfig });
    
    // Add provenance wrapper with resolved model info
    return {
      ...result, // Raw workflow output
      provenance: {
        runId: generateRunId(),
        durationMs: Date.now() - startTime,
        providerVersion: PROVIDER_VERSION,
        workflowId,
        modelConfig,
        meta: providerMeta
      }
    };
    
  } catch (error) {
    logger.error({ err: error }, 'AI Provider error');
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