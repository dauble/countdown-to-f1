// Webhook API Route for automated playlist refresh
// This endpoint can be called by external services (e.g., cron jobs, CI/CD) to trigger playlist updates
// Uses a secret token for authentication

import { getDriverStandings, getTeamStandings } from "@/services/f1Service";
import { createTextToSpeechPlaylist, buildF1Chapters, deployToAllDevices } from "@/services/yotoService";
import { uploadCardIcon, uploadCountryFlagIcon, uploadCardCoverImage, uploadTeamCarIcons } from "@/utils/imageUtils";
import { getAccessToken, refreshAccessToken, getStoredTokens, getStoredCardId, storeCardId, getStoredPlaylistTitle, storePlaylistTitle, getStoredDataHash, storeDataHash } from "@/utils/authUtils";

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
    let accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        { error: "Not authenticated. User must connect with Yoto first." },
        { status: 401 }
      );
    }

    // Refresh the access token to ensure it's still valid (tokens expire daily)
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      accessToken = refreshedToken;
      console.log('[Webhook] Access token refreshed successfully');
    } else {
      const storedTokens = getStoredTokens();
      if (storedTokens?.refreshToken) {
        // Refresh token was available but refresh failed — token may be revoked
        console.error('[Webhook] Token refresh failed with an existing refresh token');
        return Response.json(
          { error: "Failed to refresh authentication token. Please reconnect with Yoto." },
          { status: 401 }
        );
      }
      console.log('[Webhook] No refresh token available, using existing access token');
    }

    // Step 3: Validate Cloudflare Worker configuration
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
    const missingVars = [];
    if (!workerUrl) missingVars.push('CLOUDFLARE_WORKER_URL');

    if (missingVars.length > 0) {
      console.error('[Webhook] Missing required environment variables:', missingVars.join(', '));
      return Response.json(
        {
          error: "Cloudflare Worker not configured. Missing required environment variables.",
          missingVariables: missingVars,
          hint: "CLOUDFLARE_WORKER_URL is a runtime secret for the app only — set it with `fly secrets set CLOUDFLARE_WORKER_URL=<url>`. It is not read by the GitHub Actions workflow, so it does not need to be added as a repository secret.",
        },
        { status: 400 }
      );
    }

    console.log('[Webhook] Automated refresh triggered from:', request.headers.get('user-agent') || 'unknown');
    console.log('[Webhook] Fetching data from Cloudflare Worker');

    // Step 4: Fetch fresh data from Cloudflare Worker
    let workerData;
    try {
      const workerResponse = await fetch(`${workerUrl}/playlist`, {
        signal: AbortSignal.timeout(10000)
      });

      // Always read the body as text first so we can include it in error details
      // without risking a JSON parse failure on non-200 responses.
      const workerBodyText = await workerResponse.text().catch(() => '');

      if (!workerResponse.ok) {
        const truncatedBody = workerBodyText.slice(0, 500);
        console.error(
          `[Webhook] Worker returned HTTP ${workerResponse.status}:`,
          truncatedBody || '(empty response body)'
        );
        return Response.json(
          {
            error: "Failed to fetch data from Cloudflare Worker",
            details: `Worker returned ${workerResponse.status}`,
            workerStatus: workerResponse.status,
            workerResponse: truncatedBody || null,
            hint: workerResponse.status >= 500
              ? "The Cloudflare Worker encountered an internal error. Check Worker logs in the Cloudflare dashboard and verify the KV namespace (F1_DATA) and Worker environment are configured correctly."
              : null,
          },
          { status: 502 }
        );
      }

      if (!workerBodyText) {
        console.error('[Webhook] Worker returned an empty response body');
        return Response.json(
          {
            error: "Failed to fetch data from Cloudflare Worker",
            details: "Worker returned an empty response body",
            workerStatus: workerResponse.status,
          },
          { status: 502 }
        );
      }

      try {
        workerData = JSON.parse(workerBodyText);
      } catch (parseError) {
        console.error('[Webhook] Worker returned a non-JSON response:', workerBodyText.slice(0, 200));
        return Response.json(
          {
            error: "Failed to fetch data from Cloudflare Worker",
            details: "Worker returned a non-JSON response",
            workerStatus: workerResponse.status,
          },
          { status: 502 }
        );
      }

      console.log('[Webhook] Data fetched, last updated:', workerData.lastUpdated);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      console.error('[Webhook] Failed to fetch from worker:', details);
      return Response.json(
        {
          error: "Failed to fetch data from Cloudflare Worker",
          details,
          hint: "Verify the CLOUDFLARE_WORKER_URL is correct and the Worker is deployed and reachable.",
        },
        { status: 502 }
      );
    }

    // Step 4b: Skip expensive TTS generation if the F1 data hasn't changed
    // The worker embeds a SHA-256 hash of race+session fields in its payload.
    // We compare it against the hash from the last successful update we ran.
    const newDataHash = workerData.dataHash;
    if (newDataHash) {
      const storedHash = getStoredDataHash();
      if (storedHash && storedHash === newDataHash) {
        console.log('[Webhook] No data changes detected — skipping TTS generation, dataHash:', newDataHash);
        return Response.json({
          success: true,
          skipped: true,
          reason: 'OpenF1 data is unchanged since the last update. No TTS regeneration needed.',
          dataSource: {
            url: workerUrl,
            lastUpdated: workerData.lastUpdated,
            dataHash: newDataHash,
          },
          timestamp: new Date().toISOString(),
        });
      }
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

    // Step 7: Upload cover image if available
    const coverImageUrl = await uploadCardCoverImage(accessToken);

    // Step 7b: Fetch current driver & constructor standings for additional chapters
    const driverStandings = await getDriverStandings();
    await new Promise(resolve => setTimeout(resolve, 500));
    const teamStandings = await getTeamStandings();

    // Step 7c: Upload team-specific car icons for the standings chapters
    const teamIconMap = await uploadTeamCarIcons(
      [...driverStandings.map(d => d.team), ...teamStandings.map(t => t.team)],
      accessToken
    );

    // Step 8: Build chapters
    const chapters = buildF1Chapters(raceData, formattedSessions, iconMediaId, weather, countryFlagIconId, {
      driverStandings,
      teamStandings,
      teamIconMap,
    });

    // Step 9: Get stored card ID and playlist title (if exists)
    const existingCardId = getStoredCardId();
    const storedTitle = getStoredPlaylistTitle();
    
    // Use stored title if available, otherwise generate new title
    const title = storedTitle || `F1: ${raceData.name}`;
    console.log(`[Webhook] Using playlist title: "${title}" (stored: ${!!storedTitle})`);
    
    // Step 10: Create TTS playlist using Yoto Labs TTS API.
    // Yoto Labs handles TTS generation on their own infrastructure, so no external
    // API quota is consumed. A new playlist is created when data changes; the
    // skip-when-unchanged check above prevents unnecessary regeneration.
    const yotoResult = await createTextToSpeechPlaylist({
      title,
      chapters,
      accessToken,
      cardId: existingCardId,
      coverImageUrl,
    });

    if (yotoResult.cardId) {
      storeCardId(yotoResult.cardId);
      storePlaylistTitle(title);
      console.log(`[Webhook] Stored new card ID: ${yotoResult.cardId} and title: "${title}"`);
    }

    // Persist the data hash so the next run can skip if nothing has changed
    if (newDataHash) {
      storeDataHash(newDataHash);
      console.log('[Webhook] Stored data hash:', newDataHash);
    }

    // Step 11: Deploy to devices (best effort, don't fail on error)
    let deploymentResult = null;
    if (yotoResult.cardId && yotoResult.status !== 'failed') {
      try {
        deploymentResult = await deployToAllDevices(yotoResult.cardId, accessToken);
        console.log('[Webhook] Deployed to devices:', deploymentResult);
      } catch (error) {
        console.error('[Webhook] Deployment error (non-fatal):', error);
      }
    }

    // Step 12: Return success
    return Response.json({
      success: true,
      message: "Automated playlist refresh completed successfully (new playlist created)",
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
    const details = error instanceof Error ? error.message : String(error);
    console.error('[Webhook] Error:', error);
    return Response.json(
      {
        error: "Webhook execution failed",
        details,
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
