# E2E Testing

End-to-end testing that validates Cogni against live deployments.

## Automatic Integration

E2E tests run automatically in the CI/CD pipeline:
```
Deploy (Preview) → E2E Test (Preview) → Promote to Prod → Deploy (Prod)
```

The GitHub Action `.github/workflows/e2e-test-preview.yml` triggers after successful preview deployments.

## Quick Start

```bash
# Local testing (uses .env file)  
npm run e2e

# Manual GitHub Actions trigger
gh workflow run "E2E Test (Preview)" --ref main
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_REPO_GITHUB_PAT` | ✅ | - | GitHub token for API access |
| `TEST_REPO` | - | `Cogni-DAO/test-repo` | Target repository |
| `APP_ENV` | - | `dev` | Environment name (determines check name) |
| `TIMEOUT_SEC` | - | `480` | Maximum wait time |

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

## Current Limitations

⚠️ **This is a MINIMAL test** - current state, not desired state:

- Only tests basic PR workflow: file change → Cogni check → success/failure
- `cogni-git-review-preview` GitHub App must be installed on test repository  
- Creates simple file change (`.cogni-e2e.txt`) to trigger evaluation
- Waits for expected check name to complete with `success` conclusion

**Desired state**: 1:1 mapping of cogni-git-review functionality → E2E test validation. New features should get corresponding E2E tests. Currently lack infrastructure and design for comprehensive testing.

## Files
- `lib/e2e-runner.js` - Core implementation  
- `bin/e2e-runner.js` - CLI wrapper
- `test/e2e/e2e-runner.test.js` - Tests
- `test-artifacts/e2e-summary.json` - Test results (ignored by git)