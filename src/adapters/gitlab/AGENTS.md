# GitLab Adapter Architecture

## Overview
GitLab adapter implements BaseContext interface for GitLab webhooks, enabling the gateway to process GitLab merge requests using the same shared handlers as GitHub pull requests.

## Current Implementation

### Core Files
- `gitlab-router.js` - Express router with webhook token validation and handler execution
- `gitlab-context.js` - GitLab BaseContext implementation (VCS interface stub)
- `payload-transform.js` - GitLab MR webhook → GitHub PR payload transformation

### Gateway Integration
**Endpoint**: `/api/v1/webhooks/gitlab`
**Authentication**: `X-Gitlab-Token` header validated with timing-safe comparison (tsscmp)
**Handler Flow**:
1. Gateway captures shared handlers at boot via `runCogniApp(handlerCapture)`
2. GitLab router validates webhook token
3. Transforms GitLab payload to GitHub-compatible structure
4. Creates GitLab context implementing BaseContext
5. Executes appropriate shared handler
6. Returns proper HTTP status codes (200 success, 202 unsupported, 401 unauthorized, 500 error)

### Event Mapping
- GitLab `merge_request` events → `pull_request.*` handlers
  - `open` → `opened`
  - `update` → `synchronize`
  - `reopen` → `reopened`

### Payload Transformation
The `payload-transform.js` module maps GitLab webhook fields to GitHub-compatible structure:
- `object_attributes.iid` → `pull_request.number`
- `object_attributes.id` → `pull_request.id`
- `object_attributes.state` → `pull_request.state`
- `object_attributes.title` → `pull_request.title`
- `object_attributes.description` → `pull_request.body`
- `object_attributes.source_branch` → `pull_request.head.ref`
- `object_attributes.target_branch` → `pull_request.base.ref`
- `object_attributes.last_commit.id` → `pull_request.head.sha`
- `project` → `repository` (with namespace → owner mapping)

## VCS Interface Status

### Implemented
- Basic context structure with `payload`, `repo()`, and `log`
- Stub VCS methods returning appropriate errors

### Not Yet Implemented  
- GitLab API authentication and client initialization
- VCS interface methods requiring GitLab API implementation:
  - `vcs.config.get` - Read `.cogni/repo-spec.yaml` via `/projects/:id/repository/files/:path?ref=...`
  - `vcs.pulls.get` - Fetch MR metadata via `/projects/:id/merge_requests/:iid` (return changed_files, base/head refs only)
  - `vcs.pulls.listFiles` - Get changed files via `/projects/:id/merge_requests/:iid/changes` (map GitLab status flags, null additions/deletions)
  - `vcs.repos.compareCommits` - Get diff via `/projects/:id/repository/compare` (returns diffs, not per-file stats)
  - `vcs.repos.getContent` - Read file content via `/projects/:id/repository/files/:path?ref=...` (base64 content, null on 404)
  - `vcs.checks.create` - Create GitLab commit status via `POST /projects/:id/statuses/:sha` ({state, name, target_url, description, ref})
  - `vcs.issues.createComment` - Post MR comment via GitLab API

### GitLab API Implementation Requirements
**Authentication**: `Authorization: Bearer <token>` or `PRIVATE-TOKEN` header for PATs
**Base URL**: Support `GITLAB_BASE_URL` for self-hosted GitLab instances (default: https://gitlab.com)
**Project Resolution**: Map `{owner, repo}` to GitLab project ID via `/projects/:path_with_namespace` (cache results)
**Status Mapping**: Map GitHub check conclusions to GitLab commit states (success|failed|pending)

## Environment Configuration
The following GitLab-specific variables are validated in `src/env.js`:
- `WEBHOOK_SECRET_GITLAB` - Required for webhook authentication (X-Gitlab-Token equality check, not HMAC)
- `WEBHOOK_PROXY_URL_GITLAB` - Optional smee proxy URL for local development  
- `GITLAB_BASE_URL` - GitLab instance URL (default: https://gitlab.com, supports self-hosted)
- `GITLAB_ACCESS_TOKEN` - GitLab API access token (Bearer auth or PRIVATE-TOKEN header)
- `GITLAB_OAUTH_APPLICATION_ID` - Optional, for future OAuth support
- `GITLAB_OAUTH_APPLICATION_SECRET` - Optional, for future OAuth support

## Error Handling
The router implements proper HTTP status code responses:
- **200 OK**: Handler executed successfully
- **202 Accepted**: Unsupported event type (not an error)
- **401 Unauthorized**: Missing or invalid webhook token
- **500 Internal Server Error**: Handler execution failed

Errors are properly propagated from the core handler (index.js now rethrows errors) ensuring failed gate evaluations return 500 status instead of silent 200.

## Next Steps
1. Implement GitLab API client initialization with OAuth tokens
2. Complete VCS interface methods for GitLab API operations
3. Add OAuth flow at `/oauth/gitlab/callback` for token acquisition
4. Test end-to-end flow with real GitLab webhooks

**Result**: GitLab webhook reception and routing functional, awaiting VCS interface implementation for complete gate evaluation.