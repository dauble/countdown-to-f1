// Yoto Logout
import Configstore from "configstore";

const config = new Configstore("yoto-f1-card-tokens");

export async function POST() {
  try {
    config.delete("tokens");
    config.delete("f1CardId");
    config.delete("f1MyoCardId");
    return Response.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    config.delete("tokens");
    config.delete("f1CardId");
    config.delete("f1MyoCardId");
    return Response.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
