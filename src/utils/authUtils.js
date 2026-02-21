// Shared authentication and storage utilities
import Configstore from "configstore";
import path from "path";

const configPath = process.env.FLY_APP_NAME 
  ? path.join('/data', '.config-yoto-f1-card-tokens')
  : undefined; // Uses default local path

const config = new Configstore("yoto-f1-card-tokens", {}, {
  configPath
});

/**
 * Store tokens (access and refresh)
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
export function storeTokens(accessToken, refreshToken) {
  config.set("tokens", {
    accessToken,
    refreshToken,
  });
}

/**
 * Get all stored tokens
 * @returns {Object|null} Tokens object with accessToken and refreshToken
 */
export function getStoredTokens() {
  return config.get("tokens");
}

/**
 * Get stored access token
 */
export function getAccessToken() {
  const tokens = config.get("tokens");
  if (!tokens || !tokens.accessToken) {
    return null;
  }
  return tokens.accessToken;
}

/**
 * Clear all stored tokens
 */
export function clearTokens() {
  config.delete("tokens");
}

/**
 * Get stored card ID for updates
 */
export function getStoredCardId() {
  return config.get("f1CardId");
}

/**
 * Store card ID for future updates
 */
export function storeCardId(cardId) {
  if (cardId === null) {
    config.delete("f1CardId");
  } else {
    config.set("f1CardId", cardId);
  }
}

/**
 * Get stored MYO card ID
 */
export function getStoredMyoCardId() {
  return config.get("f1MyoCardId");
}

/**
 * Store MYO card ID for future updates
 */
export function storeMyoCardId(cardId) {
  if (cardId === null) {
    config.delete("f1MyoCardId");
  } else {
    config.set("f1MyoCardId", cardId);
  }
}

/**
 * Get stored playlist title
 */
export function getStoredPlaylistTitle() {
  return config.get("f1PlaylistTitle");
}

/**
 * Store playlist title for future updates
 */
export function storePlaylistTitle(title) {
  if (title === null) {
    config.delete("f1PlaylistTitle");
  } else {
    config.set("f1PlaylistTitle", title);
  }
}

/**
 * Get the last data hash that was successfully processed.
 * Used to detect whether the OpenF1 data has changed since the last TTS update.
 */
export function getStoredDataHash() {
  return config.get("f1DataHash");
}

/**
 * Store the data hash after a successful playlist update.
 * @param {string|null} hash - SHA-256 hex string, or null to clear
 */
export function storeDataHash(hash) {
  if (hash === null) {
    config.delete("f1DataHash");
  } else {
    config.set("f1DataHash", hash);
  }
}

/**
 * Refresh the access token using the stored refresh token
 * @returns {Promise<string|null>} New access token, or null if refresh failed
 */
export async function refreshAccessToken() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.refreshToken) {
    console.log('[Auth] No refresh token available');
    return null;
  }

  try {
    const response = await fetch('https://login.yotoplay.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.YOTO_CLIENT_ID,
        client_secret: process.env.YOTO_CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Auth] Token refresh failed:', response.status, errorText);
      return null;
    }

    const newTokens = await response.json();
    const usedRefreshToken = newTokens.refresh_token || tokens.refreshToken;
    if (!newTokens.refresh_token) {
      console.log('[Auth] No new refresh token returned, retaining existing refresh token');
    }
    storeTokens(newTokens.access_token, usedRefreshToken);
    console.log('[Auth] Access token refreshed successfully');
    return newTokens.access_token;
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    return null;
  }
}

/**
 * Handle authentication errors consistently
 * @param {Error} error - The error object
 * @returns {boolean} - True if it's an authentication error
 */
export function isAuthError(error) {
  return (
    error.status === 401 ||
    (error.message && typeof error.message === 'string' && 
     (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized')))
  );
}

/**
 * Create a standardized auth error response
 */
export function createAuthErrorResponse() {
  return Response.json(
    {
      error: "Authentication failed. Please reconnect with Yoto.",
      needsAuth: true,
    },
    { status: 401 }
  );
}
