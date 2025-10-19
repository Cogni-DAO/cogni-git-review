# GitLab Application Setup Guide

This document outlines the process for creating and configuring a GitLab OAuth application for Cogni Git Review integration.

## Overview

The GitLab adapter requires a two-phase setup:
1. **OAuth Application Registration** - Create group-owned OAuth app for API access
2. **Installation Flow** - User connects, selects repos, and provisions webhooks automatically

This approach eliminates manual environment variable configuration and provides a smooth "Click to Connect" experience similar to Sentry's GitLab integration.

## Phase 1: OAuth Application Creation

### 1.1 Create OAuth Application

Navigate to your GitLab group settings to create a group-owned OAuth application:

**Location**: `https://gitlab.com/groups/YOUR_GROUP/-/settings/applications`

**Configuration**:
- **Name**: `Cogni Git Review`
- **Redirect URI**: `https://your-app-domain.com/auth/gitlab/callback`
- **Scopes**: 
  - `api` - Full API access (covers merge requests, commit statuses, comments)
  - `read_user` - Read user profile information
- **Confidential**: ✅ **ON** (your Node.js server will store the client secret and do the token exchange server-side)

**Important Notes**:
- Use group-owned applications for better permission management
- The `api` scope provides comprehensive access to merge requests, project webhooks, and commit statuses
- Store the Application ID and Secret securely in your application environment

### 1.2 OAuth Flow Implementation

Implement the Authorization Code flow with PKCE for enhanced security:

```javascript
// OAuth endpoints
const GITLAB_OAUTH_BASE = 'https://gitlab.com/oauth';
const AUTHORIZE_URL = `${GITLAB_OAUTH_BASE}/authorize`;
const TOKEN_URL = `${GITLAB_OAUTH_BASE}/token`;

// Authorization request
const authParams = {
  client_id: process.env.GITLAB_CLIENT_ID,
  redirect_uri: process.env.GITLAB_REDIRECT_URI,
  response_type: 'code',
  scope: 'api read_user',
  state: generateStateToken(), // CSRF protection
  code_challenge: generateCodeChallenge(), // PKCE
  code_challenge_method: 'S256'
};
```

**Reference Implementation**: [passport-gitlab2](https://github.com/fh1ch/passport-gitlab2) provides a battle-tested Node.js OAuth strategy.

## Phase 2: Installation Flow

### 2.1 User Connection Flow

**Step 1: Connect GitLab**
- User clicks "Connect GitLab" button
- Redirect to GitLab OAuth authorization
- User authorizes application access
- Receive access token via callback

**Step 2: Project Selection**
- Fetch user's accessible projects via API
- Present project selection interface
- User selects repositories for integration

**Step 3: Webhook Provisioning**
- Automatically create webhooks for selected projects
- Store webhook IDs for future management
- Confirm successful setup to user

### 2.2 Project Discovery API

Use the access token to discover available projects:

```javascript
// List user's projects
GET https://gitlab.com/api/v4/projects?membership=true&per_page=100

// Filter for projects with sufficient permissions
// Minimum required: Developer role for webhook creation
const eligibleProjects = projects.filter(project => 
  project.permissions.project_access?.access_level >= 30 ||
  project.permissions.group_access?.access_level >= 30
);
```

**Reference**: [GitLab Projects API](https://docs.gitlab.com/ee/api/projects.html#list-user-projects)

## Phase 3: Webhook Configuration

### 3.1 Webhook Creation

For each selected project, create a webhook using the Project Hooks API:

```javascript
POST /projects/:id/hooks

{
  "url": "https://your-app-domain.com/webhooks/gitlab",
  "merge_requests_events": true,
  "note_events": true,
  "push_events": true,
  "issues_events": false,
  "wiki_page_events": false,
  "deployment_events": false,
  "job_events": false,
  "pipeline_events": false,
  "releases_events": false,
  "subgroup_events": false,
  "enable_ssl_verification": true,
  "token": generateWebhookSecret(),
  "push_events_branch_filter": "" // All branches
}
```

**Key Events**:
- `merge_requests_events` - MR opened, updated, merged, closed
- `note_events` - Comments on merge requests and commits  
- `push_events` - New commits (for commit status updates)

**Reference**: [GitLab Webhooks API](https://docs.gitlab.com/ee/api/projects.html#add-project-hook)

### 3.2 Webhook Secret Management

Generate and store unique webhook secrets for each project:

```javascript
const webhookSecret = crypto.randomBytes(32).toString('hex');

// Store mapping: project_id -> webhook_secret
await db.webhookSecrets.create({
  project_id: projectId,
  webhook_id: webhookId,
  secret: webhookSecret,
  created_at: new Date()
});
```

## Phase 4: API Operations

### 4.1 Merge Request Operations

**Comment on Merge Requests**:
```javascript
POST /projects/:id/merge_requests/:merge_request_iid/notes

{
  "body": "## Cogni Review Summary\n\n✅ All quality gates passed!"
}
```

**Update Merge Request Labels**:
```javascript
PUT /projects/:id/merge_requests/:merge_request_iid

{
  "add_labels": "cogni-reviewed,quality-approved",
  "remove_labels": "needs-review"
}
```

### 4.2 Commit Status Updates

Set commit statuses to provide build-like feedback:

```javascript
POST /projects/:id/statuses/:sha

{
  "state": "success", // success, failed, canceled, pending, running
  "ref": "feat/new-feature",
  "name": "cogni/quality-gates",
  "target_url": "https://your-app.com/reviews/12345",
  "description": "All quality gates passed"
}
```

**Status States**:
- `pending` - Review in progress
- `running` - Gates executing  
- `success` - All gates passed
- `failed` - One or more gates failed
- `canceled` - Review canceled/timeout

### 4.3 API Client Integration

**Recommended Libraries**:
- **Node.js**: [@gitbeaker/rest](https://github.com/jdalrymple/gitbeaker) - Comprehensive GitLab API client
- **Python**: [python-gitlab](https://github.com/python-gitlab/python-gitlab) - Official Python client
- **Go**: [go-gitlab](https://github.com/xanzy/go-gitlab) - Feature-complete Go client

**Example Implementation**:
```javascript
import { Gitlab } from '@gitbeaker/rest';

const api = new Gitlab({
  token: userAccessToken,
  host: 'https://gitlab.com'
});

// Create commit status
await api.Commits.editStatus(projectId, commitSha, {
  state: 'success',
  name: 'cogni/review',
  description: 'Quality gates passed'
});
```

## Implementation References

### OSS Pattern Examples

1. **[Sentry GitLab Integration](https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gitlab)**
   - Full OAuth flow with repository selection
   - Production-grade error handling and token refresh
   - Clean separation of OAuth and webhook concerns

2. **[Mattermost GitLab Plugin](https://github.com/mattermost/mattermost-plugin-gitlab)**
   - OAuth setup with configuration screens
   - Webhook secret management
   - User-friendly installation UX

3. **[Passport GitLab Strategies](https://github.com/fh1ch/passport-gitlab2)**
   - Drop-in OAuth implementation
   - Handles token refresh and error cases
   - Configurable scope management

### Security Considerations

1. **Token Security**:
   - Store access tokens encrypted at rest
   - Implement token refresh logic for long-lived integrations
   - Use webhook secrets to verify request authenticity

2. **Permission Validation**:
   - Verify user has Developer+ access before webhook creation
   - Validate webhook events match expected format
   - Implement rate limiting for API calls

3. **Error Handling**:
   - Graceful degradation when GitLab is unavailable
   - Retry logic for transient API failures
   - User-friendly error messages for permission issues

## Environment Variables

```bash
# OAuth Application Credentials
GITLAB_CLIENT_ID=your_application_id
GITLAB_CLIENT_SECRET=your_application_secret  
GITLAB_REDIRECT_URI=https://your-app.com/auth/gitlab/callback

# Application Configuration
GITLAB_BASE_URL=https://gitlab.com  # For self-hosted GitLab instances
WEBHOOK_BASE_URL=https://your-app.com/webhooks/gitlab
```

## Testing Strategy

1. **OAuth Flow Testing**:
   - Create test GitLab group and projects
   - Verify token exchange and refresh
   - Test permission boundary cases

2. **Webhook Testing**:
   - Use GitLab webhook testing interface
   - Verify signature validation
   - Test all supported event types

3. **API Integration Testing**:
   - Mock GitLab API responses
   - Test rate limiting behavior
   - Verify error handling paths

## Next Steps

1. Implement OAuth application registration UI
2. Build project selection and webhook provisioning flow
3. Create GitLab webhook event handlers
4. Implement commit status and comment API operations
5. Add comprehensive error handling and logging

---

*This setup eliminates the need for manual environment variable configuration and provides a GitLab Free tier compatible solution for automated merge request quality gates.*