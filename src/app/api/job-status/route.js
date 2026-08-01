// API Route to check TTS job status
import { checkJobStatus } from "@/services/yotoService";
import { getValidAccessToken, isAuthError, createAuthErrorResponse } from "@/utils/authUtils";

export async function GET(request) {
  try {
    // Check if user is authenticated, refreshing the token first since Yoto
    // access tokens expire daily and a stale token causes an opaque 500.
    const { accessToken, reauthRequired } = await getValidAccessToken();
    if (!accessToken) {
      if (reauthRequired) {
        return createAuthErrorResponse();
      }
      return Response.json(
        {
          error: "Not authenticated. Please connect with Yoto first.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }

    // Get jobId from query params
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return Response.json(
        {
          error: "Missing jobId parameter",
        },
        { status: 400 }
      );
    }

    // Check job status
    const jobStatus = await checkJobStatus(jobId, accessToken);

    return Response.json({
      success: true,
      job: jobStatus,
    });

  } catch (error) {
    console.error("Job status check error:", error);
    
    if (isAuthError(error)) {
      return createAuthErrorResponse();
    }
    
    return Response.json(
      {
        error: error.message || "Failed to check job status",
      },
      { status: 500 }
    );
  }
}
