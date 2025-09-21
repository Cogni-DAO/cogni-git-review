import nock from "nock";
import myProbotApp from "../../index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearSpecCache } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";
import yaml from "js-yaml";

import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");


// Load complete webhook payload fixtures
const prOpenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.opened.complete.json"), "utf-8"),
);

describe("Legacy Spec Bug Tests", () => {
  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache(); 
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
  });

  test("TDD: legacy spec format should report neutral when 0 gates run", async () => {
    // This test expects neutral conclusion when legacy spec format
    // results in 0 gates being discovered/executed by dynamic registry
    const legacySpec = yaml.load(SPEC_FIXTURES.legacy);
    
    const mockContext = {
      name: 'pull_request',
      payload: prOpenedComplete,
      repo: (params = {}) => ({ owner: 'derekg1729', repo: 'cogni-git-review', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: legacySpec })
        },
        checks: {
          create: async (params) => {
            console.log('🧪 TDD TEST - Check run conclusion:', params.conclusion);
            console.log('🧪 TDD TEST - Check run output:', JSON.stringify(params.output, null, 2));
            
            // TDD: Should report neutral when 0 gates run due to spec incompatibility
            assert.strictEqual(params.conclusion, "neutral", "Should report neutral when 0 gates run");
            
            // Should have correct summary for 0 gates case
            assert.strictEqual(params.output.summary, "No gates configured", "Should say 'No gates configured' not 'All gates passed'");
            
            // Should indicate 0 gates in detailed text
            // New format validation - should show 0 gates total
            const match = params.output.text.match(/✅\s*(\d+)\s+passed\s*\|\s*❌\s*(\d+)\s+failed\s*\|\s*⚠️\s*(\d+)\s+neutral/);
            assert(match, `Expected gate counts format in: ${params.output.text}`);
            const total = parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3]);
            assert.strictEqual(total, 0, "Should show 0 total gates");
            
            return { data: { id: 12345 } };
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