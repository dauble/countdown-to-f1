# Quick Start: Cloudflare Worker Auto-Refresh

Enable automatic daily updates for your Yoto F1 MYO card in just a few minutes!

## What You'll Need

- Cloudflare account (free tier works)
- 5-10 minutes of setup time
- Basic command line knowledge

## Setup Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

This opens your browser - just log in and grant access.

### 3. Create Storage

```bash
cd cloudflare-worker
npx wrangler kv namespace create F1_DATA
```

Copy the namespace ID from the output (looks like: `abc123def456`)

### 4. Configure

Edit `wrangler.toml` and replace `your_kv_namespace_id_here` with your actual ID:

```toml
[[kv_namespaces]]
binding = "F1_DATA"
id = "abc123def456"  # <-- Put your ID here
```

### 5. Deploy

```bash
npx wrangler deploy
```

You'll get a URL like: `https://f1-yoto-myo-worker.your-subdomain.workers.dev`

### 6. Load Initial Data

```bash
curl -X POST https://f1-yoto-myo-worker.your-subdomain.workers.dev/refresh
```

### 7. Enable in Your App

Add to your `.env` file:

```env
USE_CLOUDFLARE_WORKER=true
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.your-subdomain.workers.dev
```

### 8. Restart Your App

```bash
npm run dev  # or npm start for production
```

## That's It!

Your MYO card will now automatically fetch fresh F1 data every time you generate a card. The worker updates the data daily at 6:00 AM UTC.

## Verify It's Working

Check the worker health:

```bash
curl https://your-worker.workers.dev/health
```

Should return:

```json
{
  "status": "healthy",
  "hasCachedData": true,
  "timestamp": "2024-01-18T..."
}
```

View the cached data:

```bash
curl https://your-worker.workers.dev/playlist
```

Should return F1 race information in JSON format.

## Troubleshooting

**Problem**: `wrangler: command not found`

- **Solution**: Make sure you installed wrangler globally: `npm install -g wrangler`

**Problem**: Worker returns "No cached data"

- **Solution**: Run the manual refresh: `curl -X POST https://your-worker.workers.dev/refresh`

**Problem**: App still uses OpenF1 directly

- **Solution**: Check your `.env` file has the correct settings and restart your app

## Need More Help?

See the detailed guides:

- [Full README](CLOUDFLARE_WORKER.md) - Complete feature documentation
- [Deployment Guide](CLOUDFLARE_DEPLOYMENT.md) - Step-by-step instructions with examples
- [Feature Documentation](CLOUDFLARE_WORKER_FEATURE.md) - Architecture and details

## Cost

This runs on Cloudflare's free tier. Expected cost: **$0/month** for typical usage.

Free tier includes:

- 100,000 requests/day
- 10ms CPU time per request
- Unlimited storage (effectively)

## Daily Updates

The worker automatically fetches fresh data every day at 6:00 AM UTC. No manual intervention needed!

Want to change the schedule? Edit the cron expression in `wrangler.toml`:

```toml
[triggers]
crons = ["0 6 * * *"]  # Daily at 6:00 AM UTC
```

Examples:

- `"0 */6 * * *"` - Every 6 hours
- `"0 0 * * *"` - Daily at midnight UTC
- `"0 12 * * *"` - Daily at noon UTC

## Support

Questions? Issues? Check the main documentation or open an issue on GitHub.
