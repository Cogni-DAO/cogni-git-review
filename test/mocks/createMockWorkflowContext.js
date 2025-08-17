/**
 * Mock context factory for external gate testing
 */

import nock from 'nock';

/**
 * Create a mock context for external gate testing
 * @param {object} options - Configuration options
 * @param {string} options.repoOwner - Repository owner
 * @param {string} options.repoName - Repository name  
 * @param {string} options.headSha - PR head SHA
 * @param {object} options.workflowRuns - Mock workflow run responses
 * @param {object} options.artifacts - Mock artifact responses
 * @param {Buffer} options.artifactContent - ZIP content to return
 * @param {AbortController} [options.abortController] - Optional abort controller
 * @returns {object} Mock context with octokit, pr, repo, logger, abort
 */
export function createMockWorkflowContext({
  repoOwner = 'testorg',
  repoName = 'testrepo', 
  headSha = 'abc123def456',
  workflowRuns = [],
  artifacts = [],
  artifactContent = Buffer.alloc(0),
  abortController = null
} = {}) {
  
  // Create mock PR object
  const mockPR = {
    head: {
      sha: headSha,
      repo: {
        name: repoName,
        owner: { login: repoOwner }
      }
    },
    number: 123
  };
  
  // Create repo function that adds owner/repo to parameters
  const mockRepo = (params = {}) => ({
    owner: repoOwner,
    repo: repoName,
    ...params
  });
  
  // Create mock logger
  const mockLogger = (level, message) => {
    // console.log(`[${level.toUpperCase()}] ${message}`);
  };
  
  // Create mock abort signal
  const mockAbort = abortController || {
    aborted: false,
    signal: {
      aborted: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    }
  };
  
  // Create mock Octokit with actions methods
  const mockOctokit = {
    actions: {
      listWorkflowRunsForRepo: async (params) => {
        if (mockAbort.aborted) {
          throw new Error('aborted');
        }
        return { data: { workflow_runs: workflowRuns } };
      },
      
      listWorkflowRunArtifacts: async (params) => {
        if (mockAbort.aborted) {
          throw new Error('aborted');
        }
        return { data: { artifacts } };
      },
      
      downloadArtifact: async (params) => {
        if (mockAbort.aborted) {
          throw new Error('aborted');
        }
        return { data: artifactContent };
      }
    }
  };
  
  return {
    octokit: mockOctokit,
    pr: mockPR,
    repo: mockRepo,
    logger: mockLogger,
    abort: mockAbort
  };
}

/**
 * Create nock-based HTTP mocks for GitHub API
 * @param {object} options - Mock configuration
 * @returns {object} Nock scope for cleanup
 */
export function createWorkflowAPIMocks({
  repoOwner = 'testorg',
  repoName = 'testrepo',
  headSha = 'abc123def456',
  workflowRuns = [],
  artifacts = [],
  artifactContent = Buffer.alloc(0),
  runId = 12345
} = {}) {
  
  const scope = nock('https://api.github.com');
  
  // Mock workflow runs API
  scope
    .get(`/repos/${repoOwner}/${repoName}/actions/runs`)
    .query(query => query.head_sha === headSha)
    .reply(200, { workflow_runs: workflowRuns });
  
  // Mock artifacts API
  scope
    .get(`/repos/${repoOwner}/${repoName}/actions/runs/${runId}/artifacts`)
    .reply(200, { artifacts });
  
  // Mock artifact download API
  if (artifacts.length > 0) {
    scope
      .get(`/repos/${repoOwner}/${repoName}/actions/artifacts/${artifacts[0].id}/zip`)
      .reply(200, artifactContent);
  }
  
  return scope;
}

/**
 * Create successful workflow run fixture
 * @param {object} options - Run configuration
 * @returns {object} Workflow run object
 */
export function createWorkflowRun({
  id = 12345,
  runNumber = 42,
  name = 'Test Workflow',
  headSha = 'abc123def456',
  status = 'completed',
  conclusion = 'success',
  event = 'pull_request',
  updatedAt = new Date().toISOString()
} = {}) {
  return {
    id,
    run_number: runNumber,
    name,
    head_sha: headSha,
    status,
    conclusion,
    event,
    updated_at: updatedAt,
    created_at: updatedAt
  };
}

/**
 * Create artifact fixture
 * @param {object} options - Artifact configuration  
 * @returns {object} Artifact object
 */
export function createArtifact({
  id = 98765,
  name = 'test-artifact',
  sizeInBytes = 1024,
  createdAt = new Date().toISOString()
} = {}) {
  return {
    id,
    name,
    size_in_bytes: sizeInBytes,
    created_at: createdAt,
    archive_download_url: `https://api.github.com/repos/test/test/actions/artifacts/${id}/zip`
  };
}

/**
 * Preset mock contexts for common test scenarios
 */
export const MOCK_CONTEXTS = {
  
  /** Happy path with successful workflow and artifact */
  get happyPath() {
    const run = createWorkflowRun({ conclusion: 'success' });
    const artifact = createArtifact({ name: 'eslint-report' });
    
    return createMockWorkflowContext({
      workflowRuns: [run],
      artifacts: [artifact],
      artifactContent: Buffer.from('{"test": "content"}')
    });
  },
  
  /** No workflow runs found */
  get noRuns() {
    return createMockWorkflowContext({
      workflowRuns: [],
      artifacts: [],
      artifactContent: Buffer.alloc(0)
    });
  },
  
  /** Workflow run exists but no artifacts */
  get noArtifacts() {
    const run = createWorkflowRun({ conclusion: 'success' });
    
    return createMockWorkflowContext({
      workflowRuns: [run],
      artifacts: [],
      artifactContent: Buffer.alloc(0)
    });
  },
  
  /** Aborted context for timeout testing */
  get aborted() {
    const abortController = { 
      aborted: true,
      signal: { aborted: true }
    };
    
    return createMockWorkflowContext({
      abortController,
      workflowRuns: [],
      artifacts: [],
      artifactContent: Buffer.alloc(0)
    });
  }
};