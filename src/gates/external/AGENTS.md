# External Gates Directory

## What Goes Here
Artifact-based integrations for linters, security scanners, and other external tools.

## Architecture: Artifact Ingestion Model
External gates **do not execute tools** - they ingest artifacts uploaded by GitHub Actions workflows. This approach keeps the bot:
- **Lightweight**: No tool execution overhead
- **Secure**: No code execution, only artifact parsing
- **Universal**: Works with any tool that outputs JSON/SARIF

## Implementation Status
**Implemented** ✅:
- `artifact-json.js` - Configurable JSON parser with presets (ESLint, Ruff, etc.)
- `artifact-sarif.js` - SARIF 2.1.0 compliance parser  
- Parser presets: `eslint.json`, `ruff.json`

## Gate Types
- **artifact.json**: Parses JSON artifacts with configurable presets
- **artifact.sarif**: Parses SARIF format reports from security tools

## Principles
- **Security**: Read-only artifact ingestion, no code execution
- **Performance**: Lightweight parsing with annotation chunking (≤50 per update)
- **Universality**: Works with any tool via standardized artifact formats
- **Timeout resilience**: AbortController for graceful timeout handling

## External Gate Contract

### Required Exports
```javascript
export const runner = 'artifact.json';  // Gate identifier
export async function run(ctx, gate) {  // Gate function
  // Implementation here
}
```

### Function Signature
- **ctx**: Run context with `octokit`, `pr`, `repo()`, `abort`, `logger`
- **gate**: Gate configuration from repo-spec with `gate.with` properties

### Expected Return Format
```javascript
{
  status: 'pass'|'fail'|'neutral',
  neutral_reason?: 'timeout'|'parse_error'|'missing_artifact',
  violations: [{
    code: string,       // Rule/error code
    message: string,    // Human readable message
    path: string|null,  // File path (null for global)
    line: number|null,  // Line number
    column: number|null,// Column number (optional)
    level: 'error'|'warning'|'info',
    meta?: object       // Additional context
  }],
  stats: {
    duration_ms: number,
    // Additional stats...
  }
}
```

### Timeout Handling
External gates **must** respect `ctx.abort` signal:
```javascript
if (ctx.abort?.aborted) {
  return { status: 'neutral', neutral_reason: 'timeout', violations: [], stats: {} };
}
```

### Artifact Resolution Pattern (Internal)
External gates handle artifact resolution internally using the Subscribe & Wait pattern:
1. External gate receives enhanced context with `ctx.workflow_run.id` from workflow_run.completed event
2. Gate calls `resolveArtifact(octokit, repo, runId, headSha, artifactName)` internally
3. Primary: Direct run_id lookup; Fallback: Head SHA filtering with retry (2 attempts @ 5s)
4. ZIP extraction with 25MB size limits and signature validation
5. Parse JSON/SARIF with error handling → violations array
6. Return normalized result with timeout handling

**Context Enhancement**: workflow_run events receive missing PR data via context.payload.pull_request and stored spec via context.storedSpec for seamless gate execution.