/**
 * Artifact SARIF Gate - SARIF 2.1.0 format parser
 * Downloads ZIP artifacts from GitHub Actions and extracts SARIF reports
 */

import { downloadAndExtractJson } from './utils/artifacts.js';
import { 
  determineStatus, 
  normalizeLevel, 
  capViolations, 
  createNeutralResult,
  processViolations 
} from './utils/shared.js';

// Gate registry contract exports
export const runner = 'artifact.sarif';

/**
 * Registry-compatible run function for artifact.sarif gate
 * @param {object} ctx - Run context with octokit, pr, etc.
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
    const artifactName = config.artifact_name;
    if (!artifactName) {
      return {
        status: 'fail',
        violations: [{
          code: 'missing_config',
          message: 'artifact_name is required in gate configuration',
          path: null,
          line: null,
          column: null,
          level: 'error'
        }],
        stats: { duration_ms: Date.now() - startTime }
      };
    }

    // Download and extract SARIF from ZIP artifact
    const sarifData = await downloadAndExtractJson({
      octokit: ctx.octokit,
      repo: ctx.repo,
      pr: ctx.pr,
      artifactName,
      artifactPath: config.artifact_path,
      signal: ctx.abort?.signal,
      maxSizeBytes: (config.artifact_size_mb || 25) * 1024 * 1024
    });

    if (ctx.abort?.aborted) {
      return createNeutralResult('timeout', 'Gate execution timed out during artifact processing', startTime);
    }

    // Validate SARIF format
    if (!sarifData.version || !sarifData.runs || !Array.isArray(sarifData.runs)) {
      return createNeutralResult('invalid_format', 'Artifact does not appear to be valid SARIF format (missing version or runs)', startTime);
    }

    // Parse violations from SARIF format
    const rawViolations = parseSarifViolations(sarifData, config);

    // Process violations with path normalization
    const repoName = ctx.pr.head.repo.name;
    const { violations: processedViolations } = processViolations(rawViolations, repoName);

    // Apply finding limits
    const maxFindings = config.max_findings || 1000;
    const { violations: cappedViolations, truncated, truncatedCount } = capViolations(processedViolations, maxFindings);

    // Determine status based on violations and config
    const status = determineStatus(cappedViolations, config);

    return {
      status,
      violations: cappedViolations,
      stats: {
        artifact_name: artifactName,
        sarif_version: sarifData.version,
        runs_count: sarifData.runs.length,
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

    // Artifact or parsing errors
    if (error.message.includes('not found') || error.message.includes('No JSON') || error.message.includes('No suitable workflow run')) {
      return createNeutralResult('missing_artifact', error.message, startTime);
    }

    if (error.message.includes('exceeds') || error.message.includes('too large')) {
      return createNeutralResult('artifact_too_large', error.message, startTime);
    }

    if (error.message.includes('parse') || error.message.includes('JSON')) {
      return createNeutralResult('parse_error', error.message, startTime);
    }

    // Log unexpected errors
    ctx.logger?.('error', `Artifact SARIF gate crashed: ${error.message}`);
    
    return createNeutralResult('internal_error', `Unexpected error: ${error.message}`, startTime);
  }
}

/**
 * Parse violations from SARIF report
 * @param {object} sarifReport - Parsed SARIF report
 * @param {object} config - Gate configuration
 * @returns {Array} Array of violation objects
 */
function parseSarifViolations(sarifReport, config) {
  const violations = [];

  if (!sarifReport.runs || !Array.isArray(sarifReport.runs)) {
    throw new Error('SARIF format error: runs must be an array');
  }

  for (const run of sarifReport.runs) {
    const tool = run.tool || {};
    const driver = tool.driver || {};
    
    for (const result of run.results || []) {
      // Extract basic violation info
      const ruleId = result.ruleId || 'unknown';
      const message = result.message?.text || result.message?.markdown || 'No message';
      const level = normalizeSarifLevel(result.level);

      // Extract location information - SARIF can have multiple locations per result
      const locations = result.locations || [];
      
      if (locations.length === 0) {
        // Result without location - still report it
        violations.push({
          code: ruleId,
          message,
          path: null,
          line: null,
          column: null,
          level,
          meta: {
            tool: driver.name || 'unknown',
            tool_version: driver.version,
            rule_index: result.ruleIndex,
            kind: result.kind,
            sarif_level: result.level,
            correlation_guid: result.correlationGuid
          }
        });
      } else {
        // Process each location
        for (const location of locations) {
          const physicalLocation = location.physicalLocation;
          if (!physicalLocation) continue;

          const artifactLocation = physicalLocation.artifactLocation;
          const region = physicalLocation.region;

          violations.push({
            code: ruleId,
            message,
            path: artifactLocation?.uri || null,
            line: region?.startLine || null,
            column: region?.startColumn || null,
            level,
            meta: {
              tool: driver.name || 'unknown',
              tool_version: driver.version,
              rule_index: result.ruleIndex,
              kind: result.kind,
              sarif_level: result.level,
              correlation_guid: result.correlationGuid,
              region: {
                endLine: region?.endLine,
                endColumn: region?.endColumn,
                charOffset: region?.charOffset,
                charLength: region?.charLength
              }
            }
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Normalize SARIF severity level to standard format
 * @param {string} sarifLevel - SARIF level (error, warning, note, info, none)
 * @returns {string} Normalized level (error, warning, info)
 */
function normalizeSarifLevel(sarifLevel) {
  // Use shared normalizeLevel utility which handles various formats
  return normalizeLevel(sarifLevel);
}

