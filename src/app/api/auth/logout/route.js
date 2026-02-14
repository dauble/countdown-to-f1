// Yoto Logout
import { clearTokens, storeCardId, storeMyoCardId } from "@/utils/authUtils";

export async function POST() {
  try {
    clearTokens();
    storeCardId(null);
    storeMyoCardId(null);
    return Response.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    clearTokens();
    storeCardId(null);
    storeMyoCardId(null);
    return Response.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
