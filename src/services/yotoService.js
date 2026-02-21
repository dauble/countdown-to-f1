// Yoto API Service for creating MYO cards
// TTS: ElevenLabs API (https://elevenlabs.io/docs/api-reference/text-to-speech) generates audio
// which is then uploaded to Yoto via the standard media upload flow, enabling in-place card updates.

import { getCircuitTypeDescription } from "@/utils/circuitUtils";

const YOTO_LABS_API_BASE = "https://labs.api.yotoplay.com";
const YOTO_API_BASE = "https://api.yotoplay.com";
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // ElevenLabs voice ID
// eleven_multilingual_v2 supports up to 5000 chars per request and high-quality output
const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";

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
      // Check if it's a permission error (some accounts don't have cover upload access)
      if (errorText.includes('not authorized') || errorText.includes('explicit deny')) {
        console.log('Note: Cover image uploads require special API permissions. Continuing without cover image.');
        return null;
      }
      throw new YotoApiError(`Failed to upload cover image: ${errorText}`, response.status);
    }

    const result = await response.json();
    
    if (!result.coverImage || !result.coverImage.mediaUrl) {
      throw new Error('Upload successful but no mediaUrl returned');
    }

    console.log('Cover image uploaded successfully:', result.coverImage.mediaId);
    
    return result.coverImage.mediaUrl;

  } catch (error) {
    // Check if it's a permission error and handle gracefully
    if (error.message?.includes('not authorized') || error.message?.includes('explicit deny')) {
      console.log('Note: Cover image uploads require special API permissions. Continuing without cover image.');
      return null;
    }
    console.error('Cover image upload error:', error);
    // Return null instead of throwing to allow card creation to continue
    return null;
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

    console.log("Creating Yoto TTS playlist with", chapters.length, "chapters");
    if (cardId) {
      console.log(`Note: Labs TTS API always creates new playlists. Will track cardId ${cardId} for reference.`);
    }
    console.log("Chapters structure:", JSON.stringify(content.content.chapters, null, 2));

    // Note: Labs TTS API does not support updating existing cards via cardId parameter.
    // It always creates a new playlist. The returned cardId will be used for future reference.
    const apiUrl = new URL(`${YOTO_LABS_API_BASE}/content/job`);
    apiUrl.searchParams.set('voiceId', voiceId);

    // Submit to Labs API
    const response = await fetch(
      apiUrl.toString(),
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
      cardId: job.cardId, // Always use the newly created cardId from the API
      status: job.status,
      progress: job.progress,
      message: 'TTS playlist job started successfully!'
    };

  } catch (error) {
    console.error("Yoto TTS playlist creation error:", error);
    throw error;
  }
}

/**
 * Generate audio from text using the ElevenLabs API directly.
 * Returns an MP3 Buffer that can be uploaded to Yoto via the standard media upload flow,
 * which allows in-place card updates (unlike the Yoto Labs TTS API which always creates
 * a new playlist).
 *
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - ElevenLabs voice ID
 * @param {string} modelId - ElevenLabs model ID (default: eleven_multilingual_v2)
 * @returns {Promise<Buffer>} MP3 audio buffer
 */
async function generateElevenLabsAudio(text, voiceId = DEFAULT_VOICE_ID, modelId = DEFAULT_ELEVENLABS_MODEL) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY environment variable is required. ' +
      'Get a free API key at https://elevenlabs.io/'
    );
  }

  const response = await fetch(
    `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new YotoApiError(`ElevenLabs TTS generation failed: ${errorText}`, response.status);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Create or update a Yoto playlist using ElevenLabs TTS + the standard Yoto audio upload flow.
 *
 * Unlike createTextToSpeechPlaylist (which uses the Yoto Labs TTS API and always creates a new
 * playlist), this function:
 *   1. Generates an MP3 for every chapter track via the ElevenLabs API.
 *   2. Uploads each MP3 to Yoto with requestAudioUploadUrl / uploadAudioFile / waitForTranscoding.
 *   3. POSTs the assembled card content to the regular Yoto content API.
 *      When cardId is supplied the existing card is updated in-place; otherwise a new card is created.
 *
 * Requires the ELEVENLABS_API_KEY environment variable.
 *
 * @param {Object} params
 * @param {string} params.title - Card/playlist title
 * @param {Array}  params.chapters - Chapter array from buildF1Chapters()
 * @param {string} params.accessToken - Yoto OAuth access token
 * @param {string} [params.cardId] - Existing card ID to update; omit to create a new card
 * @param {string} [params.voiceId] - ElevenLabs voice ID (default: DEFAULT_VOICE_ID)
 * @param {string} [params.coverImageUrl] - Cover image media URL
 * @returns {Promise<Object>} Result with cardId, status, and isUpdate flag
 */
export async function createOrUpdateTTSPlaylist({
  title,
  chapters,
  accessToken,
  cardId = null,
  voiceId = DEFAULT_VOICE_ID,
  coverImageUrl = null,
}) {
  try {
    console.log(
      `${cardId ? 'Updating' : 'Creating'} Yoto playlist via ElevenLabs TTS + audio upload.`,
      `Chapters: ${chapters.length}${cardId ? `, existing cardId: ${cardId}` : ''}`
    );

    // Build each chapter by generating audio for every track and uploading it to Yoto
    const processedChapters = [];

    for (let ci = 0; ci < chapters.length; ci++) {
      const chapter = chapters[ci];
      const processedTracks = [];

      for (let ti = 0; ti < chapter.tracks.length; ti++) {
        const track = chapter.tracks[ti];

        // 1. Generate MP3 via ElevenLabs
        console.log(`Generating audio for chapter ${ci + 1} track ${ti + 1}: "${track.title}"`);
        const audioBuffer = await generateElevenLabsAudio(
          track.text,
          track.voiceId || voiceId
        );

        // 2. Upload to Yoto and wait for transcoding
        const { uploadUrl, uploadId } = await requestAudioUploadUrl(accessToken);
        await uploadAudioFile(uploadUrl, audioBuffer, 'audio/mpeg');
        const transcodedAudio = await waitForTranscoding(uploadId, accessToken);

        const trackObj = {
          key: String(ti + 1).padStart(2, '0'),
          title: track.title,
          trackUrl: `yoto:#${transcodedAudio.transcodedSha256}`,
          duration: transcodedAudio.transcodedInfo?.duration,
          fileSize: transcodedAudio.transcodedInfo?.fileSize,
          channels: transcodedAudio.transcodedInfo?.channels,
          format: transcodedAudio.transcodedInfo?.format,
          type: 'audio',
          overlayLabel: String(ti + 1),
        };

        if (track.icon) {
          trackObj.display = { icon16x16: track.icon };
        }

        processedTracks.push(trackObj);
      }

      const chapterObj = {
        key: String(ci + 1).padStart(2, '0'),
        title: chapter.title,
        overlayLabel: String(ci + 1),
        tracks: processedTracks,
      };

      if (chapter.icon) {
        chapterObj.display = { icon16x16: chapter.icon };
      }

      processedChapters.push(chapterObj);
    }

    // Assemble card content
    const content = {
      title: title,
      content: { chapters: processedChapters },
      metadata: {
        title: title,
        description: `F1 Update - ${new Date().toLocaleDateString()}`,
      },
    };

    if (coverImageUrl) {
      content.metadata.cover = { imageL: coverImageUrl };
    }

    // Include cardId to update the existing card in-place
    if (cardId) {
      content.cardId = cardId;
    }

    // POST to the regular Yoto content API (supports in-place updates via cardId)
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
      throw new YotoApiError(`Failed to create/update playlist: ${errorText}`, response.status);
    }

    const result = await response.json();
    const resultCardId = result.cardId || cardId;

    console.log(`Playlist ${cardId ? 'updated' : 'created'} successfully, cardId: ${resultCardId}`);

    return {
      cardId: resultCardId,
      jobId: null, // No async job — audio is already uploaded and transcoded
      status: 'completed',
      isUpdate: !!cardId,
      message: cardId ? 'Playlist updated successfully!' : 'Playlist created successfully!',
    };

  } catch (error) {
    console.error('createOrUpdateTTSPlaylist error:', error);
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
 * Convert F1 race data into Yoto chapter format with multiple chapters for each session
 * @param {Object} raceData - Race information (includes country, circuit type, official name)
 * @param {Array} sessions - Array of session objects (Practice, Qualifying, Sprint, Race, etc.)
 * @param {string|null} iconMediaId - Optional custom icon media ID (from uploadCardIcon)
 * @param {Object|null} weather - Optional weather data (temperature, humidity, wind, rainfall)
 * @param {string|null} countryFlagIconId - Optional country flag icon media ID for first chapter
 * @returns {Array} Array of chapter objects
 */
export function buildF1Chapters(raceData, sessions = [], iconMediaId = null, weather = null, countryFlagIconId = null) {
  const chapters = [];
  
  console.log(`Building F1 chapters with ${sessions.length} sessions, iconMediaId: ${iconMediaId || 'none'}, weather: ${weather ? 'yes' : 'no'}, countryFlagIconId: ${countryFlagIconId || 'none'}`);
  
  // Build enhanced overview text with meeting and weather details
  let overviewText = `Hello Formula 1 fans! Let me tell you about the upcoming ${raceData.name} in the ${raceData.year} season.`;

  // Add race location and circuit details
  const location = raceData.location && raceData.country 
    ? `${raceData.location}, ${raceData.country}`
    : raceData.location || raceData.country || "an exciting location";
  
  overviewText += `\n\nThis race weekend takes place in ${location}.`;
  
  // Add circuit information with type
  const circuitTypeDescription = getCircuitTypeDescription(raceData.circuitType);
  if (circuitTypeDescription) {
    overviewText += ` The drivers will be racing at the ${raceData.circuit} circuit, which is ${circuitTypeDescription}.`;
  } else {
    overviewText += ` The drivers will be racing at the ${raceData.circuit} circuit.`;
  }
  
  // Add official name if it's more detailed
  if (raceData.officialName && raceData.officialName !== raceData.name) {
    overviewText += ` The official name of this event is the ${raceData.officialName}.`;
  }

  overviewText += `\n\nThe race is scheduled for ${raceData.date} at ${raceData.time}.`;

  // Add weather information if available
  if (weather) {
    overviewText += `\n\nLet me tell you about the weather conditions at the track.`;
    
    if (weather.airTemperature !== undefined) {
      overviewText += ` The air temperature is ${Math.round(weather.airTemperature)} degrees Celsius.`;
    }
    
    if (weather.trackTemperature !== undefined) {
      overviewText += ` The track temperature is ${Math.round(weather.trackTemperature)} degrees Celsius.`;
    }
    
    if (weather.humidity !== undefined) {
      overviewText += ` The humidity level is at ${Math.round(weather.humidity)} percent.`;
    }
    
    if (weather.windSpeed !== undefined && weather.windSpeed > 0) {
      const windDescription = weather.windSpeed < 10 
        ? "light winds of"
        : weather.windSpeed < 20
        ? "moderate winds of"
        : "strong winds of";
      overviewText += ` There are ${windDescription} ${Math.round(weather.windSpeed)} kilometers per hour.`;
    }
    
    if (weather.rainfall !== undefined && weather.rainfall > 0) {
      overviewText += ` Drivers will need to navigate wet conditions as there is rainfall at the circuit.`;
    } else if (weather.rainfall !== undefined) {
      overviewText += ` The track is dry with no rainfall, perfect for racing!`;
    }
  }

  if (sessions.length > 0) {
    overviewText += `\n\nThere are ${sessions.length} sessions scheduled for this race weekend. Listen to the following chapters to learn about each session!`;
  }
  
  // Chapter 1: Overall race weekend information with enhanced details
  // Use country flag icon for first chapter if available, otherwise use generic F1 icon
  const firstChapterIcon = countryFlagIconId || iconMediaId;
  chapters.push({
    title: "Race Weekend Overview",
    icon: firstChapterIcon ? `yoto:#${firstChapterIcon}` : null,
    tracks: [
      {
        title: raceData.name,
        text: overviewText,
        icon: firstChapterIcon ? `yoto:#${firstChapterIcon}` : null,
      }
    ]
  });
  
  // Add a chapter for each session
  sessions.forEach((session) => {
    const sessionText = generateSessionText(session, raceData);
    
    chapters.push({
      title: session.sessionName,
      icon: iconMediaId ? `yoto:#${iconMediaId}` : null,
      tracks: [
        {
          title: session.sessionName,
          text: sessionText,
          icon: iconMediaId ? `yoto:#${iconMediaId}` : null,
        }
      ]
    });
  });
  
  // If no sessions data available, fall back to simple race info
  if (chapters.length === 1) {
    chapters[0] = {
      title: "Next F1 Race",
      icon: iconMediaId ? `yoto:#${iconMediaId}` : null,
      tracks: [
        {
          title: raceData.name,
          text: `Hello Formula 1 fans! Let me tell you about the next race in the ${raceData.year} season.

The next race is the ${raceData.name}, taking place in ${raceData.location}.

The race will be held on ${raceData.date}, at ${raceData.time}.

Get ready for an exciting race at ${raceData.circuit}!`,
          icon: iconMediaId ? `yoto:#${iconMediaId}` : null,
        }
      ]
    };
  }

  console.log(`Built ${chapters.length} total chapters for F1 card`);
  return chapters;
}

/**
 * Generate descriptive text for a specific session
 * @param {Object} session - Session information
 * @param {Object} raceData - Race information
 * @returns {string} Descriptive text for the session
 */
function generateSessionText(session, raceData) {
  const sessionType = session.sessionType || session.sessionName;
  
  // Format schedule information with fallback
  const scheduleText = (session.date && session.time) 
    ? `Scheduled for ${session.date} at ${session.time}.`
    : 'Schedule to be confirmed.';
  
  // Customize text based on session type
  if (sessionType.toLowerCase().includes('practice')) {
    return `This is ${session.sessionName} for the ${raceData.name}.

${scheduleText}

Practice sessions give teams the opportunity to fine-tune their car setups and drivers to learn the track. Teams will test different tire compounds and aerodynamic configurations to find the optimal balance between speed and reliability.

Watch for lap times and listen to team radio communications as engineers gather crucial data for the rest of the weekend!`;
  }
  
  if (sessionType.toLowerCase().includes('qualifying')) {
    return `This is ${session.sessionName} for the ${raceData.name}.

${scheduleText}

Qualifying determines the starting grid for the race! The session is divided into three knockout rounds: Q1, Q2, and Q3. The slowest drivers are eliminated after Q1 and Q2, while the top 10 battle it out in Q3 for pole position.

Pole position is crucial as it gives the driver the best chance of leading into the first corner. Every hundredth of a second counts!`;
  }
  
  if (sessionType.toLowerCase().includes('sprint')) {
    return `This is ${session.sessionName} for the ${raceData.name}.

${scheduleText}

The Sprint is a shorter race format that determines part of the starting grid for the main Grand Prix. It's high-intensity racing with limited laps, so every position matters!

Drivers will be pushing flat out from the start, and with reduced strategic options compared to the main race, overtaking on track becomes even more critical. Points are awarded to the top finishers!`;
  }
  
  if (sessionType.toLowerCase().includes('race')) {
    return `This is the main ${session.sessionName} of the ${raceData.name}!

${scheduleText}

This is what it's all about! The Grand Prix will see drivers battle for maximum points over the full race distance. Strategy, tire management, and racecraft will all play crucial roles.

Watch for pit stop strategies, overtaking moves, and how drivers manage their tires over the race distance. Twenty-five points await the winner, and every position counts in the championship battle!

Lights out and away we go!`;
  }
  
  // Default text for other session types
  return `This is ${session.sessionName} for the ${raceData.name}.

${scheduleText}

This session is an important part of the ${raceData.name} weekend at ${raceData.circuit}. Teams and drivers will be working hard to prepare for the main race!`;
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

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignore errors while reading error body
        }
        const baseMessage = `Failed to get transcoding status: ${response.status} ${response.statusText}`;
        throw new Error(errorText ? `${baseMessage} - ${errorText}` : baseMessage);
      }

      const data = await response.json();
      
      if (data.transcode && data.transcode.transcodedSha256) {
        console.log('Transcoding complete:', data.transcode.transcodedSha256);
        return data.transcode;
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
          readableFileSize: typeof mediaInfo?.fileSize === 'number'
            ? Math.round((mediaInfo.fileSize / 1024 / 1024) * 10) / 10
            : undefined,
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
