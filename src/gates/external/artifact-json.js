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
import { resolveArtifact } from './artifact-resolver.js';

// Gate registry contract exports
export const runner = 'artifact.json';

/**
 * Registry-compatible run function for artifact.json gate
 * Handles internal artifact resolution following design principles
 * @param {object} ctx - Run context with octokit, pr, repo(), abort, logger
 * @param {object} gate - Gate configuration from spec
 * @returns {Promise<object>} Normalized gate result
 */
export async function run(ctx, gate) {
  const config = gate.with || {};
  const startTime = Date.now();

  try {
    // Check for timeout before starting
    if (ctx.abort?.aborted) {
      return createNeutralResult('timeout', 'Gate execution timed out before starting', startTime);
    }

    // Validate required configuration
    if (!config.artifact_name) {
      return {
        status: 'fail',
        violations: [{
          code: 'missing_config',
          message: 'artifact_name is required for external gates',
          path: null,
          line: null,
          column: null,
          level: 'error'
        }],
        stats: { duration_ms: Date.now() - startTime }
      };
    }

    // Resolve artifact using internal artifact resolution pattern  
    const artifactName = config.artifact_name;
    
    // Use universal context structure (repo is already resolved, pr.head.sha is normalized)
    const artifactBuffer = await resolveArtifact(
      ctx.octokit,
      ctx.repo, // Already resolved by universal context 
      ctx.workflow_run?.id,
      ctx.pr.head.sha, // Normalized by universal context
      artifactName
    );

    // Check for timeout after artifact resolution
    if (ctx.abort?.aborted) {
      return createNeutralResult('timeout', 'Gate execution timed out during artifact resolution', startTime);
    }

    // Handle missing artifact
    if (!artifactBuffer) {
      return {
        status: 'neutral',
        neutral_reason: 'missing_artifact',
        violations: [{
          code: 'missing_artifact',
          message: `Artifact '${artifactName}' not found in workflow run`,
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
      parsedData = JSON.parse(artifactBuffer.toString('utf8'));
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
    case 'ruff_json':
      return parseRuffJson(data);
    default:
      if (config.custom_mapping) {
        throw new Error('Custom mapping not implemented in v1. Use dedicated parsers: ruff_json');
      } else {
        throw new Error(`Unknown parser '${parser}'. Supported parsers: ruff_json`);
      }
  }
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