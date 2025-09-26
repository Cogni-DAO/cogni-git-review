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
npm run e2e:preview

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

## Files
- `lib/e2e-runner.js` - Core implementation  
- `bin/e2e-runner.js` - CLI wrapper
- `test/e2e/e2e-runner.test.js` - Tests