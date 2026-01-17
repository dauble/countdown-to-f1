# Session-Based Chapters Feature

## Overview

The Yoto F1 Card Generator now creates separate chapters for each session of an F1 race weekend, providing detailed information about Practice sessions, Qualifying, Sprint races, and the main Grand Prix.

## How It Works

### Data Sources

The app uses two primary endpoints from the [OpenF1 API](https://openf1.org/):

1. **Meetings API** (`/v1/meetings`) - Gets information about the race weekend
2. **Sessions API** (`/v1/sessions`) - Retrieves all sessions for a specific meeting

### Chapter Structure

When you generate an F1 card, the app creates:

#### Chapter 1: Race Weekend Overview

- Overall information about the upcoming Grand Prix
- Location and circuit details
- Main race date and time
- Total number of scheduled sessions

#### Chapters 2+: Individual Sessions

A separate chapter for each upcoming session:

- **Practice 1, 2, 3** - Details about practice sessions and car setup work
- **Qualifying** - Explanation of the knockout format (Q1, Q2, Q3) and grid determination
- **Sprint** - Information about sprint race format and points (if scheduled)
- **Race** - Complete Grand Prix details with strategy notes

### Session Information

Each session chapter includes:

- Session name and type
- Date and time (in your local timezone)
- Detailed description of what happens during that session
- Context-specific information (e.g., qualifying format, sprint points, race strategy)

## Timezone Conversion

### How IP-Based Detection Works

The app automatically determines your timezone from your IP address:

```javascript
1. Request arrives at server
2. Extract IP from headers (x-forwarded-for or x-real-ip)
3. Query ipapi.co API: GET https://ipapi.co/{ip}/json/
4. Response includes timezone (e.g., "America/New_York")
5. Convert all session times to this timezone
```

### Detection Flow

```
User Request
    ↓
[Is IP local/private?]
    ↓ Yes → Use system timezone (Intl.DateTimeFormat)
    ↓ No
[Query ipapi.co]
    ↓ Success → Use detected timezone
    ↓ Error → Fall back to system timezone
    ↓
[Convert all dates/times]
    ↓
Display to user
```

### Timezone Examples

**Scenario 1: Australian GP (Sunday 3:00 PM AEDT)**

- User in New York: Saturday 11:00 PM EST
- User in London: Sunday 4:00 AM GMT
- User in Tokyo: Sunday 1:00 PM JST

**The app handles this automatically based on your IP!**

### Supported IPs

✅ **Works with:**

- Public IPv4 addresses
- Public IPv6 addresses
- Forwarded IPs from reverse proxies

❌ **Falls back to system timezone:**

- Localhost (127.0.0.1, ::1)
- Private networks (192.168.x.x, 10.x.x.x)
- Invalid or blocked IPs

## Technical Implementation

### API Flow

```
1. Fetch next race (OpenF1 /v1/sessions?session_name=Race)
   ↓
2. Extract meeting_key from race session
   ↓
3. Fetch all sessions (OpenF1 /v1/sessions?meeting_key={key})
   ↓
4. Filter for upcoming sessions (date_start >= now)
   ↓
5. Sort chronologically
   ↓
6. Convert each session time to user timezone
   ↓
7. Build chapter for each session
   ↓
8. Send to Yoto Labs TTS API
```

### Code Structure

**Session Fetching**: `src/services/f1Service.js`

```javascript
// Get upcoming sessions for a meeting
export async function getUpcomingSessions(meetingKey)

// Format race data with meeting key
function formatRaceData(session)
```

**Chapter Building**: `src/services/yotoService.js`

```javascript
// Build chapters with sessions
export function buildF1Chapters(raceData, sessions, iconMediaId)

// Generate session-specific text
function generateSessionText(session, raceData)
```

**Timezone Conversion**: `src/app/api/generate-card/route.js`

```javascript
// Detect user timezone from IP
async function getUserTimezone(request)

// Convert session times
sessions = rawSessions.map(session => ({
  ...session,
  date: sessionDate.toLocaleDateString('en-US', { timeZone: userTimezone }),
  time: sessionDate.toLocaleTimeString('en-US', { timeZone: userTimezone })
}))
```

## Session Type Descriptions

### Practice Sessions

- Fine-tuning car setups
- Learning track characteristics
- Testing tire compounds and aerodynamic configurations
- Gathering data for race strategy

### Qualifying

- Three knockout rounds (Q1, Q2, Q3)
- Q1: All 20 drivers, slowest 5 eliminated
- Q2: Remaining 15 drivers, slowest 5 eliminated
- Q3: Top 10 drivers battle for pole position
- Determines starting grid for the race

### Sprint

- Shorter race format (about 1/3 of race distance)
- High-intensity racing with limited strategy
- Points awarded to top finishers
- Can determine part of the starting grid

### Race

- Full Grand Prix distance
- Maximum points available (25 for winner)
- Complex strategy involving pit stops
- Tire management crucial
- Every position counts for championship

## Custom Icons

Each chapter and track displays a custom F1 race car icon on your Yoto player:

1. Icon file: `public/assets/card-images/countdown-to-f1-icon.png`
2. Automatically uploaded to Yoto with `autoConvert=true`
3. Resized to 16×16 pixels by Yoto API
4. Stored as `yoto:#{mediaId}` format
5. Applied to all chapters and tracks

## Debugging

### Console Logs

The app provides detailed logging:

```
User timezone detected: America/New_York
Converting race time from 2026-03-15T05:00:00.000Z to timezone: America/New_York
Found 7 upcoming sessions for this race weekend
Building F1 chapters with 7 sessions and iconMediaId: abc123
Built 8 total chapters for F1 card
Creating Yoto TTS playlist with 8 chapters
```

### Verification

To verify the chapters are working:

1. Generate a card
2. Check server console for "Built X total chapters"
3. Look at "View Generated Content" in the UI
4. Verify chapter count matches session count + 1 (overview)
5. Check that each session has correct date/time in your timezone

## Limitations

- OpenF1 API updates at midnight UTC, so very recent schedule changes may not appear immediately
- TTS API supports up to 3000 characters per track
- IP detection requires external API call (ipapi.co) which may be rate-limited
- Historic races (past dates) are not included in sessions

## Future Enhancements

Potential improvements:

- Add driver and team standings as additional chapters
- Include weather forecasts for each session
- Add qualifying results after Q3 completes
- Real-time session updates during race weekend
- Custom session filtering (e.g., "Race day only")

## Related Documentation

- [OpenF1 Meetings API](https://openf1.org/#meetings)
- [OpenF1 Sessions API](https://openf1.org/#sessions)
- [Yoto TTS API](https://yoto.dev/myo/labs-tts/)
- [Yoto Playlist Structure](https://yoto.dev/myo/how-playlists-work/)
- [Custom Icons Documentation](https://yoto.dev/icons/uploading-icons/)
