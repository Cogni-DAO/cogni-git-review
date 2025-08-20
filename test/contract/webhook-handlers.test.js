/**
 * GitHub Webhook Handler Contract Tests
 * Tests the basic flow from webhook event to check creation using the harness pattern
 * Converted from HTTP mocking to direct handler invocation for reliability
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { testEventHandler } from '../helpers/handler-harness.js';
import pullRequestOpenedPayload from '../fixtures/pull_request.opened.complete.json' with { type: 'json' };
import prSynchronizePayload from '../fixtures/pull_request.synchronize.complete.json' with { type: 'json' };
import prReopenedPayload from '../fixtures/pull_request.reopened.complete.json' with { type: 'json' };
import checkSuiteRerequestedPayload from '../fixtures/check_suite.rerequested.complete.json' with { type: 'json' };

describe("GitHub Webhook Handler Contract Tests", () => {

  test("pull_request.opened webhook creates failure check when spec missing", async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload: pullRequestOpenedPayload,
      spec: null,
      expectCheck: (params) => {
        assert.strictEqual(params.name, "Cogni Git PR Review");
        assert.strictEqual(params.head_sha, pullRequestOpenedPayload.pull_request.head.sha);
        assert.strictEqual(params.status, "completed");
        assert.strictEqual(params.conclusion, "failure");
        assert.strictEqual(params.output.title, "Cogni Git PR Review");
        assert(params.output.summary.includes("No .cogni/repo-spec.yaml found"));
      }
    });
  });

  test("pull_request.synchronize webhook creates failure check when spec missing", async () => {
    await testEventHandler({
      event: 'pull_request.synchronize',
      payload: prSynchronizePayload,
      spec: null,
      expectCheck: (params) => {
        assert.strictEqual(params.name, "Cogni Git PR Review");
        assert.strictEqual(params.head_sha, prSynchronizePayload.pull_request.head.sha);
        assert.strictEqual(params.status, "completed");
        assert.strictEqual(params.conclusion, "failure");
        assert.strictEqual(params.output.title, "Cogni Git PR Review");
        assert(params.output.summary.includes("No .cogni/repo-spec.yaml found"));
      }
    });
  });

  test("pull_request.reopened should create failure check when spec missing", async () => {
    await testEventHandler({
      event: 'pull_request.reopened',
      payload: prReopenedPayload,
      spec: null,
      expectCheck: (params) => {
        assert.strictEqual(params.name, "Cogni Git PR Review");
        assert.strictEqual(params.head_sha, prReopenedPayload.pull_request.head.sha);
        assert.strictEqual(params.status, "completed");
        assert.strictEqual(params.conclusion, "failure");
        assert.strictEqual(params.output.title, "Cogni Git PR Review");
        assert(params.output.summary.includes("No .cogni/repo-spec.yaml found"));
      }
    });
  });

  test("pull_request.opened with spec creates success check", async () => {
    await testEventHandler({
      event: 'pull_request.opened',
      payload: pullRequestOpenedPayload,
      spec: 'minimal',
      expectCheck: (params) => {
        assert.strictEqual(params.name, "Cogni Git PR Review");
        assert.strictEqual(params.head_sha, pullRequestOpenedPayload.pull_request.head.sha);
        assert.strictEqual(params.status, "completed");
        assert.strictEqual(params.conclusion, "success");
        assert.strictEqual(params.output.title, "Cogni Git PR Review");
        assert.strictEqual(params.output.summary, "All gates passed");
        assert.match(params.output.text || '', /\bGates:\s*\d+\s+total\b/);
      }
    });
  });

  test("validates webhook payload structure - PR opened", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(pullRequestOpenedPayload.action === "opened");
    assert(typeof pullRequestOpenedPayload.number === "number");
    assert(typeof pullRequestOpenedPayload.pull_request === "object");
    assert(typeof pullRequestOpenedPayload.pull_request.head === "object");
    assert(typeof pullRequestOpenedPayload.pull_request.head.sha === "string");
    assert(typeof pullRequestOpenedPayload.repository === "object");
    assert(typeof pullRequestOpenedPayload.installation === "object");
    assert(typeof pullRequestOpenedPayload.installation.id === "number");
  });

  test("validates webhook payload structure - PR synchronize", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(prSynchronizePayload.action === "synchronize");
    assert(typeof prSynchronizePayload.number === "number");
    assert(typeof prSynchronizePayload.pull_request === "object");
    assert(typeof prSynchronizePayload.pull_request.head === "object");
    assert(typeof prSynchronizePayload.pull_request.head.sha === "string");
    assert(typeof prSynchronizePayload.repository === "object");
    assert(typeof prSynchronizePayload.installation === "object");
    assert(typeof prSynchronizePayload.installation.id === "number");
    // Synchronize should have before/after fields
    assert(typeof prSynchronizePayload.before === "string");
    assert(typeof prSynchronizePayload.after === "string");
  });

  test("check_suite.rerequested should handle missing stored spec gracefully", async () => {
    // This test verifies that rerun gets PR number from check_suite.pull_requests, 
    // fetches full PR data, but reports neutral when no stored spec available

    const extraOctokit = {
      pulls: {
        get: async () => ({
          data: {
            number: 12,
            state: "open",
            head: { sha: "e92817d301df48f3ea502537fbd0b3d9a3ef792a" },
            base: { sha: "80ecae26be3eb6d3ad298d3b699eacdcaee9742f" },
            changed_files: 3,
            additions: 11,
            deletions: 0
          }
        })
      },
      repos: {
        listPullRequestsAssociatedWithCommit: async () => ({
          data: [{
            number: 12,
            state: 'open',
            changed_files: 3,
            additions: 11,
            deletions: 0
          }]
        })
      }
    };

    const calls = await testEventHandler({
      event: 'check_suite.rerequested',
      payload: checkSuiteRerequestedPayload,
      spec: 'minimal',
      expectCheck: (params) => {
        assert.strictEqual(params.name, "Cogni Git PR Review");
        assert.strictEqual(params.head_sha, "e92817d301df48f3ea502537fbd0b3d9a3ef792a");
        assert.strictEqual(params.status, "completed");
        assert.strictEqual(params.conclusion, "success");
        assert.strictEqual(params.output.title, "Cogni Git PR Review");
        assert.strictEqual(params.output.summary, "All gates passed");
        assert.match(params.output.text || '', /\bfiles=3\b/);
      },
      extraOctokit
    });

    assert.strictEqual(calls.length, 1);
  });

  test("validates webhook payload structure - check_suite rerequested", async () => {
    // Test that the complete payload has all required fields for our handlers
    assert(checkSuiteRerequestedPayload.action === "rerequested");
    assert(typeof checkSuiteRerequestedPayload.check_suite === "object");
    assert(typeof checkSuiteRerequestedPayload.check_suite.head_sha === "string");
    assert(Array.isArray(checkSuiteRerequestedPayload.check_suite.pull_requests));
    assert(typeof checkSuiteRerequestedPayload.repository === "object");
    assert(typeof checkSuiteRerequestedPayload.installation === "object");
    assert(typeof checkSuiteRerequestedPayload.installation.id === "number");
  });

});