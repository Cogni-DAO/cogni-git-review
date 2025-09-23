import nock from "nock";
import myProbotApp from "../../index.js";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearSpecCache } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";

import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");


// Load complete webhook payload fixtures
const prOpenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.opened.complete.json"), "utf-8"),
);

describe("Simple Integration Tests", () => {
  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
  });

  test("pull_request.opened with spec creates check successfully", async () => {
    const minimalSpec = yaml.load(SPEC_FIXTURES.minimal);
    
    const mockContext = {
      name: 'pull_request',
      payload: prOpenedComplete,
      repo: (params = {}) => ({ owner: 'derekg1729', repo: 'cogni-git-review', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: minimalSpec })
        },
        checks: {
          create: async (params) => {
            // Very basic verification - just ensure key fields exist
            assert.strictEqual(typeof params.name, "string");
            assert.strictEqual(params.head_sha, "abc123def456789012345678901234567890abcd");
            assert.strictEqual(params.status, "completed");
            assert(["success", "failure", "neutral"].includes(params.conclusion));
            assert.strictEqual(typeof params.output, "object");
            assert.strictEqual(typeof params.output.title, "string");
            assert.strictEqual(typeof params.output.summary, "string");
            return { data: { id: 9999999999 } };
          }
        }
      }
    };

    // Import the app and extract the handler
    const appModule = await import('../../index.js');
    let pullRequestHandler;
    
    // Mock app to capture the handler
    const mockApp = {
      on: (events, handler) => {
        if (Array.isArray(events) && events.includes('pull_request.opened')) {
          pullRequestHandler = handler;
        }
      },
      onAny: () => {}, // No-op for LOG_ALL_EVENTS
    };
    
    // Load the app to register handlers
    appModule.default(mockApp);
    
    // Call the handler directly with mocked context
    await pullRequestHandler(mockContext);
  });

  test("pull_request.opened without spec creates check successfully", async () => {

    const mockContext = {
      name: 'pull_request',
      payload: prOpenedComplete,
      repo: (params = {}) => ({ owner: 'derekg1729', repo: 'cogni-git-review', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: null }) // Mock missing spec
        },
        checks: {
          create: async (params) => {
            // Basic verification
            assert.strictEqual(typeof params.name, "string");
            assert.strictEqual(params.head_sha, "abc123def456789012345678901234567890abcd");
            assert.strictEqual(params.status, "completed");
            assert.strictEqual(params.conclusion, "neutral");
            assert.strictEqual(typeof params.output, "object");
            assert.strictEqual(typeof params.output.summary, "string");
            return { data: { id: 9999999998 } };
          }
        }
      }
    };

    // Import the app and extract the handler
    const appModule = await import('../../index.js');
    let pullRequestHandler;
    
    // Mock app to capture the handler
    const mockApp = {
      on: (events, handler) => {
        if (Array.isArray(events) && events.includes('pull_request.opened')) {
          pullRequestHandler = handler;
        }
      },
      onAny: () => {}, // No-op for LOG_ALL_EVENTS
    };
    
    // Load the app to register handlers
    appModule.default(mockApp);
    
    // Call the handler directly with mocked context
    await pullRequestHandler(mockContext);
  });
});