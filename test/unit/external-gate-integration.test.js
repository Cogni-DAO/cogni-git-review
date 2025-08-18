/**
 * Integration tests for external gates end-to-end flow
 * Tests happy path with ZIP fixtures and timeout scenarios
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { run as runArtifactJson } from '../../src/gates/external/artifact-json.js';
import { run as runArtifactSarif } from '../../src/gates/external/artifact-sarif.js';
import { createZipArtifact, ZIP_FIXTURES } from '../helpers/createZipArtifact.js';
import { createMockWorkflowContext, createWorkflowRun, createArtifact } from '../mocks/createMockWorkflowContext.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test fixtures
const eslintFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/eslint-happy.json'), 'utf8'));
const ruffFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/ruff-happy.json'), 'utf8'));
const sarifFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/sarif-minimal.json'), 'utf8'));

describe('external gate integration', () => {
  
  describe('artifact-json gate', () => {
    
    // BREAKING CHANGE: ESLint JSON parsing removed in favor of universal SARIF adapter
    // ESLint now uses @microsoft/eslint-formatter-sarif and artifact.sarif runner
    test.skip('ESLint happy path end-to-end', async () => {
      // Create ZIP with ESLint results
      const zipBuffer = createZipArtifact({
        'eslint-report.json': JSON.stringify(eslintFixture)
      });
      
      // Setup mock context
      const mockContext = createMockWorkflowContext({
        repoOwner: 'testorg',
        repoName: 'testrepo',
        headSha: 'abc123def456',
        workflowRuns: [createWorkflowRun({
          id: 12345,
          headSha: 'abc123def456',
          event: 'pull_request',
          conclusion: 'success'
        })],
        artifacts: [createArtifact({
          id: 98765,
          name: 'eslint-results',
          sizeInBytes: zipBuffer.length
        })],
        artifactContent: zipBuffer
      });
      
      // Configure gate
      const gateConfig = {
        id: 'eslint',
        with: {
          artifact_name: 'eslint-results',
          parser: 'eslint_json',
          fail_on: 'errors'
        }
      };
      
      // Run gate
      const result = await runArtifactJson(mockContext, gateConfig);
      
      // Verify result structure
      assert.strictEqual(result.status, 'fail'); // Has 1 error (no-console severity 2)
      assert(Array.isArray(result.violations));
      assert.strictEqual(result.violations.length, 3);
      
      // Verify parsed violations
      const errorViolation = result.violations.find(v => v.code === 'no-console');
      assert(errorViolation);
      assert.strictEqual(errorViolation.level, 'error');
      assert.strictEqual(errorViolation.path, 'src/example.js');
      assert.strictEqual(errorViolation.line, 8);
      
      const warningViolation = result.violations.find(v => v.code === 'no-unused-vars');
      assert(warningViolation);
      assert.strictEqual(warningViolation.level, 'warning');
      
      // Verify path normalization (third violation has absolute path)
      const normalizedViolation = result.violations.find(v => v.code === 'promise/no-return-wrap');
      assert(normalizedViolation);
      assert.strictEqual(normalizedViolation.path, 'src/gates/external/artifact-json.js');
      
      // Verify stats
      assert.strictEqual(result.stats.artifact_name, 'eslint-results');
      assert.strictEqual(result.stats.parser, 'eslint_json');
      assert.strictEqual(result.stats.violations_count, 3);
      assert.strictEqual(result.stats.errors, 1);
      assert.strictEqual(result.stats.warnings, 2);
      assert(typeof result.stats.duration_ms === 'number');
    });
    
    test('Ruff happy path end-to-end', async () => {
      const zipBuffer = createZipArtifact({
        'ruff-report.json': JSON.stringify(ruffFixture)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'ruff-results' })],
        artifactContent: zipBuffer
      });
      
      const gateConfig = {
        id: 'ruff',
        with: {
          artifact_name: 'ruff-results',
          parser: 'ruff_json',
          fail_on: 'errors'
        }
      };
      
      const result = await runArtifactJson(mockContext, gateConfig);
      
      assert.strictEqual(result.status, 'fail'); // Ruff defaults to error level
      assert.strictEqual(result.violations.length, 3);
      
      // Verify Ruff-specific parsing
      const f401Violation = result.violations.find(v => v.code === 'F401');
      assert(f401Violation);
      assert.strictEqual(f401Violation.path, 'src/utils.py');
      assert.strictEqual(f401Violation.line, 3);
      assert.strictEqual(f401Violation.column, 8);
      assert(f401Violation.meta.fix);
      assert(f401Violation.meta.url);
      
      // Verify path normalization for GitHub workspace
      const e501Violation = result.violations.find(v => v.code === 'E501');
      assert(e501Violation);
      assert.strictEqual(e501Violation.path, 'src/analyzer.py');
    });
    
    test.skip('passes when fail_on is "errors" and only warnings exist', async () => {
      // Create ESLint data with only warnings (severity 1)
      const warningsOnlyData = [
        {
          filePath: 'src/clean.js',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 1,
              message: 'Warning only',
              line: 5,
              column: 1
            }
          ]
        }
      ];
      
      const zipBuffer = createZipArtifact({
        'warnings.json': JSON.stringify(warningsOnlyData)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'warnings-only' })],
        artifactContent: zipBuffer
      });
      
      const result = await runArtifactJson(mockContext, {
        with: {
          artifact_name: 'warnings-only',
          parser: 'eslint_json',
          fail_on: 'errors'
        }
      });
      
      assert.strictEqual(result.status, 'pass');
      assert.strictEqual(result.violations.length, 1);
      assert.strictEqual(result.violations[0].level, 'warning');
    });
    
    test('handles missing artifact_name configuration', async () => {
      const mockContext = createMockWorkflowContext();
      
      const result = await runArtifactJson(mockContext, {
        with: {} // Missing artifact_name
      });
      
      assert.strictEqual(result.status, 'fail');
      assert.strictEqual(result.violations.length, 1);
      assert.strictEqual(result.violations[0].code, 'missing_config');
      assert(result.violations[0].message.includes('artifact_name is required'));
    });
    
    test.skip('returns neutral when artifact not found', async () => {
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'different-artifact' })], // Wrong name
        artifactContent: Buffer.alloc(0)
      });
      
      const result = await runArtifactJson(mockContext, {
        with: {
          artifact_name: 'missing-artifact',
          parser: 'eslint_json'
        }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'missing_artifact');
      assert(result.violations[0].message.includes('not found'));
    });
    
    test.skip('handles timeout during execution', async () => {
      const abortedContext = createMockWorkflowContext({
        abortController: { 
          aborted: true,
          signal: { aborted: true }
        }
      });
      
      const result = await runArtifactJson(abortedContext, {
        with: {
          artifact_name: 'test-artifact',
          parser: 'eslint_json'
        }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'timeout');
      assert(result.violations[0].message.includes('timed out'));
    });
    
    test.skip('enforces finding limits with truncation', async () => {
      // Create many violations
      const manyViolationsData = [];
      for (let i = 0; i < 15; i++) {
        manyViolationsData.push({
          filePath: `src/file${i}.js`,
          messages: [
            {
              ruleId: `rule${i}`,
              severity: 1,
              message: `Issue ${i}`,
              line: i + 1,
              column: 1
            }
          ]
        });
      }
      
      const zipBuffer = createZipArtifact({
        'many-violations.json': JSON.stringify(manyViolationsData)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'many-violations' })],
        artifactContent: zipBuffer
      });
      
      const result = await runArtifactJson(mockContext, {
        with: {
          artifact_name: 'many-violations',
          parser: 'eslint_json',
          max_findings: 10
        }
      });
      
      // Should have 10 original + 1 truncation summary
      assert.strictEqual(result.violations.length, 11);
      assert.strictEqual(result.stats.truncated, true);
      assert.strictEqual(result.stats.truncated_count, 5);
      
      const truncationSummary = result.violations[10];
      assert.strictEqual(truncationSummary.code, 'findings_truncated');
      assert(truncationSummary.message.includes('5 additional findings truncated'));
    });
  });
  
  describe('artifact-sarif gate', () => {
    
    test('SARIF happy path end-to-end', async () => {
      const zipBuffer = createZipArtifact({
        'security-report.sarif': JSON.stringify(sarifFixture)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'security-scan' })],
        artifactContent: zipBuffer
      });
      
      const gateConfig = {
        id: 'security',
        with: {
          artifact_name: 'security-scan',
          fail_on: 'errors'
        }
      };
      
      const result = await runArtifactSarif(mockContext, gateConfig);
      
      assert.strictEqual(result.status, 'fail'); // Has error-level violation
      assert.strictEqual(result.violations.length, 3);
      
      // Verify SARIF-specific parsing
      const errorViolation = result.violations.find(v => v.code === 'js/sql-injection');
      assert(errorViolation);
      assert.strictEqual(errorViolation.level, 'error');
      assert.strictEqual(errorViolation.path, 'src/db.js'); // Path normalized
      assert.strictEqual(errorViolation.line, 28);
      assert.strictEqual(errorViolation.meta.tool, 'CodeQL');
      assert.strictEqual(errorViolation.meta.correlation_guid, '12345678-1234-5678-9012-123456789012');
      
      const warningViolation = result.violations.find(v => v.code === 'js/unused-local-variable');
      assert(warningViolation);
      assert.strictEqual(warningViolation.level, 'warning');
      
      const infoViolation = result.violations.find(v => v.code === 'js/missing-error-handling');
      assert(infoViolation);
      assert.strictEqual(infoViolation.level, 'info'); // 'note' normalized to 'info'
      assert.strictEqual(infoViolation.path, null); // No location
      
      // Verify stats
      assert.strictEqual(result.stats.sarif_version, '2.1.0');
      assert.strictEqual(result.stats.runs_count, 1);
    });
    
    test('returns neutral for invalid SARIF format', async () => {
      const invalidSarif = { invalid: 'structure' };
      const zipBuffer = createZipArtifact({
        'invalid-sarif.sarif': JSON.stringify(invalidSarif)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'invalid-sarif' })],
        artifactContent: zipBuffer
      });
      
      const result = await runArtifactSarif(mockContext, {
        with: {
          artifact_name: 'invalid-sarif'
        }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'invalid_format');
      assert(result.violations[0].message.includes('valid SARIF format'));
    });
  });
  
  describe('error handling scenarios', () => {
    
    test.skip('handles invalid JSON in artifact', async () => {
      const zipBuffer = createZipArtifact({
        'invalid.json': '{ invalid json }'
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'invalid-json' })],
        artifactContent: zipBuffer
      });
      
      const result = await runArtifactJson(mockContext, {
        with: {
          artifact_name: 'invalid-json',
          parser: 'eslint_json'
        }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'parse_error');
      assert(result.violations[0].message.includes('Failed to parse artifact JSON'));
    });
    
    // TODO: JSON gate doesn't support configurable artifact_size_mb (only SARIF gate does)
    // Either implement size limits for JSON gate or remove this test
    test.skip('handles oversized artifacts', async () => {
      // Create small valid JSON but mock large artifact size
      const smallZip = createZipArtifact({
        'report.json': '[]'
      });
      
      const headSha = 'test123sha456';
      const mockContext = createMockWorkflowContext({
        headSha,
        workflowRuns: [createWorkflowRun({ 
          headSha, // Must match context SHA
          conclusion: 'success' 
        })],
        artifacts: [createArtifact({ 
          name: 'large-artifact',
          sizeInBytes: 100 * 1024 * 1024 // Mock 100MB artifact
        })],
        artifactContent: smallZip
      });
      
      const result = await runArtifactJson(mockContext, {
        with: {
          artifact_name: 'large-artifact',
          parser: 'eslint_json',
          artifact_size_mb: 1 // 1MB limit
        }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'artifact_too_large');
      assert(result.violations[0].message.includes('exceeds limit'));
    });
    
    test.skip('handles no workflow runs found', async () => {
      const mockContext = createMockWorkflowContext({
        workflowRuns: [], // No runs
        artifacts: [],
        artifactContent: Buffer.alloc(0)
      });
      
      const result = await runArtifactJson(mockContext, {
        with: {
          artifact_name: 'any-artifact',
          parser: 'eslint_json'
        }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'missing_artifact');
      assert(result.violations[0].message.includes('not found in workflow run'));
    });
  });
});