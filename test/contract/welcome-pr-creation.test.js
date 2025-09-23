import { describe, test } from 'node:test';
import assert from 'node:assert';

import installationReposAddedPayload from '../fixtures/installation_repositories.added.complete.json' with { type: 'json' };

describe('Welcome PR Creation Contract Tests', () => {

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
              
              return { data: { content: { sha: 'file1sha' } } };
            } else if (params.path === '.cogni/rules/ai-rule-template.yaml') {
              // Verify AI rule template file creation
              assert.strictEqual(params.message, 'feat(cogni): add AI rule template');
              assert.strictEqual(params.branch, 'cogni/welcome-setup');
              assert(params.content); // Base64 encoded content
              
              return { data: { content: { sha: 'file2sha' } } };
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
            
            // Verify PR body contains correct script with repo-specific values (T3 test)
            assert(params.body.includes('repos/derekg1729/cogni-git-review/branches/main/protection'));
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
    
    // Verify the complete API call sequence (T1 test validation)
    assert.strictEqual(apiCalls.length, 11, 'Should have made 11 API calls');
    
    // Verify call types in expected order
    const callTypes = apiCalls.map(call => call.type);
    const expectedTypes = [
      'getContent',    // Check if repo-spec exists
      'listPulls',     // Check if welcome PR exists  
      'getRepo',       // Get repo info for default branch
      'getRef',        // Get default branch ref
      'createRef',     // Create welcome branch
      'getContent',    // Check if repo-spec exists on branch
      'createFile',    // Create repo-spec file
      'getContent',    // Check if AI template exists on branch  
      'createFile',    // Create AI template file
      'createPR',      // Create PR
      'addLabels'      // Add label to PR
    ];
    
    assert.deepStrictEqual(callTypes, expectedTypes, 'API calls should be in correct order');
  });

});