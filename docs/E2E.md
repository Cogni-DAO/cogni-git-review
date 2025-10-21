# E2E Testing

End-to-end testing that validates Cogni against live deployments.

## Testing Frameworks

The project currently uses **two different E2E testing approaches**:

1. **Legacy CLI Runner** (`lib/e2e-runner.js`) - Production CI/CD, GitHub-only
2. **Playwright Runner** (`e2e/tests/`) - Development PoC, multi-provider support

> **Note**: The Playwright runner is a **minimal proof of concept** for GitLab support. CI/CD still uses the legacy runner. Future work will migrate to Playwright-only.

## Automatic Integration

E2E tests run automatically in the CI/CD pipeline:
```
Deploy (Preview) → E2E Test (Preview) → Promote to Prod → Deploy (Prod)
```

The GitHub Action `.github/workflows/e2e-test-preview.yml` triggers after successful preview deployments.

## Quick Start

### Legacy CLI Runner (GitHub)
```bash
# Local testing (uses .env file)  
npm run e2e

# Manual GitHub Actions trigger
gh workflow run "E2E Test (Preview)" --ref main
```

### Playwright Runner (GitLab)
```bash
# List available tests
npm run e2e:gitlab -- --list

# Run GitLab E2E tests
npm run e2e:gitlab

# View test reports
npx playwright show-report e2e/artifacts/playwright-report
```

## Environment Variables

### Legacy CLI Runner (GitHub)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_REPO_GITHUB_PAT` | ✅ | - | GitHub token for API access |
| `TEST_REPO` | - | `Cogni-DAO/test-repo` | Target repository |
| `APP_ENV` | - | `dev` | Environment name (determines check name) |
| `TIMEOUT_SEC` | - | `120` | Maximum wait time |

### Playwright Runner (GitLab)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITLAB_E2E_TEST_REPO_PAT` | ✅ | - | GitLab PAT for API access (starts with `glpat-`) |
| `GITLAB_E2E_TEST_REPO` | ✅ | - | Target GitLab repository (e.g., `username/repo`) |
| `GITLAB_E2E_APP_DEPLOYMENT_URL` | ✅ | - | App URL to test against |
| `GITLAB_E2E_WEBHOOK_TIMEOUT_MS` | - | `120000` | Webhook processing timeout |
| `GITLAB_E2E_POLL_INTERVAL_MS` | - | `5000` | Status polling interval |

**Check Names by Environment:**
- `dev` → `"Cogni Git PR Review (dev)"`  
- `preview` → `"Cogni Git PR Review (preview)"`
- `prod` → `"Cogni Git PR Review"` (locked for branch protection)

## Authentication Setup

**Local Development:**
- E2E runner uses `TEST_REPO_GITHUB_PAT` for GitHub API operations (`gh` commands)
- Git push operations work using your existing personal git credentials
- Both authentication methods must have write access to `TEST_REPO`

**GitHub Actions (CI):**
- Workflow configures git authentication using `gh auth setup-git` before E2E tests
- Uses the same `TEST_REPO_GITHUB_PAT` for both API operations and git push
- Git user configured as `cogni-bot` for commit operations

## Playwright Runner Details

### Architecture

The Playwright E2E runner uses a **hybrid CLI + API approach**:

1. **GitLab Operations**: Uses `glab` CLI for repository operations (clone, MR create, cleanup)
2. **Status Polling**: Uses GitLab API directly to poll commit status updates  
3. **Test Framework**: Playwright for test structure, assertions, and reporting

### Test Flow

```
1. Clone GitLab test repository to temp directory
2. Create test branch with sample change
3. Push branch and create Merge Request
4. Poll GitLab commit status API for Cogni processing completion
5. Validate status was created with expected conclusion
6. Cleanup: Close MR, delete branch, remove temp files
```

### Requirements

- **glab CLI**: Installed as dev dependency (`npm install` handles this)
- **GitLab Webhook**: Configured to send events to your app deployment
- **Repository Access**: GitLab PAT with read/write access to test repository
- **App Deployment**: Live Cogni deployment with GitLab integration enabled

## Current Limitations

### Legacy CLI Runner

⚠️ **This is a MINIMAL test** - current state, not desired state:

- Only tests basic PR workflow: file change → Cogni check → success/failure
- `cogni-git-review-preview` GitHub App must be installed on test repository  
- Creates simple file change (`.cogni-e2e.txt`) to trigger evaluation
- Waits for expected check name to complete with `success` conclusion

**Desired state**: 1:1 mapping of cogni-git-review functionality → E2E test validation. New features should get corresponding E2E tests. Currently lack infrastructure and design for comprehensive testing.

### Playwright Runner

⚠️ **Minimal proof of concept** for GitLab E2E testing:

- **Single test**: MR creation → Cogni webhook processing → commit status validation
- **GitLab-only**: No GitHub support in Playwright runner (yet)  
- **Manual setup**: Requires GitLab webhook configuration and PAT setup
- **No CI integration**: Not used in production CI/CD pipeline

**Future work**: Migrate legacy runner functionality to Playwright for unified multi-provider E2E testing.

## Files

### Legacy CLI Runner
- `lib/e2e-runner.js` - Core implementation  
- `bin/e2e-runner.js` - CLI wrapper
- `test/e2e/e2e-runner.test.js` - Tests
- `test-artifacts/e2e-summary.json` - Test results (ignored by git)

### Playwright Runner  
- `playwright.config.js` - Playwright configuration
- `e2e/tests/gitlab-mr-review.spec.js` - GitLab MR workflow test
- `e2e/helpers/test-config.js` - Environment validation and config
- `e2e/artifacts/` - Test reports and artifacts (gitignored)