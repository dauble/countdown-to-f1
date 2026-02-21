// API Route to send generated card data to Yoto
import { createOrUpdateTTSPlaylist, deployToAllDevices } from "@/services/yotoService";
import { uploadCardCoverImage } from "@/utils/imageUtils";
import { getAccessToken, getStoredCardId, storeCardId, storePlaylistTitle, isAuthError, createAuthErrorResponse } from "@/utils/authUtils";

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

    // Step 4: Retrieve stored card ID so we can update the existing card when present
    const existingCardId = updateExisting ? getStoredCardId() : null;

    // Step 5: Create or update TTS playlist using ElevenLabs + Yoto audio upload.
    // When existingCardId is present the current card is updated in-place instead of
    // creating a new playlist (which was the limitation of the Yoto Labs TTS API).
    const yotoResult = await createOrUpdateTTSPlaylist({
      title,
      chapters,
      accessToken,
      cardId: existingCardId,
      coverImageUrl,
    });

    // Store card ID and title for future updates
    if (yotoResult.cardId) {
      storeCardId(yotoResult.cardId);
      storePlaylistTitle(title);
      console.log(`Stored card ID: ${yotoResult.cardId} and title: "${title}"`);
    }

    // Step 6: Deploy the playlist to all devices
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

    // Step 7: Return success with card information
    return Response.json({
      success: true,
      yoto: yotoResult,
      deviceDeployment,
      isUpdate: yotoResult.isUpdate,
      message: yotoResult.isUpdate
        ? "Formula 1 card updated successfully! Check your Yoto library."
        : "Formula 1 card created successfully! Check your Yoto library.",
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
