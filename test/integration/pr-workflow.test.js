import nock from "nock";
import myProbotApp from "../../index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");

const privateKey = fs.readFileSync(
  path.join(fixturesPath, "mock-cert.pem"),
  "utf-8",
);

// Load real webhook payload fixtures
const prOpenedReal = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pr.opened.real.json"), "utf-8"),
);

const prSynchronizeReal = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pr.synchronize.real.json"), "utf-8"),
);

const checkRunRerequestedReal = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "check_run.rerequested.real.json"), "utf-8"),
);

describe("PR Workflow Integration Tests", () => {
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

  test("handles real PR opened payload - creates Cogni Git PR Review check", async () => {
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
        // Verify the check run creation matches our expected structure
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "abc123def456789012345678901234567890abcd");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("PR #1"));
        assert(body.output.summary.includes("MOCK reviewed and approved by Git Cogni v1.0"));
        return true;
      })
      .reply(200, { 
        id: 9999999999, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the real PR opened webhook event
    await probot.receive({ name: "pull_request", payload: prOpenedReal });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles real PR synchronize payload - creates Cogni Git PR Review check", async () => {
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
        // Verify the check run for synchronize event
        assert.strictEqual(body.name, "Cogni Git PR Review");
        assert.strictEqual(body.head_sha, "def456789012345678901234567890abcdef1235");
        assert.strictEqual(body.status, "completed");
        assert.strictEqual(body.conclusion, "success");
        assert.strictEqual(body.output.title, "Cogni Git PR Review");
        assert(body.output.summary.includes("PR #1"));
        assert(body.output.summary.includes("MOCK reviewed and approved by Git Cogni v1.0"));
        return true;
      })
      .reply(200, { 
        id: 9999999998, 
        status: "completed", 
        conclusion: "success" 
      });

    // Receive the real PR synchronize webhook event
    await probot.receive({ name: "pull_request", payload: prSynchronizeReal });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles real check_run rerequested payload - creates Cogni Git Commit Check", async () => {
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

    // Receive the real check_run rerequested webhook event
    await probot.receive({ name: "check_run", payload: checkRunRerequestedReal });

    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("validates webhook payload structure - PR opened", async () => {
    // Test that the real payload has all required fields for our handlers
    assert(prOpenedReal.action === "opened");
    assert(typeof prOpenedReal.number === "number");
    assert(typeof prOpenedReal.pull_request === "object");
    assert(typeof prOpenedReal.pull_request.head === "object");
    assert(typeof prOpenedReal.pull_request.head.sha === "string");
    assert(typeof prOpenedReal.repository === "object");
    assert(typeof prOpenedReal.installation === "object");
    assert(typeof prOpenedReal.installation.id === "number");
  });

  test("validates webhook payload structure - PR synchronize", async () => {
    // Test that the real payload has all required fields for our handlers
    assert(prSynchronizeReal.action === "synchronize");
    assert(typeof prSynchronizeReal.number === "number");
    assert(typeof prSynchronizeReal.pull_request === "object");
    assert(typeof prSynchronizeReal.pull_request.head === "object");
    assert(typeof prSynchronizeReal.pull_request.head.sha === "string");
    assert(typeof prSynchronizeReal.repository === "object");
    assert(typeof prSynchronizeReal.installation === "object");
    assert(typeof prSynchronizeReal.installation.id === "number");
    // Synchronize should have before/after fields
    assert(typeof prSynchronizeReal.before === "string");
    assert(typeof prSynchronizeReal.after === "string");
  });

  test("validates webhook payload structure - check_run rerequested", async () => {
    // Test that the real payload has all required fields for our handlers
    assert(checkRunRerequestedReal.action === "rerequested");
    assert(typeof checkRunRerequestedReal.check_run === "object");
    assert(typeof checkRunRerequestedReal.check_run.head_sha === "string");
    assert(typeof checkRunRerequestedReal.repository === "object");
    assert(typeof checkRunRerequestedReal.installation === "object");
    assert(typeof checkRunRerequestedReal.installation.id === "number");
  });

  // Note: Duplicate webhook delivery testing is complex with nock mocking
  // In production, webhook redelivery should be tested manually using GitHub App delivery logs

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});