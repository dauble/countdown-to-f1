# Cloudflare Worker Deployment Guide

This guide walks you through deploying the Cloudflare Worker for automatic Yoto MYO card updates.

## Prerequisites

Before you begin, ensure you have:

1. **Cloudflare Account** (free tier works fine)
   - Sign up at: https://dash.cloudflare.com/sign-up

2. **Node.js and npm** installed (v16 or higher)
   ```bash
   node --version  # Should be v16+
   npm --version
   ```

3. **Wrangler CLI** installed globally
   ```bash
   npm install -g wrangler
   ```

## Step-by-Step Deployment

### Step 1: Authenticate with Cloudflare

Open your terminal and run:

```bash
wrangler login
```

This will:
- Open your browser
- Ask you to log in to Cloudflare
- Grant Wrangler access to your account

### Step 2: Navigate to the Worker Directory

```bash
cd cloudflare-worker
```

### Step 3: Create KV Namespace

KV (Key-Value) storage is where the worker caches F1 data. Create two namespaces:

```bash
# Production namespace
wrangler kv:namespace create "F1_DATA"

# Preview namespace (for local testing)
wrangler kv:namespace create "F1_DATA" --preview
```

**Important**: Copy the namespace IDs from the output. You'll see something like:

```
🌀 Creating namespace with title "f1-yoto-myo-worker-F1_DATA"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "F1_DATA", id = "abc123def456" }
```

### Step 4: Update wrangler.toml

Open `wrangler.toml` and replace the placeholder namespace IDs with your actual IDs:

```toml
[[kv_namespaces]]
binding = "F1_DATA"
id = "abc123def456"  # Replace with YOUR production namespace ID

# For preview/development
[[kv_namespaces]]
binding = "F1_DATA"
preview_id = "xyz789ghi012"  # Replace with YOUR preview namespace ID
```

### Step 5: Customize Settings (Optional)

In `wrangler.toml`, you can customize:

#### Worker Name
```toml
name = "f1-yoto-myo-worker"  # Change if desired
```

#### Update Schedule
```toml
[triggers]
crons = ["0 6 * * *"]  # Daily at 6:00 AM UTC
```

Common schedules:
- `"0 6 * * *"` - Daily at 6:00 AM UTC
- `"0 */6 * * *"` - Every 6 hours
- `"0 0 * * 0"` - Weekly on Sunday at midnight
- `"0 0 1 * *"` - Monthly on the 1st at midnight

### Step 6: Test Locally (Optional)

Before deploying, test the worker locally:

```bash
# Start local development server
wrangler dev

# In another terminal, test the endpoints
curl http://localhost:8787/health
curl http://localhost:8787/playlist
curl -X POST http://localhost:8787/refresh
```

### Step 7: Deploy to Cloudflare

Deploy the worker:

```bash
wrangler deploy
```

You'll see output like:

```
Uploaded f1-yoto-myo-worker (1.23 sec)
Published f1-yoto-myo-worker (0.45 sec)
  https://f1-yoto-myo-worker.your-subdomain.workers.dev
```

**Save this URL!** You'll need it to integrate with your Yoto app.

### Step 8: Verify Deployment

Test your deployed worker:

```bash
# Replace with your actual worker URL
curl https://f1-yoto-myo-worker.your-subdomain.workers.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "hasCachedData": false,
  "timestamp": "2024-01-18T21:42:05.293Z"
}
```

### Step 9: Initial Data Load

Trigger the first data fetch manually:

```bash
curl -X POST https://f1-yoto-myo-worker.your-subdomain.workers.dev/refresh
```

Expected response:
```json
{
  "success": true,
  "message": "Data refreshed successfully",
  "timestamp": "2024-01-18T21:42:05.293Z"
}
```

Now verify data is cached:

```bash
curl https://f1-yoto-myo-worker.your-subdomain.workers.dev/playlist
```

You should see F1 race data in JSON format.

## Integration with Your Yoto App

Now that your worker is deployed, integrate it with your Yoto F1 card app.

### Option 1: Environment Variable Configuration

Add these variables to your `.env` file:

```env
# Enable Cloudflare Worker integration
USE_CLOUDFLARE_WORKER=true

# Your Cloudflare Worker URL (replace with your actual URL)
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.your-subdomain.workers.dev
```

Then update your app to use the worker endpoint (see main README for integration instructions).

### Option 2: Custom Domain (Optional)

If you want a custom domain like `f1-api.yourdomain.com`:

1. Add your domain to Cloudflare (if not already added)
2. Update `wrangler.toml`:

```toml
routes = [
  { pattern = "f1-api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

3. Deploy again:

```bash
wrangler deploy
```

4. Your worker will be available at: `https://f1-api.yourdomain.com/playlist`

## Monitoring

### View Live Logs

Monitor your worker in real-time:

```bash
wrangler tail
```

This shows all requests, responses, and any errors.

### Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **Workers & Pages** → **Your Worker**
3. View analytics, logs, and metrics

## Updating the Worker

When you make changes to the worker code:

```bash
# Test locally first
wrangler dev

# Deploy updates
wrangler deploy
```

## Troubleshooting

### Issue: "No namespace ID found"

**Solution**: Make sure you've created the KV namespace and updated `wrangler.toml` with the correct IDs.

### Issue: "Authentication failed"

**Solution**: Run `wrangler login` again to re-authenticate.

### Issue: "Rate limit exceeded from OpenF1 API"

**Solution**: The worker includes rate limiting (500ms delays). If you still see errors:
1. Check if you're making additional requests outside the worker
2. Increase the delay in `worker.js` (line ~13)
3. Reduce the cron frequency in `wrangler.toml`

### Issue: "Worker returns 500 error"

**Solution**: Check logs with `wrangler tail` to see the error details.

### Issue: "No cached data"

**Solution**: 
1. Manually trigger refresh: `curl -X POST https://your-worker.workers.dev/refresh`
2. Wait for the scheduled cron to run (check your cron schedule)
3. Verify OpenF1 API is accessible: `curl https://api.openf1.org/v1/meetings`

## Cost Information

**Cloudflare Workers Free Tier includes:**
- 100,000 requests/day
- 10ms CPU time per request
- KV: 100,000 reads/day, 1,000 writes/day, 1 GB storage

**Expected Usage:**
- Scheduled updates: 1-24 writes/day (depending on cron schedule)
- MYO card plays: 1 read per card play
- Typical cost: **$0/month** on free tier

If you exceed free tier limits, costs are minimal:
- $0.50 per million requests
- $0.50 per million KV reads

## Advanced Configuration

### Multiple Workers (Staging/Production)

Deploy separate staging and production workers:

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

Configure environments in `wrangler.toml` as shown in the file.

### Enable GitHub Actions Deployment

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches:
      - main
    paths:
      - 'cloudflare-worker/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'cloudflare-worker'
```

Add your Cloudflare API token to GitHub Secrets:
1. Get token: https://dash.cloudflare.com/profile/api-tokens
2. Add to: **Repository Settings** → **Secrets** → **New repository secret**
3. Name: `CLOUDFLARE_API_TOKEN`

## Next Steps

1. ✅ Worker deployed and accessible
2. ✅ Initial data loaded via `/refresh`
3. ✅ Scheduled updates configured
4. 🔜 Integrate with your Yoto app (see main README)
5. 🔜 Test the MYO card with fresh data

## Support Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
- **OpenF1 API**: https://openf1.org/
- **Yoto Developer**: https://yoto.dev/

## Rollback

If you need to roll back to a previous version:

```bash
# List deployments
wrangler deployments list

# Rollback to a specific deployment
wrangler rollback [deployment-id]
```

---

**Congratulations!** Your Cloudflare Worker is now deployed and ready to serve fresh F1 data to your Yoto MYO card. 🏎️
