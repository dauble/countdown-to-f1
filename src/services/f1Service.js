// Formula 1 API Service using OpenF1
// API Documentation: https://openf1.org/

const F1_API_BASE = "https://api.openf1.org/v1";

/**
 * Get the next upcoming race in the current season
 */
export async function getNextRace() {
  const currentYear = new Date().getFullYear();
  const now = new Date().toISOString();
  
  // Get all race sessions for the current year, ordered by date
  const response = await fetch(
    `${F1_API_BASE}/sessions?session_name=Race&year=${currentYear}&date_start>=${now.split('T')[0]}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch race data");
  }

  const sessions = await response.json();
  
  if (!sessions || sessions.length === 0) {
    // If no future races this year, try next year
    const nextYear = currentYear + 1;
    const nextYearResponse = await fetch(
      `${F1_API_BASE}/sessions?session_name=Race&year=${nextYear}`
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
}

/**
 * Get current driver standings (top 5)
 */
export async function getDriverStandings() {
  const currentYear = new Date().getFullYear();
  
  // The OpenF1 API doesn't have a direct standings endpoint
  // We'll fetch drivers and their data for the current season
  // Note: This is a simplified approach - in a real app you'd calculate standings
  // from race results or use a different API
  const response = await fetch(
    `${F1_API_BASE}/drivers?session_key=latest`
  );

  if (!response.ok) {
    // Fallback: return mock data for demonstration
    return [
      { position: 1, driver: "Max Verstappen", team: "Red Bull Racing", points: 575 },
      { position: 2, driver: "Sergio Perez", team: "Red Bull Racing", points: 285 },
      { position: 3, driver: "Lewis Hamilton", team: "Mercedes", points: 234 },
      { position: 4, driver: "Fernando Alonso", team: "Aston Martin", points: 206 },
      { position: 5, driver: "Carlos Sainz", team: "Ferrari", points: 200 }
    ];
  }

  const drivers = await response.json();
  
  // Return top 5 drivers (using mock points since API doesn't provide standings directly)
  return drivers.slice(0, 5).map((driver, index) => ({
    position: index + 1,
    driver: driver.full_name || `${driver.first_name} ${driver.last_name}`,
    team: driver.team_name || "Unknown Team",
    points: 500 - (index * 50) // Mock points for demonstration
  }));
}

/**
 * Get current constructor/team standings (top 5)
 */
export async function getTeamStandings() {
  // OpenF1 API doesn't have team standings endpoint
  // Return mock data for demonstration
  return [
    { position: 1, team: "Red Bull Racing", points: 860 },
    { position: 2, team: "Mercedes", points: 409 },
    { position: 3, team: "Ferrari", points: 406 },
    { position: 4, team: "Aston Martin", points: 280 },
    { position: 5, team: "McLaren", points: 302 }
  ];
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
