import { db } from "../db";
import { llmThinkingAttributions } from "../schema";
import { InferInsertModel } from "drizzle-orm";
import { eq, sum, desc, sql } from "drizzle-orm";

interface ThinkingCostEvent {
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  feature: string;
  workspaceId: number;
  responseTimeMs: number;
}

export const ThinkingTokenProxy = {
  attributeThinkingCost: async (event: ThinkingCostEvent & { eventId: number }): Promise<{ thinkingCostUsd: number; detectionMethod: string }> => {
    let estimatedCostUsd = 0;
    let detectionMethod: "metadata" | "timing" | "differential" = "metadata";

    if (event.model.includes("gpt-4") || event.model.includes("claude-3-opus")) {
      estimatedCostUsd = (event.inputTokens * 0.00003 + event.outputTokens * 0.00006) * 0.2; // 20% of base cost for thinking
      detectionMethod = "differential";
    } else if (event.responseTimeMs > 1000) {
      estimatedCostUsd = (event.inputTokens * 0.00001 + event.outputTokens * 0.00002) * 0.1; // 10% of base cost for longer response times
      detectionMethod = "timing";
    }

    const newAttribution: InferInsertModel<typeof llmThinkingAttributions> = {
      workspaceId: event.workspaceId,
      eventId: event.eventId,
      feature: event.feature,
      thinkingTokens: event.thinkingTokens,
      estimatedCostUsd: estimatedCostUsd,
      detectionMethod: detectionMethod,
      timestamp: Date.now(),
    };

    await db.insert(llmThinkingAttributions).values(newAttribution);

    return { thinkingCostUsd: estimatedCostUsd, detectionMethod };
  },

  // FINAL FIX 5: Replace mock with real Drizzle ORM query
  getThinkingTokenSummary: async (workspaceId: number) => {
    const result = await db
      .select({
        totalCost: sql<number>`sum(${llmThinkingAttributions.estimatedCostUsd})`,
        totalTokens: sql<number>`sum(${llmThinkingAttributions.thinkingTokens})`,
      })
      .from(llmThinkingAttributions)
      .where(eq(llmThinkingAttributions.workspaceId, workspaceId));

    const topFeatureResult = await db
      .select({ feature: llmThinkingAttributions.feature, total: sql<number>`sum(${llmThinkingAttributions.thinkingTokens})` })
      .from(llmThinkingAttributions)
      .where(eq(llmThinkingAttributions.workspaceId, workspaceId))
      .groupBy(llmThinkingAttributions.feature)
      .orderBy(desc(sql`sum(${llmThinkingAttributions.thinkingTokens})`))
      .limit(1);

    return {
      totalThinkingCost: result[0]?.totalCost || 0,
      totalThinkingTokens: result[0]?.totalTokens || 0,
      topFeature: topFeatureResult[0]?.feature || 'N/A',
    };
  },
};
