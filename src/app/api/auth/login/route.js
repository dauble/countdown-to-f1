// Yoto OAuth Login
import crypto from "crypto";
import { PKCE_VERIFIER_COOKIE } from "@/utils/authUtils";

export async function GET(request) {
  // Get the correct host from headers (handles proxies/load balancers)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  // Use http for localhost, https for everything else
  const protocol = request.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${protocol}://${host}`;

  console.log('Login - Detected base URL:', baseUrl);

  // Yoto developer apps are registered as OAuth public clients — they have no
  // client secret and instead prove their identity with PKCE.
  // See https://yoto.dev/authentication/browser-auth/
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const authUrl = "https://login.yotoplay.com/authorize";
  const params = new URLSearchParams({
    audience: "https://api.yotoplay.com",
    scope: "offline_access",
    response_type: "code",
    client_id: process.env.YOTO_CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: `${baseUrl}/api/auth/callback`,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${authUrl}?${params.toString()}`,
      "Set-Cookie": `${PKCE_VERIFIER_COOKIE}=${codeVerifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${protocol === "https" ? "; Secure" : ""}`,
    },
  });
}
