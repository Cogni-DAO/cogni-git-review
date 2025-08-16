import nock from "nock";
import myProbotApp from "../../index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";
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

const prSynchronizeComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.synchronize.complete.json"), "utf-8"),
);

// checkRunRerequestedComplete removed - we now handle check_suite.rerequested instead

const prReopenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.reopened.complete.json"), "utf-8"),
);

const checkSuiteRerequestedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "check_suite.rerequested.complete.json"), "utf-8"),
);


describe("GitHub Webhook Handler Mock-Integration Tests", () => {
  let probot;

  beforeEach(() => {
    clearSpecCache(); // Clean spec cache before each test
    nock.disableNetConnect();
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

  test("pull_request.opened webhook creates Cogni Git PR Review check", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock missing spec file
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(404, { message: "Not Found" })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check run creation matches our expected structure (no spec = failure)
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("No .cogni/repo-spec.yaml found"));
        return true;
      })
      .reply(200, { 
        id: 9999999999, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("pull_request.synchronize webhook creates Cogni Git PR Review check", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write", 
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock missing spec file
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(404, { message: "Not Found" })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check run for synchronize event (no spec = failure)
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "def456789012345678901234567890abcdef1235");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("No .cogni/repo-spec.yaml found"));
        return true;
      })
      .reply(200, { 
        id: 9999999998, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete PR synchronize webhook event
    await probot.receive({ name: "pull_request", payload: prSynchronizeComplete });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("pull_request.reopened should create Cogni Git PR Review check", async () => {
    // This test demonstrates the bug: reopened events should trigger PR review
    // Currently this will fail because the handler doesn't listen for 'reopened' events
    
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read", 
          metadata: "read",
        },
      })
      // Mock missing spec file (same as synchronize test)
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(404, { message: "Not Found" })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Should create check run when PR is reopened
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "failure"); // No spec = failure
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert.strictEqual(body.output.summary, "No .cogni/repo-spec.yaml found");
        return true;
      })
      .reply(200, { 
        id: 9999999996, 
        status: "completed", 
        conclusion: "failure" 
      });

    // This should trigger PR review when reopened (currently fails silently)
    await probot.receive({ name: "pull_request", payload: prReopenedComplete });
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("pull_request.opened with spec creates success check", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock spec loading
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify successful check with spec
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert.strictEqual(body.output.summary, "All gates passed");
        return true;
      })
      .reply(200, { 
        id: 9999999997, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedComplete });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  // NOTE: check_run.rerequested tests removed - we now handle check_suite.rerequested instead


  test("validates webhook payload structure - PR opened", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(prOpenedComplete.action === "opened");
    assert(typeof prOpenedComplete.number === "number");
    assert(typeof prOpenedComplete.pull_request === "object");
    assert(typeof prOpenedComplete.pull_request.head === "object");
    assert(typeof prOpenedComplete.pull_request.head.sha === "string");
    assert(typeof prOpenedComplete.repository === "object");
    assert(typeof prOpenedComplete.installation === "object");
    assert(typeof prOpenedComplete.installation.id === "number");
  });

  test("validates webhook payload structure - PR synchronize", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(prSynchronizeComplete.action === "synchronize");
    assert(typeof prSynchronizeComplete.number === "number");
    assert(typeof prSynchronizeComplete.pull_request === "object");
    assert(typeof prSynchronizeComplete.pull_request.head === "object");
    assert(typeof prSynchronizeComplete.pull_request.head.sha === "string");
    assert(typeof prSynchronizeComplete.repository === "object");
    assert(typeof prSynchronizeComplete.installation === "object");
    assert(typeof prSynchronizeComplete.installation.id === "number");
    // Synchronize should have before/after fields
    assert(typeof prSynchronizeComplete.before === "string");
    assert(typeof prSynchronizeComplete.after === "string");
  });


  test("check_suite.rerequested should successfully review correct PR with proper context", async () => {
    // This test verifies that rerun gets PR number from check_suite.pull_requests, 
    // fetches full PR data, and shows proper file/diff stats (not files=0 | diff_kb=0)
    
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens") 
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          pull_requests: "read",
          metadata: "read",
        },
      })
      // Mock fetching full PR data (the key improvement!)
      .get("/repos/derekg1729/cogni-git-review/pulls/12")
      .reply(200, {
        number: 12,
        state: "open",
        head: { sha: "e92817d301df48f3ea502537fbd0b3d9a3ef792a" },
        base: { sha: "80ecae26be3eb6d3ad298d3b699eacdcaee9742f" },
        changed_files: 3,
        additions: 11,
        deletions: 0
      })
      // Mock spec loading
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      })
      // Should create check run with proper PR context from API call
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "e92817d301df48f3ea502537fbd0b3d9a3ef792a");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert.strictEqual(body.output.summary, "All gates passed");
        // The key test: should show actual file/diff stats from full PR data
        assert(body.output.text.includes("files=3"));  // from PR API call
        assert(!body.output.text.includes("files=0"));  // should NOT be zero
        return true;
      })
      .reply(200, { 
        id: 9999999995, 
        status: "completed", 
        conclusion: "success" 
      });

    // This should trigger PR review with proper PR context via API fetch
    await probot.receive({ name: "check_suite", payload: checkSuiteRerequestedComplete });

    // Note: Test may have pending mocks due to API caching, but functionality works
    // The important thing is we see the right behavior in the logs
    mock.done();
  });

  test("validates webhook payload structure - check_suite rerequested", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(checkSuiteRerequestedComplete.action === "rerequested");
    assert(typeof checkSuiteRerequestedComplete.check_suite === "object");
    assert(typeof checkSuiteRerequestedComplete.check_suite.head_sha === "string");
    assert(Array.isArray(checkSuiteRerequestedComplete.check_suite.pull_requests));
    assert(typeof checkSuiteRerequestedComplete.repository === "object");
    assert(typeof checkSuiteRerequestedComplete.installation === "object");
    assert(typeof checkSuiteRerequestedComplete.installation.id === "number");
  });


  // Note: Duplicate webhook delivery testing is complex with nock mocking
  // In production, webhook redelivery should be tested manually using GitHub App delivery logs

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});