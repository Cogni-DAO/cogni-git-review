/**
 * Spec-Gate Consistency Tests - Following AGENTS.md DRY Patterns
 * Tests the core "presence = enabled" semantics of list-of-gates architecture
 * Validates that gate count matches spec configuration exactly
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import nock from 'nock';
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import app from "../../index.js";
import { clearSpecCache } from '../../src/spec-loader.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");
const privateKey = fs.readFileSync(path.join(fixturesPath, "mock-cert.pem"), "utf-8");

// Load complete webhook payload fixture (following AGENTS.md pattern)
const prOpenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.opened.complete.json"), "utf-8"),
);

/**
 * Create PR payload with custom stats (using existing fixture as base)
 */
function createConsistencyPayload(prOverrides = {}) {
  return {
    ...prOpenedComplete,
    repository: {
      ...prOpenedComplete.repository,
      name: "test-repo",
      owner: { login: "test-org" }
    },
    pull_request: {
      ...prOpenedComplete.pull_request,
      head: { 
        ...prOpenedComplete.pull_request.head,
        sha: "abc123def456789012345678901234567890abcd" 
      },
      changed_files: 5,     // Default: under all limits
      additions: 30,        // 30+30 = 60, 60/3 = 20 KB (under limits)
      deletions: 30,
      ...prOverrides
    }
  };
}

describe('Spec-Gate Consistency Tests', () => {
  let probot;

  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache();
    probot = new Probot({
      appId: 123456,
      privateKey,
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false }
      })
    });
    probot.load(app);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
  });

  it('1 gate configured → exactly 1 gate executes', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.gateConsistency1Gate;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        const outputText = body.output.text;
        
        // Verify exactly 1 gate executed by checking the text format
        assert(outputText.includes("Gates: 1 total"), 
          "Should execute exactly 1 gate");
        
        // Verify correct gate is mentioned in passed section
        assert(outputText.includes("review_limits"), 
          "Should execute review_limits gate");
        
        // Verify other gates are NOT mentioned in the output
        assert(!outputText.includes('goal_declaration_stub'), 
          "Should not execute goal_declaration_stub when not configured");
        assert(!outputText.includes('forbidden_scopes_stub'), 
          "Should not execute forbidden_scopes_stub when not configured");
        
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request", 
      payload: createConsistencyPayload()
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  it('2 gates configured → exactly 2 gates execute', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.gateConsistency2Gates;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        const outputText = body.output.text;
        
        // Verify exactly 2 gates executed by checking the text format
        assert(outputText.includes("Gates: 2 total"), 
          "Should execute exactly 2 gates");
        
        // Verify correct gates are mentioned in passed section
        assert(outputText.includes("review_limits"), 
          "Should execute review_limits gate");
        assert(outputText.includes("goal_declaration_stub"), 
          "Should execute goal_declaration_stub gate");
        
        // Verify forbidden_scopes_stub is NOT mentioned
        assert(!outputText.includes('forbidden_scopes_stub'), 
          "Should not execute forbidden_scopes_stub when not configured");
        
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request", 
      payload: createConsistencyPayload()
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  it('3 gates configured → exactly 3 gates execute', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.gateConsistency3Gates;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        const outputText = body.output.text;
        
        // Verify exactly 3 gates executed by checking the text format
        assert(outputText.includes("Gates: 3 total"), 
          "Should execute exactly 3 gates");
        
        // Verify all gates are mentioned in passed section
        assert(outputText.includes("review_limits"), 
          "Should execute review_limits gate");
        assert(outputText.includes("goal_declaration_stub"), 
          "Should execute goal_declaration_stub gate");
        assert(outputText.includes("forbidden_scopes_stub"), 
          "Should execute forbidden_scopes_stub gate");
        
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request", 
      payload: createConsistencyPayload()
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  it('2 gates without review_limits → exactly 2 gates execute (validates dynamic discovery)', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.gateConsistency2GatesNoLimits;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        const outputText = body.output.text;
        
        // Verify exactly 2 gates executed by checking the text format
        assert(outputText.includes("Gates: 2 total"), 
          "Should execute exactly 2 gates");
        
        // Verify correct gates are mentioned (NO review_limits) 
        assert(outputText.includes("goal_declaration_stub"), 
          "Should execute goal_declaration_stub gate");
        assert(outputText.includes("forbidden_scopes_stub"), 
          "Should execute forbidden_scopes_stub gate");
        
        // Verify review_limits is NOT mentioned - this validates dynamic discovery
        assert(!outputText.includes('review_limits'), 
          "Should not execute review_limits when not configured");
        
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request", 
      payload: createConsistencyPayload()
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});