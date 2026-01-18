# Yoto F1 Card Features Documentation

This document describes all the features available in the Yoto Formula 1 Card Generator application.

## Table of Contents

1. [Card Cover Image Upload](#card-cover-image-upload-feature)
2. [Real-Time Job Status](#real-time-job-status-feature)
3. [MYO Card Upload](#myo-card-upload-feature)
4. [Enhanced Race Details](#enhanced-race-details-feature)

---

# Card Cover Image Upload Feature

## Overview

**Note: Cover image uploads require special Yoto API permissions that are not available to standard accounts.**

The Yoto F1 app attempts to automatically upload custom cover images to display as card artwork. However, the `/media/coverImage/user/me/upload` endpoint is restricted and returns "not authorized" errors for most accounts.

## API Restrictions

The cover image upload feature:

- **Requires special permissions** - Not available with standard OAuth `offline_access` scope
- **Returns permission errors** - "User is not authorized to access this resource with an explicit deny"
- **Handled gracefully** - The app continues to work without cover images when upload fails
- **May require account upgrade** - Contact developers@yotoplay.com if cover uploads are important

## How It Works (When Permissions Are Available)

1. **Automatic Detection**: When you generate a card, the app automatically looks for a cover image in the `public/assets/card-images/` directory
2. **Smart Upload**: If an image is found AND permissions allow, it's uploaded to Yoto's API with the `autoconvert=true` parameter
3. **Card Integration**: The uploaded image URL is included in your card's metadata and displayed as the card artwork

## Adding Your Cover Image

### Step 1: Add Your Image

Place your cover image in the `public/assets/card-images/` directory with one of these names:

- `f1-card-cover.jpg` (recommended)
- `f1-card-cover.jpeg`
- `f1-card-cover.png`
- `countdown-to-f1-card.png` (legacy filename, still supported)

### Step 2: Generate Your Card

The app will attempt to upload the image. If you don't have permissions:

- A note will be logged: "Cover image uploads require special API permissions"
- The card will be created successfully without the cover image
- All TTS content and functionality works normally

## Image Guidelines

- **Format**: JPEG or PNG
- **Size**: Any size (Yoto automatically resizes when upload succeeds)
- **Recommended**: Square images (e.g., 500x500 or 1000x1000) work best
- **Content**: Choose an F1-related image that represents your card

## Technical Details

### Code Changes

The implementation includes:

1. **`uploadCoverImage()` function** in [src/services/yotoService.js](../src/services/yotoService.js)
   - Uploads image buffer to Yoto API
   - Returns media URL for use in card metadata
   - Uses `autoconvert=true` for automatic optimization

2. **`createTextToSpeechPlaylist()` enhancement** in [src/services/yotoService.js](../src/services/yotoService.js)
   - Now accepts optional `coverImageUrl` parameter
   - Includes cover image in `metadata.cover.imageL` field

3. **`uploadCardCoverImage()` helper** in [src/app/api/generate-card/route.js](../src/app/api/generate-card/route.js)
   - Searches for cover images in the designated directory
   - Automatically detects image type (JPEG/PNG)
   - Handles upload gracefully (won't fail if no image found)

### API Flow

```
1. App starts card generation
2. Checks for image in public/assets/card-images/
3. If found: Uploads to Yoto API → Receives mediaUrl
4. Creates card with mediaUrl in metadata.cover.imageL
5. Card displays with custom artwork!
```

## Example Cover Image Sources

You can find F1 images from:

- Official F1 website (respect copyright)
- Free stock photo sites (Unsplash, Pexels)
- Your own F1-themed designs
- AI-generated F1 artwork

## Troubleshooting

**Image not appearing?**

- **Most common**: Your account doesn't have cover image upload permissions (API returns "not authorized")
- Contact developers@yotoplay.com to request special permissions if needed
- The app will work perfectly without cover images - all core functionality remains

**Have permissions but upload still failing?**

- Check the file name matches one of the supported names
- Ensure the image is in the correct directory: `public/assets/card-images/`
- Check server logs for upload errors
- Verify the image file isn't corrupted
- Ensure the image file size isn't too large (< 10MB recommended)

## Getting Cover Upload Permissions

If cover images are important for your use case:

1. Email developers@yotoplay.com
2. Explain your F1 card project
3. Request cover image upload API permissions
4. They may grant special access depending on your account type

## Example

If you have the required permissions:

1. Download an F1 logo or race image
2. Save it as `public/assets/card-images/f1-card-cover.png`
3. Run the app and generate a card
4. Check your Yoto library - the card should have your custom image!

# Real-Time Job Status Feature

## Overview

Your Yoto F1 app now displays real-time status updates for text-to-speech generation jobs! The UI automatically polls the Yoto Labs API and shows you exactly when your card is ready.

## How It Works

### Automatic Status Polling

1. **Job Creation**: When you generate an F1 card, the app receives a `jobId` from Yoto
2. **Automatic Polling**: The UI polls the job status every 3 seconds
3. **Real-Time Updates**: Status changes appear immediately in the UI
4. **Smart Completion**: Polling automatically stops when the job completes or fails

### Job Statuses

The app displays these status updates:

- **⏳ Queued**: Job is waiting to be processed
- **🔄 Processing**: TTS audio is being generated
- **✅ Completed**: Card is ready in your Yoto library!
- **❌ Failed**: Generation encountered an error

### Progress Tracking

The UI shows track-by-track progress:

- **Progress: X / Y tracks** - Shows how many tracks have been completed out of the total

## Implementation Details

### New API Endpoint

**[src/app/api/job-status/route.js](src/app/api/job-status/route.js)**

- GET endpoint that accepts `jobId` as a query parameter
- Returns current job status from Yoto Labs API
- Uses existing `checkJobStatus()` function from yotoService

### UI Updates

**[src/app/page.js](src/app/page.js)**

Added state management:

```javascript
const [jobStatus, setJobStatus] = useState(null);
const [pollingJobId, setPollingJobId] = useState(null);
```

Polling logic via useEffect:

- Polls every 3 seconds when `pollingJobId` is set
- Automatically stops when status is `completed` or `failed`
- Updates `jobStatus` state with latest data

Status display:

- Shows emoji indicators for each status
- Displays track progress counter
- Shows completion/failure messages with appropriate styling

### Styling

**[src/app/page.module.css](src/app/page.module.css)**

Added new CSS classes:

- `.completedNote` - Green background for completed status
- `.failedNote` - Red background for failed status

## User Experience

### Before This Feature

- User generates card
- Static "processing" message
- No way to know when card is ready
- Have to manually check Yoto library

### After This Feature

- User authenticates with Yoto (required)
- User generates card
- See real-time status: Queued → Processing → Completed
- Track-by-track progress updates
- Clear notification when card is ready: **"✅ TTS generation complete! Your card is ready in your Yoto library."**
- All status information only visible to authenticated users

## Technical Flow

```
1. User clicks "Generate F1 Card"
2. POST /api/generate-card → Returns jobId
3. UI sets pollingJobId → Starts polling
4. Every 3 seconds: GET /api/job-status?jobId=xxx
5. UI updates status display
6. When status = "completed" or "failed" → Stop polling
7. Show completion message
```

## API Reference

Based on: https://yoto.dev/myo/labs-tts/#send-your-content-to-the-labs-api

Job object contains:

- `jobId`: Unique identifier for tracking
- `status`: Current status (queued, processing, completed, failed)
- `progress`: Object with `total`, `completed`, and `failed` track counts
- `cardId`: ID of the card being created/updated

## Example

When you generate a card, you'll see:

```
📱 Yoto Card Status
🔄 Updated Existing Card
Job ID: abc123
Status: 🔄 Processing
Progress: 1 / 3 tracks
```

Then when complete:

```
📱 Yoto Card Status
🔄 Updated Existing Card
Job ID: abc123
Status: ✅ Completed
Progress: 3 / 3 tracks
✅ TTS generation complete! Your card is ready in your Yoto library.
```

## Benefits

1. **Transparency**: Know exactly what's happening with your card
2. **Timing**: No more guessing when to check your library
3. **Confidence**: Visual confirmation that generation succeeded
4. **Debugging**: Failed status helps identify issues quickly

# MYO Card Upload Feature

## Overview

Your Yoto F1 app now supports uploading audio files to create MYO (Make Your Own) card-compatible playlists! This feature allows you to upload your own audio files with custom cover art, making them ready to link to physical MYO cards.

## How It Works

### Two Ways to Create Content

Your app now offers two options:

1. **TTS Card Generation** (existing feature)
   - Creates text-to-speech cards using the Labs API
   - Content appears in your library automatically
   - Can be linked to MYO cards through the Yoto app

2. **Audio Upload to MYO** (new feature)
   - Upload your own audio file
   - Automatically includes cover art from `public/assets/card-images/`
   - Creates MYO-ready playlist
   - Link to physical MYO card through the Yoto app

### MYO Upload Process

1. **Upload Audio**: Select an audio file from your device
2. **Get Upload URL**: App requests secure upload URL from Yoto API
3. **Upload File**: Audio is uploaded to Yoto's servers
4. **Transcoding**: Yoto transcodes the audio for player compatibility
5. **Add Cover**: App automatically adds cover image from your card-images folder
6. **Create Card**: MYO-compatible playlist is created in your library
7. **Link to MYO**: Use Yoto app to link playlist to physical MYO card

## Using the Feature

### Step 1: Prepare Your Audio

Supported formats:

- MP3
- M4A
- WAV
- Other common audio formats

### Step 2: Add Cover Image (Optional)

Place your cover image in `public/assets/card-images/`:

- `countdown-to-f1-card.png` (first priority)
- `f1-card-cover.jpg`
- Other supported image names

### Step 3: Upload via Web Interface

1. Visit the app homepage
2. Authenticate with Yoto (if not already) - **authentication is required**
3. Scroll to "Upload Audio to MYO Card" section
4. Click "Choose File" and select your audio
5. Click "Upload to MYO Card"
6. Wait for upload and transcoding (usually 15-60 seconds)

### Step 4: Link to Physical MYO Card

Once upload completes:

1. Open Yoto app on your phone
2. Go to Library
3. Find "F1: Next Race" (or your custom title)
4. Tap to link it to your physical MYO card
5. Insert card into player to play!

## Technical Implementation

### New Functions in yotoService.js

**`requestAudioUploadUrl(accessToken)`**

- Requests secure upload URL from Yoto API
- Returns `uploadUrl` and `uploadId`

**`uploadAudioFile(uploadUrl, audioBuffer, contentType)`**

- Uploads audio file to pre-signed URL
- Supports various audio formats

**`waitForTranscoding(uploadId, accessToken, maxAttempts)`**

- Polls transcoding status every second
- Maximum 60 attempts (60 seconds)
- Returns transcoded audio information including SHA256 hash

**`createAudioCard({ title, transcodedAudio, accessToken, coverImageUrl, cardId })`**

- Creates MYO-compatible playlist with transcoded audio
- Includes metadata (duration, file size, channels, format)
- Optionally adds cover image
- Can update existing card if `cardId` provided

### API Endpoint

**POST `/api/upload-to-myo`**

Accepts multipart/form-data with:

- `audio` (file) - Audio file to upload
- `title` (string) - Card title (default: "F1 Update")
- `updateExisting` (boolean) - Update existing card if true

Returns:

```json
{
  "success": true,
  "card": {
    "cardId": "abc123",
    "title": "F1: Next Race"
  },
  "coverImage": "Uploaded",
  "isUpdate": false,
  "message": "MYO card created successfully! Link it to your physical card in the Yoto app."
}
```

### UI Components

**Upload Form**

- File input for audio selection
- Green secondary button for MYO upload
- Disabled state during upload
- "OR" divider between TTS and MYO options

**MYO Result Display**

- Success message with instructions
- Card details (ID, title, cover image status)
- Step-by-step linking instructions
- Update badge if updating existing card

### Storage

The app stores two separate card IDs:

- `f1CardId` - TTS Library card ID
- `f1MyoCardId` - MYO card ID

This allows you to maintain both TTS and MYO versions independently.

## API Flow

```
1. User selects audio file
2. POST /api/upload-to-myo with FormData
3. Server: requestAudioUploadUrl()
4. Server: uploadAudioFile()
5. Server: waitForTranscoding() (polls every 1 second)
6. Server: uploadCoverImage()
7. Server: createAudioCard()
8. Return card details to client
9. Display success with linking instructions
```

## Transcoding Details

Based on: https://yoto.dev/myo/uploading-to-cards/

- Yoto transcodes audio to ensure player compatibility
- Process typically takes 15-60 seconds depending on file size
- Transcoded format includes:
  - Optimized audio codec
  - Normalized audio levels (optional)
  - Player-compatible format
  - SHA256 hash for content addressing

## Differences: TTS vs MYO Upload

| Feature        | TTS Generation     | MYO Upload         |
| -------------- | ------------------ | ------------------ |
| Input          | Text content       | Audio file         |
| Processing     | Labs API TTS       | Audio transcoding  |
| Wait Time      | Varies (job-based) | 15-60 seconds      |
| Output         | Library playlist   | MYO-ready playlist |
| MYO Linking    | Via app            | Via app            |
| Update Support | ✅ Yes             | ✅ Yes             |
| Cover Image    | ✅ Yes             | ✅ Yes             |

## Example Use Cases

1. **Pre-recorded F1 Commentary**: Upload professional race commentary
2. **Custom Audio**: Upload podcasts, music, or other audio content
3. **Multi-language Support**: Upload audio in different languages
4. **Archive Content**: Upload historical F1 race recordings
5. **Podcast Episodes**: Convert F1 podcasts to MYO cards

## Troubleshooting

**Upload fails**

- Check audio file format is supported
- Ensure file size is reasonable (< 100MB recommended)
- Verify internet connection
- Check Yoto authentication is valid

**Transcoding timeout**

- Large files may take longer
- Try with smaller audio file
- Check Yoto API status

**Card not appearing in library**

- Wait a few seconds and refresh Yoto app
- Check if card ID was returned
- Verify authentication

**Can't link to MYO card**

- Ensure you have a physical MYO card
- Follow linking instructions in Yoto app
- Card must be in your library first

## API Reference

Documentation: https://yoto.dev/myo/uploading-to-cards/

Key endpoints:

- `GET /media/transcode/audio/uploadUrl` - Request upload URL
- `PUT <uploadUrl>` - Upload audio file
- `GET /media/upload/{uploadId}/transcoded` - Check transcoding status
- `POST /content` - Create playlist with transcoded audio

# Enhanced Race Details Feature

This document describes the enhanced race details feature that adds more contextual information about Formula 1 races to the Yoto card.

## Overview

The enhanced race details feature fetches additional information from the OpenF1 API to provide users with richer context about each race weekend, including:

- **Meeting Details**: Official event name, country, circuit type (permanent, street, road)
- **Weather Conditions**: Air temperature, track temperature, humidity, wind speed, and rainfall

## Implementation Details

### New API Functions

Three new functions were added to `f1Service.js`:

#### 1. `getMeetingDetails(meetingKey)`

Fetches detailed meeting information from the OpenF1 `/meetings` endpoint.

**Returns:**

```javascript
{
  meetingName: string,
  meetingOfficialName: string,
  location: string,
  countryName: string,
  countryCode: string,
  circuitShortName: string,
  circuitKey: number,
  circuitType: string, // "Permanent", "Temporary - Street", or "Temporary - Road"
  year: number,
  gmtOffset: string
}
```

**Example:**

```javascript
const details = await getMeetingDetails(1234);
console.log(details.countryName); // "Japan"
console.log(details.circuitType); // "Permanent"
```

#### 2. `getSessionWeather(sessionKey)`

Fetches current weather conditions from the OpenF1 `/weather` endpoint.

**Returns:**

```javascript
{
  airTemperature: number,     // In Celsius
  trackTemperature: number,   // In Celsius
  humidity: number,           // Percentage
  pressure: number,           // In millibars
  rainfall: number,           // Boolean-like (0 or 1)
  windSpeed: number,          // In km/h
  windDirection: number,      // In degrees
  date: string                // ISO timestamp
}
```

**Example:**

```javascript
const weather = await getSessionWeather(5678);
console.log(weather.airTemperature); // 24
console.log(weather.rainfall); // 0 (dry)
```

#### 3. `getUpcomingSessions(meetingKey)`

Re-added function to fetch all sessions for a race weekend.

**Returns:**

```javascript
[
  {
    sessionName: string,
    sessionType: string,
    dateStart: string,
    dateEnd: string,
    location: string,
    circuitName: string,
    sessionKey: number,
  },
  // ... more sessions
];
```

### Enhanced Chapter Text

The `buildF1Chapters()` function in `yotoService.js` now accepts additional parameters:

```javascript
buildF1Chapters(raceData, sessions, iconMediaId, meetingDetails, weather);
```

The chapter text now includes:

1. **Official Event Name** (if different from race name)
2. **Country Information**
3. **Circuit Type Description**:
   - Permanent racing circuit
   - Temporary street circuit
   - Temporary road circuit
4. **Weather Conditions**:
   - Air and track temperatures
   - Humidity percentage
   - Wind speed
   - Rainfall status (wet/dry track)

### Example Enhanced Text

**Before:**

```
Hello Formula 1 fans! Let me tell you about the next race in the 2024 season.

The next race is the Japanese Grand Prix, taking place in Suzuka.

The race will be held on Sunday, April 7, 2024, at 02:00 AM EDT.

Get ready for an exciting race at Suzuka Circuit!
```

**After:**

```
Hello Formula 1 fans! Let me tell you about the next race in the 2024 season.

The next race is the Japanese Grand Prix, taking place in Suzuka.

The official name of this event is the Formula 1 MSC Cruises Japanese Grand Prix 2024.

This race takes place in Japan. The circuit is a permanent racing circuit.

The race will be held on Sunday, April 7, 2024, at 02:00 AM EDT.

Current weather conditions at the track: Air temperature is 24 degrees Celsius. Track temperature is 28 degrees Celsius. Humidity is 65 percent. Wind speed is 12 kilometers per hour. The track is dry with no rainfall.

Get ready for an exciting race at Suzuka Circuit!
```

## API Integration Flow

The card generation process now includes:

1. **Fetch Race Data** - Get basic race information (existing)
2. **Fetch Meeting Details** - Get circuit type and country info (new)
3. **Fetch Weather Data** - Get current track conditions (new)
4. **Build Enhanced Chapters** - Combine all data into rich descriptions (enhanced)

### Error Handling

Both meeting details and weather data are optional. If the API calls fail:

- The card generation continues with basic information
- Warnings are logged but don't block the process
- Users receive a card with standard race details

```javascript
// Graceful degradation
if (raceData.meetingKey) {
  try {
    meetingDetails = await getMeetingDetails(raceData.meetingKey);
  } catch (error) {
    console.warn("Failed to fetch meeting details:", error.message);
    // Continue without meeting details
  }
}
```

## Data Sources

### OpenF1 API Endpoints

1. **Meetings**: `https://api.openf1.org/v1/meetings?meeting_key={meetingKey}`
   - Provides circuit type, country, official names
   - Updated before each race weekend

2. **Weather**: `https://api.openf1.org/v1/weather?session_key={sessionKey}`
   - Provides live weather readings
   - Updated continuously during sessions
   - Returns the latest reading when queried

## Testing

To test the enhanced race details:

1. Generate a new card through the web interface
2. Check the generated TTS text in the response
3. Listen to the card on your Yoto device
4. Verify the additional details are present:
   - Country name mentioned
   - Circuit type described
   - Weather conditions reported

## Benefits

1. **Educational**: Children learn about different countries and circuit types
2. **Contextual**: Weather information helps understand race conditions
3. **Engaging**: More detailed descriptions create anticipation for the race
4. **Accurate**: Official event names match what broadcasters use

## Future Enhancements

Potential additions to consider:

- Historical race information (past winners, lap records)
- Session-specific weather for each practice/qualifying/race
- Track characteristics (number of turns, lap length)
- Safety car probability based on weather
- Championship implications of the race result

## Related Files

- `src/services/f1Service.js` - API data fetching
- `src/services/yotoService.js` - Chapter text generation
- `src/app/api/generate-card/route.js` - Card generation flow

## GitHub Issue

Feature implemented to address: https://github.com/dauble/yoto-app/issues/31
