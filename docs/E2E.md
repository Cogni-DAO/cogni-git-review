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
gh workflow run "E2E Test (Preview)" --ref main -f skip_deploy_check=true
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_REPO_GITHUB_PAT` | ✅ | - | GitHub token for API access |
| `TEST_REPO` | - | `Cogni-DAO/test-repo` | Target repository |
| `CHECK_NAME` | - | `Cogni Git PR Review` | Expected check name |
| `TIMEOUT_SEC` | - | `480` | Maximum wait time |

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