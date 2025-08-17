/**
 * Integration Tests for External Gates MVP
 * Tests event-driven external gates using existing fixtures and DRY principles
 */

import nock from "nock";
import myProbotApp from "../../index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearSpecCache } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";
import { createZipArtifact } from "../helpers/createZipArtifact.js";

import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");

const privateKey = fs.readFileSync(
  path.join(fixturesPath, "mock-cert.pem"),
  "utf-8",
);

// Load complete webhook payload fixtures
const prOpenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.opened.complete.json"), "utf-8"),
);

// Load existing ESLint artifact fixtures
const eslintHappy = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "artifacts/eslint-happy.json"), "utf-8"),
);

describe("External Gates MVP", () => {
  let probot;
  let checkId = 123456789;

  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache();
    probot = new Probot({
      appId: 123456,
      privateKey,
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    probot.load(myProbotApp);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
    // Clear global check state map
    if (global.checkStateMap) {
      global.checkStateMap.clear();
    }
  });

  test("pull_request.opened creates in_progress check and skips external gates", async () => {
    const mocks = nock("https://api.github.com")
      // Mock GitHub App authentication
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        expires_at: "2030-01-01T00:00:00Z",
      })
      // Mock repo spec loading
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        content: Buffer.from(SPEC_FIXTURES.withExternalGate).toString("base64"),
        encoding: "base64",
      })
      // Mock check creation - expect in_progress status
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "in_progress");
        assert.ok(body.output.summary.includes("Evaluating gates"));
        return true;
      })
      .reply(201, {
        id: checkId,
        head_sha: "abc123def456789012345678901234567890abcd",
        status: "in_progress",
      });

    await probot.receive({
      name: "pull_request",
      payload: prOpenedComplete,
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("workflow_run.completed updates check with ESLint results", async () => {
    // Simulate stored check state from PR event
    global.checkStateMap = global.checkStateMap || new Map();
    global.checkStateMap.set("abc123def456789012345678901234567890abcd", checkId);

    const mocks = nock("https://api.github.com")
      // Mock GitHub App authentication
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        expires_at: "2030-01-01T00:00:00Z",
      })
      // Mock repo spec loading
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        content: Buffer.from(SPEC_FIXTURES.withExternalGate).toString("base64"),
        encoding: "base64",
      })
      // Mock PR lookup for head_sha matching
      .get("/repos/derekg1729/cogni-git-review/pulls")
      .query({ state: "open" })
      .reply(200, [
        {
          number: 1,
          head: { sha: "abc123def456789012345678901234567890abcd" },
          base: { sha: "def456" },
          changed_files: 2,
          additions: 10,
          deletions: 5,
        },
      ])
      // Mock current PR fetch for staleness check
      .get("/repos/derekg1729/cogni-git-review/pulls/1")
      .reply(200, {
        number: 1,
        head: { sha: "abc123def456789012345678901234567890abcd" },
        base: { sha: "def456" },
        changed_files: 2,
        additions: 10,
        deletions: 5,
      })
      // Mock workflow run artifacts
      .get("/repos/derekg1729/cogni-git-review/actions/runs/456789/artifacts")
      .reply(200, {
        total_count: 1,
        artifacts: [
          {
            id: 987654,
            name: "eslint-report",
            size_in_bytes: 1024,
          },
        ],
      })
      // Mock artifact download
      .get("/repos/derekg1729/cogni-git-review/actions/artifacts/987654/zip")
      .reply(200, () => {
        return createZipArtifact(JSON.stringify(eslintHappy), "eslint-report.json");
      })
      // Mock check update - expect failure due to ESLint error
      .patch(`/repos/derekg1729/cogni-git-review/check-runs/${checkId}`, (body) => {
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure");
        assert.ok(body.output.summary.includes("Gate failures"));
        assert.ok(Array.isArray(body.annotations));
        assert.ok(body.annotations.length > 0);
        
        // Verify annotation contains ESLint finding
        const errorAnnotation = body.annotations.find(a => a.annotation_level === "failure");
        assert.ok(errorAnnotation, "Should have error-level annotation");
        assert.ok(errorAnnotation.message.includes("no-console"));
        
        return true;
      })
      .reply(200, {
        id: checkId,
        status: "completed",
        conclusion: "failure",
      });

    // Create workflow_run.completed payload
    const workflowRunPayload = {
      action: "completed",
      workflow_run: {
        id: 456789,
        name: "ESLint",
        head_sha: "abc123def456789012345678901234567890abcd",
        status: "completed",
        conclusion: "success", // This should be ignored - status from artifact only
      },
      repository: {
        id: 987654321,
        name: "cogni-git-review",
        full_name: "derekg1729/cogni-git-review",
        owner: {
          login: "derekg1729",
          id: 123456,
        },
        default_branch: "main",
      },
      installation: {
        id: 12345678,
      },
    };

    await probot.receive({
      name: "workflow_run",
      payload: workflowRunPayload,
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("workflow_run.completed ignores stale runs (head_sha mismatch)", async () => {
    global.checkStateMap = global.checkStateMap || new Map();
    global.checkStateMap.set("old_sha_123", checkId);

    const mocks = nock("https://api.github.com")
      // Mock GitHub App authentication
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        expires_at: "2030-01-01T00:00:00Z",
      })
      // Mock PR lookup - returns PR with different head_sha
      .get("/repos/derekg1729/cogni-git-review/pulls")
      .query({ state: "open" })
      .reply(200, [
        {
          number: 1,
          head: { sha: "old_sha_123" }, // Different from workflow run
        },
      ])
      // Mock current PR fetch - head has changed
      .get("/repos/derekg1729/cogni-git-review/pulls/1")
      .reply(200, {
        number: 1,
        head: { sha: "new_sha_456" }, // Current head is different
      });
    
    // No artifact or check update calls should happen
    
    const workflowRunPayload = {
      action: "completed",
      workflow_run: {
        id: 456789,
        name: "ESLint",
        head_sha: "old_sha_123", // Stale SHA - should be ignored
        status: "completed",
      },
      repository: {
        id: 987654321,
        name: "cogni-git-review",
        full_name: "derekg1729/cogni-git-review",
        owner: { login: "derekg1729", id: 123456 },
        default_branch: "main",
      },
      installation: {
        id: 12345678,
      },
    };

    await probot.receive({
      name: "workflow_run",
      payload: workflowRunPayload,
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("workflow_run.completed creates neutral status for missing artifacts", async () => {
    global.checkStateMap = global.checkStateMap || new Map();
    global.checkStateMap.set("abc123def456789012345678901234567890abcd", checkId);

    const mocks = nock("https://api.github.com")
      // Mock GitHub App authentication
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        expires_at: "2030-01-01T00:00:00Z",
      })
      // Mock repo spec loading
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        content: Buffer.from(SPEC_FIXTURES.withExternalGate).toString("base64"),
        encoding: "base64",
      })
      // Mock PR lookup
      .get("/repos/derekg1729/cogni-git-review/pulls")
      .query({ state: "open" })
      .reply(200, [
        {
          number: 1,
          head: { sha: "abc123def456789012345678901234567890abcd" },
        },
      ])
      // Mock current PR fetch
      .get("/repos/derekg1729/cogni-git-review/pulls/1")
      .reply(200, {
        number: 1,
        head: { sha: "abc123def456789012345678901234567890abcd" },
        base: { sha: "def456" },
        changed_files: 2,
        additions: 10,
        deletions: 5,
      })
      // Mock workflow run artifacts - empty
      .get("/repos/derekg1729/cogni-git-review/actions/runs/456789/artifacts")
      .reply(200, {
        total_count: 0,
        artifacts: [],
      })
      // Mock fallback head_sha lookup - also empty
      .get("/repos/derekg1729/cogni-git-review/actions/runs")
      .query({ head_sha: "abc123def456789012345678901234567890abcd", status: "completed", per_page: 5 })
      .reply(200, {
        total_count: 0,
        workflow_runs: [],
      })
      // Mock check update - expect neutral
      .patch(`/repos/derekg1729/cogni-git-review/check-runs/${checkId}`, (body) => {
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "neutral");
        assert.ok(
          body.output.summary.includes("neutral") || 
          body.output.text.includes("artifact not found")
        );
        return true;
      })
      .reply(200, {
        id: checkId,
        status: "completed",
        conclusion: "neutral",
      });

    const workflowRunPayload = {
      action: "completed",
      workflow_run: {
        id: 456789,
        name: "ESLint",
        head_sha: "abc123def456789012345678901234567890abcd",
        status: "completed",
      },
      repository: {
        id: 987654321,
        name: "cogni-git-review",
        full_name: "derekg1729/cogni-git-review",
        owner: { login: "derekg1729", id: 123456 },
        default_branch: "main",
      },
      installation: {
        id: 12345678,
      },
    };

    await probot.receive({
      name: "workflow_run",
      payload: workflowRunPayload,
    });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});