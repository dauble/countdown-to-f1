// Yoto API Service for creating MYO cards
// API Documentation: https://yoto.dev/myo/labs-tts/

const YOTO_LABS_API_BASE = "https://labs.api.yotoplay.com";
const YOTO_API_BASE = "https://api.yotoplay.com";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // ElevenLabs voice ID

/**
 * Create a text-to-speech playlist on Yoto
 * @param {Object} params
 * @param {string} params.title - Title of the card
 * @param {Array} params.chapters - Array of chapter objects with text content
 * @param {string} params.accessToken - Yoto API access token
 * @param {string} params.cardId - Optional: ID to update existing card
 * @param {string} params.voiceId - Optional: ElevenLabs voice ID
 * @returns {Promise<Object>} Job object with jobId and status
 */
export async function createTextToSpeechPlaylist({
  title,
  chapters,
  accessToken,
  cardId = null,
  voiceId = DEFAULT_VOICE_ID
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
      throw new Error(`Failed to create TTS playlist: ${errorText}`);
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
      throw new Error('Failed to check job status');
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
      throw new Error(`Failed to fetch devices: ${errorText}`);
    }

    const data = await response.json();
    console.log('Fetched devices:', data);
    
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
      throw new Error(`Failed to deploy to device ${deviceId}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Deployed to device ${deviceId}:`, result);
    
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
