# Implementation Summary: Automatic Playlist Refresh Feature

## Overview

This implementation adds automatic playlist refresh functionality to your Yoto F1 application, allowing your MYO card to be updated automatically with the latest race information from the Cloudflare Worker you've already deployed.

## What Was Implemented

### 1. Manual Refresh Feature (UI Button)

**New Endpoint**: `/api/refresh-myo-playlist`

A new "Refresh Playlist from Worker" button in the UI that:
- Fetches latest F1 data from your Cloudflare Worker
- Generates fresh TTS content with updated race information
- Creates a new Yoto playlist
- Automatically deploys to all your connected devices
- Shows real-time status including:
  - Data source (worker URL and last update time)
  - Race details (name, location, date, time)
  - All session times (practice, qualifying, race)
  - Weather conditions (if available)
  - TTS job processing status
  - Device deployment results

### 2. Automated Refresh Feature (Webhook)

**New Endpoint**: `/api/webhook/refresh-playlist`

A webhook endpoint that can be called by external schedulers to automate playlist updates:
- Secured with a webhook secret token
- Can be triggered by:
  - GitHub Actions (cron schedule)
  - cron-job.org
  - Cloud platform schedulers (AWS, GCP, Azure)
  - Any HTTP client
- Returns comprehensive status information
- Includes GET endpoint for configuration verification

### 3. Documentation

**Created/Updated Files:**
- `documentation/AUTO_REFRESH_FEATURE.md` - Complete guide with all details
- `documentation/QUICKSTART_AUTO_REFRESH.md` - 5-minute quick start guide
- `.github/workflows/refresh-playlist.yml.example` - GitHub Actions template
- `README.md` - Updated with new feature information
- `.env.example` - Added required environment variables

## Configuration Required

Add these to your `.env` file:

```env
# Your already-deployed Cloudflare Worker
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.dauble2k5.workers.dev

# Optional: Enable worker for regular generate-card calls too
USE_CLOUDFLARE_WORKER=true

# For webhook automation (generate a secure random string)
WEBHOOK_SECRET=your_random_secret_here
```

## How to Use

### Quick Start (Manual Refresh)

1. Set `CLOUDFLARE_WORKER_URL` in your `.env`
2. Deploy/restart your application
3. Log in with Yoto OAuth
4. Click "🔄 Refresh Playlist from Worker" button
5. Watch the status as your playlist updates!

### Automated Refresh Setup

**Option 1: GitHub Actions (Recommended)**

1. Copy `.github/workflows/refresh-playlist.yml.example` to `refresh-playlist.yml`
2. Add secrets to your GitHub repo:
   - `APP_URL`: Your app URL (e.g., `https://your-app.fly.dev`)
   - `WEBHOOK_SECRET`: Your webhook secret
3. Commit and push
4. Done! Runs daily at 6:30 AM UTC

**Option 2: cron-job.org**

1. Create account at [cron-job.org](https://cron-job.org)
2. Add new job:
   - URL: `https://your-app.com/api/webhook/refresh-playlist`
   - Method: POST
   - Header: `X-Webhook-Secret: your_secret`
   - Schedule: Daily at your preferred time
3. Save and enable

**Option 3: Test with curl**

```bash
curl -X POST https://your-app.com/api/webhook/refresh-playlist \
  -H "X-Webhook-Secret: your_webhook_secret" \
  -H "Content-Type: application/json"
```

## Important Notes

### TTS API Limitation

**Each refresh creates a NEW playlist** - this is a Yoto Labs TTS API limitation, not a bug.

**Why?**
- The Labs TTS API (`/content/job`) always creates new content
- It does not support updating existing TTS-based playlists
- The regular Content API (`/content`) does support updates, but only for pre-recorded audio

**Workaround:**
1. Each refresh creates a new playlist in your Yoto library
2. The newest playlist has the latest race information
3. You can link the newest playlist to your MYO card
4. Delete old playlists from the Yoto app to keep your library clean

**Future Possibility:**
The only way to truly "update" a playlist automatically would be to:
1. Pre-generate TTS audio files for all content
2. Upload them as regular audio (not using TTS API)
3. Use the regular Content API with `cardId` to update
This would require significant architectural changes and is beyond the current scope.

## Files Added/Modified

### New API Routes
- `src/app/api/refresh-myo-playlist/route.js` - Manual refresh endpoint
- `src/app/api/webhook/refresh-playlist/route.js` - Webhook automation endpoint

### Frontend Updates
- `src/app/page.js` - Added refresh button, state management, and UI
- `src/app/page.module.css` - Added styling for refresh section

### Configuration
- `.env.example` - Added CLOUDFLARE_WORKER_URL and WEBHOOK_SECRET

### Documentation
- `documentation/AUTO_REFRESH_FEATURE.md` - Complete feature guide (10k+ words)
- `documentation/QUICKSTART_AUTO_REFRESH.md` - Quick 5-minute guide
- `.github/workflows/refresh-playlist.yml.example` - GitHub Actions template
- `README.md` - Updated with feature information

## Testing

All code has been:
- ✅ Built successfully with Next.js
- ✅ Code reviewed (no issues found)
- ✅ Security scanned with CodeQL (no vulnerabilities)
- ✅ Linted and follows project conventions
- ✅ Documented comprehensively

## What This Solves

Your original request was:
> "I would love to see if this application can update my playlist from Yoto automatically, leveraging the Cloudflare worker that's been set up and configured."

**Solution Provided:**

1. ✅ **Automatic Updates**: Your playlist can now be refreshed automatically using the webhook endpoint
2. ✅ **Cloudflare Worker Integration**: Fetches fresh data from your already-deployed worker
3. ✅ **Manual Option**: Also provides a UI button for on-demand refreshes
4. ✅ **Flexible Scheduling**: Works with any cron service or scheduler
5. ✅ **Complete Documentation**: Step-by-step guides for setup and usage

**Limitation Acknowledged:**
Due to Yoto's TTS API design, each refresh creates a new playlist rather than updating the existing one. This is clearly documented with explanations and workarounds.

## Next Steps

1. **Deploy** the updated code to your hosting platform
2. **Configure** environment variables (CLOUDFLARE_WORKER_URL, WEBHOOK_SECRET)
3. **Test** the manual refresh via UI button
4. **Set up** automated refresh using GitHub Actions or your preferred scheduler
5. **Enjoy** automatically updated F1 content!

## Support

- **Quick Start**: `documentation/QUICKSTART_AUTO_REFRESH.md`
- **Full Documentation**: `documentation/AUTO_REFRESH_FEATURE.md`
- **Workflow Example**: `.github/workflows/refresh-playlist.yml.example`
- **Main README**: `README.md` (updated with feature info)

## Questions?

If you have questions or need help with setup, please refer to the comprehensive documentation or open an issue on GitHub.

---

**Ready to deploy! 🏎️🔄**
