/**
 * Unit tests for external gate utilities
 * Tests ZIP extraction, path normalization, and safety limits
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  normalizeFilePath, 
  determineStatus, 
  normalizeLevel, 
  capViolations, 
  processViolations,
  createNeutralResult
} from '../../src/gates/external/utils/shared.js';
import { downloadAndExtractJson } from '../../src/gates/external/utils/artifacts.js';
import { createZipArtifact, ZIP_FIXTURES } from '../helpers/createZipArtifact.js';
import { createMockWorkflowContext, MOCK_CONTEXTS } from '../mocks/createMockWorkflowContext.js';

describe('external gate utilities', () => {
  
  describe('normalizeFilePath', () => {
    
    test('preserves relative paths', () => {
      assert.strictEqual(normalizeFilePath('src/main.js'), 'src/main.js');
      assert.strictEqual(normalizeFilePath('test/unit.js'), 'test/unit.js');
      assert.strictEqual(normalizeFilePath('./src/app.js'), './src/app.js');
    });
    
    test('strips GitHub Actions Linux paths', () => {
      const githubPath = '/home/runner/work/myrepo/myrepo/src/main.js';
      assert.strictEqual(normalizeFilePath(githubPath), 'src/main.js');
      
      const dockerPath = '/github/workspace/test/unit.js';
      assert.strictEqual(normalizeFilePath(dockerPath), 'test/unit.js');
    });
    
    test('strips GitLab CI paths', () => {
      const gitlabPath = '/builds/myorg/myrepo/src/utils.js';
      assert.strictEqual(normalizeFilePath(gitlabPath), 'src/utils.js');
    });
    
    test('strips Windows CI paths', () => {
      const windowsPath = 'D:\\a\\myrepo\\myrepo\\src\\main.js';
      const normalized = normalizeFilePath(windowsPath);
      assert.strictEqual(normalized, 'src/main.js');
    });
    
    test('converts backslashes to forward slashes', () => {
      const windowsStyle = 'src\\components\\App.js';
      assert.strictEqual(normalizeFilePath(windowsStyle), 'src/components/App.js');
    });
    
    test('returns null for unnormalizable paths', () => {
      assert.strictEqual(normalizeFilePath('/etc/passwd'), null);
      assert.strictEqual(normalizeFilePath('/absolute/path'), null);
      assert.strictEqual(normalizeFilePath('C:\\\\Windows\\\\system32'), null);
      assert.strictEqual(normalizeFilePath(''), null);
      assert.strictEqual(normalizeFilePath(null), null);
      assert.strictEqual(normalizeFilePath(undefined), null);
    });
    
    test('handles repo name parameter (for future extensions)', () => {
      // Currently unused but available for more specific path stripping
      const path = '/home/runner/work/specific-repo/specific-repo/src/main.js';
      assert.strictEqual(normalizeFilePath(path), 'src/main.js');
    });
  });
  
  describe('processViolations', () => {
    
    test('normalizes paths in violations', () => {
      const rawViolations = [
        {
          code: 'rule1',
          message: 'Issue 1',
          path: 'src/main.js',
          line: 10,
          level: 'error'
        },
        {
          code: 'rule2', 
          message: 'Issue 2',
          path: '/home/runner/work/repo/repo/src/utils.js',
          line: 20,
          level: 'warning'
        }
      ];
      
      const { violations, unnormalizableCount } = processViolations(rawViolations);
      
      assert.strictEqual(violations.length, 2);
      assert.strictEqual(unnormalizableCount, 0);
      assert.strictEqual(violations[0].path, 'src/main.js');
      assert.strictEqual(violations[1].path, 'src/utils.js');
    });
    
    test('creates summary for unnormalizable paths', () => {
      const rawViolations = [
        {
          code: 'rule1',
          message: 'Good path',
          path: 'src/main.js',
          line: 10,
          level: 'error'
        },
        {
          code: 'rule2',
          message: 'Bad path',
          path: '/etc/shadow',
          line: 1,
          level: 'error'
        },
        {
          code: 'rule3',
          message: 'Another bad path', 
          path: '/usr/bin/malicious',
          line: 5,
          level: 'warning'
        }
      ];
      
      const { violations, unnormalizableCount } = processViolations(rawViolations);
      
      // Should have good violation + summary
      assert.strictEqual(violations.length, 2);
      assert.strictEqual(unnormalizableCount, 2);
      
      const goodViolation = violations[0];
      assert.strictEqual(goodViolation.path, 'src/main.js');
      assert.strictEqual(goodViolation.code, 'rule1');
      
      const summary = violations[1];
      assert.strictEqual(summary.code, 'path_normalization_failed');
      assert.strictEqual(summary.level, 'info');
      assert(summary.message.includes('2 findings with unnormalizable paths'));
      assert(summary.message.includes('/etc/shadow: Bad path (rule2)'));
      assert(summary.message.includes('/usr/bin/malicious: Another bad path (rule3)'));
      assert.strictEqual(summary.meta.unnormalizable_count, 2);
    });
  });
  
  describe('determineStatus', () => {
    
    test('fails on errors when fail_on is "errors"', () => {
      const violations = [
        { level: 'error', code: 'E001', message: 'Error' },
        { level: 'warning', code: 'W001', message: 'Warning' }
      ];
      
      assert.strictEqual(determineStatus(violations, { fail_on: 'errors' }), 'fail');
      assert.strictEqual(determineStatus(violations, {}), 'fail'); // default
    });
    
    test('passes on warnings only when fail_on is "errors"', () => {
      const violations = [
        { level: 'warning', code: 'W001', message: 'Warning' },
        { level: 'info', code: 'I001', message: 'Info' }
      ];
      
      assert.strictEqual(determineStatus(violations, { fail_on: 'errors' }), 'pass');
    });
    
    test('fails on warnings when fail_on is "warnings_or_errors"', () => {
      const violations = [
        { level: 'warning', code: 'W001', message: 'Warning' }
      ];
      
      assert.strictEqual(determineStatus(violations, { fail_on: 'warnings_or_errors' }), 'fail');
    });
    
    test('fails on any violations when fail_on is "any"', () => {
      const violations = [
        { level: 'info', code: 'I001', message: 'Info only' }
      ];
      
      assert.strictEqual(determineStatus(violations, { fail_on: 'any' }), 'fail');
    });
    
    test('always passes when fail_on is "none"', () => {
      const violations = [
        { level: 'error', code: 'E001', message: 'Error' }
      ];
      
      assert.strictEqual(determineStatus(violations, { fail_on: 'none' }), 'pass');
    });
    
    test('passes on empty violations', () => {
      assert.strictEqual(determineStatus([], { fail_on: 'errors' }), 'pass');
      assert.strictEqual(determineStatus([], { fail_on: 'any' }), 'pass');
    });
  });
  
  describe('capViolations', () => {
    
    test('returns all violations when under limit', () => {
      const violations = [
        { code: 'rule1', message: 'Issue 1' },
        { code: 'rule2', message: 'Issue 2' }
      ];
      
      const result = capViolations(violations, 10);
      
      assert.strictEqual(result.violations.length, 2);
      assert.strictEqual(result.truncated, false);
      assert.strictEqual(result.truncatedCount, 0);
    });
    
    test('truncates violations when over limit', () => {
      const violations = [];
      for (let i = 0; i < 15; i++) {
        violations.push({ code: `rule${i}`, message: `Issue ${i}` });
      }
      
      const result = capViolations(violations, 10);
      
      // Should have 10 original + 1 truncation summary
      assert.strictEqual(result.violations.length, 11);
      assert.strictEqual(result.truncated, true);
      assert.strictEqual(result.truncatedCount, 5);
      
      // Last violation should be truncation summary
      const summary = result.violations[10];
      assert.strictEqual(summary.code, 'findings_truncated');
      assert.strictEqual(summary.level, 'info');
      assert(summary.message.includes('5 additional findings truncated'));
      assert.strictEqual(summary.meta.total_findings, 15);
      assert.strictEqual(summary.meta.shown_findings, 10);
    });
    
    test('uses default limit of 1000', () => {
      const violations = new Array(500).fill().map((_, i) => ({ 
        code: `rule${i}`, 
        message: `Issue ${i}` 
      }));
      
      const result = capViolations(violations);
      
      assert.strictEqual(result.violations.length, 500);
      assert.strictEqual(result.truncated, false);
    });
  });
  
  describe('normalizeLevel', () => {
    
    test('handles numeric ESLint severity', () => {
      assert.strictEqual(normalizeLevel(0), 'info');
      assert.strictEqual(normalizeLevel(1), 'warning');
      assert.strictEqual(normalizeLevel(2), 'error');
      assert.strictEqual(normalizeLevel(3), 'error'); // ≥2 is error
    });
    
    test('handles string severity levels', () => {
      assert.strictEqual(normalizeLevel('error'), 'error');
      assert.strictEqual(normalizeLevel('ERROR'), 'error');
      assert.strictEqual(normalizeLevel('err'), 'error');
      assert.strictEqual(normalizeLevel('fatal'), 'error');
      
      assert.strictEqual(normalizeLevel('warning'), 'warning');
      assert.strictEqual(normalizeLevel('warn'), 'warning');
      assert.strictEqual(normalizeLevel('w'), 'warning');
      
      assert.strictEqual(normalizeLevel('info'), 'info');
      assert.strictEqual(normalizeLevel('note'), 'info');
      assert.strictEqual(normalizeLevel('unknown'), 'info');
      assert.strictEqual(normalizeLevel(undefined), 'info');
    });
  });
  
  describe('createNeutralResult', () => {
    
    test('creates properly formatted neutral result', () => {
      const startTime = Date.now();
      const result = createNeutralResult('timeout', 'Gate execution timed out', startTime);
      
      assert.strictEqual(result.status, 'neutral');
      assert.strictEqual(result.neutral_reason, 'timeout');
      assert.strictEqual(result.violations.length, 1);
      
      const violation = result.violations[0];
      assert.strictEqual(violation.code, 'timeout');
      assert.strictEqual(violation.message, 'Gate execution timed out');
      assert.strictEqual(violation.path, null);
      assert.strictEqual(violation.level, 'info');
      
      assert(typeof result.stats.duration_ms === 'number');
      assert(result.stats.duration_ms >= 0);
    });
    
    test('handles missing start time', () => {
      const result = createNeutralResult('parse_error', 'Invalid JSON');
      
      assert.strictEqual(result.stats.duration_ms, 0);
    });
  });
  
  describe('downloadAndExtractJson (integration)', () => {
    
    test('extracts JSON from ZIP artifact', async () => {
      const testData = { test: 'data', violations: [] };
      const zipBuffer = createZipArtifact({
        'report.json': JSON.stringify(testData)
      });
      
      const mockContext = createMockWorkflowContext({
        headSha: 'abc123def456',
        workflowRuns: [{ 
          id: 123, 
          head_sha: 'abc123def456', // Must match PR head SHA
          event: 'pull_request',
          status: 'completed',
          conclusion: 'success'
        }],
        artifacts: [{ 
          id: 456, 
          name: 'test-artifact',
          size_in_bytes: zipBuffer.length
        }],
        artifactContent: zipBuffer
      });
      
      const result = await downloadAndExtractJson({
        octokit: mockContext.octokit,
        repo: mockContext.repo,
        pr: mockContext.pr,
        artifactName: 'test-artifact',
        signal: mockContext.abort?.signal
      });
      
      assert.deepStrictEqual(result, testData);
    });
    
    test('selects specific file from ZIP when artifact_path specified', async () => {
      const eslintData = [{ filePath: 'src/main.js', messages: [] }];
      const ruffData = [{ code: 'F401', filename: 'src/utils.py' }];
      
      const zipBuffer = createZipArtifact({
        'eslint-report.json': JSON.stringify(eslintData),
        'ruff-report.json': JSON.stringify(ruffData),
        'readme.txt': 'Documentation'
      });
      
      const mockContext = createMockWorkflowContext({
        headSha: 'abc123def456',
        workflowRuns: [{ 
          id: 123, 
          head_sha: 'abc123def456',
          event: 'pull_request',
          status: 'completed',
          conclusion: 'success'
        }],
        artifacts: [{ 
          id: 456, 
          name: 'multi-report',
          size_in_bytes: zipBuffer.length
        }],
        artifactContent: zipBuffer
      });
      
      // Request specific ruff report
      const result = await downloadAndExtractJson({
        octokit: mockContext.octokit,
        repo: mockContext.repo,
        pr: mockContext.pr,
        artifactName: 'multi-report',
        artifactPath: 'ruff-report.json',
        signal: mockContext.abort?.signal
      });
      
      assert.deepStrictEqual(result, ruffData);
    });
    
    test('throws error when artifact not found', async () => {
      const mockContext = createMockWorkflowContext({
        headSha: 'abc123def456',
        workflowRuns: [{ 
          id: 123, 
          head_sha: 'abc123def456',
          event: 'pull_request',
          status: 'completed',
          conclusion: 'success'
        }],
        artifacts: [{ id: 456, name: 'different-artifact' }]
      });
      
      await assert.rejects(
        async () => {
          await downloadAndExtractJson({
            octokit: mockContext.octokit,
            repo: mockContext.repo,
            pr: mockContext.pr,
            artifactName: 'missing-artifact'
          });
        },
        /Artifact 'missing-artifact' not found/
      );
    });
    
    test('enforces size limits', async () => {
      // Create small content but mock a large artifact size
      const smallZip = createZipArtifact({
        'report.json': '[]'
      });
      
      const mockContext = createMockWorkflowContext({
        headSha: 'abc123def456',
        workflowRuns: [{ 
          id: 123, 
          head_sha: 'abc123def456',
          event: 'pull_request',
          status: 'completed',
          conclusion: 'success'
        }],
        artifacts: [{ 
          id: 456, 
          name: 'large-artifact',
          size_in_bytes: 50 * 1024 * 1024 // Mock 50MB artifact
        }],
        artifactContent: smallZip
      });
      
      await assert.rejects(
        async () => {
          await downloadAndExtractJson({
            octokit: mockContext.octokit,
            repo: mockContext.repo,
            pr: mockContext.pr,
            artifactName: 'large-artifact',
            maxSizeBytes: 1024 // Very small limit (1KB)
          });
        },
        /exceeds limit/
      );
    });
  });
});