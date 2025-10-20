import { describe, test, beforeEach } from "node:test";
import assert from "node:assert";
import { testEventHandler } from "../helpers/handler-harness.js";
import gitlabRawPayload from "../fixtures/merge_request.opened.complete.json" with { type: "json" };
import { transformGitLabPayload } from "../../src/adapters/gitlab/payload-transform.js";

describe("GitLab Integration Tests", () => {
  let transformedPayload;

  beforeEach(() => {
    // Mock GitLab environment
    process.env.WEBHOOK_SECRET_GITLAB = "test-secret";
    process.env.GITLAB_PAT = "test-pat-token";
    process.env.GITLAB_BASE_URL = "https://gitlab.com";
    
    // Transform GitLab payload to BaseContext-compatible format
    transformedPayload = transformGitLabPayload(gitlabRawPayload);
  });

  test("GitLab merge_request.open creates check successfully", async () => {
    await testEventHandler({
      event: "pull_request.opened", // This is what GitLab transforms to
      payload: transformedPayload,
      spec: "minimal",
      expectCheck: (params) => {
        // Validate standard check contract
        assert.strictEqual(typeof params.name, "string");
        assert.strictEqual(params.head_sha, "fb7d5cea20fd333821e718d24283bc7282483492");
        assert.strictEqual(params.status, "completed");
        assert(["success", "failure", "neutral"].includes(params.conclusion));
        assert.strictEqual(typeof params.output.title, "string");
        assert.strictEqual(typeof params.output.summary, "string");
        
        // GitLab-specific validations
        assert(params.output.summary.length > 0, "Summary should not be empty");
      }
    });
  });

  test("GitLab merge_request handles real project structure", async () => {
    await testEventHandler({
      event: "pull_request.opened",
      payload: transformedPayload,
      spec: "minimal",
      expectCheck: (params) => {
        // Verify the payload transformation worked correctly
        assert.strictEqual(params.head_sha, "fb7d5cea20fd333821e718d24283bc7282483492");
        
        // Verify it can handle the real GitLab project structure
        // The payload has: cogni-dao/core/cogni-git-review
        assert(params.output.summary.includes("gates"), "Should mention gates execution");
      }
    });
  });

  test("GitLab merge_request with missing spec fails gracefully", async () => {
    await testEventHandler({
      event: "pull_request.opened", 
      payload: transformedPayload,
      spec: null, // Missing spec
      expectCheck: (params) => {
        // Spec loading errors result in neutral conclusion by default (fail_on_error: false)
        assert.strictEqual(params.conclusion, "neutral");
        // Just verify the check was created - the exact error message may vary
        assert(typeof params.output.summary === "string", `Expected summary to be string, got: ${params.output.summary}`);
        assert(params.output.summary.length > 0, "Summary should not be empty");
      }
    });
  });

  test("GitLab transformation preserves critical fields", async () => {
    await testEventHandler({
      event: "pull_request.opened",
      payload: transformedPayload, 
      spec: "minimal",
      expectCheck: (params) => {
        // Verify transformation preserved the commit SHA
        assert.strictEqual(params.head_sha, transformedPayload.pull_request.head.sha);
        
        // Verify we can extract project info
        assert.strictEqual(params.status, "completed");
        assert(["success", "failure", "neutral"].includes(params.conclusion));
      }
    });
  });
});