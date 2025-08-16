/**
 * Shared utilities for external gates
 * Path normalization, status determination, and common helpers
 */

/**
 * Normalize file paths from CI environments to repo-relative paths
 * @param {string} filePath - Raw file path from linter output
 * @param {string} [repoName] - Repository name for path stripping
 * @returns {string|null} Normalized path or null if unnormalizable
 */
export function normalizeFilePath(filePath, repoName) {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  // Already relative path - just normalize backslashes
  if (!filePath.startsWith('/') && !filePath.match(/^[A-Z]:\\/)) {
    return filePath.replace(/\\/g, '/');
  }

  let normalized = filePath;

  // Strip common Linux CI prefixes
  const linuxPatterns = [
    /^\/home\/runner\/work\/[^\/]+\/[^\/]+\//,  // GitHub Actions
    /^\/github\/workspace\//,                    // Docker-based CI
    /^\/builds\/[^\/]+\/[^\/]+\//               // GitLab CI
  ];

  for (const pattern of linuxPatterns) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '');
      break;
    }
  }

  // Strip common Windows CI prefixes  
  const windowsPatterns = [
    /^[A-Z]:\\a\\[^\\]+\\[^\\]+\\/,  // GitHub Actions Windows
    /^[A-Z]:\\builds\\[^\\]+\\[^\\]+\\/ // GitLab CI Windows
  ];

  for (const pattern of windowsPatterns) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '');
      break;
    }
  }

  // Convert backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');

  // If still absolute or empty, it's unnormalizable
  if (!normalized || normalized.startsWith('/') || normalized.match(/^[A-Z]:/)) {
    return null;
  }

  return normalized;
}

/**
 * Determine gate status based on violations and configuration
 * @param {Array} violations - Array of violation objects
 * @param {object} config - Gate configuration
 * @returns {string} Gate status (pass, fail, neutral)
 */
export function determineStatus(violations, config) {
  const failOn = config.fail_on || 'errors';
  
  switch (failOn) {
    case 'errors':
      return violations.some(v => v.level === 'error') ? 'fail' : 'pass';
    case 'warnings_or_errors':
      return violations.some(v => v.level === 'error' || v.level === 'warning') ? 'fail' : 'pass';
    case 'any':
      return violations.length > 0 ? 'fail' : 'pass';
    case 'none':
      return 'pass';
    default:
      return 'pass';
  }
}

/**
 * Normalize severity level from tool-specific format
 * @param {string|number} severity - Tool-specific severity
 * @returns {string} Normalized level (error, warning, info)
 */
export function normalizeLevel(severity) {
  if (typeof severity === 'number') {
    if (severity >= 2) return 'error';
    if (severity === 1) return 'warning';
    return 'info';
  }
  
  const level = String(severity).toLowerCase();
  if (['error', 'err', 'e', 'fatal'].includes(level)) return 'error';
  if (['warning', 'warn', 'w'].includes(level)) return 'warning';
  return 'info';
}

/**
 * Cap violations array and create summary for truncated findings
 * @param {Array} violations - All violations found
 * @param {number} maxFindings - Maximum findings to include
 * @returns {object} Capped violations and truncation info
 */
export function capViolations(violations, maxFindings = 1000) {
  if (violations.length <= maxFindings) {
    return {
      violations,
      truncated: false,
      truncatedCount: 0
    };
  }

  const capped = violations.slice(0, maxFindings);
  const truncatedCount = violations.length - maxFindings;

  // Add a summary violation for the truncated findings
  const truncationSummary = {
    code: 'findings_truncated',
    message: `${truncatedCount} additional findings truncated (showing first ${maxFindings})`,
    path: null,
    line: null,
    column: null,
    level: 'info',
    meta: {
      total_findings: violations.length,
      shown_findings: maxFindings,
      truncated_findings: truncatedCount
    }
  };

  return {
    violations: [...capped, truncationSummary],
    truncated: true,
    truncatedCount
  };
}

/**
 * Create a neutral result with standardized format
 * @param {string} reason - Neutral reason code
 * @param {string} message - Human readable message
 * @param {number} [startTime] - Start timestamp for duration calculation
 * @returns {object} Neutral gate result
 */
export function createNeutralResult(reason, message, startTime) {
  return {
    status: 'neutral',
    neutral_reason: reason,
    violations: [{
      code: reason,
      message,
      path: null,
      line: null,
      column: null,
      level: 'info'
    }],
    stats: { 
      duration_ms: startTime ? Date.now() - startTime : 0
    }
  };
}

/**
 * Create standardized violation objects with path normalization
 * @param {Array} rawViolations - Raw violations from parser
 * @param {string} [repoName] - Repository name for path normalization
 * @returns {object} Processed violations with normalization info
 */
export function processViolations(rawViolations, repoName) {
  const processedViolations = [];
  const unnormalizablePaths = [];

  for (const violation of rawViolations) {
    const normalizedPath = normalizeFilePath(violation.path, repoName);
    
    if (normalizedPath === null && violation.path) {
      // Track unnormalizable paths for summary
      unnormalizablePaths.push({
        original: violation.path,
        violation: violation
      });
      continue; // Skip inline annotation for unnormalizable paths
    }

    processedViolations.push({
      ...violation,
      path: normalizedPath
    });
  }

  // Add summary for unnormalizable paths
  if (unnormalizablePaths.length > 0) {
    const pathSummary = unnormalizablePaths.map(p => 
      `${p.original}: ${p.violation.message} (${p.violation.code})`
    ).join('\n');

    processedViolations.push({
      code: 'path_normalization_failed',
      message: `${unnormalizablePaths.length} findings with unnormalizable paths:\n${pathSummary}`,
      path: null,
      line: null,
      column: null,
      level: 'info',
      meta: {
        unnormalizable_count: unnormalizablePaths.length,
        unnormalizable_paths: unnormalizablePaths.map(p => p.original)
      }
    });
  }

  return {
    violations: processedViolations,
    unnormalizableCount: unnormalizablePaths.length
  };
}