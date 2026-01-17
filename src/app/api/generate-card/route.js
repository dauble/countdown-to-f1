// API Route to generate a Formula 1 card
import { getNextRace, getUpcomingSessions, getDriverStandings, getTeamStandings, generateF1Script, getMeetingDetails, getSessionWeather } from "@/services/f1Service";
import { createTextToSpeechPlaylist, buildF1Chapters, deployToAllDevices } from "@/services/yotoService";
import { uploadCardCoverImage, uploadCardIcon } from "@/utils/imageUtils";
import Configstore from "configstore";

// Delay utility to respect OpenF1 API rate limit (3 requests/second)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
 * Get stored card ID for updates
 */
function getStoredCardId() {
  return config.get("f1CardId");
}

/**
 * Store card ID for future updates
 */
function storeCardId(cardId) {
  config.set("f1CardId", cardId);
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

    // Parse request body to check for update preference
    const body = await request.json().catch(() => ({}));
    const shouldUpdate = body.updateExisting !== false; // Default to true

    // Step 2: Get user's timezone
    const userTimezone = await getUserTimezone(request);
    
    // Step 3: Fetch F1 data from API (sequential to respect 3 req/sec rate limit)
    const raceData = await getNextRace();
    await delay(400); // Wait 400ms between requests (allows 2.5 req/sec safely)
    
    const driverStandings = await getDriverStandings();
    await delay(400);
    
    const teamStandings = await getTeamStandings();
    await delay(400);

    // Step 4: Convert race time to user's timezone
    if (raceData.dateStart) {
      const raceDate = new Date(raceData.dateStart);
      if (process.env.NODE_ENV !== "production") {
        console.log(`Converting race time from ${raceData.dateStart} to timezone: ${userTimezone}`);
      }
      
      // Format both date and time in user's timezone
      // This ensures the correct calendar day is shown (handles day rollover)
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
    } else {
      // Fallback for data without dateStart
      console.warn(`Race data missing dateStart field. Date: ${raceData.date}, Time: ${raceData.time}`);
      console.warn('Cannot convert to user timezone without ISO timestamp');
    }

    // Step 4a: Fetch all upcoming sessions for this race weekend
    let sessions = [];
    if (raceData.meetingKey) {
      const rawSessions = await getUpcomingSessions(raceData.meetingKey);
      
      // Convert session times to user's timezone
      sessions = rawSessions.map(session => {
        const sessionDate = new Date(session.dateStart);
        return {
          ...session,
          date: sessionDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: userTimezone
          }),
          time: sessionDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
            timeZone: userTimezone
          })
        };
      });
      
      console.log(`Found ${sessions.length} upcoming sessions for this race weekend`);
    }

    // Step 5: Generate script for text-to-speech
    const script = generateF1Script(raceData, driverStandings, teamStandings);

    // Step 6: Fetch additional race details (meeting info and weather)
    // Continue respecting OpenF1 rate limit
    let meetingDetails = null;
    let weather = null;
    
    if (raceData.meetingKey) {
      try {
        console.log(`Fetching meeting details for meetingKey: ${raceData.meetingKey}`);
        meetingDetails = await getMeetingDetails(raceData.meetingKey);
        console.log('Meeting details fetched:', meetingDetails);
        await delay(400); // Rate limit protection
      } catch (error) {
        console.error('Failed to fetch meeting details:', error.message);
      }
    }
    
    // Get weather from the first session if available
    if (sessions.length > 0 && sessions[0].sessionKey) {
      try {
        console.log(`Fetching weather for sessionKey: ${sessions[0].sessionKey}`);
        weather = await getSessionWeather(sessions[0].sessionKey);
        console.log('Weather data fetched:', weather);
        await delay(400); // Rate limit protection
      } catch (error) {
        console.error('Failed to fetch weather data:', error.message);
      }
    }

    // Step 7: Upload custom icon if available (16x16 for display on Yoto device)
    const iconMediaId = await uploadCardIcon(accessToken);

    // Step 8: Build chapters for Yoto playlist with custom icon, sessions, and enhanced details
    const chapters = buildF1Chapters(raceData, sessions, iconMediaId, meetingDetails, weather);

    // Step 9: Check if we should update existing card
    const existingCardId = shouldUpdate ? getStoredCardId() : null;
    
    // Step 10: Upload cover image if available
    const coverImageUrl = await uploadCardCoverImage(accessToken);
    
    // Step 11: Create or update the Yoto card with TTS
    const title = `F1: Next Race`;
    const yotoResult = await createTextToSpeechPlaylist({
      title,
      chapters,
      accessToken,
      cardId: existingCardId,
      coverImageUrl,
    });

    // Store the card ID if it's a new card
    if (yotoResult.cardId && !existingCardId) {
      storeCardId(yotoResult.cardId);
    }

    // Step 12: Deploy the playlist to all devices
    let deviceDeployment = null;
    if (yotoResult.cardId) {
      try {
        deviceDeployment = await deployToAllDevices(yotoResult.cardId, accessToken);
        console.log(`Device deployment: ${deviceDeployment.success}/${deviceDeployment.total} successful`);
      } catch (deployError) {
        console.error('Failed to deploy to devices:', deployError);
        // Don't fail the entire request if device deployment fails
        deviceDeployment = {
          success: 0,
          failed: 0,
          total: 0,
          error: deployError.message,
        };
      }
    }

    // Step 13: Return success with job information
    return Response.json({
      success: true,
      race: raceData,
      drivers: driverStandings,
      teams: teamStandings,
      script,
      yoto: {
        ...yotoResult,
        chapters, // Include chapters data so UI can display all content
      },
      deviceDeployment,
      isUpdate: !!existingCardId,
      meetingDetails, // Include for debugging
      weather, // Include for debugging
      message: existingCardId 
        ? "Formula 1 card updated successfully! Changes will appear in your Yoto library shortly."
        : "Formula 1 card created successfully! Check your Yoto library.",
    });

  } catch (error) {
    console.error("F1 card generation error:", error);
    
    // Check if it's an auth error by checking status code first
    const isAuthError = 
      error.status === 401 ||
      (error.message && typeof error.message === 'string' && 
       (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')));
    
    if (isAuthError) {
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
