// src/logging/index.js
import { makeLogger, noopLogger } from "./logger.js";

export const appLogger = makeLogger({ service: "cogni-git-review" });
export const noop = noopLogger;

/**
 * Create request-scoped logger from Probot context
 * @param {Object} context - Probot context with log and payload
 * @param {Object} bindings - Additional structured data to bind
 * @returns {Object} Pino logger instance
 */
export function getRequestLogger(context, bindings = {}) {
  // Prefer Probot's context.log (already a Pino child) over appLogger
  const base = context?.log?.child ? context.log : appLogger;
  
  return base.child({ 
    id: context?.id || 'unknown',
    repo: context?.payload?.repository?.full_name,
    ...bindings 
  });
}
