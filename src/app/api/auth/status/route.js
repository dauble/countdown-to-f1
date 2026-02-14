// Check authentication status
import { getAccessToken } from "@/utils/authUtils";

export async function GET() {
  try {
    const accessToken = getAccessToken();
    const isAuthenticated = !!accessToken;
    
    return Response.json({
      authenticated: isAuthenticated,
    });
  } catch (error) {
    console.error("Auth status check error:", error);
    return Response.json(
      {
        authenticated: false,
      },
      { status: 500 }
    );
  }
}
