# GitLab Adapter Architecture

## Overview
GitLab adapter implements the same two-layer abstraction as the GitHub adapter:
1. **Platform-specific entry point** - Maps GitLab webhooks/API � BaseContext interface  
2. **Host-agnostic core** - Existing gate logic unchanged

## Implementation Strategy

### Core Files
- `gitlab.js` - Express server entry point (mirrors `src/adapters/github.js` pattern)
- `gitlab/gitlab-context.js` - GitLab BaseContext implementation
- `gitlab/gitlab-vcs.js` - GitLab API � VCS interface mapping

### Webhook Architecture
**Current**: `POST /api/github/webhooks` (GitHub-specific)
**Target**: `POST /api/webhooks` (host-agnostic) + routing by `User-Agent` or path

### Event Mapping
- GitLab `merge_request` (action: open/update/reopen) � `pull_request.opened/synchronize/reopened`
- GitLab `note` (noteable_type: MergeRequest) � Comment events

### Payload Transformation
Transform GitLab webhook � GitHub-compatible BaseContext:
- `object_attributes.iid` � `pull_request.number`
- `project` � `repository` 
- `object_attributes.source_branch` � `pull_request.head.ref`

### GitLab API Integration  
Map essential endpoints to VCS interface:
- `/projects/:id/merge_requests/:iid` � `vcs.pulls.get`
- `/projects/:id/merge_requests/:iid/notes` � `vcs.issues.createComment`  
- `/projects/:id/statuses/:sha` � `vcs.checks.create`
- `/projects/:id/repository/files/:path` � `vcs.config.get`

### Authentication Flow
1. OAuth callback: `/oauth/callback/gitlab` (Disambiguation: carry `state.instance_url` for SaaS vs self-managed selection)
2. Store user access tokens per project
3. Webhook validation: `X-Gitlab-Token` header (simple string comparison)

## Integration Points
- Add GitLab env vars to `src/env.js`
- Extend webhook routing in main server
- Zero changes to `index.js` or gate logic

**Result**: Identical gate behavior across GitHub and GitLab platforms.