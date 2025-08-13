/**
 * Cogni Evaluated Gates Behavior Contract Tests - Following DRY AGENTS.md Patterns
 * Tests the 4 required behavior scenarios for the MVP using established fixtures
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

// Using fixtures from SPEC_FIXTURES (proper DRY pattern)

/**
 * Create PR payload with custom stats (using existing fixture as base)
 */
function createBehaviorPayload(prOverrides = {}) {
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
      changed_files: 5,     // Default: under limit
      additions: 30,        // 30+30 = 60, 60/3 = 20 KB (under limit)
      deletions: 30,
      ...prOverrides
    }
  };
}

describe('Cogni Evaluated Gates Behavior Contract Tests', () => {
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

  it('missing_spec_failure: No .cogni/repo-spec.yaml → conclusion=failure', async () => {
    // Follow AGENTS.md pattern: auth + 404 + check creation validation
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(404, { message: 'Not Found' })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        // Verify behavior contract: missing spec now blocks merges
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert(body.output.summary.includes("No .cogni/repo-spec.yaml found"));
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request",
      payload: createBehaviorPayload()
    });

    // Verify all mocks consumed (AGENTS.md pattern)
    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  it('valid_spec_under_limits_success: 5 files, 20 KB vs 30/100 limits → success', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.behaviorTest30_100;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        // Verify behavior contract
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.summary, "Review limits OK");
        assert(body.output.text.includes("files=5"));
        assert(body.output.text.includes("diff_kb=20"));
        assert(body.output.text.includes("✅ All review limits satisfied"));
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request", 
      payload: createBehaviorPayload({
        changed_files: 5,
        additions: 30,
        deletions: 30  // 60/3 = 20 KB
      })
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  it('valid_spec_over_files_failure: 45 files vs 30 limit → failure', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.behaviorTest30_100;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        // Verify behavior contract
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.output.summary, "Limit breaches: 1");
        assert(body.output.text.includes("files=45"));
        assert(body.output.text.includes("max_changed_files: 45 > 30"));
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request",
      payload: createBehaviorPayload({
        changed_files: 45,  // Over 30 limit
        additions: 30,
        deletions: 30  // 60/3 = 20 KB (under limit)
      })
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  it('valid_spec_over_kb_failure: 10 files, 150 KB vs 100 limit → failure', async () => {
    // Use fixture from SPEC_FIXTURES (DRY pattern)
    const specYAML = SPEC_FIXTURES.behaviorTest30_100;
    
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: { checks: "write", pull_requests: "read", metadata: "read" }
      })
      .get('/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml')
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(200, {
        type: "file",
        content: Buffer.from(specYAML).toString('base64'),
        encoding: "base64"
      })
      .post('/repos/test-org/test-repo/check-runs', (body) => {
        // Verify behavior contract
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.output.summary, "Limit breaches: 1");  
        assert(body.output.text.includes("files=10"));
        assert(body.output.text.includes("diff_kb=150"));
        assert(body.output.text.includes("max_total_diff_kb: 150 > 100"));
        return true;
      })
      .reply(200, { id: 1 });

    await probot.receive({
      name: "pull_request",
      payload: createBehaviorPayload({
        changed_files: 10,  // Under 30 limit
        additions: 225,     // 225+225 = 450, 450/3 = 150 KB (over 100 limit)  
        deletions: 225
      })
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});