# GitHub Check Suite Webhook Fixtures

## Overview
Contains captured GitHub check_suite webhook payloads for testing Cogni's webhook handling and rerun scenarios.

## Fixtures

### check_suite.completed.json
Real GitHub check_suite.completed webhook payload.
- **Event**: `check_suite` with action `completed`
- **Status**: Check suite completion event
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

### check_suite.requested.json
Real GitHub check_suite.requested webhook payload.
- **Event**: `check_suite` with action `requested`
- **Purpose**: Initial check suite creation on push
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

### check_suite.rerequested.json
Real GitHub check_suite.rerequested webhook payload.
- **Event**: `check_suite` with action `rerequested`
- **Purpose**: Manual rerun of check suite from GitHub UI
- **Key Behavior**: Lacks PR association data, requires API call to fetch PR information
- **Webhook Signature**: Signed with WEBHOOK_SECRET=402786017574bd28f9d8f7a18648939751c47fe09077d56e10f0444f14fbb73b

## Usage
These fixtures are critical for testing Cogni's check suite handling, especially the rerun scenario where PR data must be fetched separately. The rerequested event tests the handler's ability to enhance context with PR data before delegating to the main PR handler.

## Capture Details
- **Capture Tool**: webhook-capture service (tools/dev/webhook-capture/)
- **Provider**: GitHub
- **Format**: JSON with base64-encoded body in `body_raw_base64` field
- **Headers**: Complete webhook headers including GitHub event type and signatures