// Yoto API Service for creating MYO cards
// API Documentation: https://yoto.dev/myo/labs-tts/

const YOTO_LABS_API_BASE = "https://labs.api.yotoplay.com";
const YOTO_API_BASE = "https://api.yotoplay.com";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // ElevenLabs voice ID

/**
 * Custom error class for Yoto API errors that includes HTTP status
 */
class YotoApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'YotoApiError';
    this.status = status;
  }
}

/**
 * Upload a cover image to Yoto
 * @param {Buffer|Blob} imageBuffer - Image file buffer or blob
 * @param {string} accessToken - Yoto API access token
 * @param {string} contentType - Content type of the image (e.g., 'image/jpeg', 'image/png')
 * @returns {Promise<string>} Media URL of the uploaded image
 */
export async function uploadCoverImage(imageBuffer, accessToken, contentType = 'image/jpeg') {
  try {
    const url = new URL(`${YOTO_API_BASE}/media/coverImage/user/me/upload`);
    url.searchParams.set('autoconvert', 'true');
    url.searchParams.set('coverType', 'default');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to upload cover image: ${errorText}`, response.status);
    }

    const result = await response.json();
    
    if (!result.coverImage || !result.coverImage.mediaUrl) {
      throw new Error('Upload successful but no mediaUrl returned');
    }

    console.log('Cover image uploaded successfully:', result.coverImage.mediaId);
    
    return result.coverImage.mediaUrl;

  } catch (error) {
    console.error('Cover image upload error:', error);
    throw error;
  }
}

/**
 * Create a text-to-speech playlist on Yoto
 * @param {Object} params
 * @param {string} params.title - Title of the card
 * @param {Array} params.chapters - Array of chapter objects with text content
 * @param {string} params.accessToken - Yoto API access token
 * @param {string} params.cardId - Optional: ID to update existing card
 * @param {string} params.voiceId - Optional: ElevenLabs voice ID
 * @param {string} params.coverImageUrl - Optional: Media URL of uploaded cover image
 * @returns {Promise<Object>} Job object with jobId and status
 */
export async function createTextToSpeechPlaylist({
  title,
  chapters,
  accessToken,
  cardId = null,
  voiceId = DEFAULT_VOICE_ID,
  coverImageUrl = null
}) {
  try {
    // Build the playlist content structure
    const content = {
      title: title,
      content: { 
        chapters: chapters.map((chapter, chapterIndex) => {
          const chapterObj = {
            key: String(chapterIndex + 1).padStart(2, '0'),
            title: chapter.title,
            overlayLabel: String(chapterIndex + 1),
            tracks: chapter.tracks.map((track, trackIndex) => {
              const trackObj = {
                key: String(trackIndex + 1).padStart(2, '0'),
                title: track.title,
                trackUrl: track.text, // Text content goes in trackUrl for TTS
                type: 'elevenlabs',
                overlayLabel: String(trackIndex + 1),
                voiceId: track.voiceId || voiceId, // Per-track voice override
              };
              
              // Only include display.icon16x16 if icon is provided
              if (track.icon) {
                trackObj.display = {
                  icon16x16: track.icon,
                };
              }
              
              return trackObj;
            }),
          };
          
          // Only include display.icon16x16 if icon is provided
          if (chapter.icon) {
            chapterObj.display = {
              icon16x16: chapter.icon,
            };
          }
          
          return chapterObj;
        })
      },
      metadata: {
        title: title,
        description: `F1 Update - ${new Date().toLocaleDateString()}`,
      },
    };

    // Add cover image if provided
    if (coverImageUrl) {
      content.metadata.cover = {
        imageL: coverImageUrl,
      };
    }

    // If updating existing card, add cardId
    if (cardId) {
      content.cardId = cardId;
    }

    console.log("Creating Yoto TTS playlist:", content);

    // Submit to Labs API
    const response = await fetch(
      `${YOTO_LABS_API_BASE}/content/job?voiceId=${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(content),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to create TTS playlist: ${errorText}`, response.status);
    }

    const { job } = await response.json();
    
    console.log('Text-to-speech job created:', job);
    
    return {
      jobId: job.jobId,
      cardId: job.cardId || cardId, // Return cardId for storage
      status: job.status,
      progress: job.progress,
      message: cardId 
        ? 'Card update job started successfully!' 
        : 'New card creation job started successfully!'
    };

  } catch (error) {
    console.error("Yoto TTS playlist creation error:", error);
    throw error;
  }
}

/**
 * Check the status of a TTS job
 * @param {string} jobId - Job ID to check
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<Object>} Job status object
 */
export async function checkJobStatus(jobId, accessToken) {
  try {
    const response = await fetch(
      `${YOTO_LABS_API_BASE}/content/job/${jobId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new YotoApiError('Failed to check job status', response.status);
    }

    const { job } = await response.json();
    return job;

  } catch (error) {
    console.error("Job status check error:", error);
    throw error;
  }
}

/**
 * Get all devices associated with the user's account
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<Array>} Array of device objects
 */
export async function getDevices(accessToken) {
  try {
    const response = await fetch(`${YOTO_API_BASE}/me/devices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to fetch devices: ${errorText}`, response.status);
    }

    const data = await response.json();
    // Log only device count for privacy
    console.log(`Fetched ${data.devices?.length || 0} device(s)`);
    
    return data.devices || [];
  } catch (error) {
    console.error("Device fetch error:", error);
    throw error;
  }
}

/**
 * Deploy a playlist to a specific device
 * @param {string} deviceId - Device ID to deploy to
 * @param {string} cardId - Card ID to deploy
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<Object>} Deployment result
 */
export async function deployToDevice(deviceId, cardId, accessToken) {
  try {
    const response = await fetch(
      `${YOTO_API_BASE}/devices/${deviceId}/playlist`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: cardId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to deploy to device ${deviceId}: ${errorText}`, response.status);
    }

    const result = await response.json();
    console.log(`Successfully deployed to device ${deviceId}`);
    
    return result;
  } catch (error) {
    console.error(`Deploy to device ${deviceId} error:`, error);
    throw error;
  }
}

/**
 * Deploy a playlist to all devices
 * @param {string} cardId - Card ID to deploy
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<Object>} Deployment results with success/failure counts
 */
export async function deployToAllDevices(cardId, accessToken) {
  try {
    const devices = await getDevices(accessToken);
    
    if (!devices || devices.length === 0) {
      console.log('No devices found to deploy to');
      return {
        success: 0,
        failed: 0,
        total: 0,
        devices: [],
      };
    }

    console.log(`Deploying card ${cardId} to ${devices.length} device(s)`);
    
    const results = await Promise.allSettled(
      devices.map(device => deployToDevice(device.id, cardId, accessToken))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: successful,
      failed: failed,
      total: devices.length,
      devices: devices.map(d => ({ id: d.id, name: d.name })),
    };
  } catch (error) {
    console.error("Deploy to all devices error:", error);
    throw error;
  }
}

/**
 * Convert F1 race data into Yoto chapter format with single track
 * @param {Object} raceData - Race information
 * @returns {Array} Array of chapter objects
 */
export function buildF1Chapters(raceData) {
  // Single chapter with the Next Race information
  const chapter = {
    title: "Next F1 Race",
    icon: null, // Can add custom icon later
    tracks: [
      {
        title: raceData.name,
        text: `Hello Formula 1 fans! Let me tell you about the next race in the ${raceData.year} season.

The next race is the ${raceData.name}, taking place in ${raceData.location}.

The race will be held on ${raceData.date}, at ${raceData.time}.

Get ready for an exciting race at ${raceData.circuit}!`,
        icon: null, // Can add custom icon later
      }
    ]
  };

  return [chapter];
}

/**
 * Request an upload URL for audio file
 * @param {string} accessToken - Yoto API access token
 * @returns {Promise<Object>} Upload URL and uploadId
 */
export async function requestAudioUploadUrl(accessToken) {
  try {
    const response = await fetch(
      `${YOTO_API_BASE}/media/transcode/audio/uploadUrl`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to get upload URL: ${errorText}`, response.status);
    }

    const data = await response.json();
    
    if (!data.upload || !data.upload.uploadUrl) {
      throw new Error('No upload URL in response');
    }

    console.log('Got upload URL, uploadId:', data.upload.uploadId);
    
    return {
      uploadUrl: data.upload.uploadUrl,
      uploadId: data.upload.uploadId,
    };
  } catch (error) {
    console.error('Request upload URL error:', error);
    throw error;
  }
}

/**
 * Upload audio file to Yoto
 * @param {string} uploadUrl - Pre-signed upload URL
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} contentType - Content type (e.g., 'audio/mpeg', 'audio/mp3')
 * @returns {Promise<void>}
 */
export async function uploadAudioFile(uploadUrl, audioBuffer, contentType = 'audio/mpeg') {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: audioBuffer,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to upload audio: ${errorText}`, response.status);
    }

    console.log('Audio uploaded successfully');
  } catch (error) {
    console.error('Upload audio error:', error);
    throw error;
  }
}

/**
 * Wait for audio transcoding to complete
 * @param {string} uploadId - Upload ID from requestAudioUploadUrl
 * @param {string} accessToken - Yoto API access token
 * @param {number} maxAttempts - Maximum polling attempts (default: 60)
 * @returns {Promise<Object>} Transcoded audio information
 */
export async function waitForTranscoding(uploadId, accessToken, maxAttempts = 60) {
  try {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(
        `${YOTO_API_BASE}/media/upload/${uploadId}/transcoded?loudnorm=false`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (data.transcode && data.transcode.transcodedSha256) {
          console.log('Transcoding complete:', data.transcode.transcodedSha256);
          return data.transcode;
        }
      }

      // Wait 1 second before next attempt
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
      
      if (attempts % 10 === 0) {
        console.log(`Waiting for transcoding... attempt ${attempts}/${maxAttempts}`);
      }
    }

    throw new Error('Transcoding timed out after ' + maxAttempts + ' attempts');
  } catch (error) {
    console.error('Transcoding wait error:', error);
    throw error;
  }
}

/**
 * Create a MYO card with uploaded audio
 * @param {Object} params
 * @param {string} params.title - Card title
 * @param {Object} params.transcodedAudio - Transcoded audio object from waitForTranscoding
 * @param {string} params.accessToken - Yoto API access token
 * @param {string} params.coverImageUrl - Optional: Cover image URL
 * @param {string} params.cardId - Optional: ID to update existing card
 * @returns {Promise<Object>} Created card information
 */
export async function createAudioCard({
  title,
  transcodedAudio,
  accessToken,
  coverImageUrl = null,
  cardId = null
}) {
  try {
    const mediaInfo = transcodedAudio.transcodedInfo;
    const chapterTitle = mediaInfo?.metadata?.title || title;

    // Build chapters with transcoded audio
    const chapters = [
      {
        key: '01',
        title: chapterTitle,
        overlayLabel: '1',
        tracks: [
          {
            key: '01',
            title: chapterTitle,
            trackUrl: `yoto:#${transcodedAudio.transcodedSha256}`,
            duration: mediaInfo?.duration,
            fileSize: mediaInfo?.fileSize,
            channels: mediaInfo?.channels,
            format: mediaInfo?.format,
            type: 'audio',
            overlayLabel: '1',
          },
        ],
      },
    ];

    // Build content object
    const content = {
      title: title,
      content: { chapters },
      metadata: {
        media: {
          duration: mediaInfo?.duration,
          fileSize: mediaInfo?.fileSize,
          readableFileSize: mediaInfo?.fileSize 
            ? Math.round((mediaInfo.fileSize / 1024 / 1024) * 10) / 10 
            : 0,
        },
      },
    };

    // Add cover image if provided
    if (coverImageUrl) {
      content.metadata.cover = {
        imageL: coverImageUrl,
      };
    }

    // Add cardId if updating existing card
    if (cardId) {
      content.cardId = cardId;
    }

    console.log('Creating MYO card:', content);

    const response = await fetch(`${YOTO_API_BASE}/content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoApiError(`Failed to create card: ${errorText}`, response.status);
    }

    const result = await response.json();
    console.log('MYO card created successfully:', result.cardId);
    
    return result;
  } catch (error) {
    console.error('Create audio card error:', error);
    throw error;
  }
}
