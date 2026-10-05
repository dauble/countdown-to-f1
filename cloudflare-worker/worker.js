/**
 * Cloudflare Worker for Yoto MYO Card Auto-Refresh
 * 
 * This worker serves as an intermediary between the Yoto MYO card and the OpenF1 API.
 * It periodically fetches fresh F1 race data and stores it in Cloudflare KV storage,
 * ensuring the MYO card always has up-to-date content.
 * 
 * Features:
 * - Scheduled daily refresh of F1 data from OpenF1 API
 * - Serves cached playlist data to Yoto MYO card requests
 * - Handles timezone conversion for race times
 * - Rate-limited API calls to respect OpenF1's Community-tier limits
 *   (up to 3 requests/second and 30 requests/minute, see
 *   https://openf1.org/#features)
 */

const F1_API_BASE = 'https://api.openf1.org/v1';
const CACHE_KEY = 'f1_playlist_data';
// OpenF1 blocks unauthenticated global access while a session is live, which can make
// fetchF1Data() fail for hours at a time on race weekends. Keep cached data around well
// past the daily refresh cadence so a live-session outage doesn't wipe out the last known
// good playlist before the next successful refresh can replace it.
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiter for OpenF1 calls, shared by every request/scheduled event
// handled within this isolate. Stays comfortably under the documented
// Community-tier ceiling (~2.5 req/sec, 28 req/min) rather than skating
// right at it, and retries once on HTTP 429 using Retry-After.
const MIN_INTERVAL_MS = 400;
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 28;

let queueTail = Promise.resolve();
const requestTimestamps = [];

function pruneWindow(now) {
  while (requestTimestamps.length && now - requestTimestamps[0] >= WINDOW_MS) {
    requestTimestamps.shift();
  }
}

async function waitForSlot() {
  const now = Date.now();
  pruneWindow(now);

  let waitMs = 0;
  const lastRequestAt = requestTimestamps[requestTimestamps.length - 1];
  if (lastRequestAt !== undefined) {
    const sinceLast = now - lastRequestAt;
    if (sinceLast < MIN_INTERVAL_MS) {
      waitMs = MIN_INTERVAL_MS - sinceLast;
    }
  }

  if (requestTimestamps.length >= WINDOW_LIMIT) {
    const windowWait = WINDOW_MS - (now - requestTimestamps[0]) + 10;
    waitMs = Math.max(waitMs, windowWait);
  }

  if (waitMs > 0) {
    await delay(waitMs);
  }

  requestTimestamps.push(Date.now());
}

/**
 * Fetch a path from the OpenF1 API, respecting the Community-tier rate
 * limits across all callers in this isolate and retrying once on HTTP 429.
 */
function openf1Fetch(path, options = {}) {
  const task = queueTail.then(async () => {
    await waitForSlot();

    const { signal: callerSignal, ...restOptions } = options;
    const doFetch = () =>
      fetch(`${F1_API_BASE}${path}`, { ...restOptions, signal: callerSignal ?? AbortSignal.timeout(5000) });

    let response = await doFetch();

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      let retryAfterMs = 2000;
      if (retryAfterHeader) {
        const seconds = parseFloat(retryAfterHeader);
        if (!isNaN(seconds)) {
          retryAfterMs = seconds * 1000;
        } else {
          const date = new Date(retryAfterHeader);
          if (!isNaN(date.getTime())) {
            retryAfterMs = Math.max(date.getTime() - Date.now(), 0);
          }
        }
      }
      console.warn(`OpenF1 rate limit hit for ${path}, retrying after ${retryAfterMs}ms`);
      await delay(Math.max(retryAfterMs, 1000));
      await waitForSlot();
      response = await doFetch();
    }

    return response;
  });

  queueTail = task.catch(() => {});
  return task;
}

/**
 * Compute a stable SHA-256 hash of the meaningful race and session fields.
 * Weather data is intentionally excluded — it is live telemetry that can
 * change frequently and does not warrant regenerating TTS audio.
 * @param {Object} race - Formatted race object
 * @param {Array}  sessions - Array of formatted session objects
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
async function computeDataHash(race, sessions) {
  const snapshot = JSON.stringify({
    meetingKey: race.meetingKey,
    name: race.name,
    officialName: race.officialName,
    location: race.location,
    country: race.country,
    circuit: race.circuit,
    circuitType: race.circuitType,
    dateStart: race.dateStart,
    dateEnd: race.dateEnd,
    year: race.year,
    sessions: sessions.map(s => ({
      sessionKey: s.sessionKey,
      sessionName: s.sessionName,
      sessionType: s.sessionType,
      dateStart: s.dateStart,
      dateEnd: s.dateEnd,
    })),
  });
  const encoded = new TextEncoder().encode(snapshot);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Main worker event handler
 */
export default {
  /**
   * Handle scheduled events (cron trigger for daily updates)
   */
  async scheduled(event, env, ctx) {
    console.log('Scheduled event triggered:', new Date().toISOString());
    
    try {
      // Fetch fresh F1 data from OpenF1 API
      const freshData = await fetchF1Data();

      // Compute a stable hash of the meaningful race/session fields. The app compares
      // this hash to decide whether TTS audio needs regenerating; it is not used to
      // decide whether KV gets refreshed.
      const newHash = await computeDataHash(freshData.race, freshData.sessions);

      // Always write the fresh payload so KV never serves stale fields (e.g. weather,
      // which is excluded from the hash). Downstream TTS regeneration is still gated
      // by dataHash in the app's refresh webhook.
      const playlistData = { ...freshData, dataHash: newHash };
      await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
        expirationTtl: CACHE_TTL_SECONDS
      });

      console.log('F1 data refreshed — KV storage updated, dataHash:', newHash);
    } catch (error) {
      console.error('Error updating F1 data:', error);
      // Don't throw - let the worker continue serving cached data
    }
  },

  /**
   * Handle fetch requests (serve latest content to MYO card)
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for cross-origin requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // Route: GET /playlist - Return cached playlist data
    if (url.pathname === '/playlist' && request.method === 'GET') {
      try {
        // Try to get cached data from KV
        const cachedData = await env.F1_DATA.get(CACHE_KEY);
        
        if (cachedData) {
          return new Response(cachedData, {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
              ...corsHeaders
            }
          });
        }
        
        // If no cached data, fetch fresh data
        console.log('No cached data found, fetching fresh data');
        const freshData = await fetchF1Data();
        const dataHash = await computeDataHash(freshData.race, freshData.sessions);
        const playlistData = { ...freshData, dataHash };
        
        // Store for future requests
        await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
          expirationTtl: CACHE_TTL_SECONDS
        });
        
        return new Response(JSON.stringify(playlistData), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error('Error serving playlist:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch playlist data',
          message: error.message 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Route: POST /refresh - Manual refresh trigger (optional)
    if (url.pathname === '/refresh' && request.method === 'POST') {
      try {
        const freshData = await fetchF1Data();
        const dataHash = await computeDataHash(freshData.race, freshData.sessions);
        const playlistData = { ...freshData, dataHash };

        await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
          expirationTtl: CACHE_TTL_SECONDS
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Data refreshed successfully',
          dataHash,
          timestamp: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error('Error refreshing data:', error);

        // OpenF1 blocks unauthenticated access while a session is live. Rather than
        // hard-failing the caller, fall back to serving the last known good data (if any)
        // so callers like the refresh webhook can keep working through the outage.
        const cachedData = await env.F1_DATA.get(CACHE_KEY);
        if (cachedData) {
          console.log('Refresh failed, serving stale cached data instead');
          return new Response(cachedData, {
            headers: {
              'Content-Type': 'application/json',
              'X-Data-Stale': 'true',
              ...corsHeaders
            }
          });
        }

        return new Response(JSON.stringify({
          error: 'Failed to refresh data',
          message: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Route: GET /health - Health check endpoint
    if (url.pathname === '/health' && request.method === 'GET') {
      const cachedData = await env.F1_DATA.get(CACHE_KEY);
      
      return new Response(JSON.stringify({
        status: 'healthy',
        hasCachedData: !!cachedData,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Default: Return 404 for unknown routes
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};

/**
 * Fetch F1 data from OpenF1 API
 */
async function fetchF1Data() {
  const currentYear = new Date().getFullYear();
  const now = new Date().toISOString();

  // Get next race
  const raceData = await getNextRace(currentYear, now);

  // Get sessions for this race
  const sessions = await getUpcomingSessions(raceData.meetingKey);

  // Get weather data for first session if available
  let weather = null;
  if (sessions.length > 0 && sessions[0].sessionKey) {
    weather = await getSessionWeather(sessions[0].sessionKey);
  }

  return {
    race: raceData,
    sessions: sessions,
    weather: weather,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get the next upcoming race
 */
async function getNextRace(currentYear, now) {
  try {
    const response = await openf1Fetch(
      `/meetings?year=${currentYear}&date_start>=${now.split('T')[0]}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch race data');
    }

    const meetings = await response.json();

    if (!meetings || meetings.length === 0) {
      // Try next year
      const nextYear = currentYear + 1;
      const nextYearResponse = await openf1Fetch(`/meetings?year=${nextYear}`);
      
      if (!nextYearResponse.ok) {
        throw new Error('No upcoming races found');
      }
      
      const nextYearMeetings = await nextYearResponse.json();
      if (!nextYearMeetings || nextYearMeetings.length === 0) {
        throw new Error('No upcoming races found');
      }
      
      return formatRaceData(nextYearMeetings[0]);
    }
    
    return formatRaceData(meetings[0]);
  } catch (error) {
    console.error('Error fetching next race:', error);
    throw error;
  }
}

/**
 * Get all upcoming sessions for a meeting
 */
async function getUpcomingSessions(meetingKey) {
  try {
    const now = new Date().toISOString();
    
    const response = await openf1Fetch(
      `/sessions?meeting_key=${meetingKey}&date_start>=${now.split('T')[0]}`
    );

    if (!response.ok) {
      console.error('Failed to fetch sessions');
      return [];
    }

    const sessions = await response.json();
    
    if (!sessions || sessions.length === 0) {
      return [];
    }
    
    return sessions
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
      .map(session => ({
        sessionName: session.session_name,
        sessionType: session.session_type,
        dateStart: session.date_start,
        dateEnd: session.date_end,
        location: session.location,
        circuitName: session.circuit_short_name,
        sessionKey: session.session_key,
      }));
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

/**
 * Get weather data for a session
 */
async function getSessionWeather(sessionKey) {
  try {
    const response = await openf1Fetch(`/weather?session_key=${sessionKey}`);

    if (!response.ok) {
      console.error('Failed to fetch weather');
      return null;
    }

    const weatherData = await response.json();
    
    if (!weatherData || weatherData.length === 0) {
      return null;
    }
    
    // Get most recent weather reading
    const latestWeather = weatherData[weatherData.length - 1];
    
    return {
      airTemperature: latestWeather.air_temperature,
      trackTemperature: latestWeather.track_temperature,
      humidity: latestWeather.humidity,
      rainfall: latestWeather.rainfall,
      windSpeed: latestWeather.wind_speed,
      windDirection: latestWeather.wind_direction,
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}

/**
 * Format race data
 */
function formatRaceData(meeting) {
  return {
    name: meeting.meeting_name || 'Formula 1 Race',
    officialName: meeting.meeting_official_name || meeting.meeting_name,
    location: meeting.location || 'Unknown Location',
    country: meeting.country_name || 'Unknown Country',
    circuit: meeting.circuit_short_name || 'Unknown Circuit',
    circuitType: meeting.circuit_type || 'Unknown',
    countryFlag: meeting.country_flag || null,
    dateStart: meeting.date_start,
    dateEnd: meeting.date_end,
    year: meeting.year,
    meetingKey: meeting.meeting_key
  };
}
