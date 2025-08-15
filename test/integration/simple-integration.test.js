import nock from "nock";
import myProbotApp from "../../index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearSpecCache } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";

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

describe("Simple Integration Tests", () => {
  let probot;

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
  });

  test("pull_request.opened with spec creates check successfully", async () => {
    const mocks = nock("https://api.github.com")
      // Mock auth token
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock spec file fetch - return minimal spec
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation - just verify it gets created
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Very basic verification - just ensure key fields exist
        assert.strictEqual(typeof body.name, "string");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert(["success", "failure", "neutral"].includes(body.conclusion));
        assert.strictEqual(typeof body.output, "object");
        assert.strictEqual(typeof body.output.title, "string");
        assert.strictEqual(typeof body.output.summary, "string");
        return true;
      })
      .reply(200, { 
        id: 9999999999, 
        status: "completed", 
        conclusion: "success" 
      });

    // Send webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    // Verify all mocks were called
    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("pull_request.opened without spec creates check successfully", async () => {
    const mocks = nock("https://api.github.com")
      // Mock auth token
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock spec file fetch - return 404
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(404, { message: "Not Found" })
      // Mock check run creation - should be failure (missing spec)
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Basic verification
        assert.strictEqual(typeof body.name, "string");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(typeof body.output, "object");
        assert.strictEqual(typeof body.output.summary, "string");
        return true;
      })
      .reply(200, { 
        id: 9999999998, 
        status: "completed", 
        conclusion: "failure" 
      });

    // Send webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    // Verify all mocks were called
    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});