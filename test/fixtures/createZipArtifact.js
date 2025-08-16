/**
 * Test helper for creating ZIP artifacts for external gate testing
 */

import AdmZip from 'adm-zip';

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
    return createSingleFileZip('eslint-report.json', JSON.parse(`[
      {
        "filePath": "src/example.js",
        "messages": [
          {
            "ruleId": "no-unused-vars",
            "severity": 1,
            "message": "'unused' is defined but never used",
            "line": 5,
            "column": 7,
            "nodeType": "Identifier"
          }
        ],
        "errorCount": 0,
        "warningCount": 1
      }
    ]`));
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
    return createSingleFileZip('report.json', '{ "malformed": json }');
  },
  
  get empty() {
    return createZipArtifact({});
  },
  
  get multipleFiles() {
    return createZipArtifact({
      'eslint.json': '[]',
      'ruff.json': '[]',
      'readme.txt': 'Multiple files in ZIP'
    });
  }
};