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

### Execution Pattern
External gates execute immediately on every call:
1. **PR Event**: Gate attempts artifact resolution, returns `neutral` with `missing_artifact` if unavailable
2. **Workflow Event**: Gate re-runs with `workflowRunId` in context, artifacts now available
3. **Artifact Resolution**: `resolveArtifact(octokit, repo, runId, headSha, artifactName)` with fallback retry
4. **Processing**: ZIP extraction (25MB limit), JSON/SARIF parsing, violation normalization
5. **Return**: Standard gate result with pass/fail/neutral status

**Context Enhancement**: Workflow events pass `workflowRunId` to gates for artifact resolution during execution.