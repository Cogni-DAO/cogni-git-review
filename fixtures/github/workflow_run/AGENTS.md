# GitHub Workflow Run Webhook Fixtures

## Overview
Contains captured GitHub workflow_run webhook payloads for testing GitHub Actions workflow events.

## Fixtures

### workflow_run.in_progress.json
Real GitHub workflow_run.in_progress webhook payload.
- **Event**: `workflow_run` with status `in_progress`
- **Purpose**: Workflow execution status tracking
- **Contains**: Workflow metadata, run ID, repository context
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

## Usage
These fixtures support testing of GitHub Actions integration scenarios. While Cogni primarily responds to pull_request and check_suite events, workflow_run payloads provide context for understanding the full CI/CD pipeline state.

## Capture Details
- **Capture Tool**: webhook-capture service (tools/dev/webhook-capture/)
- **Provider**: GitHub
- **Format**: JSON with base64-encoded body in `body_raw_base64` field
- **Headers**: Complete webhook headers including GitHub event type and signatures