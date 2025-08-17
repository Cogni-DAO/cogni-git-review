/**
 * Test helper for creating ZIP artifacts for external gate testing
 */

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load JSON fixture from artifacts directory
 * @param {string} filename - Fixture filename
 * @returns {object} Parsed JSON content
 */
function loadFixture(filename) {
  const fixturePath = path.join(__dirname, 'artifacts', filename);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

/**
 * Create a ZIP buffer from file contents map
 * @param {Record<string, string>} files - Map of filename to content
 * @returns {Buffer} ZIP file buffer
 * 
 * @example
 * const zipBuffer = createZipArtifact({
 *   'reports/eslint.json': JSON.stringify(eslintResults),
 *   'logs/debug.txt': 'Debug information'
 * });
 */
export function createZipArtifact(files) {
  const zip = new AdmZip();
  
  for (const [filename, content] of Object.entries(files)) {
    if (typeof content === 'string') {
      zip.addFile(filename, Buffer.from(content, 'utf8'));
    } else if (Buffer.isBuffer(content)) {
      zip.addFile(filename, content);
    } else {
      // Assume it's JSON-serializable
      zip.addFile(filename, Buffer.from(JSON.stringify(content, null, 2), 'utf8'));
    }
  }
  
  return zip.toBuffer();
}

/**
 * Create a ZIP buffer with a single JSON file
 * @param {string} filename - Name of file in ZIP
 * @param {object|string} content - JSON content
 * @returns {Buffer} ZIP file buffer
 */
export function createSingleFileZip(filename, content) {
  return createZipArtifact({
    [filename]: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  });
}

/**
 * Pre-built artifact fixtures as ZIP buffers
 */
export const ZIP_FIXTURES = {
  get eslintHappy() {
    return createSingleFileZip('eslint-report.json', loadFixture('eslint-happy.json'));
  },
  
  get eslintErrorOnly() {
    return createSingleFileZip('eslint-report.json', loadFixture('eslint-error-only.json'));
  },
  
  get eslintWarningsOnly() {
    return createSingleFileZip('eslint-report.json', loadFixture('eslint-warnings-only.json'));
  },
  
  get eslintNoViolations() {
    return createSingleFileZip('eslint-report.json', loadFixture('eslint-no-violations.json'));
  },
  
  get eslintManyViolations() {
    return createSingleFileZip('eslint-report.json', loadFixture('eslint-many-violations.json'));
  },
  
  get ruffHappy() {
    return createSingleFileZip('ruff-report.json', JSON.parse(`[
      {
        "code": "F401",
        "message": "\`os\` imported but unused",
        "filename": "src/utils.py",
        "location": { "row": 3, "column": 8 }
      }
    ]`));
  },
  
  get sarifMinimal() {
    return createSingleFileZip('security-report.sarif', JSON.parse(`{
      "version": "2.1.0",
      "runs": [
        {
          "tool": { "driver": { "name": "TestTool" } },
          "results": [
            {
              "ruleId": "test-rule",
              "level": "error",
              "message": { "text": "Test violation" },
              "locations": [
                {
                  "physicalLocation": {
                    "artifactLocation": { "uri": "src/test.js" },
                    "region": { "startLine": 1, "startColumn": 1 }
                  }
                }
              ]
            }
          ]
        }
      ]
    }`));
  },
  
  get invalidJson() {
    return createSingleFileZip('report.json', loadFixture('invalid.json'));
  },
  
  get empty() {
    return createZipArtifact({});
  },
  
  get multipleFiles() {
    return createZipArtifact({
      'eslint.json': JSON.stringify(loadFixture('eslint-happy.json')),
      'ruff.json': '[]',
      'readme.txt': 'Multiple files in ZIP'
    });
  }
};

/**
 * Mock GitHub API responses for testing (consolidated from zip-helpers.js)
 */
export const mockResponses = {
  /**
   * Mock workflow run artifacts response
   */
  workflowRunArtifacts: (artifactId = 123, artifactName = 'eslint-report') => ({
    total_count: 1,
    artifacts: [
      {
        id: artifactId,
        name: artifactName,
        size_in_bytes: 1024,
        url: `https://api.github.com/repos/test/repo/actions/artifacts/${artifactId}`,
        archive_download_url: `https://api.github.com/repos/test/repo/actions/artifacts/${artifactId}/zip`,
        expired: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        expires_at: '2023-01-08T00:00:00Z'
      }
    ]
  }),

  /**
   * Mock workflow runs response 
   */
  workflowRuns: (runId = 456, headSha = 'abc123') => ({
    total_count: 1,
    workflow_runs: [
      {
        id: runId,
        head_sha: headSha,
        status: 'completed',
        conclusion: 'success',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }
    ]
  }),

  /**
   * Mock pull request response
   */
  pullRequest: (number = 1, headSha = 'abc123') => ({
    id: 1,
    number,
    head: {
      sha: headSha,
      repo: {
        name: 'test-repo',
        owner: { login: 'test-owner' }
      }
    },
    base: {
      sha: 'def456'
    },
    changed_files: 2,
    additions: 10,
    deletions: 5
  }),

  /**
   * Mock check run response
   */
  checkRun: (id = 789, headSha = 'abc123') => ({
    id,
    head_sha: headSha,
    status: 'in_progress',
    name: 'Cogni Git PR Review',
    check_suite: { id: 101 },
    url: `https://api.github.com/repos/test/repo/check-runs/${id}`,
    html_url: `https://github.com/test/repo/pull/1/checks`
  })
};