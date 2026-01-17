# 🚀 Quick Start Guide

Get your Yoto F1 Card Generator running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed ([Download](https://nodejs.org/))
- [ ] Yoto Developer Account ([Sign up](https://yoto.dev/))
- [ ] Git installed (optional)

## Step-by-Step Setup

### 1️⃣ Get Yoto Credentials (5 min)

1. Go to [Yoto Developer Portal](https://yoto.dev/)
2. Sign in or create an account
3. Create a new application:
   - Name: "F1 Card Generator"
   - Redirect URIs:
     - `http://localhost:3000/api/auth/callback` (for local dev)
     - `https://your-app-name.fly.dev/api/auth/callback` (for production, if deploying)
4. Copy your **Client ID** and **Client Secret**

### 2️⃣ Install the App (2 min)

```bash
# Clone or download the repository
git clone https://github.com/<your-github-username>/yoto-f1-card.git
cd yoto-f1-card

# Install dependencies
npm install
```

### 3️⃣ Configure Environment (1 min)

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your favorite editor
# Replace YOUR_CLIENT_ID and YOUR_CLIENT_SECRET with your actual credentials
```

Your `.env` should look like:

```env
YOTO_CLIENT_ID=abc123xyz
YOTO_CLIENT_SECRET=secret456def
```

**Pro tip:** No need for `NEXT_PUBLIC_APP_URL` - the app auto-detects the correct URL!

### 4️⃣ Start the Server (30 seconds)

```bash
npm run dev
```

You should see:

```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

### 5️⃣ Use the App (1 min)

1. Open [http://localhost:3000](http://localhost:3000)
2. Click **"🔐 Connect with Yoto"** (authentication is required before using any features)
3. Authenticate with your Yoto account
4. Click **"Generate F1 Card"**
5. Watch the real-time status: Queued → Processing → Completed
6. Check your Yoto library - your card is ready! 🎉

**What You'll Get:**

- Multiple chapters for the upcoming race weekend
- Chapter 1: Overall race weekend overview
- Chapters 2+: Individual sessions (Practice 1-3, Qualifying, Sprint, Race)
- Race car icon (🏎️) displayed on your Yoto player
- All times automatically converted to your local timezone based on your IP address

## 🎯 First Time Tips

### Finding Your Card

- Open the Yoto app on your phone
- Go to "Library" or "My Cards"
- Look for "F1: Next Race"

### Linking to Physical MYO Card

1. Insert your blank MYO card into your Yoto player
2. In the Yoto app, go to the card
3. Select "Link to MYO card"
4. Choose your F1 card from the library

### Updating the Card

Just click "Generate F1 Card" again! The app will automatically update your existing card instead of creating a new one.

### Logging Out

Click the "Logout" button in the footer to disconnect your Yoto account and clear your session.

## 🐛 Troubleshooting

### "Module not found" Error

```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### "Not authenticated" Error

- Click "Connect with Yoto" first
- Make sure your credentials in `.env` are correct
- Check that redirect URI in Yoto portal matches: `http://localhost:3000/api/auth/callback`

### Port 3000 Already in Use

```bash
# Use a different port
PORT=3001 npm run dev
# Don't forget to update NEXT_PUBLIC_APP_URL in .env
```

### Card Not Appearing in Library

- Wait 30-60 seconds (TTS processing takes time)
- Check the job status in the success message
- Refresh your Yoto app
- Check your internet connection

## 📱 Next Steps

- [ ] Link your card to a physical MYO card
- [ ] Set up automatic updates with cron
- [ ] Deploy to Fly.io or Vercel (see README.md)
- [ ] Customize the voice or content
- [ ] Star the repo on GitHub ⭐

## 🆘 Need Help?

- 📖 Read the full [README.md](README.md)
- 🐛 [Report an issue](issues)
- 💬 Join [Yoto Discord](https://discord.gg/FkwBpYf2CN)

Happy racing! 🏎️💨
