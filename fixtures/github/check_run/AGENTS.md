# GitHub Check Run Webhook Fixtures

## Overview
Contains captured GitHub check_run webhook payloads for testing Cogni's webhook handling.

## Fixtures

### check_run.completed.json
Real GitHub check_run.completed webhook payload captured from GitHub Actions.
- **Event**: `check_run` with action `completed`
- **Source**: OpenSSF Scorecard weekly workflow completion
- **Conclusion**: `skipped`
- **Associated PR**: #166 (e2e-test branch)
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

### check_run.created.json  
Real GitHub check_run.created webhook payload for initial check run creation.
- **Event**: `check_run` with action `created`
- **Status**: Initial check run state
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

## Usage
These fixtures are used in contract tests to verify correct webhook handling without requiring live GitHub API calls. The payloads include complete webhook headers and body data as captured from actual GitHub webhook deliveries.

## Capture Details
- **Capture Tool**: webhook-capture service (tools/dev/webhook-capture/)
- **Provider**: GitHub
- **Format**: JSON with base64-encoded body in `body_raw_base64` field
- **Headers**: Complete webhook headers including GitHub event type and signatures