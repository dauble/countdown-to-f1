/**
 * Get a human-readable description of a circuit type
 * @param {string} circuitType - The circuit type (e.g., "Permanent", "Temporary - Street", "Temporary - Road", "Unknown")
 * @returns {string} - A description of the circuit type
 */
export function getCircuitTypeDescription(circuitType) {
  if (!circuitType || circuitType === "Unknown") {
    return null;
  }
  
  switch (circuitType) {
    case "Permanent":
      return "a permanent racing circuit";
    case "Temporary - Street":
      return "a temporary street circuit";
    case "Temporary - Road":
      return "a temporary road circuit";
    default:
      return "a racing circuit";
  }
}
