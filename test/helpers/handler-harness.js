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
 * Extract specific event handler from app factory
 * @param {Function} appFactory - App factory function
 * @param {string|Array} events - Event name(s) to extract handler for
 * @returns {Function} Event handler function
 */
export function extractHandler(appFactory, events) {
  let handler;
  const targetEvents = Array.isArray(events) ? events : [events];
  const eventSet = new Set(targetEvents);
  
  // Mock app to capture the handler
  const mockApp = {
    on: (registeredEvents, handlerFn) => {
      const eventsList = Array.isArray(registeredEvents) ? registeredEvents : [registeredEvents];
      if (eventsList.some(e => eventSet.has(e))) {
        handler = handlerFn;
      }
    },
    onAny: () => {}, // No-op for LOG_ALL_EVENTS
  };
  
  // Load the app to register handlers
  appFactory(mockApp);
  
  if (!handler) {
    throw new Error(`Failed to extract handler for events: ${targetEvents.join(', ')}`);
  }
  
  return handler;
}

/**
 * Call app handler directly with mocked context (legacy function)
 * @param {Object} mockContext - Mock context from createMockContext
 */
export async function callPullRequestHandler(mockContext) {
  // Import the app and extract the handler (same pattern as working tests)
  const appModule = await import('../../index.js');
  const pullRequestHandler = extractHandler(appModule.default, 'pull_request.opened');
  
  // Call the handler directly with mocked context
  await pullRequestHandler(mockContext);
}

/**
 * Generic event handler testing function
 * @param {Object} options
 * @param {string} options.event - Event name (e.g., 'pull_request.opened', 'check_suite.rerequested')
 * @param {Object} options.payload - Event payload
 * @param {string|Object|null} options.spec - Spec fixture key, parsed object, or null
 * @param {Function} options.expectCheck - Function to assert on check creation
 * @param {Object} options.extraOctokit - Additional octokit methods to mock
 * @returns {Array} Array of check creation calls
 */
export async function testEventHandler(options) {
  const { event, payload, spec, expectCheck, extraOctokit = {} } = options;
  
  // Convert spec fixture to parsed object if needed
  let configResponse = spec;
  if (typeof spec === 'string') {
    const { SPEC_FIXTURES } = await import('../fixtures/repo-specs.js');
    configResponse = yaml.load(SPEC_FIXTURES[spec]);
  }
  
  // Track all check creation calls
  const calls = [];
  
  // Create mock context with flexible event name
  const mockContext = {
    name: event.split('.')[0], // 'pull_request' or 'check_suite'
    payload,
    repo: (params = {}) => ({ 
      owner: payload?.repository?.owner?.login || 'test-org',
      repo: payload?.repository?.name || 'test-repo',
      ...params 
    }),
    log: {
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {}
    },
    octokit: {
      config: {
        get: async () => ({ config: configResponse })
      },
      checks: {
        create: async (params) => {
          calls.push(params);
          if (expectCheck) {
            expectCheck(params);
          }
          return { data: { id: 1 } };
        }
      },
      ...extraOctokit,
      __debug_extra: extraOctokit
    }
  };
  
  // Extract and call the handler
  const appModule = await import('../../index.js');
  const handler = extractHandler(appModule.default, event);
  await handler(mockContext);
  
  return calls;
}

/**
 * High-level helper for common test patterns (legacy function)
 * @param {Object} options
 * @param {Object} options.payload - PR payload
 * @param {string|Object|null} options.spec - Spec fixture key, parsed object, or null
 * @param {Function} options.expectCheck - Function to assert on check creation
 */
export async function testPullRequestHandler(options) {
  const { payload, spec, expectCheck } = options;
  
  return await testEventHandler({
    event: 'pull_request.opened',
    payload,
    spec,
    expectCheck
  });
}