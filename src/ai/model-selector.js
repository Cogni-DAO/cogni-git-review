/**
 * AI Model Selection - Environment-Based Configuration
 * 
 * Selects appropriate AI model based on APP_ENV environment variable.
 * No overrides - only environment-based defaults.
 */

/**
 * Built-in model mapping by environment
 */
const DEFAULT_MODELS = {
  dev: 'gpt-4o-mini',      // Fast, cost-effective for development
  preview: 'gpt-5-2025-08-07',       // Preview matches production
  prod: 'gpt-5-2025-08-07'          // High quality for production
};

/**
 * Detect execution environment based on APP_ENV
 * @param {Object} context - Execution context
 * @param {Object} context.env - Environment variables
 * @returns {string} Environment: 'dev' | 'preview' | 'prod'
 */
function detectEnvironment({ env }) {
  // APP_ENV is configured in preview and prod deployments
  const appEnv = env.APP_ENV;
  
  if (appEnv === 'preview') {
    return 'preview';
  }
  
  if (appEnv === 'prod' || appEnv === 'production') {
    return 'prod';
  }
  
  // Default to dev (local development, no APP_ENV configured)
  return 'dev';
}

/**
 * Select AI model based on environment
 * 
 * @param {Object} context - Execution context
 * @param {Object} context.env - Environment variables (process.env)
 * @returns {Object} { environment, model, provider, audit }
 */
export function selectModel(context) {
  const startTime = Date.now();
  
  try {
    // Step 1: Detect environment
    const environment = detectEnvironment(context);
    
    // Step 2: Get model for environment
    const model = DEFAULT_MODELS[environment];
    
    if (!model) {
      throw new Error(`Unknown environment: ${environment}`);
    }
    
    // Step 3: Build result with audit info
    return {
      environment,
      model,
      provider: 'openai',
      audit: {
        source: 'built-in-defaults',
        detectionMs: Date.now() - startTime,
        context: {
          appEnv: context.env.APP_ENV || 'undefined'
        }
      }
    };
    
  } catch (error) {
    // Fallback to dev on any error
    return {
      environment: 'dev',
      model: DEFAULT_MODELS.dev,
      provider: 'openai',
      audit: {
        source: 'fallback-on-error',
        error: error.message,
        detectionMs: Date.now() - startTime
      }
    };
  }
}

/**
 * Build execution context from current environment
 * @returns {Object} Context for selectModel()
 */
export function buildContext() {
  return {
    env: process.env
  };
}