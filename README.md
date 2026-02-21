# 🏎️ Yoto Formula 1 Card Generator

A Next.js application that automatically creates and updates Yoto MYO (Make Your Own) cards with the latest Formula 1 race information. Perfect for F1 fans who want their Yoto players to announce upcoming races!

## ✨ Features

### Core Features

- 🏁 **Multi-Session Chapters** - Separate chapters for each F1 session (Practice 1-3, Qualifying, Sprint, Race)
- 📅 **Race Weekend Overview** - First chapter provides overall race weekend information
- 🌍 **Automatic Timezone Conversion** - Race times converted to your local timezone via IP address detection
- 🎙️ **Text-to-Speech** - Uses ElevenLabs via Yoto Labs API to generate audio
- 🔐 **OAuth Authentication** - Secure authentication with Yoto (required before use)
- 📱 **Responsive Design** - Works on desktop and mobile devices

### Advanced Features

- 📊 **Real-Time Job Status** - Live polling shows TTS generation progress (queued → processing → completed)
- 🎵 **Audio File Upload** - Upload your own audio files to create MYO-compatible cards
- 🔓 **Logout Functionality** - Easily logout and switch Yoto accounts
- 📡 **Device Deployment** - Automatically deploys to all connected Yoto devices
- ☁️ **Cloudflare Worker Integration** - Optional serverless worker for automatic daily content updates
- 🔄 **Automatic Playlist Refresh** - Manual or scheduled automatic updates from the Cloudflare Worker

**Note:** Cover images and custom icons require special Yoto API permissions not available to standard accounts.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A [Yoto Developer Account](https://yoto.dev/)
- Yoto OAuth credentials (Client ID & Secret)
- A physical Yoto MYO card (optional, for linking the playlist)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-github-username>/yoto-f1-card.git
   cd yoto-f1-card
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env` and fill in your Yoto credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:

   ```env
   YOTO_CLIENT_ID=your_client_id_here
   YOTO_CLIENT_SECRET=your_client_secret_here
   ```

   **Note:** No need for `NEXT_PUBLIC_APP_URL` - the app auto-detects the correct URL at runtime!

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 How to Use

### First Time Setup

1. **Connect with Yoto** - Click the "🔐 Connect with Yoto" button and authenticate
   - Authentication is required before you can use any features
   - Your session will persist across browser restarts

### Generate TTS Card

1. **Generate Card** - Click "Generate F1 Card" to create your first card with text-to-speech
2. **Watch Progress** - Real-time status shows: Queued → Processing → Completed
3. **Check Your Library** - The card will appear in your Yoto library when complete
4. **Link to MYO Card** - Use the Yoto app to link the playlist to your physical MYO card
5. **Auto-Update** - Click "Generate F1 Card" again anytime to update with the latest race info!

**What You'll Get:**

- **Chapter 1**: Race Weekend Overview - Overall information about the upcoming race
- **Chapter 2+**: Individual chapters for each session (Practice 1, Practice 2, Practice 3, Qualifying, Sprint if scheduled, and Race)
- **Accurate Times**: All session times automatically converted to your local timezone based on your IP address

### Upload Audio to MYO Card

1. **Prepare Audio** - Have an MP3, M4A, or WAV file ready
2. **Upload** - Use the "Upload Audio to MYO Card" form to select and upload your audio
3. **Wait for Processing** - The app will upload and transcode your audio (15-60 seconds)
4. **Link to MYO** - Follow the instructions to link the card in your Yoto app

### Logout

- Click the "Logout" button in the footer to disconnect your Yoto account
- You'll need to re-authenticate to use the app again

**Note:** Each time you generate a card, the Yoto Labs TTS API creates a new playlist. You may want to manually delete old F1 playlists from your library to avoid duplicates.

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: Yoto OAuth 2.0
- **Data Sources**:
  - OpenF1 API for race data
  - ipapi.co for timezone detection
- **TTS**: Yoto Labs API with ElevenLabs
- **Storage**: Configstore for local token/card storage
- **Styling**: CSS Modules

## 📦 Deployment

### Deploy to Fly.io

1. **Install Fly CLI**

   ```bash
   brew install flyctl
   ```

2. **Login to Fly**

   ```bash
   fly auth login
   ```

3. **Launch your app**

   ```bash
   fly launch
   ```

4. **Set environment variables**

   ```bash
   fly secrets set YOTO_CLIENT_ID=your_client_id
   fly secrets set YOTO_CLIENT_SECRET=your_client_secret
   ```

5. **Deploy**

   ```bash
   fly deploy
   ```

6. **Set up automatic deployments (optional)**
   - Get your Fly API token: `fly auth token`
   - Add `FLY_API_TOKEN` to GitHub repository secrets
   - Every push to `main` branch will auto-deploy via GitHub Actions!

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](documentation/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 🐛 Troubleshooting

### "Not authenticated" error

- You must click "🔐 Connect with Yoto" before using any features
- If you see the login button, your session has expired - click it to re-authenticate
- Check that your OAuth credentials are correct in `.env`
- Make sure your Yoto app has both redirect URIs configured:
  - `http://localhost:3000/api/auth/callback` (local)
  - `https://your-domain.com/api/auth/callback` (production)

### Can't see the login button

- Click "Logout" in the footer to clear your session
- Alternatively, visit `http://localhost:3000/api/auth/logout`
- Refresh the page and the login button should appear

### New playlists created each time

- The Yoto Labs TTS API always creates new playlists - it doesn't support updating existing ones
- This is different from the regular content API (used for audio uploads) which does support updates
- You may need to manually delete old F1 playlists from your Yoto library
- Watch the real-time status indicator - it shows: Queued → Processing → Completed
- TTS processing typically takes 10-30 seconds
- When status shows "✅ Completed", your card is ready in your Yoto library

### Cover image not appearing

**Cover images and custom icons require special Yoto API permissions:**

- The `/media/coverImage/user/me/upload` endpoint is restricted to special account types
- Standard OAuth accounts receive "not authorized" errors when attempting uploads
- This is a Yoto API limitation, not an issue with the app
- If cover images are important, contact developers@yotoplay.com to request permissions
- The app works perfectly without cover images - all TTS content and functionality remains intact

### MYO audio upload fails

- Ensure audio file is in a supported format (MP3, M4A, WAV)
- File size should be under 100MB
- Wait for transcoding to complete (usually 15-60 seconds)
- Check that you're authenticated with Yoto

### Race time showing wrong timezone

**How Timezone Detection Works:**

- The app automatically detects your timezone from your IP address using ipapi.co
- Works for both local development and production deployments
- If IP detection fails, defaults to the server's timezone

**Local Development:**

- When running locally (localhost), IP detection returns your local IP
- The app falls back to using `Intl.DateTimeFormat().resolvedOptions().timeZone`
- This means you'll see times in your computer's configured timezone

**Production Deployment:**

- Uses the `x-forwarded-for` or `x-real-ip` headers from your request
- Queries ipapi.co API to convert IP → timezone (e.g., "America/New_York")
- All session times are then converted to this detected timezone

**Troubleshooting:**

- Check server logs - they show: "User timezone detected: [timezone]"
- Verify your IP isn't being blocked by ipapi.co
- Private/local IPs (192.168.x.x, 10.x.x.x) automatically fall back to system timezone

### OAuth redirect issues on deployed app

- The app automatically detects the correct URL using request headers
- No configuration needed - works on Fly.io, Vercel, and other platforms
- If issues persist, check your Yoto app redirect URI matches your domain

## ☁️ Cloudflare Worker for Auto-Refresh

Want your MYO card to automatically fetch fresh F1 data every time it's played? Deploy the optional Cloudflare Worker!

### Features

- **Automatic Daily Updates**: Fetches latest F1 data from OpenF1 API every day
- **Global CDN**: Low-latency access from anywhere in the world
- **Free Tier Friendly**: Runs on Cloudflare's generous free tier
- **No Manual Updates**: Set it and forget it - your card stays current automatically
- **Manual & Automated Refresh**: Update playlists on-demand or via scheduled webhooks

### Quick Setup

1. **Deploy the Worker** (see [documentation/CLOUDFLARE_DEPLOYMENT.md](documentation/CLOUDFLARE_DEPLOYMENT.md) for full instructions)

   ```bash
   cd cloudflare-worker
   npm install -g wrangler
   wrangler login
   wrangler deploy
   ```

2. **Configure Your App** (add to `.env`)

   ```env
   USE_CLOUDFLARE_WORKER=true
   CLOUDFLARE_WORKER_URL=https://f1-yoto-myo-worker.dauble2k5.workers.dev

   # Optional: For automated webhook refresh
   WEBHOOK_SECRET=your_random_secret_here
   ```

3. **Use the Refresh Feature**:
   - **Manual**: Click "🔄 Refresh Playlist from Worker" button in the UI
   - **Automated**: Set up a cron job to call the webhook endpoint daily

For detailed setup instructions, see the [Cloudflare Worker README](documentation/CLOUDFLARE_WORKER.md), [Deployment Guide](documentation/CLOUDFLARE_DEPLOYMENT.md), and [Auto-Refresh Feature Guide](documentation/AUTO_REFRESH_FEATURE.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📝 Documentation

All documentation lives in the [`/documentation`](documentation/README.md) directory. Key guides:

- [Quick Start Guide](documentation/QUICKSTART.md) - Get up and running in 5 minutes
- [Features Guide](documentation/FEATURES.md) - Overview of all features
- [Cloudflare Worker](documentation/CLOUDFLARE_WORKER.md) - Auto-refresh setup with Cloudflare Workers
- [Cloudflare Deployment](documentation/CLOUDFLARE_DEPLOYMENT.md) - Step-by-step deployment guide
- [Auto-Refresh Feature](documentation/AUTO_REFRESH_FEATURE.md) - Automatic playlist updates
- [Session Chapters Feature](documentation/SESSIONS_CHAPTERS_FEATURE.md) - How multi-session chapters work
- [Cover Image Feature](documentation/COVER_IMAGE_FEATURE.md) - Custom cover image setup
- [Job Status Feature](documentation/JOB_STATUS_FEATURE.md) - Real-time TTS status polling
- [MYO Upload Feature](documentation/MYO_UPLOAD_FEATURE.md) - Audio file upload guide
- [Implementation Summary](documentation/IMPLEMENTATION_SUMMARY.md) - Auto-refresh implementation details
- [Changelog](documentation/CHANGELOG.md) - Version history and release notes
- [Contributing Guide](documentation/CONTRIBUTING.md) - How to contribute to the project

## 🙏 Acknowledgments

- [Yoto](https://yoto.dev/) for their amazing developer API
- [OpenF1](https://openf1.org/) for F1 data
- The F1 and Yoto communities

## 🔗 Links

- [Yoto Developer Portal](https://yoto.dev/)
- [Yoto Discord Community](https://discord.gg/FkwBpYf2CN)
- [OpenF1 API Documentation](https://openf1.org/)

---

Built with ❤️ for the Yoto community

## Customization

1. Modify `src/services/f1Service.js` to adjust data fetching
2. Update `src/app/page.js` to change the UI
3. Edit chapter scripts in the `generateF1Script` function

## Sharing with Yoto Community

Once your card is ready, follow the [Yoto Publishing Guidelines](https://yoto.dev/publishing/) to share it with the community.
