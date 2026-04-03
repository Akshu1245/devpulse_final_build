/**
 * Minimal LLM adapter used by vulnerability analysis.
 * Returns a deterministic placeholder when no provider is configured.
 */
export async function invokeLLM(..._args: any[]): Promise<{ content: string }> {
  return {
    content: JSON.stringify({
      riskAssessment: "Heuristic assessment generated because no LLM provider is configured.",
      recommendations: ["Validate authentication/authorization", "Add input validation and rate limits"],
      immediateActions: ["Patch exposed endpoint", "Enable additional logging"],
      longTermFixes: ["Add security regression tests", "Introduce periodic API threat modeling"],
      references: ["OWASP API Security Top 10"],
    }),
  };
}
