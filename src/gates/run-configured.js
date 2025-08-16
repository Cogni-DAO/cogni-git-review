/**
 * Generic Gate Launcher - Replaces hardcoded gate dispatch with dynamic resolution
 * Provides safe wrapper with crash handling, timing, and error recovery
 */

import { buildRegistry, resolveHandler } from './registry.js';

// Build registry once at module load time for performance
const registryPromise = buildRegistry();

/**
 * Run all configured gates from spec in order with dynamic resolution
 * @param {object} runCtx - Run context with spec, logger, etc.
 * @returns {Promise<GateResult[]>} Array of gate execution results
 */
export async function runConfiguredGates(runCtx) {
  const registry = await registryPromise;
  const gates = Array.isArray(runCtx.spec?.gates) ? runCtx.spec.gates : [];
  const results = [];

  for (const gate of gates) {
    const handler = resolveHandler(registry, gate);
    const result = await safeRunGate(handler, runCtx, gate);
    
    // Force ID normalization - always use spec gate ID
    const finalResult = {
      ...result,
      id: gate.id  // ALWAYS use spec gate ID, ignore what gate returns
    };
    results.push(finalResult);

    // Check for early-exit condition (oversize diff)
    // Note: Early-exit was removed but keeping for potential future use
    if (result.status === 'neutral' && result.neutral_reason === 'oversize_diff') {
      runCtx.logger?.('info', `Early exit triggered by gate ${gate.id}`, { reason: 'oversize_diff' });
      break; // Stop processing remaining gates
    }
  }

  return results;
}

/**
 * Safe wrapper for gate execution with error handling and timing
 * @param {Function|null} handler - Gate handler function or null
 * @param {object} ctx - Run context
 * @param {object} gate - Gate configuration
 * @returns {Promise<object>} Normalized gate result
 */
async function safeRunGate(handler, ctx, gate) {
  const startTime = Date.now();

  try {
    // Handle unimplemented gate
    if (!handler) {
      return {
        status: 'neutral',
        neutral_reason: 'unimplemented_gate',
        violations: [],
        stats: {},
        duration_ms: 0
      };
    }

    // Execute gate handler
    const result = await handler(ctx, gate);

    // Normalize result shape (ID will be set by caller)
    return {
      status: result.status ?? 'neutral',
      neutral_reason: result.neutral_reason,
      violations: result.violations ?? [],
      stats: result.stats ?? {},
      duration_ms: Date.now() - startTime
    };

  } catch (error) {
    // Gate crashed - log error and return neutral
    ctx.logger?.('error', `Gate ${gate.id} crashed`, { error: error.message });
    
    return {
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: Date.now() - startTime
    };
  }
}