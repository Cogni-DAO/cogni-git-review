/**
 * Shared integration test harness for direct handler testing
 * Extracted from the working pattern in cogni-evaluated-gates-behavior.test.js
 */

import yaml from 'js-yaml';

/**
 * Create a mock context for direct handler testing (same pattern as unit tests)
 * @param {Object} options
 * @param {Object} options.payload - PR payload 
 * @param {Object|null} options.configResponse - What config.get should return
 * @param {Function} options.checksAssert - Function to assert on check creation
 * @returns {Object} Mock context
 */
export function createMockContext(options) {
  const { payload, configResponse, checksAssert } = options;
  
  return {
    name: 'pull_request',
    payload,
    repo: (params = {}) => ({ 
      owner: payload?.repository?.owner?.login || 'test-org',
      repo: payload?.repository?.name || 'test-repo',
      ...params 
    }),
    octokit: {
      config: {
        get: async () => ({ config: configResponse })
      },
      checks: {
        create: async (params) => {
          if (checksAssert) {
            checksAssert(params);
          }
          return { data: { id: 1 } };
        }
      }
    }
  };
}

/**
 * Call app handler directly with mocked context
 * @param {Object} mockContext - Mock context from createMockContext
 */
export async function callPullRequestHandler(mockContext) {
  // Import the app and extract the handler (same pattern as working tests)
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
}

/**
 * High-level helper for common test patterns
 * @param {Object} options
 * @param {Object} options.payload - PR payload
 * @param {string|Object|null} options.spec - Spec fixture key, parsed object, or null
 * @param {Function} options.expectCheck - Function to assert on check creation
 */
export async function testPullRequestHandler(options) {
  const { payload, spec, expectCheck } = options;
  
  // Convert spec fixture to parsed object if needed
  let configResponse = spec;
  if (typeof spec === 'string') {
    const { SPEC_FIXTURES } = await import('../fixtures/repo-specs.js');
    configResponse = yaml.load(SPEC_FIXTURES[spec]);
  }
  
  // Create mock context and call handler
  const mockContext = createMockContext({
    payload,
    configResponse,
    checksAssert: expectCheck
  });
  
  await callPullRequestHandler(mockContext);
}