// Formula 1 API Service using OpenF1
// API Documentation: https://openf1.org/
//
// RATE LIMITING:
// OpenF1 API has a strict limit of 3 requests per second.
// This service includes 500ms delays between internal API calls (2 req/sec).
// Callers must also add 500ms delays between function calls to stay under the limit.

import { getCircuitTypeDescription } from "@/utils/circuitUtils";

const F1_API_BASE = "https://api.openf1.org/v1";

// Mock data for when API is unavailable
const MOCK_DATA = {
  nextRace: {
    name: "Australian Grand Prix",
    location: "Melbourne, Australia",
    circuit: "Albert Park Circuit",
    dateStart: "2024-03-24T05:00:00.000Z", // ISO date for timezone conversion
    date: null, // Will be converted to user's timezone in API route
    time: null, // Will be converted to user's timezone in API route
    year: 2024
  },
  drivers: [
    { position: 1, driver: "Max Verstappen", team: "Red Bull Racing", points: 575 },
    { position: 2, driver: "Sergio Perez", team: "Red Bull Racing", points: 285 },
    { position: 3, driver: "Lewis Hamilton", team: "Mercedes", points: 234 },
    { position: 4, driver: "Fernando Alonso", team: "Aston Martin", points: 206 },
    { position: 5, driver: "Carlos Sainz", team: "Ferrari", points: 200 }
  ],
  teams: [
    { position: 1, team: "Red Bull Racing", points: 860 },
    { position: 2, team: "Mercedes", points: 409 },
    { position: 3, team: "Ferrari", points: 406 },
    { position: 4, team: "McLaren", points: 302 },
    { position: 5, team: "Aston Martin", points: 280 }
  ]
};

/**
 * Get the next upcoming race in the current season
 */
export async function getNextRace() {
  try {
    const currentYear = new Date().getFullYear();
    const now = new Date().toISOString();
    
    // Get all meetings for the current year, ordered by date
    const response = await fetch(
      `${F1_API_BASE}/meetings?year=${currentYear}&date_start>=${now.split('T')[0]}`,
      { signal: AbortSignal.timeout(5000) }
    );

    console.log("F1 API response:", response);

    if (!response.ok) {
      throw new Error("Failed to fetch race data");
    }

    const meetings = await response.json();
    
    if (!meetings || meetings.length === 0) {
      // If no future races this year, try next year
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit protection
      const nextYear = currentYear + 1;
      const nextYearResponse = await fetch(
        `${F1_API_BASE}/meetings?year=${nextYear}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!nextYearResponse.ok) {
        throw new Error("No upcoming races found");
      }
      
      const nextYearMeetings = await nextYearResponse.json();
      if (!nextYearMeetings || nextYearMeetings.length === 0) {
        throw new Error("No upcoming races found");
      }
      
      return formatRaceData(nextYearMeetings[0]);
    }
    
    // Return the first (earliest) meeting
    return formatRaceData(meetings[0]);
  } catch (error) {
    console.log("Using mock race data due to API error:", error.message);
    return MOCK_DATA.nextRace;
  }
}

/**
 * Get all upcoming sessions for a meeting (Practice, Qualifying, Sprint, Race, etc.)
 * @param {number} meetingKey - The meeting key from the race session
 * @returns {Promise<Array>} Array of session objects
 */
export async function getUpcomingSessions(meetingKey) {
  try {
    const now = new Date().toISOString();
    
    // Fetch all sessions for this meeting that haven't ended yet
    const response = await fetch(
      `${F1_API_BASE}/sessions?meeting_key=${meetingKey}&date_start>=${now.split('T')[0]}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch sessions");
    }

    const sessions = await response.json();
    
    if (!sessions || sessions.length === 0) {
      return [];
    }
    
    // Sort by date_start to ensure chronological order
    return sessions
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
      .map(session => ({
        meetingName: session.meeting_name || session.location, // The overall event name (e.g., "Singapore Grand Prix")
        sessionName: session.session_name, // Specific session (e.g., "Practice 1", "Qualifying", "Race")
        sessionType: session.session_type,
        dateStart: session.date_start,
        dateEnd: session.date_end,
        location: session.location,
        circuitName: session.circuit_short_name,
        sessionKey: session.session_key,
      }));
  } catch (error) {
    console.log("Error fetching sessions:", error.message);
    return [];
  }
}

/**
 * Find the most recently completed Race session. Championship standings
 * (points_current/position_current) are calculated as of a specific session,
 * so we need a session that has actually happened to have any data.
 */
async function getLatestCompletedRaceSession() {
  const now = new Date();

  const fetchRaceSessions = async (year) => {
    const response = await fetch(
      `${F1_API_BASE}/sessions?session_name=Race&year=${year}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch race sessions for ${year}`);
    }

    return response.json();
  };

  const completedSessions = (sessions) => (sessions || [])
    .filter(s => new Date(s.date_start) <= now)
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

  let completed = completedSessions(await fetchRaceSessions(now.getFullYear()));

  if (completed.length === 0) {
    // No races have happened yet this year (e.g. off-season) — fall back to
    // the previous year's final standings.
    await new Promise(resolve => setTimeout(resolve, 500));
    completed = completedSessions(await fetchRaceSessions(now.getFullYear() - 1));
  }

  if (completed.length === 0) {
    throw new Error("No completed race sessions found");
  }

  return completed[completed.length - 1];
}

/**
 * Get current driver standings (top 5)
 * Uses the OpenF1 Drivers Championship (beta) endpoint.
 * https://openf1.org/#drivers-championship-beta
 */
export async function getDriverStandings() {
  try {
    const lastSession = await getLatestCompletedRaceSession();

    // Rate limit protection before next API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const championshipResponse = await fetch(
      `${F1_API_BASE}/championship_drivers?session_key=${lastSession.session_key}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!championshipResponse.ok) {
      throw new Error("Failed to fetch driver championship data");
    }

    const championship = await championshipResponse.json();

    if (!championship || championship.length === 0) {
      throw new Error("No driver championship data found");
    }

    // Rate limit protection before next API call
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch driver details to get names and teams
    const driversResponse = await fetch(
      `${F1_API_BASE}/drivers?session_key=${lastSession.session_key}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!driversResponse.ok) {
      throw new Error("Failed to fetch driver data");
    }

    const drivers = await driversResponse.json();
    const driverMap = new Map(drivers.map(d => [d.driver_number, d]));

    return championship
      .sort((a, b) => a.position_current - b.position_current)
      .slice(0, 5)
      .map(entry => {
        const driver = driverMap.get(entry.driver_number);
        return {
          position: entry.position_current,
          driver: driver ? (driver.full_name || `${driver.first_name} ${driver.last_name}`) : `Driver ${entry.driver_number}`,
          team: driver?.team_name || "Unknown Team",
          points: entry.points_current,
        };
      });
  } catch (error) {
    console.log("Using mock driver standings due to API error:", error.message);
    return MOCK_DATA.drivers;
  }
}

/**
 * Get current constructor/team standings (top 5)
 * Uses the OpenF1 Teams Championship (beta) endpoint.
 * https://openf1.org/#teams-championship-beta
 */
export async function getTeamStandings() {
  try {
    const lastSession = await getLatestCompletedRaceSession();

    // Rate limit protection before next API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const championshipResponse = await fetch(
      `${F1_API_BASE}/championship_teams?session_key=${lastSession.session_key}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!championshipResponse.ok) {
      throw new Error("Failed to fetch team championship data");
    }

    const championship = await championshipResponse.json();

    if (!championship || championship.length === 0) {
      throw new Error("No team championship data found");
    }

    return championship
      .sort((a, b) => a.position_current - b.position_current)
      .slice(0, 5)
      .map(entry => ({
        position: entry.position_current,
        team: entry.team_name,
        points: entry.points_current,
      }));
  } catch (error) {
    console.log("Using mock team standings due to API error:", error.message);
    return MOCK_DATA.teams;
  }
}

/**
 * Format race data for display
 */
function formatRaceData(meeting) {
  // Don't format date/time here - let generate-card route handle timezone conversion
  return {
    name: meeting.meeting_name || "Formula 1 Race",
    officialName: meeting.meeting_official_name || meeting.meeting_name,
    location: meeting.location || "Unknown Location",
    country: meeting.country_name || "Unknown Country",
    circuit: meeting.circuit_short_name || "Unknown Circuit",
    circuitType: meeting.circuit_type || "Unknown",
    countryFlag: meeting.country_flag || null, // URL to country flag image
    dateStart: meeting.date_start, // ISO date for timezone conversion in API route
    dateEnd: meeting.date_end,
    date: null, // Will be set by API route with user's timezone
    time: null, // Will be set by API route with user's timezone
    year: meeting.year,
    meetingKey: meeting.meeting_key // Needed to fetch all sessions for this meeting
  };
}

/**
 * Generate text-to-speech script for all three chapters
 */
export function generateF1Script(raceData, driverStandings, teamStandings) {
  // Chapter 1: Next Race
  // Build circuit type description
  const circuitTypeDesc = getCircuitTypeDescription(raceData.circuitType);
  
  // Build circuit description - only include type if known
  const circuitDescription = `The drivers will be racing at the ${raceData.circuit} circuit${circuitTypeDesc ? ', which is ' + circuitTypeDesc : ''}.`;

  const chapter1 = `Chapter 1: Next Race

Hello Formula 1 fans! Let me tell you about the next race in the ${raceData.year} season.

The next race is the ${raceData.name}, taking place in ${raceData.location}, ${raceData.country}.

${circuitDescription}

The race weekend begins on ${raceData.date}, with the main race at ${raceData.time}.

Get ready for an exciting race weekend!`;

  // Chapter 2: Driver Standings
  const driversList = driverStandings
    .map(d => `In position ${d.position}, ${d.driver} from ${d.team}, with ${d.points} points.`)
    .join(' ');
  
  const chapter2 = `Chapter 2: Top 5 Drivers

Now let's look at the current driver standings.

Here are the top 5 drivers in the championship.

${driversList}

What an exciting season it's been!`;

  // Chapter 3: Team Standings
  const teamsList = teamStandings
    .map(t => `In position ${t.position}, ${t.team}, with ${t.points} points.`)
    .join(' ');
  
  const chapter3 = `Chapter 3: Top 5 Teams

Finally, let's check out the constructor's championship.

Here are the top 5 teams competing for glory.

${teamsList}

Thank you for listening! Enjoy the racing!`;

  return {
    chapter1,
    chapter2,
    chapter3,
    full: `${chapter1}\n\n${chapter2}\n\n${chapter3}`
  };
}

/**
 * Get detailed meeting information
 * @param {number} meetingKey - The meeting key
 * @returns {Promise<Object|null>} Meeting details or null
 */
export async function getMeetingDetails(meetingKey) {
  try {
    const url = `${F1_API_BASE}/meetings?meeting_key=${meetingKey}`;
    console.log('Fetching meeting details from:', url);
    
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Meeting details API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch meeting details: ${response.status}`);
    }

    const meetings = await response.json();
    console.log('Meeting details response:', meetings);
    
    if (!meetings || meetings.length === 0) {
      console.warn('No meeting details found for meeting key:', meetingKey);
      return null;
    }
    
    const meeting = meetings[0];
    
    return {
      meetingName: meeting.meeting_name,
      meetingOfficialName: meeting.meeting_official_name,
      location: meeting.location,
      countryName: meeting.country_name,
      countryCode: meeting.country_code,
      circuitShortName: meeting.circuit_short_name,
      circuitKey: meeting.circuit_key,
      circuitType: meeting.circuit_type, // "Permanent", "Temporary - Street", "Temporary - Road"
      year: meeting.year,
      gmtOffset: meeting.gmt_offset,
    };
  } catch (error) {
    console.error("Error fetching meeting details:", error.message, error);
    return null;
  }
}

/**
 * Get current weather conditions at the track
 * @param {number} sessionKey - The session key to get weather for
 * @returns {Promise<Object|null>} Weather data or null
 */
export async function getSessionWeather(sessionKey) {
  try {
    // Get the most recent weather reading for this session
    const url = `${F1_API_BASE}/weather?session_key=${sessionKey}`;
    console.log('Fetching weather from:', url);
    
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Weather API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Failed to fetch weather data: ${response.status}`);
    }

    const weatherData = await response.json();
    console.log('Weather data response:', weatherData);
    
    if (!weatherData || weatherData.length === 0) {
      console.warn('No weather data found for session key:', sessionKey);
      return null;
    }
    
    // Get the most recent weather reading
    const latestWeather = weatherData[weatherData.length - 1];
    
    return {
      airTemperature: latestWeather.air_temperature,
      trackTemperature: latestWeather.track_temperature,
      humidity: latestWeather.humidity,
      pressure: latestWeather.pressure,
      rainfall: latestWeather.rainfall,
      windSpeed: latestWeather.wind_speed,
      windDirection: latestWeather.wind_direction,
      date: latestWeather.date,
    };
  } catch (error) {
    console.error("Error fetching weather data:", error.message, error);
    return null;
  }
}
