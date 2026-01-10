# Yoto Formula 1 Card Generator

A Next.js framework for creating Yoto cards that integrate Formula 1 data from OpenF1.org with text-to-speech capabilities.

## Prerequisites

1. Create a Yoto app at [Yoto Developer Portal](https://yoto.dev/get-started/start-here/)
2. Get your Client ID and Client Secret
3. Node.js 18+ installed

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Add your `YOTO_CLIENT_ID` and `YOTO_CLIENT_SECRET`

3. **Run the development server:**
```bash
npm run dev
```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Features

- ✅ OAuth authentication with Yoto
- ✅ Formula 1 API integration from OpenF1.org
- ✅ Text-to-speech generation with 3 chapters:
  - Chapter 1: Next race details (date, time, location)
  - Chapter 2: Top 5 driver standings
  - Chapter 3: Top 5 team standings
- ✅ Easy to adapt to other APIs
- ✅ Simple configuration

## API Integration

This app uses the [OpenF1 API](https://openf1.org/) to fetch:
- Upcoming race information
- Driver standings
- Constructor/team standings

## Customization

1. Modify `src/services/f1Service.js` to adjust data fetching
2. Update `src/app/page.js` to change the UI
3. Edit chapter scripts in the `generateF1Script` function

## Sharing with Yoto Community

Once your card is ready, follow the [Yoto Publishing Guidelines](https://yoto.dev/publishing/) to share it with the community.