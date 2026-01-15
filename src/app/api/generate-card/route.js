// API Route to generate a Formula 1 card
import { getNextRace, getDriverStandings, getTeamStandings, generateF1Script } from "@/services/f1Service";
import { createTextToSpeechPlaylist, buildF1Chapters, deployToAllDevices } from "@/services/yotoService";
import { uploadCardCoverImage } from "@/utils/imageUtils";
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
    
    // Step 3: Fetch F1 data from API
    const [raceData, driverStandings, teamStandings] = await Promise.all([
      getNextRace(),
      getDriverStandings(),
      getTeamStandings()
    ]);

    // Step 4: Convert race time to user's timezone
    if (raceData.dateStart) {
      const raceDate = new Date(raceData.dateStart);
      
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
      // Fallback for mock data without dateStart - use pre-formatted values
      // This shouldn't happen anymore since all data should include dateStart
      console.warn('Race data missing dateStart field, using pre-formatted date/time');
    }

    // Step 5: Generate script for text-to-speech
    const script = generateF1Script(raceData, driverStandings, teamStandings);

    // Step 6: Build chapters for Yoto playlist
    const chapters = buildF1Chapters(raceData);

    // Step 7: Check if we should update existing card
    const existingCardId = shouldUpdate ? getStoredCardId() : null;
    
    // Step 8: Upload cover image if available
    const coverImageUrl = await uploadCardCoverImage(accessToken);
    
    // Step 9: Create or update the Yoto card with TTS
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

    // Step 10: Deploy the playlist to all devices
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

    // Step 11: Return success with job information
    return Response.json({
      success: true,
      race: raceData,
      drivers: driverStandings,
      teams: teamStandings,
      script,
      yoto: yotoResult,
      deviceDeployment,
      isUpdate: !!existingCardId,
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
