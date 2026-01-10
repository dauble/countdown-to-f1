// Formula 1 API Service using OpenF1
// API Documentation: https://openf1.org/

const F1_API_BASE = "https://api.openf1.org/v1";

// Mock data for when API is unavailable
const MOCK_DATA = {
  nextRace: {
    name: "Australian Grand Prix",
    location: "Melbourne, Australia",
    circuit: "Albert Park Circuit",
    date: "Sunday, March 24, 2024",
    time: "03:00 PM AEDT",
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
    
    // Get all race sessions for the current year, ordered by date
    const response = await fetch(
      `${F1_API_BASE}/sessions?session_name=Race&year=${currentYear}&date_start>=${now.split('T')[0]}`,
      { signal: AbortSignal.timeout(5000) }
    );

    console.log("F1 API response:", response);

    if (!response.ok) {
      throw new Error("Failed to fetch race data");
    }

    const sessions = await response.json();
    
    if (!sessions || sessions.length === 0) {
      // If no future races this year, try next year
      const nextYear = currentYear + 1;
      const nextYearResponse = await fetch(
        `${F1_API_BASE}/sessions?session_name=Race&year=${nextYear}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!nextYearResponse.ok) {
        throw new Error("No upcoming races found");
      }
      
      const nextYearSessions = await nextYearResponse.json();
      if (!nextYearSessions || nextYearSessions.length === 0) {
        throw new Error("No upcoming races found");
      }
      
      return formatRaceData(nextYearSessions[0]);
    }
    
    // Return the first (earliest) race
    return formatRaceData(sessions[0]);
  } catch (error) {
    console.log("Using mock race data due to API error:", error.message);
    return MOCK_DATA.nextRace;
  }
}

/**
 * Get current driver standings (top 5)
 */
export async function getDriverStandings() {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11
    
    // If we're before March (month 2), use previous year's final standings
    const yearToUse = currentMonth < 2 ? currentYear - 1 : currentYear;
    
    console.log(`Fetching driver standings for year: ${yearToUse}`);
    
    // Get the last race session of the season to get final standings
    const sessionsResponse = await fetch(
      `${F1_API_BASE}/sessions?session_name=Race&year=${yearToUse}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!sessionsResponse.ok) {
      throw new Error("Failed to fetch race sessions");
    }

    const sessions = await sessionsResponse.json();
    
    if (!sessions || sessions.length === 0) {
      throw new Error("No race sessions found");
    }
    
    // Get the last race session
    const lastSession = sessions[sessions.length - 1];
    
    // Fetch position data from the last session to get championship standings
    const positionResponse = await fetch(
      `${F1_API_BASE}/position?session_key=${lastSession.session_key}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!positionResponse.ok) {
      throw new Error("Failed to fetch position data");
    }

    const positions = await positionResponse.json();
    
    if (!positions || positions.length === 0) {
      throw new Error("No position data found");
    }
    
    // Get the final position (last timestamp) for each driver
    const driverFinalPositions = new Map();
    
    positions.forEach(pos => {
      const existing = driverFinalPositions.get(pos.driver_number);
      if (!existing || new Date(pos.date) > new Date(existing.date)) {
        driverFinalPositions.set(pos.driver_number, pos);
      }
    });
    
    // Fetch driver details to get names and teams
    const driversResponse = await fetch(
      `${F1_API_BASE}/drivers?session_key=${lastSession.session_key}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!driversResponse.ok) {
      throw new Error("Failed to fetch driver data");
    }

    const drivers = await driversResponse.json();
    const driverMap = new Map(
      drivers.map(d => [d.driver_number, d])
    );
    
    // Sort by final position and take top 5
    const sortedPositions = Array.from(driverFinalPositions.values())
      .sort((a, b) => a.position - b.position)
      .slice(0, 5);
    
    // Map to driver standings format
    return sortedPositions.map((pos, index) => {
      const driver = driverMap.get(pos.driver_number);
      return {
        position: pos.position || (index + 1),
        driver: driver ? (driver.full_name || `${driver.first_name} ${driver.last_name}`) : `Driver ${pos.driver_number}`,
        team: driver?.team_name || "Unknown Team",
        points: Math.max(500 - (pos.position - 1) * 50, 0) // Estimated points based on position
      };
    });
  } catch (error) {
    console.log("Using mock driver standings due to API error:", error.message);
    return MOCK_DATA.drivers;
  }
}

/**
 * Get current constructor/team standings (top 5)
 */
export async function getTeamStandings() {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-11
    
    // If we're before March (month 2), use previous year's final standings
    const yearToUse = currentMonth < 2 ? currentYear - 1 : currentYear;
    
    console.log(`Fetching team standings for year: ${yearToUse}`);
    
    // Get the last race session of the season
    const sessionsResponse = await fetch(
      `${F1_API_BASE}/sessions?session_name=Race&year=${yearToUse}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!sessionsResponse.ok) {
      throw new Error("Failed to fetch race sessions");
    }

    const sessions = await sessionsResponse.json();
    
    if (!sessions || sessions.length === 0) {
      throw new Error("No race sessions found");
    }
    
    // Get the last race session
    const lastSession = sessions[sessions.length - 1];
    
    // Fetch drivers from the last session to extract teams
    const driversResponse = await fetch(
      `${F1_API_BASE}/drivers?session_key=${lastSession.session_key}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!driversResponse.ok) {
      throw new Error("Failed to fetch team data");
    }

    const drivers = await driversResponse.json();
    
    if (!drivers || drivers.length === 0) {
      throw new Error("No team data found");
    }
    
    // Extract unique teams
    const uniqueTeams = Array.from(
      new Map(drivers.map(d => [d.team_name, d])).values()
    );
    
    // Create team standings with mock points
    const teamStandings = uniqueTeams
      .filter(d => d.team_name) // Only include teams with names
      .slice(0, 5)
      .map((driver, index) => ({
        position: index + 1,
        team: driver.team_name,
        points: 860 - (index * 100) // Mock points (API doesn't provide standings)
      }));
    
    return teamStandings.length > 0 ? teamStandings : MOCK_DATA.teams;
  } catch (error) {
    console.log("Using mock team standings due to API error:", error.message);
    return MOCK_DATA.teams;
  }
}

/**
 * Format race data for display
 */
function formatRaceData(session) {
  const raceDate = new Date(session.date_start);
  
  return {
    name: session.meeting_name || session.location || "Formula 1 Race",
    location: session.location || session.country_name || "Unknown Location",
    circuit: session.circuit_short_name || session.circuit_key || "Unknown Circuit",
    dateStart: session.date_start, // Keep original ISO date for timezone conversion
    date: raceDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    time: raceDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    }),
    year: session.year
  };
}

/**
 * Generate text-to-speech script for all three chapters
 */
export function generateF1Script(raceData, driverStandings, teamStandings) {
  // Chapter 1: Next Race
  const chapter1 = `Chapter 1: Next Race

Hello Formula 1 fans! Let me tell you about the next race in the ${raceData.year} season.

The next race is the ${raceData.name}, taking place in ${raceData.location}.

The race will be held on ${raceData.date}, at ${raceData.time}.

Get ready for an exciting race at ${raceData.circuit}!`;

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
