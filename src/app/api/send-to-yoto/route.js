// API Route to send generated card data to Yoto
import { createTextToSpeechPlaylist, deployToAllDevices } from "@/services/yotoService";
import { uploadCardCoverImage } from "@/utils/imageUtils";
import { getAccessToken, storeCardId, isAuthError, createAuthErrorResponse } from "@/utils/authUtils";

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

    // Step 2: Parse request body to get the generated card data
    const body = await request.json();
    const { chapters, title = "F1: Next Race", updateExisting = true } = body;

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return Response.json(
        { error: "No chapters data provided" },
        { status: 400 }
      );
    }

    // Step 3: Upload cover image if available
    const coverImageUrl = await uploadCardCoverImage(accessToken);
    
    // Step 4: Create TTS playlist
    // Note: Labs TTS API always creates new playlists, it doesn't support updating existing ones
    const yotoResult = await createTextToSpeechPlaylist({
      title,
      chapters,
      accessToken,
      cardId: null, // Labs API doesn't support updates
      coverImageUrl,
    });

    // Store the newly created card ID for future reference
    if (yotoResult.cardId) {
      storeCardId(yotoResult.cardId);
      console.log(`Stored new card ID: ${yotoResult.cardId}`);
    }

    // Step 5: Deploy the playlist to all devices
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

    // Step 6: Return success with job information
    return Response.json({
      success: true,
      yoto: yotoResult,
      deviceDeployment,
      isUpdate: false, // Labs TTS API always creates new playlists
      message: "Formula 1 card created successfully! Check your Yoto library.",
    });

  } catch (error) {
    console.error("Send to Yoto error:", error);
    
    if (isAuthError(error)) {
      return createAuthErrorResponse();
    }
    
    return Response.json(
      {
        error: error.message || "Failed to send card to Yoto",
      },
      { status: 500 }
    );
  }
}
