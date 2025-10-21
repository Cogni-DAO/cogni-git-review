# E2E Testing

End-to-end testing that validates Cogni against live deployments.

## Testing Framework

The project uses **Playwright** as the unified E2E testing framework:

- **Location**: `e2e/tests/` - Test specifications for GitHub and GitLab
- **Configuration**: `playwright.config.js` - Unified test configuration
- **CI/CD Integration**: Used in GitHub Actions for preview and production validation

## Automatic Integration

E2E tests run automatically in the CI/CD pipeline:
```
Deploy (Preview) → E2E Test (Preview) → Promote to Prod → Deploy (Prod)
```

The GitHub Action `.github/workflows/e2e-test-preview.yml` triggers after successful preview deployments.

## Quick Start

```bash
# Run all E2E tests (GitHub + GitLab)
npm run e2e

# Run GitHub tests only
npm run e2e:github

# Run GitLab tests only
npm run e2e:gitlab

# List available tests
npx playwright test --list

# View test reports after run
npx playwright show-report e2e/artifacts/playwright-report

# Manual GitHub Actions trigger
gh workflow run "E2E Test (Preview)" --ref main
```

## Environment Variables

### GitHub E2E Tests

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `E2E_GITHUB_PAT` | ✅ | - | GitHub token for API access |
| `E2E_GITHUB_REPO` | - | `Cogni-DAO/test-repo` | Target repository |
| `APP_ENV` | - | `dev` | Environment name (determines check name) |
| `TIMEOUT_SEC` | - | `480` | Maximum wait time (seconds) |
| `SLEEP_MS` | - | `5000` | Poll interval (milliseconds) |

### GitLab E2E Tests

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `E2E_GITLAB_PAT` | ✅ | - | GitLab PAT for API access (starts with `glpat-`) |
| `E2E_GITLAB_REPO` | ✅ | - | Target GitLab repository (e.g., `username/repo`) |
| `E2E_GITLAB_DEPLOYMENT_URL` | ✅ | - | App URL to test against |
| `E2E_GITLAB_WEBHOOK_TIMEOUT_MS` | - | `120000` | Webhook processing timeout |
| `E2E_GITLAB_POLL_INTERVAL_MS` | - | `5000` | Status polling interval |

**Check Names by Environment:**
- `dev` → `"Cogni Git PR Review (dev)"`  
- `preview` → `"Cogni Git PR Review (preview)"`
- `prod` → `"Cogni Git PR Review"` (locked for branch protection)

## Authentication Setup

**Local Development:**
- E2E runner uses `E2E_GITHUB_PAT` for GitHub API operations (`gh` commands)
- Git push operations work using your existing personal git credentials
- Both authentication methods must have write access to `E2E_GITHUB_REPO`

**GitHub Actions (CI):**
- Workflow configures git authentication using `gh auth setup-git` before E2E tests
- Uses the same `E2E_GITHUB_PAT` for both API operations and git push
- Git user configured as `cogni-bot` for commit operations

## Test Architecture

### Unified Playwright Framework

The E2E tests use Playwright with provider-specific approaches:

**GitHub Tests**:
1. **Operations**: Uses `gh` CLI for repository operations (clone, PR create, cleanup)
2. **Status Polling**: Uses GitHub API to poll check run status
3. **Test Flow**: Clone → Create PR → Poll checks → Validate → Cleanup

**GitLab Tests**:
1. **Operations**: Uses `glab` CLI for repository operations (clone, MR create, cleanup)
2. **Status Polling**: Uses GitLab API to poll commit status  
3. **Test Flow**: Clone → Create MR → Poll status → Validate → Cleanup

### Requirements

- **CLI Tools**: `gh` (GitHub) and `glab` (GitLab) CLIs installed
- **Webhook Configuration**: GitHub App or GitLab webhook configured for test repositories
- **Repository Access**: PATs with read/write access to test repositories
- **App Deployment**: Live Cogni deployment with provider integration enabled

## Current Limitations

⚠️ **Minimal test coverage** - current state, not desired state:

- **Basic workflows only**: PR/MR creation → Cogni check/status → validation
- **Simple file changes**: Creates `.cogni-e2e.txt` to trigger evaluation
- **Limited scenarios**: Only tests happy path with successful checks

**Desired state**: 1:1 mapping of cogni-git-review functionality → E2E test validation. New features should get corresponding E2E tests.

### CI/CD Artifact Collection

GitHub Actions automatically collects E2E test artifacts on failure:
- **HTML reports**: Interactive test results viewer
- **JSON results**: Machine-readable test outcomes  
- **Videos**: Screen recordings of failed tests
- **Traces**: Detailed execution traces for debugging
- **Retention**: 7 days in GitHub Actions artifacts

## Files

- `playwright.config.js` - Unified Playwright configuration
- `e2e/tests/github-pr-review.spec.js` - GitHub PR workflow test
- `e2e/tests/gitlab-mr-review.spec.js` - GitLab MR workflow test  
- `e2e/helpers/test-config.js` - GitLab environment validation
- `e2e/artifacts/` - Test reports and artifacts (gitignored)
- `test/e2e/e2e-runner.test.js` - Unit tests for E2E utilities