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
 * - Rate-limited API calls to respect OpenF1limits (3 req/sec)
 */

const F1_API_BASE = 'https://api.openf1.org/v1';
const CACHE_KEY = 'f1_playlist_data';

// Delay utility to respect OpenF1 API rate limit (3 requests/second)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      const playlistData = await fetchF1Data();
      
      // Store in KV storage
      await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
        expirationTtl: 86400 // 24 hours
      });
      
      console.log('Successfully updated F1 playlist data');
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
        const playlistData = await fetchF1Data();
        
        // Store for future requests
        await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
          expirationTtl: 86400 // 24 hours
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
        const playlistData = await fetchF1Data();
        
        await env.F1_DATA.put(CACHE_KEY, JSON.stringify(playlistData), {
          expirationTtl: 86400
        });
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Data refreshed successfully',
          timestamp: new Date().toISOString()
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error('Error refreshing data:', error);
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
  
  // Respect rate limit
  await delay(500);
  
  // Get sessions for this race
  const sessions = await getUpcomingSessions(raceData.meetingKey);
  
  await delay(500);
  
  // Get weather data for first session if available
  let weather = null;
  if (sessions.length > 0 && sessions[0].sessionKey) {
    weather = await getSessionWeather(sessions[0].sessionKey);
    await delay(500);
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
    const response = await fetch(
      `${F1_API_BASE}/meetings?year=${currentYear}&date_start>=${now.split('T')[0]}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch race data');
    }

    const meetings = await response.json();
    
    if (!meetings || meetings.length === 0) {
      // Try next year
      await delay(500);
      const nextYear = currentYear + 1;
      const nextYearResponse = await fetch(
        `${F1_API_BASE}/meetings?year=${nextYear}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
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
    
    const response = await fetch(
      `${F1_API_BASE}/sessions?meeting_key=${meetingKey}&date_start>=${now.split('T')[0]}`,
      { signal: AbortSignal.timeout(5000) }
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
    const response = await fetch(
      `${F1_API_BASE}/weather?session_key=${sessionKey}`,
      { signal: AbortSignal.timeout(5000) }
    );

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
