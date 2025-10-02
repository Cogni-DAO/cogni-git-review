/**
 * Mock Logger Utilities for Tests
 * Provides reusable logger mocks to eliminate duplication across test files
 */

/**
 * Create a capturing logger that records all log calls for test assertions
 * @returns {Object} Logger with captured calls array
 */
export function createCapturingLogger() {
  const logCalls = [];
  
  const logger = {
    debug: (msg, meta) => { logCalls.push({ level: 'debug', msg, meta }); },
    info: (msg, meta) => { logCalls.push({ level: 'info', msg, meta }); },
    warn: (msg, meta) => { logCalls.push({ level: 'warn', msg, meta }); },
    error: (msg, meta) => { logCalls.push({ level: 'error', msg, meta }); },
    child: () => logger // Return self for .child() calls
  };

  // Attach the logCalls array for test assertions
  logger.getCalls = () => logCalls;
  logger.clearCalls = () => logCalls.length = 0;

  return logger;
}

/**
 * Create a simple noop logger for tests that don't need capturing
 * @returns {Object} Logger that does nothing
 */
export function createNoopLogger() {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => createNoopLogger()
  };
}