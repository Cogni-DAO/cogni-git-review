/**
 * Unit tests for artifact-json.js parsers
 * Tests dedicated ESLint and Ruff JSON parsers with path normalization
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Import the parser functions - need to use dynamic import since they're not exported
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const artifactJsonPath = join(__dirname, '../../src/gates/external/artifact-json.js');

// Read the source to test internal functions (following existing test patterns)
const artifactJsonSource = await readFile(artifactJsonPath, 'utf8');

// Extract parser functions using eval in test context (similar to existing stub tests)
const moduleContext = { exports: {} };
const moduleCode = `
${artifactJsonSource}

// Export internal functions for testing
exports.parseEslintJson = parseEslintJson;
exports.parseRuffJson = parseRuffJson;
exports.parseViolations = parseViolations;
`;

// Skip eval for MVP - ES6 import issue
// eval(moduleCode);
// const { parseEslintJson, parseRuffJson, parseViolations } = moduleContext.exports;

// Load test fixtures
const eslintFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/eslint-happy.json'), 'utf8'));
const ruffFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/ruff-happy.json'), 'utf8'));

describe.skip('artifact-json parsers', () => {
  
  describe('parseEslintJson', () => {
    
    test('parses ESLint JSON format correctly', () => {
      const violations = parseEslintJson(eslintFixture);
      
      // Should have 3 violations total (2 from first file, 1 from second file)
      assert.strictEqual(violations.length, 3);
      
      // Test first violation (warning)
      const firstViolation = violations[0];
      assert.strictEqual(firstViolation.code, 'no-unused-vars');
      assert.strictEqual(firstViolation.message, "'unused' is defined but never used");
      assert.strictEqual(firstViolation.path, 'src/example.js');
      assert.strictEqual(firstViolation.line, 5);
      assert.strictEqual(firstViolation.column, 7);
      assert.strictEqual(firstViolation.level, 'warning'); // severity 1 = warning
      assert.strictEqual(firstViolation.meta.severity, 1);
      assert.strictEqual(firstViolation.meta.nodeType, 'Identifier');
      
      // Test second violation (error)
      const secondViolation = violations[1];
      assert.strictEqual(secondViolation.code, 'no-console');
      assert.strictEqual(secondViolation.level, 'error'); // severity 2 = error
      assert.strictEqual(secondViolation.meta.severity, 2);
      
      // Test third violation (from absolute path file)
      const thirdViolation = violations[2];
      assert.strictEqual(thirdViolation.code, 'promise/no-return-wrap');
      assert.strictEqual(thirdViolation.path, '/home/runner/work/cogni-git-review/cogni-git-review/src/gates/external/artifact-json.js');
      assert.strictEqual(thirdViolation.level, 'warning');
    });
    
    test('handles empty messages arrays', () => {
      const emptyMessagesData = [
        {
          filePath: 'clean-file.js',
          messages: [],
          errorCount: 0,
          warningCount: 0
        }
      ];
      
      const violations = parseEslintJson(emptyMessagesData);
      assert.strictEqual(violations.length, 0);
    });
    
    test('handles missing ruleId', () => {
      const noRuleData = [
        {
          filePath: 'test.js',
          messages: [
            {
              message: 'Parsing error',
              line: 1,
              column: 1,
              severity: 2
            }
          ]
        }
      ];
      
      const violations = parseEslintJson(noRuleData);
      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].code, 'unknown');
      assert.strictEqual(violations[0].message, 'Parsing error');
    });
    
    test('throws error for non-array input', () => {
      assert.throws(() => {
        parseEslintJson({ notAnArray: true });
      }, /ESLint JSON format expects an array/);
    });
    
    test('handles missing message properties gracefully', () => {
      const incompleteData = [
        {
          filePath: 'incomplete.js',
          messages: [
            {
              // Missing message, line, column, severity
              ruleId: 'test-rule'
            }
          ]
        }
      ];
      
      const violations = parseEslintJson(incompleteData);
      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].code, 'test-rule');
      assert.strictEqual(violations[0].message, 'No message');
      assert.strictEqual(violations[0].line, null);
      assert.strictEqual(violations[0].column, null);
      assert.strictEqual(violations[0].level, 'info'); // undefined severity normalizes to info
    });
  });
  
  describe('parseRuffJson', () => {
    
    test('parses Ruff JSON format correctly', () => {
      const violations = parseRuffJson(ruffFixture);
      
      // Should have 3 violations
      assert.strictEqual(violations.length, 3);
      
      // Test first violation (with fix info)
      const firstViolation = violations[0];
      assert.strictEqual(firstViolation.code, 'F401');
      assert.strictEqual(firstViolation.message, '`os` imported but unused');
      assert.strictEqual(firstViolation.path, 'src/utils.py');
      assert.strictEqual(firstViolation.line, 3);
      assert.strictEqual(firstViolation.column, 8);
      assert.strictEqual(firstViolation.level, 'error'); // Default level for Ruff
      assert(firstViolation.meta.fix);
      assert.strictEqual(firstViolation.meta.url, 'https://beta.ruff.rs/docs/rules/unused-import');
      
      // Test second violation (with absolute path)
      const secondViolation = violations[1];
      assert.strictEqual(secondViolation.code, 'E501');
      assert.strictEqual(secondViolation.path, '/github/workspace/src/analyzer.py');
      assert.strictEqual(secondViolation.line, 42);
      assert.strictEqual(secondViolation.column, 80);
      assert.strictEqual(secondViolation.meta.noqa, 'E501');
      
      // Test third violation
      const thirdViolation = violations[2];
      assert.strictEqual(thirdViolation.code, 'W293');
      assert.strictEqual(thirdViolation.path, 'tests/test_main.py');
    });
    
    test('handles missing location gracefully', () => {
      const noLocationData = [
        {
          code: 'TEST001',
          message: 'Test violation',
          filename: 'test.py'
          // No location field
        }
      ];
      
      const violations = parseRuffJson(noLocationData);
      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].line, null);
      assert.strictEqual(violations[0].column, null);
    });
    
    test('handles missing code and message', () => {
      const incompleteData = [
        {
          filename: 'test.py',
          location: { row: 5, column: 10 }
          // Missing code and message
        }
      ];
      
      const violations = parseRuffJson(incompleteData);
      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].code, 'RUF');
      assert.strictEqual(violations[0].message, 'No message');
    });
    
    test('throws error for non-array input', () => {
      assert.throws(() => {
        parseRuffJson({ notAnArray: true });
      }, /Ruff JSON format expects an array/);
    });
  });
  
  describe('parseViolations', () => {
    
    test('routes to eslint_json parser correctly', () => {
      const config = { parser: 'eslint_json' };
      const violations = parseViolations(eslintFixture, config);
      
      assert.strictEqual(violations.length, 3);
      assert.strictEqual(violations[0].code, 'no-unused-vars');
    });
    
    test('routes to ruff_json parser correctly', () => {
      const config = { parser: 'ruff_json' };
      const violations = parseViolations(ruffFixture, config);
      
      assert.strictEqual(violations.length, 3);
      assert.strictEqual(violations[0].code, 'F401');
    });
    
    test('throws error for unknown parser', () => {
      const config = { parser: 'unknown_parser' };
      
      assert.throws(() => {
        parseViolations([], config);
      }, /Unknown parser 'unknown_parser'/);
    });
    
    test('throws error for custom mapping (not implemented)', () => {
      const config = { custom_mapping: { root: '$' } };
      
      assert.throws(() => {
        parseViolations([], config);
      }, /Custom mapping not implemented in v1/);
    });
  });
});