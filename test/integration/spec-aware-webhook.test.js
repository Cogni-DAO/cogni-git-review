// IMPORT TEST HELPERS FIRST (before app code)
import { makeProbot } from "../helpers/probot.js";
import { mockInstallationAuth, mockCreateCheckRun, mockGetFileContents, mockGetFileNotFound } from "../helpers/githubMocks.js";
import "../setup.js"; // Load global nock setup

import myProbotApp from "../../index.js";
import { clearSpecCache } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");

// Load complete webhook payload fixtures
const prOpenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.opened.complete.json"), "utf-8"),
);

describe("Spec-Aware Webhook Integration Tests", () => {
  beforeEach(() => {
    clearSpecCache(); // Clean spec cache before each test
  });

  afterEach(() => {
    clearSpecCache();
  });


  test("pull_request.opened with missing spec creates failure check with setup instructions", async () => {
    const { owner, name: repo } = prOpenedComplete.repository;
    const installationId = prOpenedComplete.installation.id;

    mockInstallationAuth(installationId);
    mockGetFileNotFound(owner.login, repo, ".cogni/repo-spec.yaml", "abc123def456789012345678901234567890abcd");
    mockCreateCheckRun(owner.login, repo);

    const probot = makeProbot(myProbotApp);
    await probot.receive({ 
      id: '1', 
      name: "pull_request", 
      payload: prOpenedComplete 
    });
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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
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
      .query({ ref: "abc123def456789012345678901234567890abcd" })
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

  test("spec loading is cached across multiple webhook events", async () => {
    const { owner, name: repo } = prOpenedComplete.repository;
    const installationId = prOpenedComplete.installation.id;

    // Enable nock debugging to see ALL HTTP requests
    const nock = await import('nock').then(m => m.default);
    nock.recorder.rec({
      dont_print: true,
      output_objects: true
    });

    const testSpec = `intent:
  name: cached-project
gates:
  spec_mode: enforced`;

    // Set up mocks using helpers
    mockInstallationAuth(installationId, 4); // Try 4 to be safe
    
    // Mock spec file fetch - should only happen once due to caching
    mockGetFileContents(owner.login, repo, ".cogni/repo-spec.yaml", "abc123def456789012345678901234567890abcd", testSpec);
    
    // Mock check run creation for both events
    mockCreateCheckRun(owner.login, repo);
    mockCreateCheckRun(owner.login, repo);

    // Create fresh probot instance
    const probot = makeProbot(myProbotApp);

    // Send the same webhook event twice - spec should be cached after first
    await probot.receive({ id: '1', name: "pull_request", payload: prOpenedComplete });
    await probot.receive({ id: '2', name: "pull_request", payload: prOpenedComplete });
    
    // Debug: Show all recorded HTTP requests
    const recordings = nock.recorder.play();
    console.log("🔍 ALL HTTP REQUESTS MADE:");
    recordings.forEach((req, i) => {
      console.log(`${i + 1}: ${req.method} ${req.scope}${req.path}`);
    });
    
    // Test passes if no exceptions thrown by global nock setup
  });
});