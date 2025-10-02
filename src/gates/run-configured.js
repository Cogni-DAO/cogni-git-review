/**
 * Generic Gate Launcher - Replaces hardcoded gate dispatch with dynamic resolution
 * Provides safe wrapper with crash handling, timing, and error recovery
 */

import { buildRegistry, resolveHandler } from './registry.js';

// Build registry once at module load time for performance
// Note: Logger will be passed when available in runConfiguredGates
let registryPromise = null;

/**
 * Derive unique gate ID from gate specification
 * @param {object} gateSpec - Gate configuration from spec
 * @returns {string} Derived gate ID
 */
function deriveGateId(gateSpec) {
  if (gateSpec.id) return gateSpec.id;  // Explicit wins

  // Auto-derive for ai-rule from rule_file basename
  if (gateSpec.type === 'ai-rule' && gateSpec.with?.rule_file) {
    return gateSpec.with.rule_file.replace(/\.ya?ml$/, '');
  }

  return gateSpec.type;  // Fallback
}

/**
 * Validate that all gate IDs are unique
 * @param {Array<object>} gates - Array of gate specifications
 * @throws {Error} If duplicate IDs are found
 */
function validateUniqueIds(gates) {
  const ids = new Set();
  for (const gate of gates) {
    const id = deriveGateId(gate);
    if (ids.has(id)) {
      throw new Error(`Duplicate gate ID: ${id}`);
    }
    ids.add(id);
  }
}

/**
 * Run all configured gates from spec in order with dynamic resolution
 * @param {object} params - Parameters object
 * @param {import('probot').Context} params.context - Probot context with execution metadata
 * @param {object} params.logger - Logger instance
 * @returns {Promise<{results: GateResult[]}>} Gate execution results
 */
export async function runConfiguredGates({ context, logger }) {
  // Build registry with logger on first call
  if (!registryPromise) {
    registryPromise = buildRegistry(logger);
  }
  const registry = await registryPromise;
  const allGates = Array.isArray(context.spec?.gates) ? context.spec.gates : [];
  
  // Validate unique gate IDs before execution
  try {
    validateUniqueIds(allGates);
  } catch (error) {
    logger.error({ err: error }, 'Gate ID validation failed');
    throw error;
  }
  
  const results = [];

  for (const gate of allGates) {
    const gateId = deriveGateId(gate);
    

    const handler = resolveHandler(registry, gate);
    
    try {
      const result = await safeRunGate(handler, context, gate, gateId, logger);
      
      // Force ID normalization - always use derived gate ID
      const finalResult = {
        ...result,
        id: gateId  // ALWAYS use derived gate ID, ignore what gate returns
      };
      results.push(finalResult);
      
    } catch (error) {
      // Handle unexpected errors from safeRunGate itself (not gate execution errors)
      logger.error({ 
        err: error,
        gate_id: gateId,
        type: gate.type 
      }, 'Critical error in gate wrapper');
      
      // Push a neutral result to prevent breaking the entire gate chain
      const neutralResult = {
        id: gateId,
        status: 'neutral',
        neutral_reason: 'wrapper_error',
        violations: [],
        stats: { wrapper_error: error.message },
        duration_ms: 0
      };
      results.push(neutralResult);
    }
  }

  return { results };
}

/**
 * Safe wrapper for gate execution with error handling and timing
 * @param {Function|null} handler - Gate handler function or null
 * @param {object} ctx - Run context
 * @param {object} gate - Gate configuration
 * @param {string} gateId - Derived gate ID for logging
 * @param {object} logger - Logger instance
 * @returns {Promise<object>} Normalized gate result
 */
async function safeRunGate(handler, ctx, gate, gateId, logger) {
  const startTime = Date.now();
  const log = logger.child({ module: `gates/${gateId}` });

  // Log gate start for ALL gate types
  log.info({ type: gate.type }, 'Gate starting');

  try {
    // Handle unimplemented gate
    if (!handler) {
      log.warn({ type: gate.type }, 'Gate unimplemented');
      return {
        status: 'neutral',
        neutral_reason: 'unimplemented_gate',
        violations: [],
        stats: {},
        duration_ms: Date.now() - startTime
      };
    }


    // Execute gate handler
    const result = await handler(ctx, gate, logger);

    // Log gate completion
    const duration = Date.now() - startTime;
    log.info({ 
      status: result.status || 'neutral',
      duration_ms: duration,
      violations: result.violations?.length || 0
    }, 'Gate completed');

    // Normalize result shape (ID will be set by caller)
    return {
      status: result.status ?? 'neutral',
      neutral_reason: result.neutral_reason,
      violations: result.violations ?? [],
      observations: result.observations ?? [],
      stats: result.stats ?? {},
      provenance: result.provenance,
      res: result.res,
      providerResult: result.providerResult,
      rule: result.rule,
      passed: result.passed,
      failed: result.failed,
      error: result.error,
      duration_ms: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Gate crashed - log error and return neutral
    log.error({ 
      err: error,
      duration_ms: duration,
      type: gate.type
    }, 'Gate crashed');
    
    return {
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: duration
    };
  }
}