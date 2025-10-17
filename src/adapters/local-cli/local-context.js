/**
 * LocalContext class - implements BaseContext interface for local git operations
 * Provides VCS interface backed by git CLI commands and filesystem access
 * @typedef {import('../base-context.d.ts').BaseContext} BaseContext
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { parseGitStats, parseGitNameStatus, execGitCommand, isGitRepository } from './git-utils.js';

/**
 * @implements {BaseContext}
 */
export class LocalContext {
  constructor(baseRef, headRef, repoPath) {
    this.baseRef = baseRef;
    this.headRef = headRef;
    this.repoPath = path.resolve(repoPath);
    
    // Validate git repository
    if (!isGitRepository(this.repoPath)) {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }
    
    this._createMinimalPayload();
    this._createVCS();
  }

  _createMinimalPayload() {
    const repoName = path.basename(this.repoPath);
    
    // Minimal payload with only fields gates actually read
    this.payload = {
      repository: {
        name: repoName,
        full_name: `local/${repoName}`
      },
      installation: { id: 'local-cli' },
      pull_request: {
        number: 1,
        state: 'open',
        title: `Local diff: ${this.baseRef}...${this.headRef}`,
        head: {
          sha: this._getCommitSha(this.headRef),
          repo: {
            name: repoName
          }
        },
        base: {
          sha: this._getCommitSha(this.baseRef)
        }
      },
      action: 'opened'
    };
  }

  _getCommitSha(ref) {
    try {
      return execGitCommand(`git rev-parse ${ref}`, this.repoPath).trim();
    } catch (error) {
      throw new Error(`Failed to get commit SHA for ${ref}: ${error.message}`);
    }
  }


  repo(options = {}) {
    return {
      owner: 'local',
      repo: this.payload.repository.name,
      ...options
    };
  }

  _createVCS() {
    this.vcs = {
      config: {
        get: async ({ path: filePath }) => {
          try {
            const fullPath = path.join(this.repoPath, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            return { config: YAML.parse(content) };
          } catch {
            console.warn(`Config file not found: ${filePath}`);
            return { config: null };
          }
        }
      },

      pulls: {
        get: async () => {
          try {
            const statsOutput = execGitCommand(`git diff --shortstat ${this.baseRef}...${this.headRef}`, this.repoPath);
            const [changed_files, additions, deletions] = parseGitStats(statsOutput);
            return { data: { changed_files, additions, deletions } };
          } catch (error) {
            throw new Error(`Failed to get PR stats: ${error.message}`);
          }
        },

        listFiles: async () => {
          try {
            const output = execGitCommand(`git diff --name-status ${this.baseRef}...${this.headRef}`, this.repoPath);
            const files = parseGitNameStatus(output);
            return { data: files };
          } catch (error) {
            throw new Error(`Failed to list changed files: ${error.message}`);
          }
        }
      },

      repos: {
        getContent: async ({ path: filePath }) => {
          try {
            const fullPath = path.join(this.repoPath, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            return { 
              data: { 
                content: Buffer.from(content).toString('base64'),
                encoding: 'base64'
              } 
            };
          } catch {
            throw new Error(`File not found: ${filePath}`);
          }
        }
      },

      // Support both direct and rest namespaced access patterns
      rest: {
        pulls: {
          listFiles: async (...args) => this.vcs.pulls.listFiles(...args)
        }
      },

      checks: {
        create: async (params) => {
          // Output check results to console with proper formatting
          let status;
          if (params.conclusion === 'success') {
            status = '✅';
          } else if (params.conclusion === 'failure') {
            status = '❌';
          } else {
            status = '⚠️';
          }
          console.log(`${status} Check: ${params.conclusion.toUpperCase()} - ${params.output?.summary || 'No summary'}`);
          
          if (params.output?.text) {
            console.log('\n📋 Details:');
            console.log(params.output.text);
          }
          
          return { 
            data: { 
              id: 'local-check',
              html_url: 'local://check'
            } 
          };
        }
      },

      issues: {
        createComment: async ({ body }) => {
          console.log('\n💬 PR Comment:');
          console.log('─'.repeat(50));
          console.log(body);
          console.log('─'.repeat(50));
          
          return { 
            data: { 
              id: 'local-comment',
              html_url: 'local://comment'
            } 
          };
        }
      }
    };
  }
}