import nock from "nock";
import myProbotApp from "../../index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearSpecCache } from "../../src/spec-loader.js";

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

  test("pull_request.opened with valid spec creates check with spec-based name", async () => {
    const customCheckName = "Custom Repository Check";
    const validSpec = `intent:
  name: custom-project
  mission: Project with custom check name
  ownership:
    maintainers: ['@test-org/maintainers']

gates:
  spec_mode: enforced
  check_presentation:
    name: '${customCheckName}'`;

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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(200, {
        type: "file",
        content: Buffer.from(validSpec).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check uses the spec-defined name
        assert.strictEqual(body.name, customCheckName);
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, customCheckName);
        assert(body.output.summary.includes("PR #1"));
        assert(body.output.text.includes("Repository spec loaded successfully"));
        assert(body.output.text.includes("Mode: enforced"));
        return true;
      })
      .reply(200, { 
        id: 9999999999, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("pull_request.opened with missing spec creates neutral check with setup instructions", async () => {
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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(404, { message: "Not Found" })
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check is neutral with helpful message
        assert.strictEqual(body.name, "Cogni Git PR Review"); // Default name
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "neutral");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("No .cogni/repo-spec.yaml found"));
        assert(body.output.text.includes("No repository spec found"));
        assert(body.output.text.includes("add a .cogni/repo-spec.yaml file"));
        return true;
      })
      .reply(200, { 
        id: 9999999998, 
        status: "completed", 
        conclusion: "neutral" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("pull_request.opened with invalid spec creates neutral check with validation error", async () => {
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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(200, {
        type: "file",
        content: Buffer.from(invalidSpec).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check is neutral with validation error
        assert.strictEqual(body.name, "Cogni Git PR Review"); // Default name
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "neutral");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("Spec validation failed"));
        assert(body.output.text.includes("No repository spec found"));
        return true;
      })
      .reply(200, { 
        id: 9999999997, 
        status: "completed", 
        conclusion: "neutral" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mocks.pendingMocks(), []);
  });

  test("pull_request.opened with bootstrap mode spec creates success check", async () => {
    const bootstrapSpec = `intent:
  name: bootstrap-project
  mission: Project in bootstrap mode
  
gates:
  spec_mode: bootstrap
  check_presentation:
    name: 'Bootstrap Test Check'`;

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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
      .reply(200, {
        type: "file",
        content: Buffer.from(bootstrapSpec).toString('base64'),
        encoding: "base64"
      })
      // Mock check run creation
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check uses bootstrap mode
        assert.strictEqual(body.name, "Bootstrap Test Check");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success"); // Bootstrap mode still shows success for spec loading
        assert.strictEqual(body.output.title, "Bootstrap Test Check");
        assert(body.output.text.includes("Repository spec loaded successfully"));
        assert(body.output.text.includes("Mode: bootstrap"));
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

  test("spec loading is cached across multiple webhook events", async () => {
    const testSpec = `intent:
  name: cached-project
gates:
  spec_mode: enforced`;

    const mocks = nock("https://api.github.com")
      // Mock auth tokens for both events
      .post("/app/installations/12345678/access_tokens")
      .twice()
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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
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