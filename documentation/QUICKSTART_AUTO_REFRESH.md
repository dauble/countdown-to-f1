# Quick Start: Auto-Refresh Feature

Get your F1 Yoto playlist updating automatically in just a few minutes!

## Prerequisites

✅ Cloudflare Worker deployed at: `https://f1-yoto-myo-worker.dauble2k5.workers.dev`
✅ Your app deployed (Fly.io, Vercel, etc.)
✅ Authenticated with Yoto (click "Connect with Yoto" button)

## Step 1: Configure Environment Variables

Add these to your `.env` file (or deployment platform):

```env
# Enable worker integration
USE_CLOUDFLARE_WORKER=true

# Your Cloudflare Worker URL (already deployed!)
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.dauble2k5.workers.dev

# Generate a webhook secret (for automated refresh)
WEBHOOK_SECRET=your_random_secret_here
```

**Generate a secure webhook secret:**

```bash
# Using OpenSSL
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2: Try Manual Refresh

1. Visit your app: `https://your-app-url.com`
2. Log in with Yoto OAuth
3. Click the **"🔄 Refresh Playlist from Worker"** button
4. Watch the status as your playlist is generated!

You should see:
- ✅ Fresh race information from the worker
- ✅ Session times and weather data
- ✅ Real-time TTS generation status
- ✅ Automatic deployment to your devices

## Step 3: Set Up Automated Refresh (Optional)

### Option A: GitHub Actions (Easiest)

1. Copy the example workflow:
   ```bash
   cp .github/workflows/refresh-playlist.yml.example .github/workflows/refresh-playlist.yml
   ```

2. Add secrets to your GitHub repo:
   - Go to: Settings → Secrets → Actions
   - Add `APP_URL`: Your app URL (e.g., `https://your-app.fly.dev`)
   - Add `WEBHOOK_SECRET`: Your webhook secret from `.env`

3. Commit and push the workflow file

4. Test it manually:
   - Go to Actions tab → "Refresh F1 Yoto Playlist"
   - Click "Run workflow"

**Done!** Your playlist will now update daily at 6:30 AM UTC.

### Option B: cron-job.org (No Code)

1. Visit [cron-job.org](https://cron-job.org) and create account
2. Create new cron job:
   - **Title**: F1 Yoto Refresh
   - **URL**: `https://your-app-url.com/api/webhook/refresh-playlist`
   - **Schedule**: Every day at 06:30 (or your preference)
   - **HTTP Method**: POST
   - **Headers**: Click "Add" and enter:
     - Name: `X-Webhook-Secret`
     - Value: Your webhook secret
3. Save and enable

### Option C: Test with curl

Before automating, test the webhook manually:

```bash
curl -X POST https://your-app-url.com/api/webhook/refresh-playlist \
  -H "X-Webhook-Secret: your_webhook_secret" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Automated playlist refresh completed successfully",
  "race": {
    "name": "Australian Grand Prix",
    "location": "Melbourne",
    "country": "Australia"
  },
  "yoto": {
    "jobId": "...",
    "cardId": "...",
    "status": "processing"
  }
}
```

## Troubleshooting

### ❌ "Cloudflare Worker URL not configured"

**Fix**: Add `CLOUDFLARE_WORKER_URL` to your `.env`:
```env
CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.dauble2k5.workers.dev
```

### ❌ "Failed to fetch fresh data"

**Check**: Is the Cloudflare Worker running?
```bash
curl https://f1-yoto-myo-worker.dauble2k5.workers.dev/health
```

Should return:
```json
{
  "status": "healthy",
  "hasCachedData": true
}
```

### ❌ Webhook returns 401 Unauthorized

**Fix**: Check your webhook secret matches in both places:
1. App's `.env` file: `WEBHOOK_SECRET=...`
2. Request header: `X-Webhook-Secret: ...`

### ❌ "Not authenticated"

**Fix**: You need to log in via the UI first:
1. Visit `https://your-app-url.com`
2. Click "Connect with Yoto"
3. Complete OAuth flow
4. Try refresh again

## Understanding the Output

When you refresh, you'll see:

**Data Source** 📡
- Worker URL and last update time
- Confirms data is coming from Cloudflare Worker

**Race Information** 🏁
- Name, location, country
- Date and time (in UTC by default)

**Sessions** 📅
- All practice, qualifying, and race times
- Sprint sessions (if scheduled)

**Weather** 🌤️
- Track and air temperature
- Humidity and wind conditions
- Rainfall status

**Yoto Status** 📱
- Job ID for tracking
- TTS generation progress
- Completion status

**Device Deployment** 📡
- Number of devices updated
- Deployment success/failure count

## Best Practices

✅ **Schedule After Worker Update**: Set cron for 6:30 AM UTC (30 min after worker updates at 6 AM)

✅ **Check Logs Regularly**: Monitor your automation logs for failures

✅ **Keep Webhook Secret Secure**: Never commit secrets to Git

✅ **Clean Up Old Playlists**: Due to TTS API limitations, new playlists are created each time. Delete old ones from Yoto app.

## What Happens Each Refresh?

1. 🔄 Fetch latest data from Cloudflare Worker
2. 📝 Build TTS chapters with race info
3. 🎙️ Generate speech via Yoto Labs TTS API
4. 📦 Create new playlist in your library
5. 📱 Deploy to all your Yoto devices
6. ✅ You're done!

**Note**: Each refresh creates a NEW playlist (Yoto TTS API limitation). Link the newest one to your MYO card.

## Next Steps

- ✨ Set up automated daily refresh
- 📅 Adjust schedule to match your timezone
- 🧪 Test before race weekends
- 📖 Read full docs in `documentation/AUTO_REFRESH_FEATURE.md`

## Need Help?

- 📖 Full Documentation: `documentation/AUTO_REFRESH_FEATURE.md`
- 💬 GitHub Issues: Report bugs or ask questions
- 🎮 Yoto Discord: Join the community

---

**Enjoy automatically updated F1 content on your Yoto! 🏎️🎧**
