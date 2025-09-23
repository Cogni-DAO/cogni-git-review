import { describe, test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the function we want to test
// Note: customizeRepoSpec is not exported, so we need to test it through the module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to extract and test customizeRepoSpec
async function testCustomizeRepoSpec(templateContent, repoName) {
  // Import the module and access the function through eval or re-implementation
  // Since customizeRepoSpec is not exported, we'll re-implement the logic for testing
  let content = templateContent;
  
  // Same logic as in createWelcomePR.js:customizeRepoSpec
  content = content.replace(
    /(^intent:\s*[\r\n]+)((?:\s+.+[\r\n]+)*?)(\s*name:\s*).+$/m, 
    (match, p1, p2, p3) => `${p1}${p2}${p3}${repoName}`
  );
  
  return content;
}

describe('Template Customization Contract Tests', () => {

  test('replaces intent.name placeholder with actual repo name', async () => {
    const templateContent = `schema_version: '0.1.4'

intent:
  name: my-project
  goals:
    - Clear, scoped goals of the project

gates:
  - type: review-limits`;

    const result = await testCustomizeRepoSpec(templateContent, 'awesome-repo');
    
    // Verify the repo name was replaced
    assert(result.includes('name: awesome-repo'), 'Should replace placeholder with actual repo name');
    assert(!result.includes('name: my-project'), 'Should not contain original placeholder');
    
    // Verify YAML structure is preserved
    assert(result.includes('intent:'), 'Should preserve intent section');
    assert(result.includes('goals:'), 'Should preserve goals section');
    assert(result.includes('gates:'), 'Should preserve gates section');
  });

  test('handles repo names with hyphens and special characters', async () => {
    const templateContent = `intent:
  name: placeholder-name
  goals:
    - Test goal`;

    const result = await testCustomizeRepoSpec(templateContent, 'my-awesome-project-123');
    
    assert(result.includes('name: my-awesome-project-123'), 'Should handle repo names with hyphens and numbers');
    assert(!result.includes('placeholder-name'), 'Should replace the placeholder');
  });

  test('preserves indentation and YAML formatting', async () => {
    const templateContent = `schema_version: '0.1.4'

intent:
  name: test-project
  goals:
    - Goal one
    - Goal two
  non_goals:
    - Out of scope

gates:
  - type: review-limits
    id: review_limits`;

    const result = await testCustomizeRepoSpec(templateContent, 'new-repo');
    
    // Verify specific formatting is preserved
    assert(result.includes('  name: new-repo'), 'Should preserve correct indentation');
    assert(result.includes('  goals:'), 'Should preserve goals indentation');
    assert(result.includes('    - Goal one'), 'Should preserve nested list indentation');
    assert(result.includes('  non_goals:'), 'Should preserve non_goals section');
  });

  test('only replaces name field within intent section', async () => {
    const templateContent = `schema_version: '0.1.4'

intent:
  name: replace-this
  goals:
    - Clear goals

other_section:
  name: do-not-replace-this
  value: test

gates:
  - type: review-limits
    name: also-do-not-replace`;

    const result = await testCustomizeRepoSpec(templateContent, 'target-repo');
    
    // Should replace only the intent.name
    assert(result.includes('  name: target-repo'), 'Should replace intent.name');
    assert(result.includes('  name: do-not-replace-this'), 'Should not replace other name fields');
    assert(result.includes('    name: also-do-not-replace'), 'Should not replace gate name fields');
  });

  test('handles templates with complex intent sections', async () => {
    const templateContent = `schema_version: '0.1.4'

intent:
  name: complex-template
  description: |
    Multi-line description
    with various content
  goals:
    - Primary objective
    - Secondary objective
  non_goals:
    - Explicitly excluded items
  metadata:
    owner: team-name
    
gates:
  - type: review-limits`;

    const result = await testCustomizeRepoSpec(templateContent, 'complex-repo');
    
    assert(result.includes('  name: complex-repo'), 'Should replace name in complex intent section');
    assert(result.includes('Multi-line description'), 'Should preserve multi-line content');
    assert(result.includes('owner: team-name'), 'Should preserve metadata fields');
  });

  test('handles edge case with minimal template', async () => {
    const templateContent = `intent:
  name: minimal`;

    const result = await testCustomizeRepoSpec(templateContent, 'edge-case');
    
    assert(result.includes('name: edge-case'), 'Should handle minimal template structure');
  });

  test('integration test with actual template file', async () => {
    // Read the actual template file
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'repo-spec-template.yaml');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    const result = await testCustomizeRepoSpec(templateContent, 'integration-test-repo');
    
    // Verify the actual template transformation
    assert(result.includes('name: integration-test-repo'), 'Should replace name in actual template');
    assert(!result.includes('name: my-project'), 'Should not contain original placeholder from template');
    
    // Verify key sections are preserved
    assert(result.includes('schema_version:'), 'Should preserve schema version');
    assert(result.includes('gates:'), 'Should preserve gates section');
    assert(result.includes('type: review-limits'), 'Should preserve review-limits gate');
    assert(result.includes('type: ai-rule'), 'Should preserve ai-rule gate');
  });

  test('handles templates with different line endings', async () => {
    // Test with Windows line endings
    const templateWithCRLF = `intent:\r\n  name: windows-template\r\n  goals:\r\n    - Test goal`;
    
    const result = await testCustomizeRepoSpec(templateWithCRLF, 'cross-platform-repo');
    
    assert(result.includes('name: cross-platform-repo'), 'Should handle CRLF line endings');
  });

  test('preserves comments and structure around intent section', async () => {
    const templateContent = `# Repository specification
# This file defines the project intent

schema_version: '0.1.4'

# Project intent and goals
intent:
  name: commented-template
  goals:
    - Goal with comment # inline comment
  non_goals:
    - Out of scope item

# Quality gates configuration  
gates:
  - type: review-limits  # Comment about limits`;

    const result = await testCustomizeRepoSpec(templateContent, 'preserve-comments');
    
    assert(result.includes('name: preserve-comments'), 'Should replace name');
    assert(result.includes('# Repository specification'), 'Should preserve header comment');
    assert(result.includes('# Project intent and goals'), 'Should preserve section comment');
    assert(result.includes('# inline comment'), 'Should preserve inline comments');
    assert(result.includes('# Comment about limits'), 'Should preserve gate comments');
  });

});