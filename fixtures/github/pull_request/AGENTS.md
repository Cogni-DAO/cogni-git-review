# GitHub Pull Request Webhook Fixtures

## Overview
Contains captured GitHub pull_request webhook payloads for testing Cogni's primary event handling flows.

## Fixtures

### pull_request.opened.json
Real GitHub pull_request.opened webhook payload.
- **Event**: `pull_request` with action `opened`
- **Purpose**: Initial PR creation event that triggers Cogni evaluation
- **Contains**: Complete PR metadata including files, additions, deletions, head/base SHA
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

### pull_request.synchronize.json
Real GitHub pull_request.synchronize webhook payload.
- **Event**: `pull_request` with action `synchronize`
- **Purpose**: PR update event triggered by new commits
- **Contains**: Updated PR state after push
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

### pull_request.closed.json
Real GitHub pull_request.closed webhook payload.
- **Event**: `pull_request` with action `closed`
- **Purpose**: PR closure event (merged or closed without merge)
- **Contains**: Final PR state and merge information if merged
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

## Usage
These fixtures form the core test data for Cogni's PR evaluation logic. The opened and synchronize events trigger gate evaluations, while closed events are used for cleanup or metrics. Contract tests use these payloads to verify webhook handling without live API calls.

## Capture Details
- **Capture Tool**: webhook-capture service (tools/dev/webhook-capture/)
- **Provider**: GitHub
- **Format**: JSON with base64-encoded body in `body_raw_base64` field
- **Headers**: Complete webhook headers including GitHub event type and signatures