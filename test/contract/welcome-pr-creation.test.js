import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

import installationReposAddedPayload from '../fixtures/installation_repositories.added.complete.json' with { type: 'json' };

describe('Welcome PR Creation Contract Tests', () => {
  let originalReadFileSync;

  beforeEach(() => {
    // Mock fs.readFileSync to eliminate filesystem dependency
    originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (path, encoding) => {
      if (path.includes('repo-spec-template.yaml')) {
        // Return minimal valid repo-spec template with intent block
        return `schema_version: '0.1.4'
intent:
  name: REPO_NAME
  goals:
    - Test goal
gates:
  - type: review-limits
    id: review_limits`;
      } else if (path.includes('ai-rule-template.yaml')) {
        // Return minimal AI rule template
        return `name: "AI Rule Template"
description: "Template for AI-powered rules"
threshold: 0.8`;
      }
      // Fall back to original for other files
      return originalReadFileSync.call(fs, path, encoding);
    };
  });

  afterEach(() => {
    // Restore original fs.readFileSync
    fs.readFileSync = originalReadFileSync;
  });

  test('installation_repositories.added creates welcome branch, files, and PR', async () => {
    // Track all API calls made for verification
    const apiCalls = [];
    
    const mockContext = {
      name: 'installation_repositories',
      payload: installationReposAddedPayload,
      octokit: {
        repos: {
          getContent: async (params) => {
            apiCalls.push({ type: 'getContent', params });
            
            // Mock responses for different content checks
            if (params.path === '.cogni/repo-spec.yaml' && !params.ref) {
              // Check if repo-spec exists on default branch (should return 404 for new install)  
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.cogni/repo-spec.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if repo-spec exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.cogni/rules/ai-rule-template.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if AI rule template exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.allstar/allstar.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if Allstar config exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.allstar/branch-protection.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if Allstar branch protection exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.github/workflows/ci.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if CI workflow exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.github/workflows/security.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if Security workflow exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.github/workflows/release-please.yaml' && params.ref === 'cogni/welcome-setup') {
              // Check if Release workflow exists on branch (should return 404 for new file)
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            }
            
            throw new Error(`Unexpected getContent call: ${params.path}`);
          },
          
          get: async (params) => {
            apiCalls.push({ type: 'getRepo', params });
            
            // Return repo info with default branch
            assert.strictEqual(params.owner, 'derekg1729');
            assert.strictEqual(params.repo, 'cogni-git-review');
            return { data: { default_branch: 'main' } };
          },
          
          createOrUpdateFileContents: async (params) => {
            apiCalls.push({ type: 'createFile', params });
            
            if (params.path === '.cogni/repo-spec.yaml') {
              // Verify repo-spec file creation
              assert.strictEqual(params.message, 'feat(cogni): add initial repo-spec configuration');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              // Decode and verify template customization (T4 test)
              const content = Buffer.from(params.content, 'base64').toString('utf8');
              assert(content.includes('name: cogni-git-review')); // Template customized with repo name
              assert(!content.includes('REPO_NAME')); // Template placeholder should be replaced
              
              return { data: { content: { sha: 'file1sha' } } };
            } else if (params.path === '.cogni/rules/ai-rule-template.yaml') {
              // Verify AI rule template file creation
              assert.strictEqual(params.message, 'feat(cogni): add AI rule template');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file2sha' } } };
            } else if (params.path === '.allstar/allstar.yaml') {
              // Verify Allstar config file creation
              assert.strictEqual(params.message, 'feat(allstar): add allstar configuration');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file3sha' } } };
            } else if (params.path === '.allstar/branch-protection.yaml') {
              // Verify Allstar branch protection file creation
              assert.strictEqual(params.message, 'feat(allstar): add branch protection policy');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file4sha' } } };
            } else if (params.path === '.github/workflows/ci.yaml') {
              // Verify CI workflow file creation
              assert.strictEqual(params.message, 'feat(ci): add CI workflow');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file5sha' } } };
            } else if (params.path === '.github/workflows/security.yaml') {
              // Verify Security workflow file creation
              assert.strictEqual(params.message, 'feat(security): add security workflow');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file6sha' } } };
            } else if (params.path === '.github/workflows/release-please.yaml') {
              // Verify Release workflow file creation
              assert.strictEqual(params.message, 'feat(release): add release workflow');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file7sha' } } };
            }
            
            throw new Error(`Unexpected createOrUpdateFileContents call: ${params.path}`);
          }
        },
        
        pulls: {
          list: async (params) => {
            apiCalls.push({ type: 'listPulls', params });
            
            // Return empty array (no existing welcome PRs)
            assert.strictEqual(params.state, 'open');
            return { data: [] };
          },
          
          create: async (params) => {
            apiCalls.push({ type: 'createPR', params });
            
            // Verify PR creation (T1 and T3 test)
            assert.strictEqual(params.title, 'chore(cogni): bootstrap repo-spec for cogni-git-review');
            assert.strictEqual(params.head, 'cogni/welcome-setup');
            assert.strictEqual(params.base, 'main');
            assert(params.body); // PR body with script
            
            // Verify PR body contains Allstar installation instructions (T3 test)
            assert(params.body.includes('Install Allstar'));
            assert(params.body.includes('https://github.com/apps/allstar-app'));
            assert(params.body.includes('Cogni Git PR Review'));
            
            return { data: { number: 42, id: 123 } };
          }
        },
        
        git: {
          getRef: async (params) => {
            apiCalls.push({ type: 'getRef', params });
            
            // Return default branch ref
            assert.strictEqual(params.ref, 'heads/main');
            return { data: { object: { sha: 'abc123def456789012345678901234567890abcd' } } };
          },
          
          createRef: async (params) => {
            apiCalls.push({ type: 'createRef', params });
            
            // Verify branch creation
            assert.strictEqual(params.ref, 'refs/heads/cogni/welcome-setup');
            assert.strictEqual(params.sha, 'abc123def456789012345678901234567890abcd');
            
            return { data: { ref: 'refs/heads/cogni/welcome-setup' } };
          }
        },
        
        issues: {
          addLabels: async (params) => {
            apiCalls.push({ type: 'addLabels', params });
            
            // Verify label addition
            assert.strictEqual(params.issue_number, 42);
            assert.deepStrictEqual(params.labels, ['cogni-setup']);
            
            return { data: [] };
          }
        }
      }
    };

    // Import app and extract installation handler (following existing pattern)
    const appModule = await import('../../index.js');
    let installationHandler;
    
    const mockApp = {
      on: (event, handler) => {
        if (event === 'installation_repositories.added') {
          installationHandler = handler;
        }
      },
      onAny: () => {} // No-op for LOG_ALL_EVENTS
    };
    
    appModule.default(mockApp);
    assert(installationHandler, 'Should have extracted installation handler');

    // Execute the handler
    await installationHandler(mockContext);
    
    // Verify key API operations occurred (avoid brittle exact counts)
    const callTypes = apiCalls.map(call => call.type);
    
    // Assert presence of critical operations
    assert(callTypes.includes('getContent'), 'Should check if files exist');
    assert(callTypes.includes('getRepo'), 'Should get repo info');  
    assert(callTypes.includes('createRef'), 'Should create branch');
    assert(callTypes.includes('createFile'), 'Should create files');
    assert(callTypes.includes('createPR'), 'Should create PR');
    
    // Assert key ordering constraints (operations must happen in logical sequence)
    assert(callTypes.indexOf('getRef') < callTypes.indexOf('createRef'), 'Should get branch ref before creating branch');
    assert(callTypes.indexOf('createRef') < callTypes.indexOf('createFile'), 'Should create branch before adding files');
    assert(callTypes.indexOf('createFile') < callTypes.indexOf('createPR'), 'Should create files before creating PR');
    assert(callTypes.indexOf('createPR') < callTypes.indexOf('addLabels'), 'Should create PR before adding labels');
  });

});