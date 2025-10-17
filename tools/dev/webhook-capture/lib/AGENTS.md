# Webhook Capture Library

## Overview
Core library for the webhook-capture service that captures, processes, and stores webhook payloads as test fixtures.

## Components

### fixture-writer.ts
Handles writing captured webhook payloads to the filesystem as JSON fixtures.

#### Key Features
- **Automatic Directory Structure**: Organizes fixtures by provider and event type
- **Event Detection**: Identifies event types from webhook headers
  - GitHub: Uses `x-github-event` header
  - Alchemy: Detects CogniSignal via `x-alchemy-signature`
  - Generic: Falls back to other event headers
- **Base64 Encoding**: Stores raw webhook body as base64 in `body_raw_base64` field
- **Timestamped Filenames**: Creates unique filenames with timestamp, provider, event, and ID

#### FixtureRecord Type
```typescript
type FixtureRecord = {
  id: string;                    // Unique identifier (nanoid)
  received_at: string;           // ISO timestamp
  method: string;                // HTTP method (POST)
  url: string;                   // Webhook endpoint URL
  provider: string;              // Service provider (github, alchemy, etc.)
  headers: Record<string, string | string[]>;
  body_raw_base64: string;       // Base64-encoded raw body
};
```

#### Directory Structure
Fixtures are organized as:
```
fixtures/
├── github/
│   ├── pull_request/
│   │   └── 2025-10-15T02-46-47-908Z_github_pull_request_[id].json
│   ├── check_suite/
│   └── check_run/
└── alchemy/
    └── CogniSignal/
```

## Usage
The fixture-writer is used by the webhook-capture service to persist incoming webhooks. These fixtures become test data for Cogni's contract tests, enabling webhook handler testing without live API dependencies.

## Environment
- `FIXTURE_CAPTURE_DIR`: Override default fixture output directory (defaults to `./fixtures`)

## Integration
Works with the webhook-capture service (parent directory) to provide a complete webhook recording solution for test fixture generation.