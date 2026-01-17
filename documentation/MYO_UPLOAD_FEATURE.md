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
