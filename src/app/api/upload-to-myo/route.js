// API Route to upload audio to MYO card
import { requestAudioUploadUrl, uploadAudioFile, waitForTranscoding, createAudioCard } from "@/services/yotoService";
import { uploadCardCoverImage } from "@/utils/imageUtils";
import { getAccessToken, isAuthError, createAuthErrorResponse } from "@/utils/authUtils";
import Configstore from "configstore";
import path from "path";

// Create config for MYO card ID storage (separate from auth tokens)
const configPath = process.env.FLY_APP_NAME 
  ? path.join('/data', '.config-yoto-f1-card-tokens')
  : undefined;
  
const config = new Configstore("yoto-f1-card-tokens", {}, {
  configPath
});

/**
 * Get stored MYO card ID
 */
function getStoredMyoCardId() {
  return config.get("f1MyoCardId");
}

/**
 * Store MYO card ID for future updates
 */
function storeMyoCardId(cardId) {
  config.set("f1MyoCardId", cardId);
}

export async function POST(request) {
  try {
    // Check authentication
    const accessToken = getAccessToken();
    if (!accessToken) {
      return Response.json(
        { error: "Not authenticated. Please connect with Yoto first.", needsAuth: true },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const title = formData.get('title') || 'F1 Update';
    const updateExisting = formData.get('updateExisting') === 'true';

    if (!audioFile) {
      return Response.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log(`Uploading audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Step 1: Request upload URL
    const { uploadUrl, uploadId } = await requestAudioUploadUrl(accessToken);

    // Step 2: Upload audio file
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const contentType = audioFile.type || 'audio/mpeg';
    await uploadAudioFile(uploadUrl, audioBuffer, contentType);

    // Step 3: Wait for transcoding
    console.log('Waiting for transcoding...');
    const transcodedAudio = await waitForTranscoding(uploadId, accessToken);

    // Step 4: Upload cover image
    const coverImageUrl = await uploadCardCoverImage(accessToken);

    // Step 5: Check if updating existing card
    const existingCardId = updateExisting ? getStoredMyoCardId() : null;

    // Step 6: Create MYO card
    const card = await createAudioCard({
      title,
      transcodedAudio,
      accessToken,
      coverImageUrl,
      cardId: existingCardId,
    });

    // Store card ID if new
    if (card.cardId && !existingCardId) {
      storeMyoCardId(card.cardId);
    }

    return Response.json({
      success: true,
      card: {
        cardId: card.cardId,
        title: title,
      },
      coverImage: coverImageUrl ? 'Uploaded' : 'None',
      isUpdate: !!existingCardId,
      message: existingCardId 
        ? 'MYO card updated successfully! Link it to your physical card in the Yoto app.'
        : 'MYO card created successfully! Link it to your physical card in the Yoto app.',
    });

  } catch (error) {
    console.error('MYO upload error:', error);

    if (isAuthError(error)) {
      return createAuthErrorResponse();
    }

    return Response.json(
      { error: (error && typeof error === 'object' && 'message' in error && error.message) || 'Failed to create MYO card' },
      { status: 500 }
    );
  }
}
