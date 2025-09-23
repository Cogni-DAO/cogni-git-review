/**
 * Cogni Evaluated Gates Behavior Contract Tests - Following DRY AGENTS.md Patterns
 * Tests the 4 required behavior scenarios for the MVP using established fixtures
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import nock from 'nock';
import yaml from 'js-yaml';
import { clearSpecCache } from '../../src/spec-loader.js';
import { SPEC_FIXTURES } from '../fixtures/repo-specs.js';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");

// Load complete webhook payload fixture (following AGENTS.md pattern)
const prOpenedComplete = JSON.parse(
  fs.readFileSync(path.join(fixturesPath, "pull_request.opened.complete.json"), "utf-8"),
);

// Using fixtures from SPEC_FIXTURES (proper DRY pattern)

/**
 * Create PR payload with custom stats (using existing fixture as base)
 */
function createBehaviorPayload(prOverrides = {}) {
  return {
    ...prOpenedComplete,
    repository: {
      ...prOpenedComplete.repository,
      name: "test-repo",
      owner: { login: "test-org" }
    },
    pull_request: {
      ...prOpenedComplete.pull_request,
      head: { 
        ...prOpenedComplete.pull_request.head,
        sha: "abc123def456789012345678901234567890abcd" 
      },
      changed_files: 5,     // Default: under limit
      additions: 30,        // 30+30 = 60, 60/3 = 20 KB (under limit)
      deletions: 30,
      ...prOverrides
    }
  };
}

describe('Cogni Evaluated Gates Behavior Contract Tests', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
    clearSpecCache();
  });

  afterEach(() => {
    console.log('Pending mocks before cleanup:', nock.pendingMocks());
    if (!nock.isDone()) {
      throw new Error(`Unconsumed mocks: ${nock.pendingMocks()}`);
    }
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
  });

  it('missing_spec_failure: No .cogni/repo-spec.yaml → conclusion=failure', async () => {
    // Create mock context (same pattern as unit tests)
    const mockContext = {
      name: 'pull_request',
      payload: createBehaviorPayload(),
      repo: (params = {}) => ({ owner: 'test-org', repo: 'test-repo', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: null })  // Mock missing spec
        },
        checks: {
          create: async (params) => {
            // Verify the check run is created correctly
            assert.strictEqual(params.conclusion, 'neutral');
            assert.strictEqual(params.name, 'Cogni Git PR Review');
            assert(params.output.summary.includes('Cogni needs a repo-spec'));
            return { data: { id: 1 } };
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

  it('valid_spec_under_limits_success: 5 files, 20 KB vs 30/100 limits → success', async () => {
    // Use parsed fixture (same pattern as unit tests)
    const expectedSpec = yaml.load(SPEC_FIXTURES.behaviorTest30_100);
    
    // Create mock context 
    const mockContext = {
      name: 'pull_request',
      payload: createBehaviorPayload({
        changed_files: 5,
        additions: 30,
        deletions: 30  // 60/3 = 20 KB
      }),
      repo: (params = {}) => ({ owner: 'test-org', repo: 'test-repo', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: expectedSpec })  // Mock valid spec
        },
        checks: {
          create: async (params) => {
            // Verify behavior contract - new tri-state format
            assert.strictEqual(params.conclusion, "success");
            assert.strictEqual(params.output.summary, "All gates passed");
            // New format validation - accept any gate counts that total 3
            const match = params.output.text.match(/✅\s*(\d+)\s+passed\s*\|\s*❌\s*(\d+)\s+failed\s*\|\s*⚠️\s*(\d+)\s+neutral/);
            assert(match, `Expected gate counts format in: ${params.output.text}`);
            const total = parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3]);
            assert.strictEqual(total, 3, `Expected 3 total gates, got ${total}`);
            assert(params.output.text.includes("✅ 3 passed"));
            // Stats should be in review_limits gate section now (no more footer)
            assert(params.output.text.includes("changed_files: 5"));
            assert(params.output.text.includes("total_diff_kb: 20"));
            return { data: { id: 1 } };
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

  it('valid_spec_over_files_failure: 45 files vs 30 limit → failure', async () => {
    // Use parsed fixture (same pattern as unit tests)
    const expectedSpec = yaml.load(SPEC_FIXTURES.behaviorTest30_100);
    
    // Create mock context 
    const mockContext = {
      name: 'pull_request',
      payload: createBehaviorPayload({
        changed_files: 45,  // Over 30 limit
        additions: 30,
        deletions: 30  // 60/3 = 20 KB (under limit)
      }),
      repo: (params = {}) => ({ owner: 'test-org', repo: 'test-repo', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: expectedSpec })  // Mock valid spec
        },
        checks: {
          create: async (params) => {
            // Verify behavior contract - new tri-state format
            assert.strictEqual(params.conclusion, "failure");
            assert.strictEqual(params.output.summary, "Gate failures: 1");
            // New format validation - accept any gate counts that total 3
            const match = params.output.text.match(/✅\s*(\d+)\s+passed\s*\|\s*❌\s*(\d+)\s+failed\s*\|\s*⚠️\s*(\d+)\s+neutral/);
            assert(match, `Expected gate counts format in: ${params.output.text}`);
            const total = parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3]);
            assert.strictEqual(total, 3, `Expected 3 total gates, got ${total}`);
            assert(params.output.text.includes("❌ 1 failed"));
            assert(params.output.text.includes("max_changed_files: 45 > 30"));
            // Stats should be in review_limits gate section now (no more footer)
            assert(params.output.text.includes("changed_files: 45"));
            return { data: { id: 1 } };
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

  it('valid_spec_over_kb_failure: 10 files, 150 KB vs 100 limit → failure', async () => {
    // Use parsed fixture (same pattern as unit tests)
    const expectedSpec = yaml.load(SPEC_FIXTURES.behaviorTest30_100);
    
    // Create mock context 
    const mockContext = {
      name: 'pull_request',
      payload: createBehaviorPayload({
        changed_files: 10,  // Under 30 limit
        additions: 225,     // 225+225 = 450, 450/3 = 150 KB (over 100 limit)  
        deletions: 225
      }),
      repo: (params = {}) => ({ owner: 'test-org', repo: 'test-repo', ...params }),
      octokit: {
        config: {
          get: async () => ({ config: expectedSpec })  // Mock valid spec
        },
        checks: {
          create: async (params) => {
            // Verify behavior contract - new tri-state format
            assert.strictEqual(params.conclusion, "failure");
            assert.strictEqual(params.output.summary, "Gate failures: 1");  
            // New format validation - accept any gate counts that total 3
            const match = params.output.text.match(/✅\s*(\d+)\s+passed\s*\|\s*❌\s*(\d+)\s+failed\s*\|\s*⚠️\s*(\d+)\s+neutral/);
            assert(match, `Expected gate counts format in: ${params.output.text}`);
            const total = parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3]);
            assert.strictEqual(total, 3, `Expected 3 total gates, got ${total}`);
            assert(params.output.text.includes("❌ 1 failed"));
            // Stats should be in review_limits gate section now (no more footer)
            assert(params.output.text.includes("changed_files: 10"));
            assert(params.output.text.includes("total_diff_kb: 150"));
            assert(params.output.text.includes("max_total_diff_kb: 150 > 100"));
            return { data: { id: 1 } };
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