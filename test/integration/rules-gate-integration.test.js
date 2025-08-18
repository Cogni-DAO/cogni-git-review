/**
 * Real Integration Test for Rules Gate
 * 
 * Tests complete webhook → spec loading → gate registry → rules gate → check creation flow
 * Following integration test pattern from test/integration/AGENTS.md
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import nock from "nock";
import { Probot } from "probot";
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import myProbotApp from "../../index.js";
import { clearSpecCache } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';
import pullRequestOpenedPayload from '../fixtures/pull_request.opened.complete.json' assert { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "..", "fixtures");
const privateKey = fs.readFileSync(path.join(fixturesPath, "mock-cert.pem"), "utf-8");

describe('Rules Gate Integration Tests', () => {
  let probot;

  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache();
    probot = new Probot({ 
      appId: 123456, 
      privateKey,
      secret: "test"
    });
    probot.load(myProbotApp);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('webhook with rules gate enabled creates check with rules evaluation', async () => {
    // Mock GitHub API calls following existing pattern
    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, { 
        token: "ghs_test_token",
        expires_at: "2099-01-01T00:00:00Z",
        permissions: {
          checks: "write",
          contents: "read",
          metadata: "read",
          pull_requests: "read"
        }
      })
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.rulesMvpIntegration).toString('base64'),
        encoding: "base64"
      })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Basic verification - just ensure key fields exist
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, pullRequestOpenedPayload.pull_request.head.sha);
        assert.strictEqual(body.status, "completed");
        assert.ok(['success', 'failure', 'neutral'].includes(body.conclusion));
        assert.strictEqual(typeof body.output, "object");
        assert.strictEqual(typeof body.output.title, "string");
        assert.strictEqual(typeof body.output.summary, "string");
        return true;
      })
      .reply(201, { 
        id: 999999999, 
        status: "completed",
        conclusion: "neutral"
      });

    // Send webhook and verify flow
    await probot.receive({ 
      name: "pull_request", 
      payload: pullRequestOpenedPayload 
    });

    // Verify all mocks were consumed
    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test('webhook with missing rules directory handles gracefully', async () => {
    // Create spec with invalid rules directory
    const specWithInvalidRulesDir = SPEC_FIXTURES.rulesMvpIntegration.replace(
      'rules_dir: .cogni/rules',
      'rules_dir: /nonexistent/rules'
    );

    const mocks = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, { 
        token: "ghs_test_token",
        expires_at: "2099-01-01T00:00:00Z",
        permissions: {
          checks: "write",
          contents: "read", 
          metadata: "read",
          pull_requests: "read"
        }
      })
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file", 
        content: Buffer.from(specWithInvalidRulesDir).toString('base64'),
        encoding: 'base64'
      })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Basic verification - should handle missing rules gracefully
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, pullRequestOpenedPayload.pull_request.head.sha);
        assert.strictEqual(body.status, "completed");
        assert.ok(['success', 'failure', 'neutral'].includes(body.conclusion));
        assert.strictEqual(typeof body.output, "object");
        return true;
      })
      .reply(201, { 
        id: 999999998, 
        status: "completed",
        conclusion: "neutral"
      });

    await probot.receive({ 
      name: "pull_request", 
      payload: pullRequestOpenedPayload 
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});