/**
 * GitLab to GitHub payload transformation
 */

/**
 * Transform GitLab webhook payload to GitHub-like structure
 * @param {object} gitlabPayload - GitLab webhook payload
 * @returns {object} GitHub-compatible payload
 */
export function transformGitLabPayload(gitlabPayload) {
  const { object_kind, object_attributes, project, user: _user } = gitlabPayload;
  
  if (object_kind === 'merge_request') {
    return {
      action: mapMRAction(object_attributes.action),
      pull_request: {
        id: object_attributes.id,
        number: object_attributes.iid,
        state: object_attributes.state === 'opened' ? 'open' : object_attributes.state,
        title: object_attributes.title,
        body: object_attributes.description,
        head: {
          sha: object_attributes.last_commit?.id,
          ref: object_attributes.source_branch
        },
        base: {
          ref: object_attributes.target_branch
        }
      },
      repository: {
        id: project.id,
        name: project.name,
        full_name: project.path_with_namespace,
        owner: { login: project.namespace }
      }
    };
  }
  
  return gitlabPayload; // Return unchanged for other events
}

/**
 * Map GitLab MR actions to GitHub PR actions
 * @param {string} gitlabAction - GitLab action
 * @returns {string} GitHub action
 */
function mapMRAction(gitlabAction) {
  switch (gitlabAction) {
    case 'open': return 'opened';
    case 'update': return 'synchronize';
    case 'reopen': return 'reopened';
    default: return gitlabAction;
  }
}