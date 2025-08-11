# PR Workflow Testing - Debugging Report

This is the most basic v0 testing workflow, manually initiated. v0.1 will need a proper automated integration test.

AND - this is highlighting how the current PR workflow is broken.

## Objective
Test the Probot GitHub App's ability to:
1. Create checks on PR creation
2. Handle re-run requests from GitHub UI
3. Enable branch protection requiring checks

## What We Tried

### 1. Initial PR Testing Setup
- **Goal**: Create PR to test bot functionality
- **Approach**: Created `test-pr-functionality` branch → PR to `feat/v0-pr-review`
- **Problem**: Both branches identical, GitHub won't create PR
- **Fix**: Recreated test branch from `main` instead

### 2. PR Creation
- **Created**: PR #2 (`test-pr-functionality` → `feat/v0-pr-review`)
- **Expected**: Bot should create "Cogni Git Review" check
- **Actual**: **ZERO checks created**

### 3. Historical Comparison
- **PR #1**: Every commit shows "1 check passed" ✅. all commits were directly to main
- **PR #2**: New commits show nothing (zero checks) ❌. Commits were to a sub branch.
- **Regression identified**: Bot was working, now isn't

### 4. Simple Commit Test
- **Created**: `throwaway-test-branch` with simple commit
- **Expected**: `check_suite.requested` event → bot creates check
- **Actual**: **ZERO webhook activity in terminal**

## Current Discoveries

### Bot Configuration Analysis
```yaml
# app.yml events (current):
default_events:
  - check_run          # ✅ Enabled
  - check_suite        # ✅ Enabled  
  # - pull_request     # ❌ Commented out

default_permissions:
  checks: write         # ✅ Correct
  metadata: read        # ✅ Correct
  # pull_requests: read # ❌ Commented out
```

### Critical Issues Identified

#### 1. **NO WEBHOOK DELIVERY**
- Terminal shows `npm start` running with smee.io proxy
- **Zero webhook activity** on any git push/commit
- This suggests **webhook delivery is completely broken**

#### 2. **Even Basic Events Failing**
- `check_suite` events should trigger on **any commit to any branch**
- Not even basic check_suite webhooks are being delivered
- This is **not a code issue** - it's infrastructure/configuration

#### 3. **Regression from Working State**
- PR #1 had successful checks
- Something changed between PR #1 and now
- **Not related to our code changes**

## Continuing Errors

### Primary Issue: No Webhook Delivery
- **Symptom**: Zero activity in bot terminal despite git pushes
- **Impact**: Bot cannot respond to any GitHub events
- **Root Cause**: Likely webhook configuration issue

### Secondary Issues (Masked by Primary)
- Cannot test PR functionality
- Cannot test rerun functionality  
- Cannot test branch protection
- All blocked by webhook delivery failure

## Next Debugging Steps

### Immediate
1. **Verify GitHub App Installation**
   - Check: Repository → Settings → Integrations & webhooks → GitHub Apps
   - Confirm app is still installed and active

2. **Verify Webhook Configuration** 
   - Check: GitHub App settings → Webhook URL
   - Confirm smee.io URL is correct and active
   - Test webhook delivery manually

3. **Check App Permissions**
   - Verify GitHub App still has required permissions
   - Check if permissions were revoked or changed

### If Webhooks Fixed
1. Test basic check_suite functionality
2. Enable PR events in app.yml
3. Test PR workflow end-to-end
4. Test rerun functionality
5. Enable branch protection

## BREAKTHROUGH: Server Logs Analysis

### What The Logs Reveal
```
DEBUG (My app!): GitHub request: POST .../check-runs - 201
    head_branch: "main"          # ✅ WORKING
    head_branch: "feat/name-update"  # ✅ WORKING
```

### The Real Problem
**GitHub App is configured to only send webhooks for specific branches!**

- ✅ `main` branch → webhooks delivered
- ✅ `feat/name-update` branch → webhooks delivered  
- ❌ `test-pr-functionality` → NO webhooks
- ❌ `throwaway-test-branch` → NO webhooks

### Root Cause
GitHub App webhook configuration is **branch-restricted**, not receiving events for new branches.

## Next Steps
1. **Check GitHub App Settings** → Webhook configuration
2. **Look for branch filters** in GitHub App setup
3. **Verify repository selection** - may be limited to specific branches
4. **Re-configure app** to receive events from ALL branches

## RESOLUTION: Server Restart Fixed Issue

### What Happened
After extensive debugging, **restarting the local server (`npm start`) magically fixed the webhook delivery issue**.

### Evidence of Fix
```
DEBUG (Cogni Git Review): GitHub request: POST .../check-runs - 201
    head_branch: "feat/v0-pr-review"    # ✅ NOW WORKING
    head_sha: "c875b2c5aafba376fa9b4cfd08ccd716fa0a35be"
    status: "completed"
    conclusion: "success"
```

### Root Cause: Unknown
- **Symptom**: Webhooks stopped being delivered to local server
- **GitHub was sending** webhooks to smee.io correctly
- **Smee.io was receiving** them correctly  
- **Local server wasn't processing** forwarded webhooks
- **Simple restart resolved** the connection issue

### Debugging Lesson
**If webhooks stop working**: Try restarting the local development server first before deep debugging.

**Possible causes** (unconfirmed):
- Smee.io connection timeout/disconnect
- Local network connectivity issue
- Node.js process state corruption
- WebSocket connection dropped

## Status  
**RESOLVED**: Webhook delivery restored via server restart.

**Next**: Continue with PR workflow testing and branch protection setup.