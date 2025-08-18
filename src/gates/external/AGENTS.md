# External Gates Architecture

## Core Principle: Universal Adapter Model

External gates use a **"universal adapter"** approach where **no tool-specific code** exists in runners. Instead, two generic adapters handle all external tools through standardized artifact formats.

## Architecture Overview

### Universal Adapters (Runners)
- **`artifact.sarif`**: Universal SARIF 2.1.0 parser for ANY SARIF-compliant tool
- **`artifact.jsonpath`**: Generic JSON parser using declarative JSONPath mappings

### No Tool-Specific Parsers
❌ **Removed**: `parseEslintJson`, `parseRuffJson`, etc.  
✅ **Replaced with**: Configuration-driven adapters + presets

### Configuration-Only Integration
Tools integrate through **configuration alone**:
1. **Workflow**: Tool outputs SARIF or JSON artifact
2. **Repo-spec**: Specifies which adapter and configuration to use
3. **Zero app code changes**: New tools work immediately

## How It Works

### 1. SARIF-First Approach (Preferred)
```yaml
# .cogni/repo-spec.yaml
gates:
  - id: eslint
    source: external
    runner: artifact.sarif
    with:
      artifact_name: eslint.sarif

  - id: secrets_scan  
    source: external
    runner: artifact.sarif
    with:
      artifact_name: gitleaks.sarif
```

**Workflow Requirements:**
```yaml
# .github/workflows/lint.yml
- name: Run ESLint (SARIF)
  run: npx eslint -f @microsoft/eslint-formatter-sarif -o eslint.sarif .
- name: Upload SARIF
  uses: actions/upload-artifact@v4
  with:
    name: eslint.sarif
    path: eslint.sarif
```

### 2. JSONPath Fallback (Legacy)
For tools that cannot output SARIF:
```yaml
gates:
  - id: custom_tool
    source: external  
    runner: artifact.jsonpath
    with:
      artifact_name: custom-report.json
      root: "$[*]"
      mapping:
        file: "$.fileName"
        line: "$.lineNumber" 
        code: "$.ruleId"
        message: "$.description"
        severity: "$.level"
      severity_map:
        "high": "error"
        "medium": "warning"
        "low": "info"
```

## Universal Adapter Benefits

### For Tool Authors
- **Zero coding**: Just output SARIF and configure gate
- **Immediate support**: No waiting for runner updates
- **Future-proof**: Standards-based approach

### For Repository Owners  
- **Consistent experience**: All tools behave identically
- **Easy configuration**: Same format for all external gates
- **No vendor lock-in**: Switch tools by changing workflow + config

### For Bot Maintainers
- **Minimal code**: Two adapters handle ALL tools
- **No tool-specific bugs**: Generic parsing only
- **Zero maintenance**: New tools don't require code changes

## Supported Tools (via SARIF)

**Security Scanners**: Gitleaks, Semgrep, Bandit, CodeQL, Trivy  
**Linters**: ESLint, RuboCop, SwiftLint, golangci-lint  
**Code Quality**: SonarQube, Checkmarx, Veracode  

*Any tool that can output SARIF 2.1.0 format works immediately.*

## Presets System

Presets provide **configuration templates** (not code):

### ESLint Preset (`presets/eslint.json`)
```json
{
  "runner": "artifact.sarif",
  "with": {
    "artifact_name": "eslint.sarif",
    "fail_on": { "min_severity": "warning" }
  },
  "workflow": {
    "install_command": "npm install @microsoft/eslint-formatter-sarif",
    "run_command": "npx eslint -f @microsoft/eslint-formatter-sarif -o eslint.sarif ."
  }
}
```

### Custom Preset Example
```json
{
  "runner": "artifact.jsonpath", 
  "with": {
    "artifact_name": "custom.json",
    "root": "$[*]",
    "mapping": { "file": "$.path", "message": "$.desc" }
  }
}
```

## Adding New Tools

### Method 1: SARIF Output (Recommended)
1. Configure tool to output SARIF format
2. Upload SARIF artifact in workflow  
3. Add gate to repo-spec using `artifact.sarif` runner
4. **Done** - No app code changes needed

### Method 2: JSONPath Mapping (Fallback)
1. Analyze tool's JSON output structure
2. Create JSONPath mapping configuration
3. Add gate to repo-spec using `artifact.jsonpath` runner  
4. **Done** - No app code changes needed

### Method 3: New Preset (Optional)
Create `presets/{tool}.json` with reusable configuration template.

## Implementation Details

### Artifact Resolution
Both adapters use shared `downloadAndExtractJson()`:
- **Source**: GitHub Actions artifacts (ZIP format)
- **Size limit**: 25MB per artifact
- **Timeout**: Respects `AbortController`
- **Retry**: Automatic fallback for missing artifacts

### Violation Normalization
All adapters produce standardized violations:
```javascript
{
  code: string,      // Rule ID (e.g., "no-unused-vars")
  message: string,   // Human readable description
  path: string|null, // Repo-relative file path
  line: number|null, // Line number
  column: number|null, // Column (optional)
  level: 'error'|'warning'|'info', // Normalized severity
  meta: object       // Tool-specific metadata
}
```

### Path Normalization
Adapters automatically normalize CI paths:
- Strip `/home/runner/work/repo/repo/` (GitHub Actions)
- Strip `/github/workspace/` (Docker)
- Convert backslashes to forward slashes
- Handle URI encoding (`%20` → spaces)

### Status Determination
Standard `determineStatus()` logic:
- `fail_on: 'errors'` → Only error-level violations fail
- `fail_on: 'warnings_or_errors'` → Warning+ violations fail
- `fail_on: 'any'` → Any violation fails
- `fail_on: 'none'` → Always pass (annotation-only)

## Migration Guide

### From Tool-Specific Parsers
**Before (deprecated):**
```yaml
runner: artifact.json
with:
  parser: eslint_json
  artifact_name: report.json
```

**After (universal):**
```yaml  
runner: artifact.sarif
with:
  artifact_name: report.sarif
```

**Benefits**: Eliminates tool-specific code, uses standardized format.

### BREAKING CHANGES
- **ESLint JSON parser removed**: Use `@microsoft/eslint-formatter-sarif`
- **Tool-specific parsers deprecated**: Migrate to SARIF or JSONPath
- **Custom mapping**: Replace with JSONPath configuration

## Testing

### SARIF Adapter Tests
- Generic SARIF parsing (`test/unit/artifact-sarif-parser.test.js`)
- Real tool fixtures (Gitleaks, CodeQL examples)
- Edge cases: malformed SARIF, missing artifacts, timeout

### JSONPath Adapter Tests  
- Mapping validation and extraction
- Path normalization across CI environments
- Severity level mapping

### Integration Tests
- End-to-end artifact download and processing
- GitHub API mocking for workflow runs and artifacts

## Error Handling

### Neutral Status Reasons
- `missing_artifact`: No workflow run or artifact found
- `parse_error`: Invalid JSON/SARIF format
- `timeout`: Processing exceeded time limit
- `invalid_format`: Unsupported file structure

### Graceful Degradation
- Missing artifacts → neutral status (not fail)
- Parse errors → neutral with diagnostic message
- Timeouts → partial results when possible
- Oversized artifacts → neutral with size limit message

## Security Model

### Artifact-Only Ingestion
- **No code execution**: Only data parsing
- **Read-only access**: Cannot modify repository
- **Size limits**: Prevent resource exhaustion
- **Format validation**: Reject malformed data

### Timeout Protection
All operations respect `AbortController`:
```javascript
if (ctx.abort?.aborted) {
  return createNeutralResult('timeout', 'Processing timed out');
}
```

This architecture eliminates tool-specific security risks while maintaining universal compatibility.