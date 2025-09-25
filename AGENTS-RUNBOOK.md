# cogni-git-review Deployment

## Production (LIVE)
- **URL**: `https://cogni-git-review-prod-mwkzx.ondigitalocean.app/cogni-git-review-prod/`
- **Webhook**: `https://cogni-git-review-prod-mwkzx.ondigitalocean.app/cogni-git-review-prod/api/github/webhooks`
- **Logs**: `https://cloud.digitalocean.com/apps/58d763ca-c99c-4bc2-be03-f3109930130c/logs/cogni-git-review-prod?i=7b25f6`
- **Auto-deploys**: on Push to `production` branch

## GitHub Configuration
**Environment "Production":**
- Variables: `APP_ID`
- Secrets: `PRIVATE_KEY`, `WEBHOOK_SECRET`, `OPENAI_API_KEY`

**Environment "Preview":**
- Variables: `PREVIEW_APP_ID`
- Secrets: `PREVIEW_PRIVATE_KEY`, `PREVIEW_WEBHOOK_SECRET`, `OPENAI_API_KEY`

**Repository:**
- `DIGITAL_OCEAN_ACCESS_TOKEN`

## Preview Environment
- **Auto-deploys**: on Push to `main` branch
- **URL**: TBD (will be created when deployed)
- **Purpose**: Testing changes before promoting to production

