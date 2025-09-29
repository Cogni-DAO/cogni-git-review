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
 * @param {import('probot').Context} context - Probot context with execution metadata
 * @returns {Promise<{results: GateResult[]}>} Gate execution results
 */
export async function runConfiguredGates(context) {
  // Build registry with logger on first call
  if (!registryPromise) {
    registryPromise = buildRegistry(context.log || console);
  }
  const registry = await registryPromise;
  const allGates = Array.isArray(context.spec?.gates) ? context.spec.gates : [];
  
  // Validate unique gate IDs before execution
  try {
    validateUniqueIds(allGates);
  } catch (error) {
    context.log?.error('Gate ID validation failed', { error: error.message });
    throw error;
  }
  
  const results = [];

  for (const gate of allGates) {
    const gateId = deriveGateId(gate);
    
    // Check for timeout before each gate - return partial results if aborted
    if (context.abort?.aborted) {
      context.logger?.('warn', 'Gate execution aborted due to timeout', { 
        gate_id: gateId, 
        deadline_ms: context.deadline_ms,
        partial_results: results.length
      });
      return { results };
    }

    const handler = resolveHandler(registry, gate);
    
    try {
      const result = await safeRunGate(handler, context, gate, gateId);
      
      // Force ID normalization - always use derived gate ID
      const finalResult = {
        ...result,
        id: gateId  // ALWAYS use derived gate ID, ignore what gate returns
      };
      results.push(finalResult);
      
    } catch (error) {
      if (error.message === 'aborted') {
        // Mid-gate abort - return partial results
        context.logger?.('warn', 'Gate execution aborted mid-gate', { 
          gate_id: gateId,
          partial_results: results.length
        });
        return { results };
      }
      // Non-abort errors are already normalized in safeRunGate; nothing to rethrow here.
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
 * @returns {Promise<object>} Normalized gate result
 */
async function safeRunGate(handler, ctx, gate, gateId) {
  const startTime = Date.now();

  try {
    // Handle unimplemented gate
    if (!handler) {
      return {
        status: 'neutral',
        neutral_reason: 'unimplemented_gate',
        violations: [],
        stats: {},
        duration_ms: Date.now() - startTime
      };
    }

    // Check for timeout before executing gate
    if (ctx.abort?.aborted) {
      throw new Error('aborted');
    }

    // Execute gate handler
    const result = await handler(ctx, gate);

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
      duration_ms: Date.now() - startTime
    };

  } catch (error) {
    // Handle abort vs regular errors differently
    if (error.message === 'aborted') {
      // Re-throw abort to stop execution at launcher level
      throw error;
    }
    
    // Gate crashed - log error and return neutral
    ctx.logger?.('error', `Gate ${gateId} crashed`, { error: error.message });
    
    return {
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: Date.now() - startTime
    };
  }
}