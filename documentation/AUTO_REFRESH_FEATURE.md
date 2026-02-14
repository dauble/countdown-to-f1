# Automatic Playlist Refresh Feature

## Overview

The automatic playlist refresh feature allows your Yoto F1 MYO card to be updated automatically with the latest race information from the Cloudflare Worker. This feature provides two methods for refreshing your playlist:

1. **Manual Refresh**: Click a button in the UI to refresh your playlist on demand
2. **Automated Refresh**: Use webhooks to schedule automatic updates (e.g., daily via cron)

## How It Works

### Data Flow

```
Cloudflare Worker (updates daily)
         ↓
    Fresh F1 Data
         ↓
  Your Application
         ↓
   Yoto TTS API
         ↓
   Updated Playlist
         ↓
  Your Yoto Devices
```

1. **Cloudflare Worker**: Automatically fetches F1 data from OpenF1 API daily and caches it
2. **Application**: Fetches cached data from the worker when refresh is triggered
3. **TTS Generation**: Converts race information to speech using Yoto Labs TTS API
4. **Playlist Creation**: Creates a new playlist with the fresh content
5. **Device Deployment**: Automatically deploys to all your connected Yoto devices

## Setup

### Prerequisites

- Cloudflare Worker deployed and configured (see `cloudflare-worker/README.md`)
- Yoto OAuth authentication completed
- Application deployed (local or production)

### Environment Configuration

Add to your `.env` file:

```env
# Enable Cloudflare Worker integration
USE_CLOUDFLARE_WORKER=true

# Your Cloudflare Worker URL (required for refresh feature)
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.dauble2k5.workers.dev

# Webhook secret for automated refresh (optional)
WEBHOOK_SECRET=your_strong_random_secret_here
```

Generate a strong webhook secret:
```bash
# Using OpenSSL
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

### Method 1: Manual Refresh (UI Button)

1. **Authenticate**: Connect with Yoto using the OAuth login button
2. **Click Refresh**: Click the "🔄 Refresh Playlist from Worker" button
3. **Wait for Processing**: Watch the status as TTS content is generated
4. **Enjoy**: The updated playlist is automatically deployed to your devices

**What You'll See:**
- Real-time status updates during TTS generation
- Data source information (worker URL, last update time)
- Race details (name, location, date, time)
- Session schedule (all practice, qualifying, race times)
- Weather conditions (if available)
- Device deployment status

### Method 2: Automated Refresh (Webhook)

Set up a scheduled job to automatically refresh your playlist daily.

#### Option A: GitHub Actions (Recommended)

Create `.github/workflows/refresh-playlist.yml`:

```yaml
name: Refresh F1 Yoto Playlist

on:
  schedule:
    # Run daily at 6 AM UTC (adjust to your preference)
    - cron: '0 6 * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Playlist Refresh
        run: |
          curl -X POST https://your-app-url.com/api/webhook/refresh-playlist \
            -H "X-Webhook-Secret: ${{ secrets.WEBHOOK_SECRET }}" \
            -H "Content-Type: application/json"
```

**Setup:**
1. Add `WEBHOOK_SECRET` to your GitHub repository secrets
2. Replace `your-app-url.com` with your actual deployment URL
3. Commit the workflow file to your repository

#### Option B: Cron-Job.org

1. Visit [cron-job.org](https://cron-job.org/)
2. Create a free account
3. Create a new cron job:
   - **URL**: `https://your-app-url.com/api/webhook/refresh-playlist`
   - **Schedule**: Daily at your preferred time
   - **HTTP Method**: POST
   - **Headers**: Add `X-Webhook-Secret: your_secret_here`

#### Option C: Cloud Platform Scheduler

**AWS EventBridge:**
```bash
aws events put-rule \
  --name refresh-f1-playlist \
  --schedule-expression "cron(0 6 * * ? *)"
```

**Google Cloud Scheduler:**
```bash
gcloud scheduler jobs create http refresh-f1-playlist \
  --schedule="0 6 * * *" \
  --uri="https://your-app-url.com/api/webhook/refresh-playlist" \
  --http-method=POST \
  --headers="X-Webhook-Secret=your_secret_here"
```

## API Reference

### POST /api/refresh-myo-playlist

Manual refresh endpoint (used by the UI button).

**Authentication**: Requires Yoto OAuth session

**Response:**
```json
{
  "success": true,
  "message": "MYO playlist refreshed successfully!",
  "yoto": {
    "jobId": "abc123",
    "cardId": "xyz789",
    "status": "processing"
  },
  "race": {
    "name": "Australian Grand Prix",
    "location": "Melbourne",
    "country": "Australia",
    "date": "March 24, 2024",
    "time": "05:00 UTC"
  },
  "sessions": [...],
  "weather": {...},
  "dataSource": {
    "type": "cloudflare-worker",
    "url": "https://...",
    "lastUpdated": "2024-03-20T06:00:00Z"
  },
  "deviceDeployment": {
    "success": 2,
    "failed": 0,
    "total": 2
  }
}
```

### POST /api/webhook/refresh-playlist

Automated refresh endpoint for webhooks.

**Authentication**: Requires `X-Webhook-Secret` header

**Headers:**
```
X-Webhook-Secret: your_webhook_secret
```

**Response:**
```json
{
  "success": true,
  "message": "Automated playlist refresh completed successfully",
  "timestamp": "2024-03-20T06:30:00Z",
  "race": {...},
  "yoto": {...},
  "dataSource": {...},
  "deviceDeployment": {...}
}
```

### GET /api/webhook/refresh-playlist

Check webhook status and configuration.

**Authentication**: Requires `X-Webhook-Secret` header

**Response:**
```json
{
  "status": "active",
  "configured": {
    "authentication": true,
    "cloudflareWorker": true,
    "webhookSecret": true
  },
  "workerUrl": "https://...",
  "timestamp": "2024-03-20T06:30:00Z",
  "usage": {
    "endpoint": "/api/webhook/refresh-playlist",
    "method": "POST",
    "headers": {...}
  }
}
```

## Important Notes

### TTS API Limitation

**New Playlist Each Time**: Due to Yoto Labs TTS API limitations, each refresh creates a NEW playlist. The API does not support updating existing TTS-based playlists.

**Why This Happens:**
- The Labs TTS API (`/content/job`) always creates new content
- Unlike the regular Content API (`/content`), it doesn't accept `cardId` for updates
- This is a Yoto API design decision, not an application limitation

**Workaround:**
1. Each refresh creates a new playlist in your library
2. You can delete old playlists manually from the Yoto app
3. The MYO card link remains valid - just link the newest playlist

### Data Freshness

- **Worker Updates**: The Cloudflare Worker updates daily at 6 AM UTC
- **Race Data**: Information is as fresh as the OpenF1 API provides
- **Weather**: Weather data is from the most recent session (if available)

### Timezone Handling

All times in the refresh feature use UTC by default. To show local times:
1. The manual UI refresh uses the user's IP-detected timezone
2. Webhook refreshes use UTC (configurable in future updates)

## Troubleshooting

### Refresh Button Shows Error

**"Cloudflare Worker URL not configured"**
- Solution: Add `CLOUDFLARE_WORKER_URL` to your `.env` file
- Verify the worker URL is correct and accessible

**"Failed to fetch fresh data"**
- Check if Cloudflare Worker is deployed and running
- Test the worker: `curl https://your-worker.workers.dev/health`
- Verify worker KV namespace has data

### Webhook Not Working

**401 Unauthorized**
- Verify `WEBHOOK_SECRET` matches in both app and caller
- Check the header name is exactly `X-Webhook-Secret`

**"Not authenticated"**
- The application needs a valid Yoto OAuth session
- Log in via the UI first to establish authentication
- Tokens are stored persistently using Configstore

**500 Error**
- Check application logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure Cloudflare Worker is responsive

### Multiple Playlists in Library

This is expected behavior due to TTS API limitations.

**Options:**
1. **Manual Cleanup**: Delete old playlists from Yoto app regularly
2. **Naming Convention**: Each playlist includes the race name (e.g., "F1: Australian Grand Prix")
3. **Future Enhancement**: Potential script to clean up old playlists

## Best Practices

### Scheduling Refreshes

**Recommended Schedule:**
- **Daily**: 6 AM UTC (after Cloudflare Worker updates)
- **Race Weekends**: More frequent (e.g., every 6 hours)
- **Off-Season**: Less frequent (e.g., weekly)

**Example Cron Expressions:**
```
0 6 * * *        # Daily at 6 AM UTC
0 */6 * * *      # Every 6 hours
0 6 * * 1        # Weekly on Mondays
```

### Security

1. **Strong Webhook Secret**: Use a long random string (32+ characters)
2. **HTTPS Only**: Always use HTTPS for webhook calls
3. **Rate Limiting**: Implement rate limiting if exposing webhook publicly
4. **Rotate Secrets**: Change webhook secret periodically

### Monitoring

**Check Refresh Success:**
1. Monitor webhook response codes
2. Set up alerts for failed refreshes
3. Check Yoto app library for new playlists

**Logs:**
- Application logs show webhook executions
- Cloudflare Worker logs show data fetches
- Yoto Labs API provides job status

## Cost Considerations

### Free Tier Usage

**Cloudflare Worker:**
- 100,000 requests/day (free tier)
- Daily refresh = 1 request/day
- Well within free limits

**Yoto Labs TTS:**
- Check Yoto developer pricing
- Each refresh generates new TTS
- Consider cost if refreshing very frequently

**GitHub Actions:**
- 2,000 minutes/month (free tier)
- Each refresh takes ~1 minute
- Daily refresh = 30 minutes/month

## Future Enhancements

Potential improvements for future versions:

1. **Playlist Cleanup**: Automatic deletion of old playlists
2. **Smart Scheduling**: Only refresh when race data changes
3. **Timezone Preferences**: User-configurable timezone for webhooks
4. **Notification**: Email/SMS when new playlist is ready
5. **Multi-User**: Support for multiple Yoto accounts
6. **Audio Caching**: Pre-generate TTS audio to speed up refreshes

## Related Documentation

- [Cloudflare Worker Setup](../cloudflare-worker/README.md)
- [Yoto Labs TTS API](https://yoto.dev/myo/labs-tts/)
- [Environment Configuration](../.env.example)
- [Contributing Guide](CONTRIBUTING.md)

## Support

For issues or questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Yoto Developer Discord: [Join the community](https://discord.gg/FkwBpYf2CN)
- Documentation: Check other docs in the `/documentation` folder

---

Last updated: February 2026
