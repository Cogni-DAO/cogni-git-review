/**
 * Artifact JSON Gate - JSON artifact parser with dedicated parsers for common tools
 * Downloads ZIP artifacts from GitHub Actions and extracts JSON reports
 */

import { 
  determineStatus, 
  normalizeLevel, 
  capViolations, 
  createNeutralResult,
  processViolations 
} from './utils/shared.js';

// Gate registry contract exports
export const runner = 'artifact.json';

/**
 * Registry-compatible run function for artifact.json gate
 * @param {object} ctx - Run context with octokit, pr, etc.
 * @param {object} gate - Gate configuration from spec
 * @param {Buffer} artifactData - Pre-resolved artifact JSON data
 * @returns {Promise<object>} Normalized gate result
 */
export async function run(ctx, gate, artifactData) {
  const config = gate.with || {};
  const startTime = Date.now();

  try {
    // Check for timeout before starting
    if (ctx.abort?.aborted) {
      return createNeutralResult('timeout', 'Gate execution timed out before starting', startTime);
    }

    // Validate artifact data is provided
    if (!artifactData) {
      return {
        status: 'neutral',
        neutral_reason: 'missing_artifact',
        violations: [{
          code: 'missing_artifact',
          message: 'No artifact data provided to parser',
          path: null,
          line: null,
          column: null,
          level: 'info'
        }],
        stats: { duration_ms: Date.now() - startTime }
      };
    }

    // Parse artifact data as JSON
    let parsedData;
    try {
      parsedData = JSON.parse(artifactData.toString('utf8'));
    } catch (parseError) {
      return createNeutralResult('parse_error', `Failed to parse artifact JSON: ${parseError.message}`, startTime);
    }

    if (ctx.abort?.aborted) {
      return createNeutralResult('timeout', 'Gate execution timed out during artifact processing', startTime);
    }

    // Parse violations using dedicated parsers
    const rawViolations = parseViolations(parsedData, config);

    // Process violations with path normalization
    const { violations: processedViolations } = processViolations(rawViolations);

    // Apply finding limits
    const maxFindings = config.max_findings || 1000;
    const { violations: cappedViolations, truncated, truncatedCount } = capViolations(processedViolations, maxFindings);

    // Determine status based on violations and config
    const status = determineStatus(cappedViolations, config);

    return {
      status,
      violations: cappedViolations,
      stats: {
        artifact_name: config.artifact_name || 'unknown',
        parser: config.parser || 'custom',
        violations_count: processedViolations.length,
        errors: cappedViolations.filter(v => v.level === 'error').length,
        warnings: cappedViolations.filter(v => v.level === 'warning').length,
        truncated,
        truncated_count: truncatedCount,
        duration_ms: Date.now() - startTime
      }
    };

  } catch (error) {
    // Handle specific error types
    if (ctx.abort?.aborted || error.message === 'aborted') {
      return createNeutralResult('timeout', 'Gate execution timed out', startTime);
    }

    // Parsing errors
    if (error.message.includes('parse') || error.message.includes('JSON')) {
      return createNeutralResult('parse_error', error.message, startTime);
    }

    // Log unexpected errors
    ctx.logger?.('error', `Artifact JSON gate crashed: ${error.message}`);
    
    return createNeutralResult('internal_error', `Unexpected error: ${error.message}`, startTime);
  }
}

/**
 * Parse violations from JSON data using dedicated parsers
 * @param {object|Array} data - Parsed JSON data from artifact
 * @param {object} config - Gate configuration
 * @returns {Array} Array of violation objects
 */
function parseViolations(data, config) {
  const parser = config.parser;
  
  switch (parser) {
    case 'eslint_json':
      return parseEslintJson(data);
    case 'ruff_json':
      return parseRuffJson(data);
    default:
      if (config.custom_mapping) {
        throw new Error('Custom mapping not implemented in v1. Use dedicated parsers: eslint_json, ruff_json');
      } else {
        throw new Error(`Unknown parser '${parser}'. Supported parsers: eslint_json, ruff_json`);
      }
  }
}

/**
 * Parse ESLint JSON format: Array<{filePath, messages[]}>
 * @param {Array} eslintResults - ESLint results array
 * @returns {Array} Normalized violations
 */
function parseEslintJson(eslintResults) {
  const violations = [];
  
  if (!Array.isArray(eslintResults)) {
    throw new Error('ESLint JSON format expects an array of file results');
  }
  
  for (const fileResult of eslintResults) {
    const filePath = fileResult.filePath;
    const messages = fileResult.messages || [];
    
    for (const message of messages) {
      violations.push({
        code: message.ruleId || 'unknown',
        message: message.message || 'No message',
        path: filePath,
        line: Number(message.line) || null,
        column: Number(message.column) || null,
        level: normalizeLevel(message.severity),
        meta: {
          severity: message.severity,
          nodeType: message.nodeType,
          source: message.source,
          endLine: message.endLine,
          endColumn: message.endColumn
        }
      });
    }
  }
  
  return violations;
}

/**
 * Parse Ruff JSON format: Array<{filename, location, code, message}>  
 * @param {Array} ruffResults - Ruff results array
 * @returns {Array} Normalized violations
 */
function parseRuffJson(ruffResults) {
  const violations = [];
  
  if (!Array.isArray(ruffResults)) {
    throw new Error('Ruff JSON format expects an array of violation objects');
  }
  
  for (const result of ruffResults) {
    const location = result.location || {};
    
    violations.push({
      code: result.code || 'RUF',
      message: result.message || 'No message',
      path: result.filename,
      line: Number(location.row) || null,
      column: Number(location.column) || null,
      level: normalizeLevel(result.level || 'error'), // Ruff defaults to error
      meta: {
        fix: result.fix,
        url: result.url,
        noqa: result.noqa,
        location: location
      }
    });
  }
  
  return violations;
}