// Yoto OAuth Callback
import { storeTokens } from "@/utils/authUtils";

export async function GET(request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const authCode = searchParams.get("code");
  
  // Get the correct host from headers (handles proxies/load balancers)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  // Use http for localhost, https for everything else
  const protocol = request.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${protocol}://${host}`;
  
  console.log('Callback - Detected base URL:', baseUrl);

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
          redirect_uri: `${baseUrl}/api/auth/callback`,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    storeTokens(tokens.access_token, tokens.refresh_token);

    return Response.redirect(new URL("/", baseUrl));
  } catch (error) {
    console.error("Auth callback error:", error);
    return Response.redirect(new URL("/?error=auth_failed", baseUrl));
  }
}


