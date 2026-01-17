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
