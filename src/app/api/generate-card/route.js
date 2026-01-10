// API Route to generate a Formula 1 card
import { getNextRace, getDriverStandings, getTeamStandings, generateF1Script } from "@/services/f1Service";

export async function POST(request) {
  try {
    // Step 1: Fetch F1 data from API
    const [raceData, driverStandings, teamStandings] = await Promise.all([
      getNextRace(),
      getDriverStandings(),
      getTeamStandings()
    ]);

    // Step 2: Generate script for text-to-speech (3 chapters)
    const script = generateF1Script(raceData, driverStandings, teamStandings);

    // Step 3: Return data (in production, you'd also generate TTS and create card)
    return Response.json({
      success: true,
      race: raceData,
      drivers: driverStandings,
      teams: teamStandings,
      script,
      message: "Formula 1 data retrieved successfully!",
    });

  } catch (error) {
    console.error("F1 card generation error:", error);
    return Response.json(
      {
        error: error.message || "Failed to generate F1 card",
      },
      { status: 500 }
    );
  }
}
