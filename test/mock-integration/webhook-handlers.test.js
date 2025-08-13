import nock from "nock";
import myProbotApp from "../../index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

const prSynchronizeComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.synchronize.complete.json"), "utf-8"),
);

const checkRunRerequestedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "check_run.rerequested.complete.json"), "utf-8"),
);

const checkSuiteRequestedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "check_suite.requested.complete.json"), "utf-8"),
);

describe("GitHub Webhook Handler Mock-Integration Tests", () => {
  let probot;

  beforeEach(() => {
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
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check run creation matches our expected structure (no spec = neutral)
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "neutral");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("Invalid .cogni/repo-spec.yaml"));
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
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check run for synchronize event (no spec = neutral)
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "def456789012345678901234567890abcdef1235");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "neutral");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("Invalid .cogni/repo-spec.yaml"));
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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
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
        assert.strictEqual(body.output.summary, "Review limits OK");
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

  test("check_run.rerequested webhook creates Cogni Git Commit Check", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens") 
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          metadata: "read",
        },
      })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check run rerun matches our expected structure
        assert.strictEqual(body.name, "Cogni Git Commit Check");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Cogni Git Commit Check");
        assert.strictEqual(body.output.summary, "MOCK Code review re-run completed successfully!");
        return true;
      })
      .reply(200, { 
        id: 9999999997, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete check_run rerequested webhook event
    await probot.receive({ name: "check_run", payload: checkRunRerequestedComplete });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("check_suite.requested webhook creates Cogni Git Commit Check", async () => {
    const mock = nock("https://api.github.com")
      .post("/app/installations/12345678/access_tokens")
      .reply(200, {
        token: "ghs_test_token",
        permissions: {
          checks: "write",
          metadata: "read",
        },
      })
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        // Verify the check run creation matches our expected structure
        assert.strictEqual(body.name, "Cogni Git Commit Check");
        assert.strictEqual(body.head_branch, "feat/integration-testing");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Cogni Git Commit Check");
        assert.strictEqual(body.output.summary, "MOCK Code review completed successfully!");
        return true;
      })
      .reply(200, { 
        id: 9999999994, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the complete check_suite requested webhook event
    await probot.receive({ name: "check_suite", payload: checkSuiteRequestedComplete });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

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

  test("validates webhook payload structure - check_run rerequested", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(checkRunRerequestedComplete.action === "rerequested");
    assert(typeof checkRunRerequestedComplete.check_run === "object");
    assert(typeof checkRunRerequestedComplete.check_run.head_sha === "string");
    assert(typeof checkRunRerequestedComplete.repository === "object");
    assert(typeof checkRunRerequestedComplete.installation === "object");
    assert(typeof checkRunRerequestedComplete.installation.id === "number");
  });

  test("validates webhook payload structure - check_suite requested", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(checkSuiteRequestedComplete.action === "requested");
    assert(typeof checkSuiteRequestedComplete.check_suite === "object");
    assert(typeof checkSuiteRequestedComplete.check_suite.head_branch === "string");
    assert(typeof checkSuiteRequestedComplete.check_suite.head_sha === "string");
    assert(typeof checkSuiteRequestedComplete.repository === "object");
    assert(typeof checkSuiteRequestedComplete.installation === "object");
    assert(typeof checkSuiteRequestedComplete.installation.id === "number");
  });

  // Note: Duplicate webhook delivery testing is complex with nock mocking
  // In production, webhook redelivery should be tested manually using GitHub App delivery logs

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});