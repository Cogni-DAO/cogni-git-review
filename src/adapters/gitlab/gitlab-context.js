/**
 * GitLab BaseContext implementation - like local-context.js
 */

import { Gitlab } from '@gitbeaker/rest';
import { environment } from '../../env.js';
import YAML from 'yaml';

/**
 * Create GitLab client instance
 * @returns {Gitlab} GitLab API client
 */
function createGitLabClient() {
  if (!environment.GITLAB_PAT) {
    throw new Error('GITLAB_PAT environment variable is required');
  }
  
  return new Gitlab({
    token: environment.GITLAB_PAT,
    host: environment.GITLAB_BASE_URL || 'https://gitlab.com'
  });
}

/**
 * Extract project ID from transformed payload
 * @param {object} payload - Transformed payload
 * @returns {number} GitLab project ID
 */
function getProjectId(payload) {
  // In GitLab webhooks, project ID is available in the original payload
  // The transformer should preserve this information
  return payload.repository.id;
}

/**
 * Transform GitHub-style file content response to match expected format
 * @param {object} gitlabResponse - GitLab API response
 * @returns {object} GitHub-compatible response
 */
function transformFileContent(gitlabResponse) {
  return {
    data: {
      content: gitlabResponse.content, // Already base64 encoded by GitLab API
      encoding: gitlabResponse.encoding || 'base64',
      size: gitlabResponse.size,
      sha: gitlabResponse.blob_id,
      type: 'file'
    }
  };
}

/**
 * Create GitLab context implementing BaseContext interface
 * @param {object} transformedPayload - GitHub-like payload
 * @returns {import('../base-context.d.ts').BaseContext} GitLab context
 */
export function createGitLabContext(transformedPayload) {
  const gitlab = createGitLabClient();
  const projectId = getProjectId(transformedPayload);
  
  return {
    payload: transformedPayload,
    
    repo: (params = {}) => ({
      owner: transformedPayload.repository.owner.login,
      repo: transformedPayload.repository.name,
      ...params
    }),

    // GitLab VCS interface implementation
    vcs: {
      config: {
        get: async ({ _owner, _repo, path }) => {
          try {
            // GitLab requires ref parameter - use HEAD for default branch
            const response = await gitlab.RepositoryFiles.show(projectId, path, 'HEAD');
            const content = Buffer.from(response.content, 'base64').toString('utf8');
            return { config: YAML.parse(content) };
          } catch (error) {
            if (error.response?.status === 404) {
              throw new Error(`Config file not found: ${path}`);
            }
            throw error;
          }
        }
      },
      pulls: {
        get: async ({ _owner, _repo, pull_number }) => {
          try {
            const mr = await gitlab.MergeRequests.show(projectId, pull_number);
            return {
              data: {
                id: mr.id,
                number: mr.iid,
                state: mr.state,
                title: mr.title,
                body: mr.description,
                head: {
                  sha: mr.sha,
                  ref: mr.source_branch
                },
                base: {
                  sha: mr.target_branch,
                  ref: mr.target_branch
                },
                changed_files: mr.changes_count,
                additions: 0, // Not directly available in GitLab
                deletions: 0  // Not directly available in GitLab
              }
            };
          } catch (error) {
            throw new Error(`Failed to get merge request: ${error.message}`);
          }
        },
        listFiles: async ({ _owner, _repo, pull_number }) => {
          try {
            const changes = await gitlab.MergeRequests.allDiffs(projectId, pull_number);
            return {
              data: changes.map(change => ({
                filename: change.new_path || change.old_path,
                status: change.new_file ? 'added' : (change.deleted_file ? 'removed' : 'modified'),
                additions: 0, // Not available in GitLab diff format
                deletions: 0, // Not available in GitLab diff format
                changes: 0,
                patch: change.diff
              }))
            };
          } catch (error) {
            throw new Error(`Failed to list merge request files: ${error.message}`);
          }
        }
      },
      repos: {
        compareCommits: async ({ _owner, _repo, base, head }) => {
          try {
            const comparison = await gitlab.Repositories.compare(projectId, base, head);
            return {
              data: {
                files: comparison.diffs?.map(diff => ({
                  filename: diff.new_path || diff.old_path,
                  status: diff.new_file ? 'added' : (diff.deleted_file ? 'removed' : 'modified'),
                  additions: 0, // Not available
                  deletions: 0, // Not available
                  changes: 0,
                  patch: diff.diff
                })) || []
              }
            };
          } catch (error) {
            throw new Error(`Failed to compare commits: ${error.message}`);
          }
        },
        getContent: async ({ _owner, _repo, path, ref }) => {
          try {
            // GitLab requires ref parameter - use HEAD if not provided
            const gitlabRef = ref || 'HEAD';
            const response = await gitlab.RepositoryFiles.show(projectId, path, gitlabRef);
            return transformFileContent(response);
          } catch (error) {
            if (error.response?.status === 404) {
              throw new Error(`File not found: ${path}`);
            }
            throw error;
          }
        },
        listPullRequestsAssociatedWithCommit: async ({ _commit_sha }) => {
          try {
            // GitLab doesn't have direct equivalent, return synthetic data
            // In practice, this is only used for rerun events which GitLab handles differently
            return {
              data: [{
                id: transformedPayload.pull_request?.id,
                number: transformedPayload.pull_request?.number,
                state: 'open'
              }].filter(pr => pr.id)
            };
          } catch (error) {
            throw new Error(`Failed to get associated pull requests: ${error.message}`);
          }
        }
      },
      checks: {
        create: async ({ name, head_sha, conclusion, output }) => {
          try {
            // GitLab uses commit statuses instead of check runs
            // Map GitHub check conclusions to GitLab commit states
            let state;
            if (conclusion === 'success') state = 'success';
            else if (conclusion === 'failure') state = 'failed';
            else if (conclusion === 'cancelled') state = 'canceled';
            else if (conclusion === 'neutral') state = 'skipped';  // TODO: value off err-on-neutral flag
            else state = 'pending';

            const result = await gitlab.Commits.editStatus(projectId, head_sha, {
              state,
              name,
              description: output?.summary || `${name} check`,
              target_url: output?.title ? `#${name}` : undefined
            });

            return {
              data: {
                id: result.id,
                status: state,
                conclusion: state === 'success' ? 'success' : (state === 'failed' ? 'failure' : null)
              }
            };
          } catch (error) {
            console.error('GitLab commit status creation failed:', error);
            throw new Error(`Failed to create commit status: ${error.message}`);
          }
        }
      },
      issues: {
        createComment: async ({ issue_number, body }) => {
          try {
            // For merge requests, use merge request notes
            const note = await gitlab.MergeRequestNotes.create(projectId, issue_number, {
              body
            });
            return {
              data: {
                id: note.id,
                body: note.body
              }
            };
          } catch (error) {
            console.error('GitLab comment creation failed:', error);
            throw new Error(`Failed to create comment: ${error.message}`);
          }
        }
      },
      rest: {
        pulls: {
          listFiles: async ({ _owner, _repo, pull_number }) => {
            // Same implementation as vcs.pulls.listFiles
            try {
              const changes = await gitlab.MergeRequests.allDiffs(projectId, pull_number);
              return {
                data: changes.map(change => ({
                  filename: change.new_path || change.old_path,
                  status: change.new_file ? 'added' : (change.deleted_file ? 'removed' : 'modified'),
                  additions: 0, // Not available in GitLab diff format
                  deletions: 0, // Not available in GitLab diff format
                  changes: 0,
                  patch: change.diff
                }))
              };
            } catch (error) {
              throw new Error(`Failed to list merge request files: ${error.message}`);
            }
          }
        }
      }
    },

    log: console // Basic logging
  };
}