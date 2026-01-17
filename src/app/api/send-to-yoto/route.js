// API Route to send generated card data to Yoto
import { createTextToSpeechPlaylist, deployToAllDevices } from "@/services/yotoService";
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

    // Step 3: Check if we should update existing card
    const existingCardId = updateExisting ? getStoredCardId() : null;
    
    // Step 4: Upload cover image if available
    const coverImageUrl = await uploadCardCoverImage(accessToken);
    
    // Step 5: Create or update the Yoto card with TTS
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

    // Step 7: Return success with job information
    return Response.json({
      success: true,
      yoto: yotoResult,
      deviceDeployment,
      isUpdate: !!existingCardId,
      message: existingCardId 
        ? "Formula 1 card updated successfully! Changes will appear in your Yoto library shortly."
        : "Formula 1 card created successfully! Check your Yoto library.",
    });

  } catch (error) {
    console.error("Send to Yoto error:", error);
    
    // Check if it's an auth error
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
        error: error.message || "Failed to send card to Yoto",
      },
      { status: 500 }
    );
  }
}
