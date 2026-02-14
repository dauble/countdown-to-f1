// Webhook API Route for automated playlist refresh
// This endpoint can be called by external services (e.g., cron jobs, CI/CD) to trigger playlist updates
// Uses a secret token for authentication

import { createTextToSpeechPlaylist, buildF1Chapters, deployToAllDevices } from "@/services/yotoService";
import { uploadCardIcon, uploadCountryFlagIcon } from "@/utils/imageUtils";
import { getAccessToken, getStoredCardId, storeCardId } from "@/utils/authUtils";

/**
 * Webhook endpoint for automated playlist refresh
 * 
 * Usage:
 * POST /api/webhook/refresh-playlist
 * Headers:
 *   X-Webhook-Secret: <your_webhook_secret>
 * 
 * This endpoint can be called by:
 * - Cron jobs (e.g., GitHub Actions, cron-job.org)
 * - Cloudflare Worker (via scheduled trigger)
 * - Any external service that needs to trigger a refresh
 */
export async function POST(request) {
  try {
    // Step 1: Verify webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      return Response.json(
        { error: "Webhook not configured. Please set WEBHOOK_SECRET environment variable." },
        { status: 500 }
      );
    }

    const providedSecret = request.headers.get('X-Webhook-Secret');
    if (!providedSecret || providedSecret !== webhookSecret) {
      return Response.json(
        { error: "Unauthorized. Invalid webhook secret." },
        { status: 401 }
      );
    }

    // Step 2: Check authentication (stored access token)
    const accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        { error: "Not authenticated. User must connect with Yoto first." },
        { status: 401 }
      );
    }

    // Step 3: Get Cloudflare Worker URL
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
    if (!workerUrl) {
      return Response.json(
        { error: "Cloudflare Worker URL not configured." },
        { status: 400 }
      );
    }

    console.log('[Webhook] Automated refresh triggered from:', request.headers.get('user-agent') || 'unknown');
    console.log('[Webhook] Fetching data from:', workerUrl);

    // Step 4: Fetch fresh data from Cloudflare Worker
    let workerData;
    try {
      const workerResponse = await fetch(`${workerUrl}/playlist`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!workerResponse.ok) {
        throw new Error(`Worker returned ${workerResponse.status}`);
      }

      workerData = await workerResponse.json();
      console.log('[Webhook] Data fetched, last updated:', workerData.lastUpdated);
    } catch (error) {
      console.error('[Webhook] Failed to fetch from worker:', error);
      return Response.json(
        { error: "Failed to fetch data from Cloudflare Worker", details: error.message },
        { status: 502 }
      );
    }

    // Step 5: Extract and format race data
    const raceData = workerData.race;
    const sessions = workerData.sessions || [];
    const weather = workerData.weather || null;

    // Format dates and times
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

    // Step 6: Upload icons
    const iconMediaId = await uploadCardIcon(accessToken);
    let countryFlagIconId = null;
    if (raceData.countryFlag) {
      countryFlagIconId = await uploadCountryFlagIcon(raceData.countryFlag, accessToken, raceData.country);
    }

    // Step 7: Build chapters
    const chapters = buildF1Chapters(raceData, formattedSessions, iconMediaId, weather, countryFlagIconId);

    // Step 8: Create TTS playlist
    const existingCardId = getStoredCardId();
    const title = `F1: ${raceData.name}`;
    const yotoResult = await createTextToSpeechPlaylist({
      title,
      chapters,
      accessToken,
      cardId: existingCardId,
    });

    if (yotoResult.cardId) {
      storeCardId(yotoResult.cardId);
    }

    // Step 9: Deploy to devices (best effort, don't fail on error)
    let deploymentResult = null;
    if (yotoResult.cardId && yotoResult.status !== 'failed') {
      try {
        deploymentResult = await deployToAllDevices(yotoResult.cardId, accessToken);
        console.log('[Webhook] Deployed to devices:', deploymentResult);
      } catch (error) {
        console.error('[Webhook] Deployment error (non-fatal):', error);
      }
    }

    // Step 10: Return success
    return Response.json({
      success: true,
      message: "Automated playlist refresh completed successfully",
      timestamp: new Date().toISOString(),
      race: {
        name: raceData.name,
        location: raceData.location,
        country: raceData.country,
        date: raceData.date,
      },
      yoto: {
        jobId: yotoResult.jobId,
        cardId: yotoResult.cardId,
        status: yotoResult.status,
      },
      dataSource: {
        url: workerUrl,
        lastUpdated: workerData.lastUpdated,
      },
      deviceDeployment: deploymentResult,
    });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return Response.json(
      {
        error: "Webhook execution failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - returns webhook information and status
 */
export async function GET(request) {
  // Verify webhook secret for GET as well
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get('X-Webhook-Secret');
  if (!providedSecret || providedSecret !== webhookSecret) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Return webhook status and configuration
  const accessToken = getAccessToken();
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

  return Response.json({
    status: "active",
    configured: {
      authentication: !!accessToken,
      cloudflareWorker: !!workerUrl,
      webhookSecret: true,
    },
    workerUrl: workerUrl || null,
    timestamp: new Date().toISOString(),
    usage: {
      endpoint: "/api/webhook/refresh-playlist",
      method: "POST",
      headers: {
        "X-Webhook-Secret": "<your_webhook_secret>"
      },
      description: "Triggers an automated playlist refresh from the Cloudflare Worker"
    }
  });
}
