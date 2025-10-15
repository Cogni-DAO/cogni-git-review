# Webhook Capture Tool

Standalone HTTP server for capturing webhook payloads and saving them as test fixtures.

## Architecture
```
webhook-capture/
├─ capture-server.ts    # HTTP server listening on port 4001
└─ lib/
   └─ fixture-writer.ts # Fixture persistence logic
```

## Functionality

### Capture Server (`capture-server.ts`)
HTTP server that:
- Listens on port specified by `CAPTURE_PORT` (default: 4001)
- Accepts POST requests to `/capture` endpoint
- Captures raw request bytes and headers
- Detects webhook provider automatically
- Saves fixtures with full request metadata

### Fixture Writer (`lib/fixture-writer.ts`)
Persists webhook data as JSON fixtures:
- Stores raw body as base64-encoded string for exact byte preservation
- Organizes fixtures by provider and event type
- Generates timestamped filenames with unique identifiers
- Creates directory structure: `<dir>/<provider>/<event>/<timestamp>_<provider>_<event>_<id>.json`

## Provider Detection
Automatically identifies webhook source:
- **GitHub**: Detected via `x-github-event` header
- **Alchemy**: Detected via `x-alchemy-signature` or `x-alchemy-event-type` headers
- **Unknown**: Fallback for unrecognized webhooks

## Fixture Format
```typescript
{
  id: string;                              // Unique identifier from webhook or timestamp
  received_at: string;                     // ISO timestamp
  method: string;                          // HTTP method (usually POST)
  url: string;                             // Request path
  provider: string;                        // Detected provider (github/alchemy/unknown)
  headers: Record<string, string | string[]>; // All request headers
  body_raw_base64: string;                // Base64-encoded raw body bytes
}
```

## Environment Variables
- `CAPTURE_PORT`: Server listening port (default: 4001)
- `FIXTURE_CAPTURE_DIR`: Fixture storage directory (default: `./fixtures`)

## Usage Commands
```bash
npm run dev:capture              # Start capture server
npm run smee-capture-chain-events # Route Alchemy webhooks to capture via Smee
npm run smee-capture-git-events   # Route GitHub webhooks to capture via Smee  
npm run capture                   # Run both Smee clients concurrently
```

## Integration with Tests
Captured fixtures integrate with test infrastructure via `test/helpers/fixture-replay.ts` for deterministic webhook testing.