/**
 * Unit Tests for External Gates - Artifact JSON Parser MVP
 * Tests artifact-json.js parser using existing fixtures and DRY principles
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { run } from '../../src/gates/external/artifact-json.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, '../fixtures');

// Load existing ESLint fixture
const eslintHappy = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, 'artifacts/eslint-happy.json'), 'utf-8')
);

describe('External Gates - Artifact JSON Parser MVP', () => {
  let mockContext;
  
  beforeEach(() => {
    mockContext = {
      abort: { aborted: false },
      logger: () => {} // Silent logger for tests
    };
  });

  describe('ESLint JSON Parsing with Existing Fixtures', () => {
    it('parses existing ESLint fixture correctly', async () => {
      const artifactData = Buffer.from(JSON.stringify(eslintHappy));
      
      const gate = {
        with: {
          parser: 'eslint_json',
          artifact_name: 'eslint-report',
          fail_on: 'errors'
        }
      };
      
      const result = await run(mockContext, gate, artifactData);
      
      assert.strictEqual(result.status, 'fail'); // Has severity 2 error
      assert.ok(result.violations.length >= 1);
      
      // Find the error violation (severity 2)
      const errorViolation = result.violations.find(v => v.level === 'error');
      assert.ok(errorViolation, 'Should have error-level violation');
      assert.strictEqual(errorViolation.code, 'no-console');
      assert.ok(errorViolation.message.includes('console statement'));
      assert.strictEqual(errorViolation.path, 'src/example.js');
      assert.strictEqual(errorViolation.line, 8);
      assert.strictEqual(errorViolation.column, 3);
    });

    it('handles warnings vs errors with fail_on policy', async () => {
      const artifactData = Buffer.from(JSON.stringify(eslintHappy));
      
      const gate = {
        with: {
          parser: 'eslint_json',
          fail_on: 'warnings_or_errors' // Should fail on both
        }
      };
      
      const result = await run(mockContext, gate, artifactData);
      
      assert.strictEqual(result.status, 'fail');
      assert.ok(result.violations.some(v => v.level === 'error'));
      assert.ok(result.violations.some(v => v.level === 'warning'));
    });

    it('passes warnings-only when fail_on=errors', async () => {
      // Create warnings-only fixture
      const warningsOnly = eslintHappy.map(file => ({
        ...file,
        messages: file.messages.filter(msg => msg.severity === 1), // Only warnings
        errorCount: 0
      }));
      
      const artifactData = Buffer.from(JSON.stringify(warningsOnly));
      
      const gate = {
        with: {
          parser: 'eslint_json',
          fail_on: 'errors' // Should pass since no errors
        }
      };
      
      const result = await run(mockContext, gate, artifactData);
      
      assert.strictEqual(result.status, 'pass');
      assert.ok(result.violations.length > 0); // Still has warnings
      assert.ok(result.violations.every(v => v.level === 'warning'));
    });
  });

  describe('Error Handling', () => {
    it('handles missing artifact data', async () => {
      const gate = {
        with: {
          parser: 'eslint_json',
          fail_on: 'errors'
        }
      };
      
      const result = await run(mockContext, gate, null);
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'missing_artifact');
    });

    it('handles malformed JSON', async () => {
      const artifactData = Buffer.from('{ invalid json }');
      const gate = {
        with: {
          parser: 'eslint_json',
          fail_on: 'errors'
        }
      };
      
      const result = await run(mockContext, gate, artifactData);
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'parse_error');
    });

    it('handles timeout/abort signal', async () => {
      mockContext.abort.aborted = true;
      
      const gate = {
        with: {
          parser: 'eslint_json',
          fail_on: 'errors'
        }
      };
      
      const result = await run(mockContext, gate, Buffer.from('[]'));
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'timeout');
    });
  });

  describe('Stats Generation', () => {
    it('includes comprehensive stats in result', async () => {
      const artifactData = Buffer.from(JSON.stringify(eslintHappy));
      
      const gate = {
        with: {
          parser: 'eslint_json',
          artifact_name: 'test-artifact',
          fail_on: 'errors'
        }
      };
      
      const result = await run(mockContext, gate, artifactData);
      
      assert.strictEqual(result.stats.artifact_name, 'test-artifact');
      assert.strictEqual(result.stats.parser, 'eslint_json');
      assert.ok(result.stats.violations_count >= 1);
      assert.ok(result.stats.errors >= 1);
      assert.ok(result.stats.warnings >= 1);
      assert.ok(typeof result.stats.duration_ms === 'number');
    });
  });
});