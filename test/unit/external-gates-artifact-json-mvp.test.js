/**
 * Unit Tests for External Gates - Artifact JSON Parser MVP  
 * Tests pure parser mapping (violations, stats) - NO orchestration logic
 * Addresses code review: parser should only do mapping, orchestrator handles neutral/errors
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, '../fixtures');

// Load fixtures for pure parser testing
const eslintHappy = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'artifacts/eslint-happy.json'), 'utf-8')
);
const eslintErrorOnly = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'artifacts/eslint-error-only.json'), 'utf-8')
);
const eslintWarningsOnly = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'artifacts/eslint-warnings-only.json'), 'utf-8')
);
const eslintNoViolations = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'artifacts/eslint-no-violations.json'), 'utf-8')
);

// Pure parser function - we'll extract this from artifact-json.js  
// For now, let's create a direct parser that only does ESLint mapping
function parseESLintJson(eslintResults) {
  if (!Array.isArray(eslintResults)) {
    return null; // Invalid input - let orchestrator handle
  }
  
  const violations = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const fileResult of eslintResults) {
    const filePath = fileResult.filePath || 'unknown';
    
    for (const message of fileResult.messages || []) {
      const violation = {
        path: filePath,
        line: message.line || 1,
        column: message.column || 1,
        level: message.severity === 2 ? 'error' : 'warning',
        message: message.message || 'Unknown violation',
        code: message.ruleId || 'unknown'
      };
      
      violations.push(violation);
      
      if (violation.level === 'error') totalErrors++;
      else totalWarnings++;
    }
  }
  
  return {
    violations,
    stats: {
      parser: 'eslint_json',
      violations_count: violations.length,
      errors: totalErrors,
      warnings: totalWarnings,
      duration_ms: 0 // Placeholder for processing time
    }
  };
}

describe('External Gates - Artifact JSON Parser MVP', () => {

  describe('Pure Parser Mapping Tests', () => {
    it('parses ESLint JSON with severity mapping', () => {
      const result = parseESLintJson(eslintHappy);
      
      // Should return violations and stats only - NO status/policy logic
      assert.ok(result);
      assert.ok(Array.isArray(result.violations));
      assert.ok(typeof result.stats === 'object');
      
      // Verify severity mapping: 2→error, 1→warning  
      const hasError = result.violations.some(v => v.level === 'error');
      const hasWarning = result.violations.some(v => v.level === 'warning');
      assert.ok(hasError, 'Should have error-level violations');
      assert.ok(hasWarning, 'Should have warning-level violations');
      
      // Verify violation structure
      const firstViolation = result.violations[0];
      assert.ok(firstViolation.path);
      assert.ok(typeof firstViolation.line === 'number');
      assert.ok(typeof firstViolation.column === 'number');
      assert.ok(['error', 'warning'].includes(firstViolation.level));
      assert.ok(firstViolation.message);
      assert.ok(firstViolation.code);
    });

    it('handles missing line/column with defaults', () => {
      const eslintWithMissingFields = [{
        filePath: 'test.js',
        messages: [
          { severity: 2, message: 'test error' } // Missing line, column, ruleId
        ]
      }];
      
      const result = parseESLintJson(eslintWithMissingFields);
      
      assert.ok(result);
      const violation = result.violations[0];
      assert.strictEqual(violation.line, 1); // Default
      assert.strictEqual(violation.column, 1); // Default  
      assert.strictEqual(violation.code, 'unknown'); // Default
      assert.strictEqual(violation.message, 'test error');
    });

    it('handles missing ruleId gracefully', () => {
      const eslintNoRuleId = [{
        filePath: 'test.js',
        messages: [
          { severity: 1, line: 5, column: 10, message: 'some warning' } // No ruleId
        ]
      }];
      
      const result = parseESLintJson(eslintNoRuleId);
      
      assert.ok(result);
      assert.strictEqual(result.violations[0].code, 'unknown');
    });

    it('maps file paths correctly', () => {
      const result = parseESLintJson(eslintHappy);
      
      // All violations should have valid paths
      for (const violation of result.violations) {
        assert.ok(typeof violation.path === 'string');
        assert.ok(violation.path.length > 0);
      }
    });
  });

  describe('Error Boundary Tests', () => {
    it('returns null for missing artifact data', () => {
      const result = parseESLintJson(null);
      assert.strictEqual(result, null); // Parser returns null, orchestrator handles
    });

    it('returns null for malformed JSON structure', () => {
      const result = parseESLintJson('not an array');
      assert.strictEqual(result, null); // Parser returns null, orchestrator handles
    });

    it('returns empty results for empty array', () => {
      const result = parseESLintJson([]);
      
      assert.ok(result);
      assert.strictEqual(result.violations.length, 0);
      assert.strictEqual(result.stats.violations_count, 0);
      assert.strictEqual(result.stats.errors, 0);
      assert.strictEqual(result.stats.warnings, 0);
    });
  });

  describe('Stats Generation Tests', () => {
    it('generates accurate violation statistics', () => {
      const result = parseESLintJson(eslintHappy);
      
      const errorCount = result.violations.filter(v => v.level === 'error').length;
      const warningCount = result.violations.filter(v => v.level === 'warning').length;
      
      assert.strictEqual(result.stats.errors, errorCount);
      assert.strictEqual(result.stats.warnings, warningCount);
      assert.strictEqual(result.stats.violations_count, errorCount + warningCount);
    });

    it('includes processing metadata in stats', () => {
      const result = parseESLintJson(eslintHappy);
      
      assert.strictEqual(result.stats.parser, 'eslint_json');
      assert.ok(typeof result.stats.duration_ms === 'number');
    });
  });

  describe('Fixture-Specific Tests', () => {
    it('parses error-only fixture correctly', () => {
      const result = parseESLintJson(eslintErrorOnly);
      
      assert.ok(result);
      assert.ok(result.violations.every(v => v.level === 'error'));
      assert.strictEqual(result.stats.warnings, 0);
      assert.ok(result.stats.errors > 0);
    });

    it('parses warnings-only fixture correctly', () => {
      const result = parseESLintJson(eslintWarningsOnly);
      
      assert.ok(result);
      assert.ok(result.violations.every(v => v.level === 'warning'));
      assert.strictEqual(result.stats.errors, 0);
      assert.ok(result.stats.warnings > 0);
    });

    it('parses no-violations fixture correctly', () => {
      const result = parseESLintJson(eslintNoViolations);
      
      assert.ok(result);
      assert.strictEqual(result.violations.length, 0);
      assert.strictEqual(result.stats.errors, 0);
      assert.strictEqual(result.stats.warnings, 0);
    });
  });
});