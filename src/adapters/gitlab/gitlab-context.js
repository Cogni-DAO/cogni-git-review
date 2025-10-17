/**
 * GitLab BaseContext implementation - like local-context.js
 */

/**
 * Create GitLab context implementing BaseContext interface
 * @param {object} transformedPayload - GitHub-like payload
 * @returns {import('../base-context.d.ts').BaseContext} GitLab context
 */
export function createGitLabContext(transformedPayload) {
  return {
    payload: transformedPayload,
    
    repo: (params = {}) => ({
      owner: transformedPayload.repository.owner.login,
      repo: transformedPayload.repository.name,
      ...params
    }),

    // Minimal VCS interface (stub for now)
    vcs: {
      config: {
        get: async () => {
          throw new Error('GitLab VCS interface not implemented yet');
        }
      },
      pulls: {
        get: async () => {
          throw new Error('GitLab VCS interface not implemented yet');
        }
      },
      repos: {
        compareCommits: async () => {
          throw new Error('GitLab VCS interface not implemented yet');
        }
      },
      checks: {
        create: async () => {
          console.log('GitLab commit status creation - not implemented yet');
          return { data: { id: 'mock' } };
        }
      },
      issues: {
        createComment: async () => {
          console.log('GitLab comment creation - not implemented yet');
          return { data: { id: 'mock' } };
        }
      }
    },

    log: console // Basic logging
  };
}