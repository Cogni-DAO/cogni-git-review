import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import yaml from 'js-yaml';
import { run } from '../../src/gates/cogni/governance-policy.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';
import { loadRepoSpec } from '../../src/spec-loader.js';
import { PR_REVIEW_NAME } from '../../src/constants.js';
import { noopLogger } from '../../src/logging/logger.js';
import { createNoopLogger } from '../helpers/mock-logger.js';
import { createMockContextWithSpec } from '../helpers/handler-harness.js';

describe('Governance Policy Gate', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      repo: () => ({ owner: 'test-org', repo: 'test-repo' }),
      log: {
        error: () => {}
      },
      octokit: {
        repos: {
          getContent: async ({ path }) => {
            // Mock workflow file contents based on path
            const mockFiles = {
              '.github/workflows/ci.yaml': 'name: CI - PR\non:\n  pull_request:\n',
              '.github/workflows/security.yaml': 'name: Security\non:\n  pull_request:\n'
            };
            
            if (mockFiles[path]) {
              return {
                data: {
                  content: Buffer.from(mockFiles[path]).toString('base64')
                }
              };
            } else {
              const error = new Error('Not found');
              error.status = 404;
              throw error;
            }
          }
        }
      }
    };
  });

  test('passes when all required workflows exist with matching names', async () => {
    // Parse YAML first, following spec-loader.test.js pattern
    const expectedSpec = yaml.load(SPEC_FIXTURES.governance);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.violations.length, 0);
    assert.strictEqual(result.stats.contexts_checked, 2); // Excludes self-exempt "Cogni Git PR Review"
    assert.deepStrictEqual(result.stats.exempt_contexts, [PR_REVIEW_NAME]);
  });

  test('fails when workflow file is missing', async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.governance);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    // Mock missing security workflow
    mockContext.octokit.repos.getContent = async ({ path }) => {
      if (path === '.github/workflows/security.yaml') {
        const error = new Error('Not found');
        error.status = 404;
        throw error;
      }
      
      const mockFiles = {
        '.github/workflows/ci.yaml': 'name: CI - PR\non:\n  pull_request:\n',
        '.github/workflows/security.yaml': 'name: Security\non:\n  push:\n'
      };
      
      if (mockFiles[path]) {
        return {
          data: {
            content: Buffer.from(mockFiles[path]).toString('base64')
          }
        };
      } else {
        const error = new Error('Not found');
        error.status = 404;
        throw error;
      }
    };

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].code, 'workflow_missing');
    assert.strictEqual(result.violations[0].meta.context, 'Security');
  });

  test('fails when workflow name does not match required context', async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.governance);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    // Mock CI workflow with wrong name
    mockContext.octokit.repos.getContent = async ({ path }) => {
      const mockFiles = {
        '.github/workflows/ci.yaml': 'name: Wrong Name\non:\n  pull_request:\n',
        '.github/workflows/security.yaml': 'name: Security\non:\n  pull_request:\n'
      };
      
      if (mockFiles[path]) {
        return {
          data: {
            content: Buffer.from(mockFiles[path]).toString('base64')
          }
        };
      } else {
        const error = new Error('Not found');
        error.status = 404;
        throw error;
      }
    };

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].code, 'workflow_name_mismatch');
    assert.strictEqual(result.violations[0].meta.expected_name, 'CI - PR');
    assert.strictEqual(result.violations[0].meta.actual_name, 'Wrong Name');
  });

  test('returns neutral when no required contexts are specified', async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.governanceNoContexts);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'neutral');
    assert.strictEqual(result.neutral_reason, 'no_contexts_required');
    assert.strictEqual(result.stats.contexts_checked, 0);
  });

  test('exempts Cogni Git PR Review from checks', async () => {
    const inlineSpec = `schema_version: '0.1.4'

intent:
  name: governance-self-exempt-project
  goals:
    - Test self-exemption behavior
  non_goals:
    - Testing non-exempt contexts

required_status_contexts:
  - ${PR_REVIEW_NAME}

gates:
  - type: governance-policy
    id: governance_policy`;
    const expectedSpec = yaml.load(inlineSpec);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'neutral');
    assert.strictEqual(result.neutral_reason, 'no_contexts_required');
    assert.strictEqual(result.stats.contexts_checked, 0);
  });

  test('handles unknown contexts gracefully', async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.governanceUnknownContext);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 1);
    assert.strictEqual(result.violations[0].code, 'unknown_context');
    assert.strictEqual(result.violations[0].meta.context, 'Unknown Context');
  });

  test('handles GitHub API errors gracefully', async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.governance);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    mockContext.octokit.repos.getContent = async () => {
      const error = new Error('API Error');
      error.status = 500;
      throw error;
    };

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'fail');
    assert.strictEqual(result.violations.length, 2); // All 2 contexts fail
    assert(result.violations.every(v => v.code === 'workflow_check_error'));
  });

  test('handles internal errors gracefully', async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.governance);
    const specResult = await loadRepoSpec(createMockContextWithSpec(expectedSpec), createNoopLogger());
    mockContext.spec = specResult.spec;

    // Mock an internal error by breaking the repo function
    mockContext.repo = () => {
      throw new Error('Internal error');
    };

    const result = await run(mockContext, {}, createNoopLogger());

    assert.strictEqual(result.status, 'neutral');
    assert.strictEqual(result.neutral_reason, 'internal_error');
    assert.strictEqual(result.violations.length, 0);
    assert(typeof result.stats.error === 'string');
  });
});

