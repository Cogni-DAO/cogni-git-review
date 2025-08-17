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

describe("Spec-Aware Webhook Integration Tests", () => {
  let probot;

  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache(); // Clean spec cache before each test
    probot = new Probot({
      appId: 123456,
      privateKey,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(myProbotApp);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
  });


  test("pull_request.opened with missing spec creates failure check with setup instructions", async () => {
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
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check is failure with helpful message
        assert.strictEqual(body.name, "Cogni Git PR Review"); // Default name
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("No .cogni/repo-spec.yaml found"));
        assert(body.output.text.includes("Add `.cogni/repo-spec.yaml`"));
        return true;
      })
      .reply(200, { 
        id: 9999999998, 
        status: "completed", 
        conclusion: "failure" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("pull_request.opened with invalid spec creates failure check with validation error", async () => {
    const invalidSpec = `invalid yaml [unclosed`;

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
      // Mock spec file fetch - return invalid YAML
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(invalidSpec).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check is failure with validation error
        assert.strictEqual(body.name, "Cogni Git PR Review"); // Default name
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("Invalid .cogni/repo-spec.yaml"));
        assert(body.output.text.includes("Repository spec validation failed"));
        return true;
      })
      .reply(200, { 
        id: 9999999997, 
        status: "completed", 
        conclusion: "failure" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("pull_request.opened with minimal spec creates success check", async () => {
    const minimalSpec = SPEC_FIXTURES.minimal;

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
      // Mock spec file fetch
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(minimalSpec).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check uses minimal spec (has review_limits but PR data passes)
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success"); // PR data passes limits
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert.strictEqual(body.output.summary, "All gates passed");
        assert(body.output.text.includes("**Passed:** review_limits"));
        return true;
      })
      .reply(200, { 
        id: 9999999996, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  // TODO: Fix pending mock issue - Bug ID: 0849bf8a-9b4b-45df-b58d-b9daef6fa4f1
  // Seems the same as Bug ID: 515b4dfe-01df-490e-b324-4f52dde56440
  // Always shows exactly 1 pending auth token mock regardless of count
  test.skip("spec loading is cached across multiple webhook events", async () => {
    console.log("🧪 CACHING TEST STARTED");
    const testSpec = `intent:
  name: cached-project
gates:
  spec_mode: enforced`;

    const mocks = nock("https://api.github.com")
      // Mock auth tokens (new index.js structure needs 3 calls)
      .post("/app/installations/12345678/access_tokens")
      .times(3)
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock spec file fetch - should only happen once due to caching
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .once() // Important: only once due to caching
      .reply(200, {
        type: "file",
        content: Buffer.from(testSpec).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation for both events
      .post("/repos/derekg1729/cogni-git-review/check-runs")
      .twice()
      .reply(200, { 
        id: 9999999995, 
        status: "completed", 
        conclusion: "success" 
      });

    // Send the same webhook event twice
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    // Should have no pending mocks - spec was cached after first load
    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });
});