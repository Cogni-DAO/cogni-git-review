# External Gates: Artifact Ingestion Model

## Overview

External gates enable **universal linter and scanner integration** without shipping tool-specific code in the Cogni Git Review bot. Instead of executing tools directly, external gates ingest artifacts uploaded by GitHub Actions workflows.

## Key Benefits

- ✅ **Zero tool dependencies** in the bot application
- ✅ **Maximum security** - no code execution, only artifact parsing
- ✅ **Universal compatibility** - works with any tool that outputs JSON/SARIF
- ✅ **Repository control** - teams manage their own tool versions and configurations
- ✅ **Minimal adoption** - add workflow + gate config, done

## Architecture

```
Repository Workflow → Upload Artifact → Bot Downloads → Parse → Violations → Single Check
```

1. **Repository runs tool** (ESLint, Ruff, etc.) via GitHub Actions
2. **Tool outputs JSON/SARIF** to artifact
3. **Bot downloads artifact** from completed workflow run  
4. **Bot parses violations** using configurable presets
5. **Bot aggregates results** under single required check with inline annotations

## Security Model

### Read-Only Operations
- **Artifact download only** - no code execution whatsoever
- **Base branch configurations** - workflows run with repo's own setup
- **Size limits enforced** - reject oversized artifacts with neutral status

### No Code Execution
- Bot never executes linting tools, scripts, or user code
- All processing is pure data transformation (JSON/SARIF → violations)
- Malformed artifacts result in neutral status with clear error message

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

## Supported Gate Types

### `artifact.json` - Configurable JSON Parser

Universal JSON parser with presets for common tools:

```yaml
gates:
  - id: eslint
    source: external
    runner: artifact.json
    with:
      artifact_name: 'eslint-report'
      parser: 'eslint_json'
      fail_on: 'errors'
      timeout_ms: 180000
```

**Built-in Parser Presets:**
- `eslint_json` - ESLint JSON output format
- `ruff_json` - Ruff Python linter JSON format

**Custom Mapping** (for tools without presets):
```yaml
gates:
  - id: custom-tool
    source: external  
    runner: artifact.json
    with:
      artifact_name: 'custom-report'
      custom_mapping:
        root: '$[*]'
        fields:
          file: '$.filename'
          line: '$.line'
          code: '$.rule_id'
          message: '$.description'
          severity: '$.level'
```

### `artifact.sarif` - SARIF 2.1.0 Parser

For security scanners and tools that output SARIF:

```yaml
gates:
  - id: security-scan
    source: external
    runner: artifact.sarif  
    with:
      artifact_name: 'security-report'
      fail_on: 'errors'
      timeout_ms: 300000
```

## Configuration Options

### Common Options
- `artifact_name` **(required)** - Name of GitHub Actions artifact to download
- `fail_on` - When to fail the gate: `'errors'` (default), `'any'`, `'none'`
- `timeout_ms` - Maximum time to wait for artifact download

### JSON Parser Specific
- `parser` - Built-in preset name (`eslint_json`, `ruff_json`)
- `custom_mapping` - Custom field extraction rules (see example above)

## Minimal Adoption Guide

### Step 1: Add Workflow

Create `.github/workflows/eslint-report.yml`:

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
      - run: npx eslint -f json . > eslint-report.json
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: eslint-report
          path: eslint-report.json
```

### Step 2: Configure Gate

Add to `.cogni/repo-spec.yaml`:

```yaml
gates:
  - id: eslint
    source: external
    runner: artifact.json
    with:
      artifact_name: 'eslint-report'
      parser: 'eslint_json' 
      fail_on: 'errors'
```

### Step 3: Install Bot

Install the Cogni Git Review GitHub App on your repository.

**That's it!** No additional dependencies, Actions setup, or configuration needed.

## Example Workflows

### Ruff (Python)

```yaml
name: Ruff (report for Cogni)  
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  ruff:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: write
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/ruff-action@v1
        with:
          args: check --output-format json .
      - name: Save JSON report
        run: ruff check --output-format json . > ruff-report.json
      - name: Upload artifact  
        uses: actions/upload-artifact@v4
        with:
          name: ruff-report
          path: ruff-report.json
```

### Security Scanner (SARIF)

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
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - name: Run security scanner
        run: |
          # Run your security tool that outputs SARIF
          security-tool --format sarif --output security-report.sarif .
      - name: Upload SARIF artifact
        uses: actions/upload-artifact@v4
        with:
          name: security-report
          path: security-report.sarif
```

## Timeout Behavior

External gates implement graceful timeout handling:

- **AbortController integration** - respects global gate timeout
- **Partial results** - if timeout occurs during processing, gate returns neutral
- **Clear messaging** - timeout reasons are surfaced in check annotations
- **No hanging processes** - all network operations are cancellable

## Annotation Chunking

For large reports with many violations:

- **Batch processing** - annotations sent in chunks of ≤50 per API call
- **Performance optimization** - prevents API rate limiting
- **Complete coverage** - all violations are eventually surfaced
- **Progress indication** - check summary shows total violation counts

## Error Handling

### Neutral Status Scenarios
- Artifact not found or workflow didn't run
- Invalid JSON/SARIF format in artifact  
- Artifact too large (size limit exceeded)
- Network timeout during download
- Parser preset not found

### Fail Status Scenarios
- Missing required configuration (`artifact_name`)
- Violations found matching `fail_on` criteria

### Status Determination
- **Pass**: No violations or only warnings (when `fail_on: 'errors'`)  
- **Fail**: Violations found matching fail criteria
- **Neutral**: System errors, timeouts, or configuration issues

## Future Extensions

### Additional Parser Presets
- `bandit_json` - Python security linter
- `gitleaks_json` - Secrets detection
- `sonarqube_json` - SonarQube analysis
- `shellcheck_json` - Shell script linting

### Enhanced Features
- **Multi-artifact support** - combine results from multiple tools
- **Baseline filtering** - ignore pre-existing violations
- **Custom annotation templates** - tool-specific formatting
- **Trend analysis** - violation count changes over time

---

**Questions?** Check the [main README](../README.md) for setup instructions or review example configurations in `.cogni/repo-spec-template.yaml`.