// Yoto OAuth Callback
import Configstore from "configstore";

const config = new Configstore("yoto-f1-card-tokens");

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authCode = searchParams.get("code");

  if (!authCode) {
    return new Response("Missing authorization code", { status: 400 });
  }

  try {
    const tokenResponse = await fetch(
      "https://login.yotoplay.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.YOTO_CLIENT_ID,
          client_secret: process.env.YOTO_CLIENT_SECRET,
          code: authCode,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    storeTokens(tokens.access_token, tokens.refresh_token);

    const url = new URL(request.url);
    return Response.redirect(new URL("/", url.origin));
  } catch (error) {
    console.error("Auth callback error:", error);
    const url = new URL(request.url);
    return Response.redirect(new URL("/?error=auth_failed", url.origin));
  }
}

function storeTokens(accessToken, refreshToken) {
  config.set("tokens", {
    accessToken,
    refreshToken,
  });
}

export function getStoredTokens() {
  return config.get("tokens");
}
