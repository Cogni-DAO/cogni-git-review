// src/logging/index.js
import { makeLogger, noopLogger } from "./logger.js";

export const appLogger = makeLogger({ service: "cogni-git-review" });
export const noop = noopLogger;

/**
 * Create request-scoped logger from Probot context
 * @param {import('../adapters/base-context.d.ts').BaseContext} context - Base context interface with log and payload
 * @param {Object} bindings - Additional structured data to bind
 * @returns {Object} Pino logger instance
 */
export function getRequestLogger(context, bindings = {}) {
  // Always use appLogger (with Loki transport) instead of Probot's context.log
  return appLogger.child({ 
    id: context?.id || 'unknown',
    repo: context?.payload?.repository?.full_name,
    ...bindings 
  });
}