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

    console.log("Creating Yoto TTS playlist with", chapters.length, "chapters");
    console.log("Chapters structure:", JSON.stringify(content.content.chapters, null, 2));

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
 * Convert F1 race data into Yoto chapter format with multiple chapters for each session
 * @param {Object} raceData - Race information
 * @param {Array} sessions - Array of session objects (Practice, Qualifying, Sprint, Race, etc.)
 * @param {string|null} iconMediaId - Optional custom icon media ID (from uploadCardIcon)
 * @param {Object|null} meetingDetails - Optional meeting details (country, circuit type, official name)
 * @param {Object|null} weather - Optional weather data (temperature, humidity, wind, rainfall)
 * @returns {Array} Array of chapter objects
 */
export function buildF1Chapters(raceData, sessions = [], iconMediaId = null, meetingDetails = null, weather = null) {
  const chapters = [];
  
  console.log(`Building F1 chapters with ${sessions.length} sessions, iconMediaId: ${iconMediaId || 'none'}, meeting details: ${meetingDetails ? 'yes' : 'no'}, weather: ${weather ? 'yes' : 'no'}`);
  
  // Build enhanced overview text with meeting and weather details
  let overviewText = `Hello Formula 1 fans! Let me tell you about the upcoming ${raceData.name} in the ${raceData.year} season.`;

  // Add meeting details if available
  if (meetingDetails) {
    // Use meetingName for the circuit name (better than circuitShortName)
    const circuitName = meetingDetails.meetingName || raceData.circuit;
    const location = meetingDetails.countryName || raceData.location;
    
    overviewText += `\n\nThis race weekend takes place in ${location} at ${circuitName}.`;
    
    if (meetingDetails.meetingOfficialName && meetingDetails.meetingOfficialName !== raceData.name) {
      overviewText += ` The official name of this event is the ${meetingDetails.meetingOfficialName}.`;
    }
    
    if (meetingDetails.circuitType) {
      const circuitTypeDescription = meetingDetails.circuitType === "Permanent" 
        ? "a permanent racing circuit"
        : meetingDetails.circuitType === "Temporary - Street"
        ? "a temporary street circuit"
        : meetingDetails.circuitType === "Temporary - Road"
        ? "a temporary road circuit"
        : "a racing circuit";
      
      overviewText += ` ${circuitName} is ${circuitTypeDescription}.`;
    }
  } else {
    // Fallback if no meeting details
    overviewText += `\n\nThis race weekend takes place in ${raceData.location} at ${raceData.circuit}.`;
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
  chapters.push({
    title: "Race Weekend Overview",
    icon: iconMediaId ? `yoto:#${iconMediaId}` : null,
    tracks: [
      {
        title: raceData.name,
        text: overviewText,
        icon: iconMediaId ? `yoto:#${iconMediaId}` : null,
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
