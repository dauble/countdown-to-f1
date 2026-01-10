// API Route to generate a Formula 1 card
import { getNextRace, getDriverStandings, getTeamStandings, generateF1Script } from "@/services/f1Service";
import { createTextToSpeechPlaylist, buildF1Chapters } from "@/services/yotoService";
import Configstore from "configstore";

const config = new Configstore("yoto-f1-card-tokens");

/**
 * Get stored access token
 */
function getAccessToken() {
  const tokens = config.get("tokens");
  if (!tokens || !tokens.accessToken) {
    return null;
  }
  return tokens.accessToken;
}

/**
 * Get user's timezone from IP address
 */
async function getUserTimezone(request) {
  try {
    // Get user's IP address from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get("x-real-ip");
    
    // If no IP or localhost, return default timezone
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    
    // Use ipapi.co to get timezone from IP
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  } catch (error) {
    console.log("Could not determine timezone from IP:", error.message);
  }
  
  // Default to server/UTC timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export async function POST(request) {
  try {
    // Step 1: Check if user is authenticated
    const accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        {
          error: "Not authenticated. Please connect with Yoto first.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }

    // Step 2: Get user's timezone
    const userTimezone = await getUserTimezone(request);
    
    // Step 3: Fetch F1 data from API
    const [raceData, driverStandings, teamStandings] = await Promise.all([
      getNextRace(),
      getDriverStandings(),
      getTeamStandings()
    ]);

    // Step 4: Convert race time to user's timezone
    if (raceData.dateStart) {
      const raceDate = new Date(raceData.dateStart);
      raceData.date = raceDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: userTimezone
      });
      raceData.time = raceDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: userTimezone
      });
    }

    // Step 5: Generate script for text-to-speech
    const script = generateF1Script(raceData, driverStandings, teamStandings);

    // Step 6: Build chapters for Yoto playlist
    const chapters = buildF1Chapters(raceData);

    // Step 7: Create the Yoto card with TTS
    const title = `F1: ${raceData.name} ${raceData.year}`;
    const yotoResult = await createTextToSpeechPlaylist({
      title,
      chapters,
      accessToken,
    });

    // Step 8: Return success with job information
    return Response.json({
      success: true,
      race: raceData,
      drivers: driverStandings,
      teams: teamStandings,
      script,
      yoto: yotoResult,
      message: "Formula 1 card created successfully! Check your Yoto library.",
    });

  } catch (error) {
    console.error("F1 card generation error:", error);
    
    // Check if it's an auth error
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      return Response.json(
        {
          error: "Authentication failed. Please reconnect with Yoto.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }
    
    return Response.json(
      {
        error: error.message || "Failed to generate F1 card",
      },
      { status: 500 }
    );
  }
}
