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
buildF1Chapters(raceData, iconMediaId, meetingDetails, weather);
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
