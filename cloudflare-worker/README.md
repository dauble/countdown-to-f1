# Cloudflare Worker for Yoto MYO Card Auto-Refresh

This Cloudflare Worker serves as an intermediary between the Yoto MYO card and the OpenF1 API, enabling automatic daily content updates for your Formula 1 card.

## Overview

The worker provides:
- **Scheduled Daily Refresh**: Automatically fetches fresh F1 race data every day at 6:00 AM UTC
- **Cached Content Delivery**: Serves the latest playlist data to Yoto MYO card requests with low latency
- **Global Availability**: Deployed on Cloudflare's edge network for worldwide accessibility
- **Rate Limit Compliance**: Respects OpenF1 API rate limits (3 requests/second)

## Architecture

```
Yoto MYO Card → Cloudflare Worker → OpenF1 API
                      ↓
                 KV Storage (Cache)
```

1. **Scheduled Updates**: Worker fetches data from OpenF1 API daily via cron trigger
2. **Data Storage**: Fresh data is cached in Cloudflare KV storage
3. **Content Delivery**: MYO card requests fetch cached data from the worker

## Setup Instructions

### Prerequisites

- Cloudflare account (free tier works)
- Wrangler CLI installed: `npm install -g wrangler`
- Node.js 16+ installed

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create a KV Namespace

Create a KV namespace to store the F1 playlist data:

```bash
# For production
wrangler kv:namespace create "F1_DATA"

# For preview/development
wrangler kv:namespace create "F1_DATA" --preview
```

Copy the namespace ID from the output and update it in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "F1_DATA"
id = "your_kv_namespace_id_here"  # Replace with your actual ID
```

### 4. Configure the Worker

Edit `wrangler.toml` to customize:

- **Cron Schedule**: Change the cron expression to your preferred update time
  ```toml
  [triggers]
  crons = ["0 6 * * *"]  # Daily at 6:00 AM UTC
  ```
  
- **Worker Name**: Update if you want a different name
  ```toml
  name = "f1-yoto-myo-worker"
  ```

### 5. Deploy the Worker

Deploy to Cloudflare:

```bash
# Deploy to production
wrangler deploy

# Or deploy to a specific environment
wrangler deploy --env production
```

After deployment, you'll get a URL like: `https://f1-yoto-myo-worker.your-subdomain.workers.dev`

### 6. Test the Worker

Test the endpoints:

```bash
# Health check
curl https://f1-yoto-myo-worker.your-subdomain.workers.dev/health

# Get playlist data
curl https://f1-yoto-myo-worker.your-subdomain.workers.dev/playlist

# Manual refresh (optional)
curl -X POST https://f1-yoto-myo-worker.your-subdomain.workers.dev/refresh
```

## API Endpoints

### GET /playlist

Returns the cached F1 playlist data in JSON format.

**Response:**
```json
{
  "race": {
    "name": "Australian Grand Prix",
    "location": "Melbourne",
    "country": "Australia",
    "circuit": "Albert Park Circuit",
    "dateStart": "2024-03-24T05:00:00.000Z",
    "year": 2024,
    "meetingKey": 1234
  },
  "sessions": [
    {
      "sessionName": "Practice 1",
      "dateStart": "2024-03-22T02:30:00.000Z",
      "sessionKey": 5678
    }
  ],
  "weather": {
    "airTemperature": 22,
    "trackTemperature": 35,
    "humidity": 65
  },
  "lastUpdated": "2024-03-22T06:00:00.000Z"
}
```

### POST /refresh

Manually trigger a data refresh (useful for testing or immediate updates).

**Response:**
```json
{
  "success": true,
  "message": "Data refreshed successfully",
  "timestamp": "2024-03-22T10:30:00.000Z"
}
```

### GET /health

Health check endpoint to verify worker status.

**Response:**
```json
{
  "status": "healthy",
  "hasCachedData": true,
  "timestamp": "2024-03-22T10:30:00.000Z"
}
```

## Integration with Yoto MYO Card

To use this worker with your Yoto MYO card, you'll need to update your application to fetch data from the worker endpoint instead of directly from OpenF1.

### Option 1: Update Generate Card Route

Modify `src/app/api/generate-card/route.js` to optionally fetch from the worker:

```javascript
// Add to the top of the file
const USE_CLOUDFLARE_WORKER = process.env.USE_CLOUDFLARE_WORKER === 'true';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;

// In the POST handler, replace F1 API calls with:
if (USE_CLOUDFLARE_WORKER && CLOUDFLARE_WORKER_URL) {
  const response = await fetch(`${CLOUDFLARE_WORKER_URL}/playlist`);
  const data = await response.json();
  
  // Use the cached data
  raceData = data.race;
  sessions = data.sessions;
  weather = data.weather;
} else {
  // Existing F1 API calls
  const raceData = await getNextRace();
  // ... rest of existing code
}
```

### Option 2: Direct MYO Card Integration

For direct integration where the MYO card fetches from the worker on every play:

1. Configure your Yoto MYO card to point to: `https://f1-yoto-myo-worker.your-subdomain.workers.dev/playlist`
2. The card will fetch fresh data every time it's played
3. Data is cached for 1 hour (customizable via `Cache-Control` header)

## Environment Variables

Add these to your `.env` file to use the Cloudflare Worker:

```env
# Enable Cloudflare Worker integration
USE_CLOUDFLARE_WORKER=true

# Your Cloudflare Worker URL
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.your-subdomain.workers.dev
```

## Monitoring and Logs

View worker logs and analytics:

```bash
# Tail live logs
wrangler tail

# View in Cloudflare dashboard
# Go to Workers & Pages → Your Worker → Logs
```

## Customization

### Change Update Schedule

Edit the cron expression in `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 6 * * *",      # 6:00 AM UTC daily
  "0 18 * * *"      # 6:00 PM UTC daily (add multiple times if needed)
]
```

### Adjust Cache Duration

Modify the `expirationTtl` in `worker.js`:

```javascript
await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
  expirationTtl: 86400  // 24 hours (adjust as needed)
});
```

### Add Custom Domain

1. Add your domain to Cloudflare
2. Update `wrangler.toml`:

```toml
routes = [
  { pattern = "f1-api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

3. Deploy: `wrangler deploy`

## Troubleshooting

### Worker not updating data

1. Check logs: `wrangler tail`
2. Verify KV namespace binding in `wrangler.toml`
3. Manually trigger refresh: `curl -X POST https://your-worker.workers.dev/refresh`

### Rate limit errors from OpenF1

The worker includes 500ms delays between API calls (2 req/sec). If you still see rate limit errors:
- Increase delay time in `worker.js`
- Reduce update frequency in cron schedule

### CORS errors

CORS headers are included by default. If you need to restrict origins, modify the `corsHeaders` in `worker.js`:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',  // Specific domain
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

## Cost Estimates

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request
- KV: 100,000 reads/day, 1,000 writes/day

For this use case:
- **Scheduled updates**: 1 write/day (well within free tier)
- **MYO card requests**: Depends on usage, but likely within free tier
- **Estimated cost**: $0/month on free tier for typical usage

## Development

### Local Testing

Test the worker locally:

```bash
# Install dependencies (if any)
npm install

# Run locally
wrangler dev

# Test endpoints
curl http://localhost:8787/health
curl http://localhost:8787/playlist
```

### Update Worker

After making changes:

```bash
# Deploy updated version
wrangler deploy

# Or deploy to staging first
wrangler deploy --env staging
```

## Support

For issues or questions:
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- OpenF1 API: https://openf1.org/
- Yoto Developer: https://yoto.dev/

## License

This worker follows the same MIT license as the main project.
