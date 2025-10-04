/**
 * AI Model Selection - Environment-Based Configuration
 * 
 * Selects appropriate AI model based on environment.APP_ENV environment variable.
 * No overrides - only environment-based defaults.
 */

import { environment } from "../env.js";

/**
 * Built-in model mapping by environment
 */
const DEFAULT_MODELS = {
  dev: 'gpt-4o-mini',      // Fast, cost-effective for development
  preview: 'gpt-5-2025-08-07',       // Preview matches production
  prod: 'gpt-5-2025-08-07'          // High quality for production
};


/**
 * Select AI model based on environment
 * 
 * @returns {Object} { environment, model, provider, audit }
 */
export function selectModel() {
  const startTime = Date.now();
  
  try {
    
    // Get model for environment 
    const model = DEFAULT_MODELS[environment.APP_ENV];
    
    if (!model) {
      throw new Error(`Unknown environment: ${environment.APP_ENV}`);
    }
    
    // Step 2: Build result with audit info
    return {
      environment: environment.APP_ENV,
      model,
      provider: 'openai',
      audit: {
        source: 'built-in-defaults',
        detectionMs: Date.now() - startTime
      }
    };
    
  } catch (error) {
    // Fallback to dev on any error
    return {
      environment: environment.APP_ENV,
      model: DEFAULT_MODELS[environment.APP_ENV],
      provider: 'openai',
      audit: {
        source: 'fallback-on-error',
        error: error.message,
        detectionMs: Date.now() - startTime
      }
    };
  }
}