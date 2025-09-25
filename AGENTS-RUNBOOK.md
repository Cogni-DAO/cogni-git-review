# cogni-git-review Deployment

## Production (LIVE)
- **URL**: `https://cogni-git-review-prod-mwkzx.ondigitalocean.app/cogni-git-review-prod/`
- **Webhook**: `https://cogni-git-review-prod-mwkzx.ondigitalocean.app/cogni-git-review-prod/api/github/webhooks`
- **Logs**: `https://cloud.digitalocean.com/apps/58d763ca-c99c-4bc2-be03-f3109930130c/logs/cogni-git-review-prod?i=7b25f6`
- **Auto-deploys**: on Push to `main` branch

## GitHub Configuration
**Environment "production":**
- Variables: `APP_ID` (1761205), `CLIENT_ID` (Iv23liXZB0avFTzd2auo)
- Secrets: `PRIVATE_KEY`, `WEBHOOK_SECRET`, `OPENAI_API_KEY`

**Repository:**
- `DIGITAL_OCEAN_ACCESS_TOKEN`

## Preview/Dev Environments
Not configured. Only production exists.

