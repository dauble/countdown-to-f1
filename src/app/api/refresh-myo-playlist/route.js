// API Route to refresh MYO playlist from Cloudflare Worker data
// This endpoint fetches fresh F1 data from the Cloudflare worker and updates
// the existing MYO card with new TTS content using ElevenLabs + Yoto audio upload.

import { createOrUpdateTTSPlaylist, buildF1Chapters, deployToAllDevices } from "@/services/yotoService";
import { uploadCardIcon, uploadCountryFlagIcon, uploadCardCoverImage } from "@/utils/imageUtils";
import { getAccessToken, getStoredCardId, storeCardId, getStoredPlaylistTitle, storePlaylistTitle, isAuthError, createAuthErrorResponse } from "@/utils/authUtils";

/**
 * Refresh MYO playlist with latest data from Cloudflare Worker.
 * Uses ElevenLabs TTS + Yoto audio upload so that, when a card ID is already
 * stored, the existing playlist is updated in-place rather than a new one being
 * created on every refresh.
 */
export async function POST(request) {
  try {
    // Step 1: Check authentication
    const accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        { error: "Not authenticated. Please connect with Yoto first.", needsAuth: true },
        { status: 401 }
      );
    }

    // Step 2: Get Cloudflare Worker URL from environment
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
    if (!workerUrl) {
      return Response.json(
        { 
          error: "Cloudflare Worker URL not configured. Please set CLOUDFLARE_WORKER_URL environment variable.",
          hint: "Example: https://f1-yoto-myo-worker.dauble2k5.workers.dev"
        },
        { status: 400 }
      );
    }

    console.log('Refreshing MYO playlist from Cloudflare Worker:', workerUrl);

    // Step 3: Fetch fresh data from Cloudflare Worker
    let workerData;
    try {
      const workerResponse = await fetch(`${workerUrl}/playlist`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!workerResponse.ok) {
        throw new Error(`Worker returned ${workerResponse.status}: ${workerResponse.statusText}`);
      }

      workerData = await workerResponse.json();
      console.log(`Fetched fresh data from worker, last updated: ${workerData.lastUpdated}`);
    } catch (error) {
      console.error('Failed to fetch from Cloudflare Worker:', error);
      return Response.json(
        {
          error: "Failed to fetch fresh data from Cloudflare Worker",
          details: error.message,
          workerUrl: workerUrl
        },
        { status: 502 }
      );
    }

    // Step 4: Extract race, sessions, and weather data
    const raceData = workerData.race;
    const sessions = workerData.sessions || [];
    const weather = workerData.weather || null;

    // Step 5: Format dates and times (convert from ISO strings)
    // The worker stores ISO timestamps, we need to format them for TTS
    if (raceData.dateStart) {
      const raceDate = new Date(raceData.dateStart);
      raceData.date = raceDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
      raceData.time = raceDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone: 'UTC'
      });
    }

    // Format session times
    const formattedSessions = sessions.map(session => {
      if (session.dateStart) {
        const sessionDate = new Date(session.dateStart);
        return {
          ...session,
          date: sessionDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
          }),
          time: sessionDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
            timeZone: 'UTC'
          })
        };
      }
      return session;
    });

    // Step 6: Upload custom icon if available
    const iconMediaId = await uploadCardIcon(accessToken);

    // Step 7: Upload country flag icon if available
    let countryFlagIconId = null;
    if (raceData.countryFlag) {
      countryFlagIconId = await uploadCountryFlagIcon(raceData.countryFlag, accessToken, raceData.country);
    }

    // Step 8: Upload cover image if available
    const coverImageUrl = await uploadCardCoverImage(accessToken);

    // Step 9: Build chapters with fresh data
    const chapters = buildF1Chapters(raceData, formattedSessions, iconMediaId, weather, countryFlagIconId);

    // Step 10: Get stored card ID and playlist title (if exists)
    const existingCardId = getStoredCardId();
    const storedTitle = getStoredPlaylistTitle();
    
    // Step 11: Use stored title if available, otherwise generate new title
    const title = storedTitle || `F1: ${raceData.name}`;
    console.log(`Using playlist title: "${title}" (stored: ${!!storedTitle})`);
    
    // Step 12: Create or update TTS playlist using ElevenLabs + Yoto audio upload.
    // When existingCardId is present the current card is updated in-place instead of
    // creating a new playlist (which was the limitation of the Yoto Labs TTS API).
    const yotoResult = await createOrUpdateTTSPlaylist({
      title,
      chapters,
      accessToken,
      cardId: existingCardId, // Provides update-in-place when card already exists
      coverImageUrl,
    });

    // Store the new card ID and title
    if (yotoResult.cardId) {
      storeCardId(yotoResult.cardId);
      storePlaylistTitle(title);
      console.log(`Stored new card ID: ${yotoResult.cardId} and title: "${title}"`);
    }

    // Step 13: Deploy to all devices
    // Audio is already uploaded and transcoded, so deployment can proceed immediately.
    let deploymentResult = null;
    if (yotoResult.cardId && yotoResult.status !== 'failed') {
      try {
        deploymentResult = await deployToAllDevices(yotoResult.cardId, accessToken);
        console.log('Deployed to devices:', deploymentResult);
      } catch (error) {
        console.error('Deployment error (non-fatal):', error);
      }
    }

    // Step 14: Return success with playlist info
    return Response.json({
      success: true,
      message: yotoResult.isUpdate
        ? "MYO playlist refreshed successfully! The existing playlist has been updated with the latest F1 data."
        : "MYO playlist created successfully with the latest F1 data.",
      yoto: {
        jobId: yotoResult.jobId,
        cardId: yotoResult.cardId,
        status: yotoResult.status,
        isUpdate: yotoResult.isUpdate,
      },
      race: {
        name: raceData.name,
        location: raceData.location,
        country: raceData.country,
        date: raceData.date,
        time: raceData.time,
      },
      sessions: formattedSessions.map(s => ({
        name: s.sessionName,
        date: s.date,
        time: s.time,
      })),
      weather: weather,
      dataSource: {
        type: 'cloudflare-worker',
        url: workerUrl,
        lastUpdated: workerData.lastUpdated,
      },
      deviceDeployment: deploymentResult,
    });

  } catch (error) {
    console.error('MYO playlist refresh error:', error);

    if (isAuthError(error)) {
      return createAuthErrorResponse();
    }

    return Response.json(
      {
        error: error.message || "Failed to refresh MYO playlist",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
