# External Gates: Universal Adapter Architecture

## Overview

External gates enable **universal linter and scanner integration** without shipping tool-specific code in the Cogni Git Review bot. The architecture uses **two universal adapters** that handle ALL external tools through standardized artifact formats - no tool-specific parsers required.

## Key Benefits

- ✅ **Zero tool dependencies** in the bot application
- ✅ **Maximum security** - no code execution, only artifact parsing
- ✅ **Universal compatibility** - works with any tool that outputs SARIF or JSON
- ✅ **Repository control** - teams manage their own tool versions and configurations
- ✅ **Minimal adoption** - add workflow + gate config, done
- ✅ **Future-proof** - standards-based approach eliminates vendor lock-in

## Universal Adapter Architecture

```
Repository Workflow → Upload SARIF/JSON Artifact → Bot Downloads → Parse → Violations → Single Check
```

### Two Universal Adapters (Runners)

1. **`artifact.sarif`** - Universal SARIF 2.1.0 parser for ANY SARIF-compliant tool
2. **`artifact.jsonpath`** - Generic JSON parser using declarative JSONPath mappings

### No Tool-Specific Code

❌ **Removed**: `parseEslintJson`, `parseRuffJson`, tool-specific parsers  
✅ **Replaced with**: Configuration-driven universal adapters + presets

### Configuration-Only Integration

New tools integrate through **configuration alone**:
1. **Workflow**: Tool outputs SARIF or JSON artifact
2. **Repo-spec**: Specifies which adapter and configuration to use
3. **Zero app code changes**: New tools work immediately

## Architecture Flow

1. **Repository runs tool** (ESLint, Gitleaks, etc.) via GitHub Actions
2. **Tool outputs SARIF or JSON** to artifact (SARIF preferred)
3. **Bot downloads artifact** from completed workflow run  
4. **Universal adapter parses** violations using standardized format
5. **Bot aggregates results** under single required check with inline annotations

## Security Model

### Read-Only Operations
- **Artifact download only** - no code execution whatsoever
- **Base branch configurations** - workflows run with repo's own setup
- **Size limits enforced** - reject oversized artifacts with neutral status

### No Code Execution
- Bot never executes linting tools, scripts, or user code
- All processing is pure data transformation (SARIF/JSON → violations)
- Malformed artifacts result in neutral status with clear error message

## Supported Gate Runners

### `artifact.sarif` - SARIF 2.1.0 Universal Parser (Recommended)

**For any tool that can output SARIF format:**

```yaml
gates:
  - id: eslint
    source: external
    runner: artifact.sarif
    with:
      artifact_name: eslint.sarif
      fail_on: 'errors'

  - id: secrets_scan
    source: external
    runner: artifact.sarif  
    with:
      artifact_name: gitleaks.sarif
      fail_on: 'errors'
```

**Supported Tools** (via SARIF output):
- **Security Scanners**: Gitleaks, Semgrep, Bandit, CodeQL, Trivy
- **Linters**: ESLint (via @microsoft/eslint-formatter-sarif), RuboCop, SwiftLint, golangci-lint  
- **Code Quality**: SonarQube, Checkmarx, Veracode

*Any tool that can output SARIF 2.1.0 format works immediately.*

### `artifact.jsonpath` - JSONPath Universal Parser (Fallback)

**For tools that cannot output SARIF:**

```yaml
gates:
  - id: custom-tool
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

## Configuration Options

### Universal Options (Both Runners)
- `artifact_name` **(required)** - Name of GitHub Actions artifact to download
- `fail_on` - When to fail the gate: `'errors'` (default), `'warnings_or_errors'`, `'any'`, `'none'`
- `timeout_ms` - Maximum time to wait for artifact download

### JSONPath Runner Specific
- `root` - JSONPath to array of violations (`"$[*]"`)
- `mapping` - Field extraction rules (file, line, code, message, severity)
- `severity_map` - Map tool severity values to normalized levels

## Minimal Adoption Guide

### Method 1: SARIF Output (Recommended)

#### Step 1: Create SARIF Workflow

**.github/workflows/eslint-report.yml:**
```yaml
name: ESLint (report for Cogni)
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  eslint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm install @microsoft/eslint-formatter-sarif
      - run: npx eslint --format @microsoft/eslint-formatter-sarif --output-file eslint.sarif .
        continue-on-error: true
      - name: Upload SARIF artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eslint.sarif
          path: eslint.sarif
```

#### Step 2: Configure Universal SARIF Gate

**.cogni/repo-spec.yaml:**
```yaml
gates:
  - id: eslint
    source: external
    runner: artifact.sarif
    with:
      artifact_name: eslint.sarif
      fail_on: 'errors'
```

#### Step 3: Install Bot

Install the Cogni Git Review GitHub App on your repository.

**That's it!** No tool-specific code changes needed.

### Method 2: JSONPath Fallback

For tools that cannot output SARIF, use the JSONPath adapter with custom mapping configuration.

## Example Workflows

### Secrets Scanning (Gitleaks + SARIF)

**.github/workflows/secrets-scan.yml:**
```yaml
name: Secrets Scan (report for Cogni)
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  secrets:
    runs-on: ubuntu-latest  
    permissions:
      contents: read
      actions: write
    steps:
      - uses: actions/checkout@v4
      - name: Run Gitleaks
        run: |
          docker run --rm -v "${{ github.workspace }}:/path" \
            ghcr.io/gitleaks/gitleaks:latest \
            detect --source="/path" --report-format=sarif --report-path=/path/gitleaks.sarif --exit-code=0
      - name: Upload Gitleaks SARIF artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: gitleaks.sarif
          path: gitleaks.sarif
```

### Security Scanner (Generic SARIF)

```yaml  
name: Security Scan (SARIF for Cogni)
on:
  pull_request:
    types: [opened, synchronize, reopened]  
jobs:
  security:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: write
    steps:
      - uses: actions/checkout@v4
      - name: Run security scanner
        run: |
          # Any tool that outputs SARIF 2.1.0
          security-tool --format sarif --output security-report.sarif .
      - name: Upload SARIF artifact
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-report.sarif
          path: security-report.sarif
```

## Presets System

Presets provide **configuration templates** (not code) for common tools:

### ESLint Preset Example
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

## Adding New Tools

### Method 1: SARIF Output (Recommended)
1. Configure tool to output SARIF 2.1.0 format
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

## Universal Adapter Benefits

### For Tool Authors
- **Zero coding**: Just output SARIF and configure gate
- **Immediate support**: No waiting for bot updates
- **Future-proof**: Standards-based approach

### For Repository Owners  
- **Consistent experience**: All tools behave identically
- **Easy configuration**: Same format for all external gates
- **No vendor lock-in**: Switch tools by changing workflow + config

### For Bot Maintainers
- **Minimal code**: Two adapters handle ALL tools
- **No tool-specific bugs**: Generic parsing only
- **Zero maintenance**: New tools don't require code changes

## Required App Permissions

The Cogni Git Review GitHub App requires the following permissions for artifact ingestion:

### Repository Permissions
- **Actions: Read** - Download artifacts from workflow runs
- **Checks: Write** - Create check runs with gate results
- **Contents: Read** - Access repository files and PR context
- **Metadata: Read** - Access basic repository information
- **Pull Requests: Read** - Access PR details and context

### Event Subscriptions
- **Pull Request** - Trigger on opened, synchronize, reopened
- **Check Suite** - Handle rerun requests via rerequested event

### API Usage Patterns
- **Workflow Runs API** - `GET /repos/:owner/:repo/actions/runs`
- **Artifact Download API** - `GET /repos/:owner/:repo/actions/artifacts/:id/zip`
- **Check Runs API** - `POST/PATCH /repos/:owner/:repo/check-runs`

No elevated permissions (Admin, Write to Contents, Secrets access, etc.) are required or requested.

## Error Handling

### Neutral Status Scenarios
- Artifact not found or workflow didn't run
- Invalid SARIF/JSON format in artifact  
- Artifact too large (size limit exceeded)
- Network timeout during download
- Unsupported file structure

### Fail Status Scenarios
- Missing required configuration (`artifact_name`)
- Violations found matching `fail_on` criteria

### Status Determination
- **Pass**: No violations or only warnings (when `fail_on: 'errors'`)  
- **Fail**: Violations found matching fail criteria
- **Neutral**: System errors, timeouts, or configuration issues

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

## Implementation Details

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

### Timeout Behavior

External gates implement graceful timeout handling:

- **AbortController integration** - respects global gate timeout
- **Partial results** - if timeout occurs during processing, gate returns neutral
- **Clear messaging** - timeout reasons are surfaced in check annotations
- **No hanging processes** - all network operations are cancellable

### Annotation Chunking

For large reports with many violations:

- **Batch processing** - annotations sent in chunks of ≤50 per API call
- **Performance optimization** - prevents API rate limiting
- **Complete coverage** - all violations are eventually surfaced
- **Progress indication** - check summary shows total violation counts

---

**Questions?** Check the [main README](../README.md) for setup instructions or review example configurations in `.cogni/repo-spec-template.yaml`.