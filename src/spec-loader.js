import { assertRuleSchema } from './ai/schemas/validators.js';

/**
 * Load and parse repository spec using Probot's built-in config loader
 * @param {import('probot').Context} context - Probot context with repository info
 * @returns {Promise<{ok: boolean, spec?: object, error?: object}>}
 */
export async function loadRepoSpec(context) {
  const { config } = await loadCogniFile(context, '.cogni/repo-spec.yaml');
  
  // Handle both null and empty object {} as missing spec
  if (!config || Object.keys(config).length === 0) return { ok: false, error: { code: 'SPEC_MISSING' } };
  if (!config.intent || !config.gates) return { ok: false, error: { code: 'SPEC_INVALID' } };
  
  // TODO: Add repo-spec schema validation similar to rule validation above
  
  return { ok: true, spec: config };
}

/**
 * Safe loader for any .cogni/* file - single source of truth for repo I/O
 * @param {import('probot').Context} context - Probot context with repository info
 * @param {string} path - Path relative to repo root (must start with '.cogni/')
 * @returns {Promise<{config: object|null}>}
 */
async function loadCogniFile(context, path) {
  // Security: only allow .cogni/ prefix, forbid traversal
  if (!path.startsWith('.cogni/') || path.includes('..')) {
    throw new Error(`Invalid cogni path: ${path}`);
  }
  
  const { owner, repo } = context.repo();
  return await context.octokit.config.get({ owner, repo, path });
}

/**
 * Load a single rule from .cogni/rules/ directory
 * Each gate instance loads exactly one rule file
 * @param {import('probot').Context} context - Probot context with repository info
 * @param {Object} options - Rule loading options
 * @param {string} options.rulesDir - Rules directory (default: '.cogni/rules')
 * @param {string} options.ruleFile - Single rule file to load
 * @param {boolean} options.blockingDefault - Default blocking behavior (default: true)
 * @returns {Promise<{ok: boolean, rule?: Object, error?: object}>} Single rule result
 */
export async function loadSingleRule(context, { rulesDir = '.cogni/rules', ruleFile, blockingDefault = true }) {
  if (!ruleFile) {
    return { ok: false, error: { code: 'NO_RULE_FILE' } };
  }
  
  const rulePath = `${rulesDir}/${ruleFile}`;
  
  try {
    const { config } = await loadCogniFile(context, rulePath);
    
    if (!config) {
      return { ok: false, error: { code: 'RULE_MISSING' } };
    }
    
    // Minimal validation - just check for required fields
    if (!config.id || !config.success_criteria) {
      return { ok: false, error: { code: 'RULE_INVALID' } };
    }
    
    // Early schema validation on raw rule before adding internal properties
    try {
      assertRuleSchema(config);
    } catch (error) {
      console.error('🚨 Rule schema validation failed:', error.message);
      if (error.details) {
        console.error('📋 Validation details:', JSON.stringify(error.details, null, 2));
      }
      return { ok: false, error: { code: 'RULE_SCHEMA_INVALID', message: error.message, details: error.details } };
    }
    
    // Generate rule key and apply defaults
    const rule = {
      ...config,
      rule_key: config.id,
      blocking: config.blocking !== undefined ? config.blocking : blockingDefault,
      _metadata: {
        fileName: ruleFile,
        loadedAt: new Date().toISOString()
      }
    };
    
    console.log(`✅ Rule: Loaded '${rule.id}' from ${ruleFile}`);
    return { ok: true, rule };
    
  } catch (error) {
    console.log(`❌ Rule: Error loading ${ruleFile}: ${error.message}`);
    return { ok: false, error: { code: 'RULE_LOAD_FAILED', message: error.message } };
  }
}


/**
 * Clear the spec cache (Probot handles caching internally)
 */
export function clearSpecCache() {
  // Probot config plugin handles caching internally
  // This is a no-op for backward compatibility
}

/**
 * Get cache stats (Probot handles caching internally)
 */
export function getSpecCacheStats() {
  return {
    size: 'managed_by_probot',
    keys: []
  };
}