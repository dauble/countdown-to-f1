# Cloudflare Worker Auto-Refresh Feature

## Overview

The Cloudflare Worker Auto-Refresh feature enables automatic daily content updates for Yoto MYO cards without manual intervention. This serverless solution runs on Cloudflare's global edge network, providing low-latency access to fresh F1 race data.

## Problem Statement

Previously, users had to manually regenerate their Yoto F1 cards to get the latest race information. This meant:
- Manual intervention required before each race weekend
- Outdated content if users forgot to update
- Multiple API calls to OpenF1every time a card was generated
- No automatic refresh when the card was played

## Solution

The Cloudflare Worker acts as an intermediary caching layer between the Yoto MYO card and the OpenF1 API:

1. **Scheduled Updates**: Worker fetches fresh data from OpenF1 API daily via cron trigger
2. **Cached Delivery**: Data is stored in Cloudflare KV storage
3. **Instant Access**: MYO card requests fetch cached data with minimal latency
4. **Optional Integration**: Users can choose to enable or disable the worker

## Architecture

```
┌─────────────────┐
│  Yoto MYO Card  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Next.js Application    │
│  (generate-card API)    │
└────────┬────────────────┘
         │
         ▼
    ┌────────┐
    │Enable? │───No───┐
    └───┬────┘        │
        │Yes          │
        ▼             ▼
┌──────────────┐  ┌──────────────┐
│  Cloudflare  │  │  OpenF1 API  │
│    Worker    │  │   (Direct)   │
└──────┬───────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│ KV Storage   │
│  (Cache)     │
└──────────────┘
       ▲
       │
  Daily Cron
```

## Benefits

### For Users
- **Hands-Free Updates**: Set it once, never worry about manual updates
- **Always Fresh**: Latest race data automatically available
- **Faster Load Times**: Cached data means quicker response times
- **Reduced API Load**: Fewer direct calls to OpenF1 API

### For Developers
- **Rate Limit Friendly**: Worker respects OpenF1's 3 req/sec limit
- **Cost Effective**: Runs on Cloudflare's free tier for typical usage
- **Global Distribution**: Deployed on 300+ Cloudflare edge locations
- **Easy Monitoring**: Built-in logging and analytics

## Implementation Details

### Worker Components

#### 1. Scheduled Event Handler
```javascript
async scheduled(event, env, ctx) {
  // Triggered daily via cron (default: 6:00 AM UTC)
  const playlistData = await fetchF1Data();
  await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData));
}
```

#### 2. Fetch Event Handler
```javascript
async fetch(request, env, ctx) {
  // Serves cached data to incoming requests
  const cachedData = await env.F1_DATA.get(CACHE_KEY);
  return new Response(cachedData);
}
```

#### 3. Data Fetching Logic
- Fetches next race from OpenF1 API
- Gets all upcoming sessions for the race weekend
- Retrieves weather data for the first session
- Respects rate limits with 500ms delays between calls

### Next.js Integration

The `generate-card` API route can optionally use the Cloudflare Worker:

```javascript
// Check if worker is enabled
const useWorker = process.env.USE_CLOUDFLARE_WORKER === 'true';

if (useWorker && workerUrl) {
  // Fetch from Cloudflare Worker
  const response = await fetch(`${workerUrl}/playlist`);
  const data = await response.json();
  // Use cached data
} else {
  // Fetch directly from OpenF1 API
  const raceData = await getNextRace();
  // ... existing logic
}
```

### Configuration

Two environment variables control the feature:

```env
# Enable/disable worker integration
USE_CLOUDFLARE_WORKER=true

# Worker endpoint URL
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.workers.dev
```

## API Endpoints

### GET /playlist
Returns the cached F1 playlist data.

**Response Structure:**
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
      "sessionType": "Practice",
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
Manually triggers a data refresh. Useful for:
- Initial deployment setup
- Testing
- Immediate updates before a race

### GET /health
Health check endpoint to verify worker status.

## Deployment

### Prerequisites
- Cloudflare account (free tier works)
- Wrangler CLI: `npm install -g wrangler`
- Node.js 16+

### Quick Deployment Steps

1. **Authenticate**
   ```bash
   wrangler login
   ```

2. **Create KV Namespace**
   ```bash
   wrangler kv:namespace create "F1_DATA"
   ```

3. **Update Configuration**
   Edit `wrangler.toml` with your namespace ID

4. **Deploy**
   ```bash
   wrangler deploy
   ```

5. **Initial Data Load**
   ```bash
   curl -X POST https://your-worker.workers.dev/refresh
   ```

For detailed instructions, see [cloudflare-worker/DEPLOYMENT.md](../cloudflare-worker/DEPLOYMENT.md)

## Monitoring and Maintenance

### View Logs
```bash
wrangler tail
```

### Check Health
```bash
curl https://your-worker.workers.dev/health
```

### Cloudflare Dashboard
- Navigate to Workers & Pages in Cloudflare dashboard
- View real-time analytics, request counts, and error rates
- Monitor KV storage usage

## Cost Analysis

### Cloudflare Workers Free Tier
- **100,000 requests/day**: More than enough for typical usage
- **10ms CPU time/request**: Worker executes in ~5-10ms
- **KV Storage**: 100,000 reads/day, 1,000 writes/day

### Expected Usage
- **Scheduled updates**: 1 write/day
- **MYO card plays**: Depends on usage, but typically < 1,000 reads/day
- **Manual refreshes**: Occasional

### Estimated Cost
**$0/month** on free tier for typical personal usage

If usage exceeds free tier (unlikely):
- $0.50 per million requests
- $0.50 per million KV reads
- $5.00 per million KV writes

## Customization Options

### Update Frequency
Change the cron schedule in `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 6 * * *",      # Daily at 6:00 AM UTC
  "0 18 * * *"      # Also at 6:00 PM UTC (optional)
]
```

Common schedules:
- `"0 */6 * * *"` - Every 6 hours
- `"0 0 * * 0"` - Weekly on Sunday
- `"0 0 1 * *"` - Monthly on the 1st

### Cache Duration
Adjust TTL in `worker.js`:

```javascript
await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
  expirationTtl: 86400  // 24 hours (adjust as needed)
});
```

### Custom Domain
Add your domain in `wrangler.toml`:

```toml
routes = [
  { pattern = "f1-api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

## Troubleshooting

### Common Issues

**Issue**: Worker returns 500 error
- **Solution**: Check logs with `wrangler tail`
- **Cause**: Usually OpenF1 API rate limit or network timeout

**Issue**: No cached data available
- **Solution**: Manually trigger refresh: `curl -X POST .../refresh`
- **Cause**: First deployment or cache expired

**Issue**: Stale data in cache
- **Solution**: Check cron schedule is set correctly
- **Verify**: Cron triggers are visible in Cloudflare dashboard

**Issue**: CORS errors from browser
- **Solution**: Worker includes CORS headers by default
- **Check**: Verify headers in response

## Testing

### Local Testing with Wrangler
```bash
cd cloudflare-worker
wrangler dev

# In another terminal
curl http://localhost:8787/health
curl http://localhost:8787/playlist
```

### Integration Testing
1. Deploy worker to staging environment
2. Update `.env` with staging worker URL
3. Generate a test card
4. Verify data comes from worker (check logs)

### Production Testing
1. Deploy to production
2. Trigger manual refresh
3. Verify health endpoint
4. Test with actual MYO card generation

## Security Considerations

### API Keys
- No API keys required for OpenF1 (public API)
- Worker URL is public but read-only
- No sensitive data stored in KV

### Rate Limiting
- Worker respects OpenF1's 3 req/sec limit
- 500ms delays between API calls
- Scheduled updates (not real-time) reduce load

### Data Privacy
- No user data stored
- Only public F1 race information cached
- No authentication required for worker endpoints

## Future Enhancements

Potential improvements for future versions:

1. **Multi-Region Support**: Cache data closer to users globally
2. **Webhook Integration**: Trigger updates when OpenF1 data changes
3. **GraphQL Support**: More flexible data querying
4. **Batch Updates**: Update multiple cards at once
5. **Custom Schedules**: Per-user update schedules
6. **Analytics**: Track MYO card usage patterns

## Rollback Procedure

If the worker needs to be disabled:

1. **Disable in App**
   ```env
   USE_CLOUDFLARE_WORKER=false
   ```

2. **Remove Worker** (optional)
   ```bash
   wrangler delete
   ```

3. **App falls back to direct OpenF1 API calls**

## Related Documentation

- [Cloudflare Worker README](../cloudflare-worker/README.md)
- [Deployment Guide](../cloudflare-worker/DEPLOYMENT.md)
- [Wrangler Configuration](../cloudflare-worker/wrangler.toml)
- [Main README](../README.md)

## Support and Feedback

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check Cloudflare Workers documentation
- Review OpenF1 API documentation

## Version History

### Version 1.0.0 (2024-01-18)
- Initial release
- Basic caching functionality
- Scheduled daily updates
- Integration with generate-card API route
- Health check and manual refresh endpoints

## Contributing

Contributions are welcome! When working on the Cloudflare Worker:

1. Test locally with `wrangler dev`
2. Deploy to staging: `wrangler deploy --env staging`
3. Verify functionality before production deployment
4. Update documentation if adding new features

## License

This feature follows the same MIT license as the main project.
