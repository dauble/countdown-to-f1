// Yoto OAuth Callback
import { storeTokens, PKCE_VERIFIER_COOKIE } from "@/utils/authUtils";

function getCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

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

  // Clear the one-time PKCE verifier cookie on every outcome below
  const clearVerifierCookie = `${PKCE_VERIFIER_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${protocol === "https" ? "; Secure" : ""}`;

  if (!authCode) {
    return new Response("Missing authorization code", { status: 400 });
  }

  const codeVerifier = getCookie(request, PKCE_VERIFIER_COOKIE);
  if (!codeVerifier) {
    console.error("Auth callback error: missing PKCE code_verifier cookie (expired, or /login wasn't hit first)");
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/?error=auth_failed", baseUrl).toString(),
        "Set-Cookie": clearVerifierCookie,
      },
    });
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
          code: authCode,
          code_verifier: codeVerifier,
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

    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/", baseUrl).toString(),
        "Set-Cookie": clearVerifierCookie,
      },
    });
  } catch (error) {
    console.error("Auth callback error:", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: new URL("/?error=auth_failed", baseUrl).toString(),
        "Set-Cookie": clearVerifierCookie,
      },
    });
  }
}


