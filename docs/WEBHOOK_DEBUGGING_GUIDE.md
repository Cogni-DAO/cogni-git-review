# Webhook Debugging Guide - Cogni Git Review Bot

## Overview
This guide provides systematic approaches for debugging webhook delivery issues and testing the Cogni Git Review bot locally.

## Debugging Webhook Delivery Issues

### 1. Check Webhook Connection Status
**First, verify if webhooks are being delivered:**

1. **Check Smee.io proxy directly**: https://smee.io/LhGHiP1UNnaXgLGi
   - Should show recent webhook deliveries in real-time
   - If empty, the issue is with GitHub → Smee delivery

2. **Check local server logs**:
   ```bash
   npm start
   # Look for webhook events in console output
   ```

3. **Common connection issues**:
   - **Connection drops**: Restart `npm start` - this is environmental, not code
   - **No webhooks received**: Check if GitHub App settings match `app.yml`
   - **Smee.io timeout**: The proxy URL may need refreshing

### 2. GitHub App Settings Verification

**Critical Note**: `app.yml` changes do NOT automatically sync to GitHub!

**Manual verification required at**: `github.com/settings/apps/[app-name]`

**Required Settings:**
```yaml
Events:
- check_run ✅
- check_suite ✅ 
- pull_request ✅

Permissions:
- Checks: Write ✅
- Pull requests: Read ✅
- Metadata: Read ✅
```

### 3. Webhook Redelivery for Production Debugging

**GitHub App Dashboard → Advanced → Recent Deliveries**

**Process:**
1. Find the failed/problematic webhook delivery
2. Click "Redeliver" 
3. Ensure local server is running (`npm start`)
4. Monitor console for webhook processing

**Benefits:**
- Replay exact production payloads locally
- Test specific edge cases that occurred in production
- No need to create manual PRs or commits

## Local Testing Workflow

### Automated Integration Tests (Preferred)
```bash
# Run comprehensive integration test suite
npm test

# Run only integration tests
node --test test/integration/
```

**Test Coverage:**
- ✅ Real GitHub webhook payload validation
- ✅ PR opened → check creation
- ✅ PR synchronize → check creation  
- ✅ Check run rerequested → rerun logic
- ✅ Duplicate delivery handling
- ✅ Payload structure validation

### Manual Testing Checklist
When automated tests aren't sufficient:

1. **Start local server**: `npm start`
2. **Verify smee connection**: Check https://smee.io/LhGHiP1UNnaXgLGi
3. **Trigger event**: Create PR, push commits, or use webhook redelivery
4. **Monitor logs**: Watch console for event processing
5. **Verify result**: Check GitHub for created check runs

## Troubleshooting Common Issues

### "No webhooks received"
**Symptoms**: Local server running, but no events in console
**Solutions**:
1. Restart `npm start` (connection drop)
2. Check smee.io URL for recent deliveries
3. Verify GitHub App installation on target repository
4. Check if webhook events are enabled in GitHub App settings

### "Check runs not created"
**Symptoms**: Webhooks received, but no checks appear on GitHub
**Solutions**:
1. Check console for error messages
2. Verify API permissions in GitHub App settings
3. Ensure installation has correct repository access
4. Check if branch protection rules are interfering

### "Permission denied" errors
**Symptoms**: API calls failing with 403/401 errors
**Solutions**:
1. Verify GitHub App permissions match requirements
2. Check if installation accepted new permission requests
3. Ensure private key is correctly configured
4. Verify App ID matches configuration

## Integration Test Fixtures

**Real webhook payload fixtures located in**: `test/fixtures/`

- `pr.opened.real.json` - Actual PR opened webhook from GitHub
- `pr.synchronize.real.json` - PR updated/synchronized event
- `check_run.rerequested.real.json` - Check rerun request

**Creating new fixtures:**
1. Use webhook redelivery to capture real GitHub payloads
2. Copy payload from smee.io or GitHub App delivery logs  
3. Sanitize sensitive data (tokens, private repo info)
4. Save as `.json` file in `test/fixtures/`

## Production Debugging Workflow

1. **Identify issue**: Check GitHub App delivery logs
2. **Collect payload**: Copy the exact webhook payload from delivery logs
3. **Local reproduction**: Use webhook redelivery or create fixture
4. **Test fix**: Run integration tests + manual verification
5. **Deploy**: Standard deployment process

## Success Criteria

**Debugging is successful when:**
- ✅ Webhook delivery issues are identified and resolved
- ✅ Local testing reproduces production behavior
- ✅ Integration tests cover the problematic scenario
- ✅ Issue root cause is documented for future reference