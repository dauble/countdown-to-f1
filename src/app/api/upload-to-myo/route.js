// API Route to upload audio to MYO card
import { requestAudioUploadUrl, uploadAudioFile, waitForTranscoding, createAudioCard, uploadCoverImage } from "@/services/yotoService";
import Configstore from "configstore";
import { readFileSync } from "fs";
import { join } from "path";

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

/**
 * Upload card cover image if available
 */
async function uploadCardCoverImage(accessToken) {
  try {
    const publicDir = join(process.cwd(), 'public', 'assets', 'card-images');
    const possibleImages = ['countdown-to-f1-card.png', 'f1-card-cover.jpg', 'f1-card-cover.jpeg', 'f1-card-cover.png'];
    
    for (const imageName of possibleImages) {
      try {
        const imagePath = join(publicDir, imageName);
        const imageBuffer = readFileSync(imagePath);
        const ext = imageName.split('.').pop().toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
        
        console.log(`Found cover image: ${imageName}, uploading...`);
        const mediaUrl = await uploadCoverImage(imageBuffer, accessToken, contentType);
        console.log(`Cover image uploaded: ${mediaUrl}`);
        
        return mediaUrl;
      } catch (err) {
        console.error(`Error processing cover image "${imageName}":`, err);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error uploading cover image:', error);
    return null;
  }
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

    const status =
      (error && typeof error === 'object' && 'status' in error && error.status) ||
      (error &&
        typeof error === 'object' &&
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response &&
        error.response.status);

    const isAuthError =
      status === 401 ||
      (error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string' &&
        (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')));

    if (isAuthError) {
      return Response.json(
        { error: "Authentication failed. Please reconnect with Yoto.", needsAuth: true },
        { status: 401 }
      );
    }

    return Response.json(
      { error: (error && typeof error === 'object' && 'message' in error && error.message) || 'Failed to create MYO card' },
      { status: 500 }
    );
  }
}
