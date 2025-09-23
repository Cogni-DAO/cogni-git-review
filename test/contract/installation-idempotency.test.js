import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { extractHandler } from '../helpers/handler-harness.js';

import installationReposAddedPayload from '../fixtures/installation_repositories.added.complete.json' with { type: 'json' };

describe('Installation Idempotency Contract Tests', () => {
  let originalReadFileSync;

  beforeEach(() => {
    // Mock fs.readFileSync for template files (DRY principle)
    originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (path, encoding) => {
      if (path.includes('repo-spec-template.yaml')) {
        return `schema_version: '0.1.4'
intent:
  name: REPO_NAME
  goals:
    - Test goal
gates:
  - type: review-limits
    id: review_limits`;
      } else if (path.includes('ai-rule-template.yaml')) {
        return `name: "AI Rule Template"
description: "Template for AI-powered rules"
threshold: 0.8`;
      }
      return originalReadFileSync.call(fs, path, encoding);
    };
  });

  afterEach(() => {
    fs.readFileSync = originalReadFileSync;
  });

  test('installation handler is idempotent when branch already exists', async () => {
    const apiCalls = [];
    
    const mockContext = {
      name: 'installation_repositories',
      payload: installationReposAddedPayload,
      octokit: {
        repos: {
          getContent: async (params) => {
            apiCalls.push({ type: 'getContent', params });
            
            // Mock that repo-spec doesn't exist on default branch
            if (params.path === '.cogni/repo-spec.yaml' && !params.ref) {
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.cogni/repo-spec.yaml' && params.ref === 'cogni/welcome-setup') {
              // File doesn't exist on branch yet
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.cogni/rules/ai-rule-template.yaml' && params.ref === 'cogni/welcome-setup') {
              // AI rule file doesn't exist on branch yet
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            }
            throw new Error(`Unexpected getContent call: ${params.path} ref: ${params.ref || 'default'}`);
          },
          
          get: async (params) => {
            apiCalls.push({ type: 'getRepo', params });
            return { data: { default_branch: 'main' } };
          },
          
          createOrUpdateFileContents: async (params) => {
            apiCalls.push({ type: 'createFile', params });
            return { data: { content: { sha: 'file-sha' } } };
          }
        },
        
        pulls: {
          list: async (params) => {
            apiCalls.push({ type: 'listPulls', params });
            // No existing welcome PRs
            return { data: [] };
          },
          
          create: async (params) => {
            apiCalls.push({ type: 'createPR', params });
            return { data: { number: 42, id: 123 } };
          }
        },
        
        git: {
          getRef: async (params) => {
            apiCalls.push({ type: 'getRef', params });
            return { data: { object: { sha: 'abc123def456789012345678901234567890abcd' } } };
          },
          
          createRef: async (params) => {
            apiCalls.push({ type: 'createRef', params });
            
            // Simulate branch already exists (422 error)
            const error = new Error('Reference already exists');
            error.status = 422;
            throw error;
          }
        },
        
        issues: {
          addLabels: async (params) => {
            apiCalls.push({ type: 'addLabels', params });
            return { data: [] };
          }
        }
      }
    };

    // Extract handler using project's established pattern
    const appModule = await import('../../index.js');
    const installationHandler = extractHandler(appModule.default, 'installation_repositories.added');

    // Execute handler
    await installationHandler(mockContext);
    
    // Verify handler gracefully handled branch existence
    const callTypes = apiCalls.map(call => call.type);
    assert(callTypes.includes('getRef'), 'Should get branch ref');
    assert(callTypes.includes('createRef'), 'Should attempt to create branch');
    
    // Should continue with setup despite branch existing
    assert(callTypes.includes('getRepo'), 'Should continue getting repo info');
  });

  test('installation handler is idempotent when welcome PR already exists', async () => {
    const apiCalls = [];
    
    const mockContext = {
      name: 'installation_repositories',
      payload: installationReposAddedPayload,
      octokit: {
        repos: {
          getContent: async (params) => {
            apiCalls.push({ type: 'getContent', params });
            
            // Mock that repo-spec doesn't exist
            if (params.path === '.cogni/repo-spec.yaml' && !params.ref) {
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            }
            throw new Error(`Unexpected getContent call: ${params.path}`);
          },
          
          get: async (params) => {
            apiCalls.push({ type: 'getRepo', params });
            return { data: { default_branch: 'main' } };
          }
        },
        
        pulls: {
          list: async (params) => {
            apiCalls.push({ type: 'listPulls', params });
            
            // Mock existing welcome PR
            return { 
              data: [{
                number: 42,
                head: { ref: 'cogni/welcome-setup' },
                labels: [{ name: 'cogni-setup' }]
              }]
            };
          }
        },
        
        git: {
          // No git operations should be called when PR exists
        }
      }
    };

    const appModule = await import('../../index.js');
    const installationHandler = extractHandler(appModule.default, 'installation_repositories.added');

    await installationHandler(mockContext);
    
    const callTypes = apiCalls.map(call => call.type);
    
    // Should check for existing PR and stop early
    assert(callTypes.includes('getContent'), 'Should check if repo-spec exists');
    assert(callTypes.includes('listPulls'), 'Should check for existing PRs');
    assert(!callTypes.includes('getRef'), 'Should not attempt git operations when PR exists');
  });

  test('installation handler is idempotent when files already exist on branch', async () => {
    const apiCalls = [];
    
    const mockContext = {
      name: 'installation_repositories', 
      payload: installationReposAddedPayload,
      octokit: {
        repos: {
          getContent: async (params) => {
            apiCalls.push({ type: 'getContent', params });
            
            if (params.path === '.cogni/repo-spec.yaml' && !params.ref) {
              // Repo-spec doesn't exist on default branch
              const error = new Error('Not Found');
              error.status = 404;
              throw error;
            } else if (params.path === '.cogni/repo-spec.yaml' && params.ref === 'cogni/welcome-setup') {
              // File already exists on branch
              return { 
                data: { 
                  content: Buffer.from('existing content').toString('base64'),
                  sha: 'existing-sha'
                }
              };
            } else if (params.path === '.cogni/rules/ai-rule-template.yaml' && params.ref === 'cogni/welcome-setup') {
              // AI rule file already exists on branch
              return {
                data: {
                  content: Buffer.from('existing ai rule content').toString('base64'),
                  sha: 'existing-ai-sha'
                }
              };
            }
            
            throw new Error(`Unexpected getContent call: ${params.path} ref: ${params.ref}`);
          },
          
          get: async (params) => {
            apiCalls.push({ type: 'getRepo', params });
            return { data: { default_branch: 'main' } };
          },
          
          createOrUpdateFileContents: async (params) => {
            apiCalls.push({ type: 'createFile', params });
            // Should not be called when files exist
            throw new Error('Should not create files when they already exist');
          }
        },
        
        pulls: {
          list: async (params) => {
            apiCalls.push({ type: 'listPulls', params });
            return { data: [] }; // No existing PRs
          },
          
          create: async (params) => {
            apiCalls.push({ type: 'createPR', params });
            return { data: { number: 42, id: 123 } };
          }
        },
        
        git: {
          getRef: async (params) => {
            apiCalls.push({ type: 'getRef', params });
            return { data: { object: { sha: 'abc123def456789012345678901234567890abcd' } } };
          },
          
          createRef: async (params) => {
            apiCalls.push({ type: 'createRef', params });
            return { data: { ref: 'refs/heads/cogni/welcome-setup' } };
          }
        },
        
        issues: {
          addLabels: async (params) => {
            apiCalls.push({ type: 'addLabels', params });
            return { data: [] };
          }
        }
      }
    };

    const appModule = await import('../../index.js');
    const installationHandler = extractHandler(appModule.default, 'installation_repositories.added');

    await installationHandler(mockContext);
    
    const callTypes = apiCalls.map(call => call.type);
    
    // Should create branch and PR but skip file creation
    assert(callTypes.includes('createRef'), 'Should create branch');
    assert(callTypes.includes('createPR'), 'Should create PR');
    assert(!callTypes.includes('createFile'), 'Should not create files when they exist');
    
    // Should check for file existence on branch
    const getContentCalls = apiCalls.filter(call => 
      call.type === 'getContent' && call.params.ref === 'cogni/welcome-setup'
    );
    assert(getContentCalls.length >= 2, 'Should check existence of both template files on branch');
  });

});