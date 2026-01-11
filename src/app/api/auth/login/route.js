// Yoto OAuth Login
export async function GET(request) {
  // Determine the base URL from the request (works in all environments)
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  
  const authUrl = "https://login.yotoplay.com/authorize";
  const params = new URLSearchParams({
    audience: "https://api.yotoplay.com",
    scope: "offline_access",
    response_type: "code",
    client_id: process.env.YOTO_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/auth/callback`,
  });
  
  return Response.redirect(`${authUrl}?${params.toString()}`);
}
