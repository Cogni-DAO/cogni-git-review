/**
 * LocalContext class - implements BaseContext interface for local git operations
 * Provides VCS interface backed by git CLI commands and filesystem access
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { HostAdapter } from '../base-context.d.ts';
import { parseGitStats, parseGitNameStatus, execGitCommand } from './git-utils.js';

export class LocalContext extends HostAdapter {
  constructor(baseRef, headRef, repoPath) {
    super();
    this.baseRef = baseRef;
    this.headRef = headRef;
    this.repoPath = path.resolve(repoPath);
    
    this._setupPayload();
    this._setupVCS();
  }

  _setupPayload() {
    // Extract repository info from git remote or use defaults
    let repoName = path.basename(this.repoPath);
    let ownerName = 'local';
    
    try {
      // Try to extract from git remote
      const remoteUrl = execGitCommand('git remote get-url origin', this.repoPath);
      const match = remoteUrl.match(/[:/]([^/]+)\/([^/.]+)/);
      if (match) {
        [, ownerName, repoName] = match;
      }
    } catch (error) {
      // Use defaults if git remote fails
    }

    // Generate PR data from git diff
    const prStats = this._generatePRStats();
    
    // Create GitHub-like payload structure
    this.payload = {
      repository: {
        name: repoName,
        full_name: `${ownerName}/${repoName}`,
        owner: { login: ownerName }
      },
      installation: { 
        id: 'local-cli' 
      },
      pull_request: {
        id: 1,
        number: 1,
        state: 'open',
        title: `Local diff: ${this.baseRef}...${this.headRef}`,
        head: {
          sha: this._getCommitSha(this.headRef),
          repo: {
            name: repoName,
            full_name: `${ownerName}/${repoName}`
          }
        },
        base: {
          sha: this._getCommitSha(this.baseRef),
          repo: {
            name: repoName,
            full_name: `${ownerName}/${repoName}`
          }
        },
        ...prStats
      },
      action: 'opened'
    };
  }

  _generatePRStats() {
    try {
      const statsOutput = execGitCommand(`git diff --shortstat ${this.baseRef}...${this.headRef}`, this.repoPath);
      const [changed_files, additions, deletions] = parseGitStats(statsOutput);
      return { changed_files, additions, deletions };
    } catch (error) {
      return { changed_files: 0, additions: 0, deletions: 0 };
    }
  }

  _getCommitSha(ref) {
    try {
      return execGitCommand(`git rev-parse ${ref}`, this.repoPath);
    } catch (error) {
      return ref; // fallback to ref name
    }
  }

  repo(options = {}) {
    const { owner, repo } = this._extractRepoInfo();
    return {
      owner,
      repo,
      ...options
    };
  }

  _extractRepoInfo() {
    const { repository } = this.payload;
    return {
      owner: repository.owner.login,
      repo: repository.name
    };
  }

  _setupVCS() {
    this.vcs = {
      config: {
        get: async ({ path: filePath }) => {
          try {
            const fullPath = path.join(this.repoPath, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            return { config: YAML.parse(content) };
          } catch (error) {
            // Return empty config if file doesn't exist (matches GitHub behavior)
            return { config: null };
          }
        }
      },

      pulls: {
        get: async ({ pull_number }) => {
          const stats = this._generatePRStats();
          return { data: stats };
        },

        listFiles: async ({ pull_number }) => {
          try {
            const output = execGitCommand(`git diff --name-status ${this.baseRef}...${this.headRef}`, this.repoPath);
            const files = parseGitNameStatus(output);
            return { data: files };
          } catch (error) {
            return { data: [] };
          }
        }
      },

      repos: {
        getContent: async ({ path: filePath, ref }) => {
          try {
            const fullPath = path.join(this.repoPath, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            return { 
              data: { 
                content: Buffer.from(content).toString('base64'),
                encoding: 'base64'
              } 
            };
          } catch (error) {
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
          const status = params.conclusion === 'success' ? '✅' : 
                        params.conclusion === 'failure' ? '❌' : '⚠️';
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