# Branch Protection Setup

## Quick Start

**For any repository (including this one):**
```bash
# Add status check requirement (preserves existing protection rules)
make setup-branch-protection OWNER=myorg REPO=myrepo

# Verify it worked:
make verify-branch-protection OWNER=myorg REPO=myrepo
```

## Installation Options

### Option 1: Copy this Makefile (Recommended)
```bash
# Copy Makefile to your repo, then:
make setup-branch-protection OWNER=yourorg REPO=yourrepo
```

### Option 2: Manual Setup
1. Settings → Branches → Add rule for `main`
2. Require status checks → Add `Cogni Git PR Review`
3. Save

### Option 3: Organization Rulesets (Org-wide)
1. Org Settings → Code security → Rulesets → New ruleset
2. Target: All repositories
3. Branches: `main` 
4. Enable "Require status checks to pass before merging"
5. Add required check: `Cogni Git PR Review`

## Prerequisites

- **Authentication**: `gh auth login` with admin access to target repo
- **Test first**: Open a test PR so the check context exists
- **Stable naming**: Always use exactly `"Cogni Git PR Review"`

## Troubleshooting

```bash
# Check if protection is working:
make verify-branch-protection OWNER=yourorg REPO=yourrepo

# Fix auth issues:
gh auth login --scopes repo,admin:org
```