// Check authentication status
import Configstore from "configstore";

const config = new Configstore("yoto-f1-card-tokens");

export async function GET() {
  try {
    const tokens = config.get("tokens");
    const isAuthenticated = !!(tokens && tokens.accessToken);
    
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
