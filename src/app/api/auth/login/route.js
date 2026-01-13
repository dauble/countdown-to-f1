// Yoto OAuth Login
export async function GET(request) {
  // Get the correct host from headers (handles proxies/load balancers)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  // Use http for localhost, https for everything else
  const protocol = request.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${protocol}://${host}`;
  
  console.log('Login - Detected base URL:', baseUrl);
  
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
