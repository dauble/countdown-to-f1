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
 * Get stored card ID for updates
 */
export function getStoredCardId() {
  return config.get("f1CardId");
}

/**
 * Store card ID for future updates
 */
export function storeCardId(cardId) {
  config.set("f1CardId", cardId);
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
