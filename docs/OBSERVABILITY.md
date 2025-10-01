# AI Workflow Observability

## Architecture Overview

`cogni-git-review` uses Langfuse to implement basic tracing for AI workflow executions. This is the current minimal MVP implementation that captures essential metadata for debugging AI evaluations:

## Data Flow

```
GitHub Webhook → Probot Context → rules.js → provider.js → AI Workflows → Langfuse
```

Basic context data flows from GitHub webhook events through the gate system to AI workflows, where execution traces are captured and exported to Langfuse.

## Implementation

### Core Components

- **src/ai/provider.js**: Central tracing configuration with basic metadata collection
- **src/ai/workflows/goal-evaluations.js**: Location to add workflow-specific tracing context extension  
- **src/gates/cogni/rules.js**: Basic context data extraction and passing from GitHub events

### Dependencies

- `langfuse-langchain@^3.38.5` - LangChain integration for automatic tracing
- No OpenTelemetry dependencies in current MVP implementation

### Configuration

Tracing is enabled when environment variables are present:

```bash
LANGFUSE_PUBLIC_KEY=<project-key>
LANGFUSE_SECRET_KEY=<secret-key>
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # optional
```

Environment tagging uses `APP_ENV` variable (dev/preview/prod).

## Trace Data Structure

### Metadata Captured (MVP)

**Basic Infrastructure Context:**
- `repo` - Repository full name
- `pr_number` - Pull request number  
- `commit_sha` - Git commit hash
- `installation_id` - GitHub App installation
- `model` - AI model used
- `environment` - Deployment environment

**Workflow Context:**
- `workflow_id` - Workflow identifier
- `rule_id` - Quality gate rule identifier
- `evaluation_count` - Number of evaluations in batch

**Session Correlation:**
- Session ID: `pr-{pr_number}` for grouping related evaluations
- Tags: `repo:owner/name`, `workflow:id`, `model:name`

### Code Implementation

**Provider metadata collection** (`src/ai/provider.js:65-86`):
```javascript
const runMeta = {
  repo: workflowInput.repo,
  pr_number: workflowInput.pr_number,
  commit_sha: workflowInput.commit_sha,
  rule_id: workflowInput.rule_id,
  model: modelConfig.model,
  environment: ENV,
};
```

**Workflow extension** (`src/ai/workflows/goal-evaluations.js:118-127`):
```javascript
metadata: {
  ...metadata,  // Inherit from provider
  evaluation_count: Object.keys(evaluationsObj).length
}
```

## Dashboard Usage

### Filtering Capabilities

- **By repository**: `repo:Cogni-DAO/cogni-git-review`
- **By PR**: Session `pr-123`  
- **By rule**: `rule_id:code-quality-check`
- **By model**: `model:gpt-4o-mini`
- **By environment**: `dev`, `preview`, `prod`

### Debugging Features

- Trace specific PR evaluations with full context
- Compare model performance across environments
- Track evaluation patterns by rule type  
- Session correlation for multi-rule PRs

## MVP Limitations

- **No span sanitization** - all metadata is exported without filtering
- **No data retention controls** - relies on Langfuse default settings
- **Basic metadata only** - added as metadata field to tracess
- **No sampling** - all AI executions are traced
- **Simple integration** - uses LangChain callbacks, not OpenTelemetry

## Performance

- **Zero overhead** when tracing not configured
- **Automatic detection** - only traces when keys present
- **No breaking changes** to existing functionality