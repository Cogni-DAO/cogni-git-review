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

describe("Legacy Spec Bug Tests", () => {
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

  test("TDD: legacy spec format should report neutral when 0 gates run", async () => {
    // This test expects neutral conclusion when legacy spec format
    // results in 0 gates being discovered/executed by dynamic registry
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
      // Get spec file - return legacy object-style format
      .get("/repos/derekg1729/cogni-git-review/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.legacy).toString('base64'),
        encoding: "base64"
      })
      // Create check run - TDD: should report neutral
      .post("/repos/derekg1729/cogni-git-review/check-runs", (body) => {
        console.log('🧪 TDD TEST - Check run conclusion:', body.conclusion);
        console.log('🧪 TDD TEST - Check run output:', JSON.stringify(body.output, null, 2));
        
        // TDD: Should report neutral when 0 gates run due to spec incompatibility
        assert.strictEqual(body.conclusion, "neutral", "Should report neutral when 0 gates run");
        
        // Should indicate no gates or spec compatibility issues
        assert(body.output.text.includes("Gates: 0 total") || 
               body.output.text.includes("no gates") ||
               body.output.text.includes("neutral"), "Should indicate 0 gates or compatibility issue");
        
        return true;
      })
      .reply(201, {
        id: 12345,
        status: "completed",
        conclusion: "neutral"
      });

    // Send PR opened event
    await probot.receive({
      name: "pull_request",
      id: "12345-67890", 
      payload: prOpenedComplete
    });

    // Verify mocks were called
    if (!mocks.isDone()) {
      console.error('Pending mocks:', mocks.pendingMocks());
    }
    assert.strictEqual(mocks.isDone(), true, "All GitHub API calls should be made");
  });
});