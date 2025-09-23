// test/check-contract.min.test.js
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { PR_REVIEW_NAME } from '../../src/constants.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const indexPath = path.resolve(repoRoot, 'index.js');
const indexSource = fs.readFileSync(indexPath, 'utf8');

describe('Check Contract — Minimal Drift Guard', () => {
  test('constant value is locked (branch protection)', () => {
    assert.strictEqual(
      PR_REVIEW_NAME,
      'Cogni Git PR Review',
      'PR_REVIEW_NAME must not drift — would break existing branch protection'
    );
  });

  test('app code uses constant, not literals (name + optional title)', () => {
    // Ensure import present
    assert.ok(
      /\bimport\s*\{\s*PR_REVIEW_NAME\s*\}/.test(indexSource),
      'index.js must import PR_REVIEW_NAME'
    );

    // Ensure check "name" uses the constant
    assert.ok(
      /name:\s*PR_REVIEW_NAME\b/.test(indexSource),
      'index.js must use PR_REVIEW_NAME for check name'
    );

    // Optional: enforce title uses the constant (delete this block if you don’t want to couple UI title)
    assert.ok(
      /title:\s*PR_REVIEW_NAME\b/.test(indexSource),
      'index.js should use PR_REVIEW_NAME for check title (remove this assertion if not desired)'
    );

    // No hard-coded literal in app code
    const hardLiteral = indexSource.match(/name:\s*['"]Cogni Git PR Review['"]/g);
    assert.ok(
      !hardLiteral || hardLiteral.length === 0,
      `Found ${hardLiteral?.length || 0} hard-coded 'Cogni Git PR Review' literals in index.js — use the constant`
    );
  });

  test('conclusion mapping is locked (pass|fail|neutral)', () => {
    // Require explicit cases (string search is fine for tonight)
    assert.ok(
      /case\s*['"]pass['"]\s*:\s*return\s*['"]success['"]/.test(indexSource),
      "Missing required mapping: pass → success"
    );
    assert.ok(
      /case\s*['"]fail['"]\s*:\s*return\s*['"]failure['"]/.test(indexSource),
      "Missing required mapping: fail → failure"
    );
    assert.ok(
      /case\s*['"]neutral['"]\s*:\s*return\s*['"]neutral['"]/.test(indexSource),
      "Missing required mapping: neutral → neutral"
    );
  });

  test('single mapping function/definition exists', () => {
    // Allow either `function mapStatusToConclusion` or `const mapStatusToConclusion =`
    const defs =
      (indexSource.match(/\bfunction\s+mapStatusToConclusion\b/g) || []).length +
      (indexSource.match(/\bconst\s+mapStatusToConclusion\b/g) || []).length;
    assert.strictEqual(
      defs,
      1,
      `Expected exactly one mapStatusToConclusion definition, found ${defs}`
    );
  });
});
