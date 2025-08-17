/**
 * Unit tests for artifact-sarif.js parser
 * Tests SARIF parsing with level normalization and location handling
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Since we can't easily test internal functions, let's test the main run function instead
import { run } from '../../src/gates/external/artifact-sarif.js';
import { createZipArtifact } from '../helpers/createZipArtifact.js';
import { 
  createMockWorkflowContext, 
  createWorkflowRun, 
  createArtifact 
} from '../mocks/createMockWorkflowContext.js';

// For testing internal parsing logic, we'll test through the public interface

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load test fixtures
const sarifFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/sarif-minimal.json'), 'utf8'));
const gitleaksFixture = JSON.parse(await readFile(join(__dirname, '../fixtures/artifacts/gitleaks.sarif'), 'utf8'));

describe('artifact-sarif parser', () => {
  
  describe('SARIF parsing via run function', () => {
    
    test('parses generic SARIF format correctly', async () => {
      const zipBuffer = createZipArtifact({
        'test.sarif': JSON.stringify(sarifFixture)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'test.sarif' })],
        artifactContent: zipBuffer
      });
      
      const result = await run(mockContext, {
        with: { artifact_name: 'test.sarif' }
      });
      
      // Should have 3 violations (2 with locations, 1 without)
      assert.strictEqual(result.violations.length, 3);
      assert.strictEqual(result.status, 'fail'); // Has error level
      
      // Test first violation (warning with location)
      const firstViolation = result.violations.find(v => v.code === 'js/unused-local-variable');
      assert(firstViolation);
      assert.strictEqual(firstViolation.message, "Unused local variable 'temp'.");
      assert.strictEqual(firstViolation.path, 'src/main.js');
      assert.strictEqual(firstViolation.line, 15);
      assert.strictEqual(firstViolation.column, 9);
      assert.strictEqual(firstViolation.level, 'warning');
      assert.strictEqual(firstViolation.meta.tool, 'CodeQL');
      
      // Test second violation (error with absolute path, gets normalized)
      const secondViolation = result.violations.find(v => v.code === 'js/sql-injection');
      assert(secondViolation);
      assert.strictEqual(secondViolation.level, 'error');
      assert.strictEqual(secondViolation.path, 'src/db.js'); // Path normalized from absolute
      assert.strictEqual(secondViolation.line, 28);
      assert.strictEqual(secondViolation.column, 5);
      
      // Test third violation (note level, no location)
      const thirdViolation = result.violations.find(v => v.code === 'js/missing-error-handling');
      assert(thirdViolation);
      assert.strictEqual(thirdViolation.level, 'info'); // 'note' normalizes to 'info'
      assert.strictEqual(thirdViolation.path, null);
      assert.strictEqual(thirdViolation.line, null);
    });
    
    test('parses Gitleaks SARIF output correctly', async () => {
      const zipBuffer = createZipArtifact({
        'gitleaks.sarif': JSON.stringify(gitleaksFixture)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'gitleaks.sarif' })],
        artifactContent: zipBuffer
      });
      
      const result = await run(mockContext, {
        with: { artifact_name: 'gitleaks.sarif' }
      });
      
      // Should have 2 violations
      assert.strictEqual(result.violations.length, 2);
      assert.strictEqual(result.status, 'fail'); // Has error level secrets
      assert.strictEqual(result.stats.artifact_name, 'gitleaks.sarif');
      assert.strictEqual(result.stats.sarif_version, '2.1.0');
      
      // Test AWS access key detection (error level)
      const awsViolation = result.violations.find(v => v.code === 'aws-access-key');
      assert(awsViolation);
      assert.strictEqual(awsViolation.level, 'error');
      assert.strictEqual(awsViolation.path, 'src/config.js');
      assert.strictEqual(awsViolation.line, 12);
      assert.strictEqual(awsViolation.meta.tool, 'gitleaks');
      assert(awsViolation.message.includes('aws-access-key'));
      
      // Test generic API key detection (warning level)
      const apiViolation = result.violations.find(v => v.code === 'generic-api-key');
      assert(apiViolation);
      assert.strictEqual(apiViolation.level, 'warning');
      assert.strictEqual(apiViolation.path, 'scripts/deploy.sh');
      assert.strictEqual(apiViolation.line, 44);
    });
    
    test('handles missing artifact gracefully', async () => {
      const mockContext = createMockWorkflowContext({
        workflowRuns: [], // No workflow runs
        artifacts: [],
        artifactContent: Buffer.alloc(0)
      });
      
      const result = await run(mockContext, {
        with: { artifact_name: 'missing.sarif' }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'missing_artifact');
      assert(result.violations[0].message.includes('No suitable workflow run found'));
    });
    
    test('handles invalid SARIF format', async () => {
      const invalidSarif = { invalid: 'structure' };
      const zipBuffer = createZipArtifact({
        'invalid.sarif': JSON.stringify(invalidSarif)
      });
      
      const mockContext = createMockWorkflowContext({
        workflowRuns: [createWorkflowRun({ conclusion: 'success' })],
        artifacts: [createArtifact({ name: 'invalid.sarif' })],
        artifactContent: zipBuffer
      });
      
      const result = await run(mockContext, {
        with: { artifact_name: 'invalid.sarif' }
      });
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'invalid_format');
      assert(result.violations[0].message.includes('valid SARIF format'));
    });
  });
});