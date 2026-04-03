/**
 * LLM Cost Intelligence Service
 * =============================
 * High-performance cost tracking with thinking token detection.
 */

import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  llmCostEvents,
  budgetThresholds,
  llmThinkingAttributions,
  type LlmCostEvent,
} from "../schema";

// ─────────────────────────────────────────────────────────────────────────
// PRICING TABLE (Updated with latest prices)
// ─────────────────────────────────────────────────────────────────────────

export const PRICING_TABLE: Record<string, { input: number; output: number; thinking?: number }> = {
  // OpenAI
  "gpt-4o": { input: 0.000005, output: 0.000015 },
  "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  "gpt-4-turbo": { input: 0.00001, output: 0.00003 },
  "gpt-3.5-turbo": { input: 0.0000005, output: 0.0000015 },

  // Anthropic
  "claude-3-5-sonnet-20241022": { input: 0.000003, output: 0.000015 },
  "claude-3-5-haiku-20241022": { input: 0.0000008, output: 0.000004 },
  "claude-3-7-sonnet-20250219": { input: 0.000003, output: 0.000015, thinking: 0.000003 },
  "claude-3-opus": { input: 0.000015, output: 0.000075 },

  // Google
  "gemini-2.5-flash": { input: 0.00000015, output: 0.0000006 },
  "gemini-2.5-pro": { input: 0.00000125, output: 0.000005 },
  "gemini-1.5-pro": { input: 0.00000125, output: 0.000005 },
  "gemini-1.5-flash": { input: 0.000000075, output: 0.0000003 },

  // Reasoning Models (with thinking tokens)
  "o1": { input: 0.000015, output: 0.00006, thinking: 0.000015 },
  "o1-mini": { input: 0.000003, output: 0.000012, thinking: 0.000003 },
  "o1-preview": { input: 0.000015, output: 0.00006, thinking: 0.000015 },
  "o3-mini": { input: 0.0000011, output: 0.0000044, thinking: 0.0000011 },
};

export type TimePeriod = "day" | "week" | "month" | "all";

// ─────────────────────────────────────────────────────────────────────────
// THINKING TOKEN DETECTION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Detect thinking tokens using multiple methods:
 * 1. Direct API reporting (o1, claude-3-7-sonnet)
 * 2. Timing differential - if latency >> expected output time
 */
export function estimateThinkingTokens(
  model: string,
  reportedOutputTokens: number,
  latencyMs: number,
  usageObject?: { completion_tokens_details?: { reasoning_tokens?: number } }
): number {
  // Method 1: Direct from API
  const reported = usageObject?.completion_tokens_details?.reasoning_tokens;
  if (reported && reported > 0) return reported;

  // Method 2: Timing differential for reasoning models
  const isReasoningModel = ["o1", "o3-mini", "claude-3-7"].some((m) => model.includes(m));
  if (!isReasoningModel) return 0;

  const expectedOutputMs = reportedOutputTokens * 2; // ~2ms per output token
  const networkOverheadMs = 400;
  const excessMs = Math.max(0, latencyMs - expectedOutputMs - networkOverheadMs);

  return Math.round(excessMs); // 1ms ≈ 1 thinking token
}

// ─────────────────────────────────────────────────────────────────────────
// COST CALCULATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calculate total cost for an LLM call including thinking tokens.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number = 0
): number {
  const pricing = PRICING_TABLE[model] ?? {
    input: 0.000003,
    output: 0.000015,
  };

  return (
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    thinkingTokens * (pricing.thinking ?? pricing.output)
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TRACKING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Track an LLM cost event. Fire-and-forget for performance.
 */
export async function trackCostEvent(input: {
  workspaceId: number;
  userId?: number;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  thinkingTokens?: number;
  featureName?: string;
  statusCode?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ costUsd: number; thinkingTokens: number }> {
  const thinkingTokens = input.thinkingTokens ?? estimateThinkingTokens(
    input.model,
    input.completionTokens,
    input.latencyMs ?? 0
  );

  const costUsd = calculateCost(
    input.model,
    input.promptTokens,
    input.completionTokens,
    thinkingTokens
  );

  // Fire-and-forget: save to database without blocking
  const db = await getDb();
  if (db) {
    db.insert(llmCostEvents)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: input.provider,
        model: input.model,
        featureName: input.featureName ?? "unknown",
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.promptTokens + input.completionTokens,
        costUsd: costUsd.toFixed(8),
        statusCode: input.statusCode,
        latencyMs: input.latencyMs,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        eventTimestamp: Date.now(),
      })
      .catch((err) => console.error("[LLMTracking] Failed to save event:", err));

    // Track thinking tokens separately if significant
    if (thinkingTokens > 0) {
      db.insert(llmThinkingAttributions)
        .values({
          workspaceId: input.workspaceId,
          eventId: 0, // Will be updated after insert
          feature: input.featureName ?? "unknown",
          thinkingTokens,
          estimatedCostUsd: (thinkingTokens * (PRICING_TABLE[input.model]?.thinking ?? 0.000003)).toFixed(8),
          detectionMethod: "timing",
          timestamp: Date.now(),
        })
        .catch((err) => console.error("[LLMTracking] Failed to save thinking tokens:", err));
    }
  }

  return { costUsd, thinkingTokens };
}

// ─────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────

function getTimeRange(period: TimePeriod): { start: number; end: number } {
  const now = Date.now();
  const ranges: Record<TimePeriod, { start: number; end: number }> = {
    day: { start: now - 24 * 60 * 60 * 1000, end: now },
    week: { start: now - 7 * 24 * 60 * 60 * 1000, end: now },
    month: { start: now - 30 * 24 * 60 * 60 * 1000, end: now },
    all: { start: 0, end: now },
  };
  return ranges[period];
}

export async function getCostSummary(workspaceId: number, period: TimePeriod = "month") {
  const db = await getDb();
  if (!db) return null;

  const { start, end } = getTimeRange(period);

  const events = await db
    .select()
    .from(llmCostEvents)
    .where(
      and(
        eq(llmCostEvents.workspaceId, workspaceId),
        gte(llmCostEvents.eventTimestamp, start),
        lte(llmCostEvents.eventTimestamp, end)
      )
    );

  const totalCost = events.reduce((sum, e) => sum + parseFloat(e.costUsd as string), 0);
  const totalTokens = events.reduce((sum, e) => sum + e.totalTokens, 0);
  const avgLatency = events.length > 0
    ? events.reduce((sum, e) => sum + (e.latencyMs ?? 0), 0) / events.length
    : 0;

  return {
    totalCostUsd: parseFloat(totalCost.toFixed(8)),
    totalCostInr: parseFloat((totalCost * 83).toFixed(2)), // Approximate INR conversion
    eventCount: events.length,
    totalTokens,
    averageLatencyMs: Math.round(avgLatency),
    period,
  };
}

export async function getCostByProvider(workspaceId: number, period: TimePeriod = "month") {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = getTimeRange(period);

  const events = await db
    .select()
    .from(llmCostEvents)
    .where(
      and(
        eq(llmCostEvents.workspaceId, workspaceId),
        gte(llmCostEvents.eventTimestamp, start),
        lte(llmCostEvents.eventTimestamp, end)
      )
    );

  const byProvider: Record<string, { provider: string; totalCost: number; eventCount: number }> = {};

  for (const event of events) {
    const cost = parseFloat(event.costUsd as string);
    if (!byProvider[event.provider]) {
      byProvider[event.provider] = { provider: event.provider, totalCost: 0, eventCount: 0 };
    }
    byProvider[event.provider].totalCost += cost;
    byProvider[event.provider].eventCount += 1;
  }

  return Object.values(byProvider).sort((a, b) => b.totalCost - a.totalCost);
}

export async function getCostByModel(workspaceId: number, period: TimePeriod = "month") {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = getTimeRange(period);

  const events = await db
    .select()
    .from(llmCostEvents)
    .where(
      and(
        eq(llmCostEvents.workspaceId, workspaceId),
        gte(llmCostEvents.eventTimestamp, start),
        lte(llmCostEvents.eventTimestamp, end)
      )
    );

  const byModel: Record<string, { model: string; totalCost: number; eventCount: number }> = {};

  for (const event of events) {
    const cost = parseFloat(event.costUsd as string);
    if (!byModel[event.model]) {
      byModel[event.model] = { model: event.model, totalCost: 0, eventCount: 0 };
    }
    byModel[event.model].totalCost += cost;
    byModel[event.model].eventCount += 1;
  }

  return Object.values(byModel).sort((a, b) => b.totalCost - a.totalCost);
}

export async function getCostByFeature(workspaceId: number, period: TimePeriod = "month") {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = getTimeRange(period);

  const events = await db
    .select()
    .from(llmCostEvents)
    .where(
      and(
        eq(llmCostEvents.workspaceId, workspaceId),
        gte(llmCostEvents.eventTimestamp, start),
        lte(llmCostEvents.eventTimestamp, end)
      )
    );

  const byFeature: Record<string, { featureName: string; totalCost: number; eventCount: number }> = {};
  let grandTotal = 0;

  for (const event of events) {
    const cost = parseFloat(event.costUsd as string);
    const feature = event.featureName ?? "unknown";
    if (!byFeature[feature]) {
      byFeature[feature] = { featureName: feature, totalCost: 0, eventCount: 0 };
    }
    byFeature[feature].totalCost += cost;
    byFeature[feature].eventCount += 1;
    grandTotal += cost;
  }

  return Object.values(byFeature)
    .map((f) => ({
      ...f,
      percentOfTotal: grandTotal > 0 ? parseFloat(((f.totalCost / grandTotal) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

export async function getDailyCostTrend(workspaceId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // OPTIMIZED: Use SQL GROUP BY DATE() instead of loading all events
  const dailyAggregates = await db
    .select({
      date: sql<string>`DATE(FROM_UNIXTIME(${llmCostEvents.eventTimestamp} / 1000))`.as('date'),
      totalCost: sql<number>`COALESCE(SUM(CAST(${llmCostEvents.costUsd} AS DECIMAL(12,8))), 0)`.as('totalCost'),
    })
    .from(llmCostEvents)
    .where(
      and(
        eq(llmCostEvents.workspaceId, workspaceId),
        gte(llmCostEvents.eventTimestamp, startTime),
        lte(llmCostEvents.eventTimestamp, now)
      )
    )
    .groupBy(sql`DATE(FROM_UNIXTIME(${llmCostEvents.eventTimestamp} / 1000))`);

  // Build lookup map from aggregated results
  const byDay: Record<string, number> = {};
  for (const row of dailyAggregates) {
    if (row.date) {
      byDay[row.date] = Number(row.totalCost) || 0;
    }
  }

  // Fill in all days in range (including zero-cost days)
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now - (days - i - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    return {
      date,
      costUsd: parseFloat((byDay[date] ?? 0).toFixed(8)),
      thinkingCostUsd: 0, // Thinking costs tracked separately
    };
  });
}

export async function getThinkingTokenSummary(workspaceId: number) {
  const db = await getDb();
  if (!db) return { totalThinkingTokens: 0, totalThinkingCost: 0 };

  const results = await db
    .select()
    .from(llmThinkingAttributions)
    .where(eq(llmThinkingAttributions.workspaceId, workspaceId));

  return {
    totalThinkingTokens: results.reduce((sum, r) => sum + r.thinkingTokens, 0),
    totalThinkingCost: parseFloat(
      results.reduce((sum, r) => sum + parseFloat(r.estimatedCostUsd as string), 0).toFixed(8)
    ),
    totalThinkingCostInr: parseFloat(
      (results.reduce((sum, r) => sum + parseFloat(r.estimatedCostUsd as string), 0) * 83).toFixed(2)
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// BUDGET MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export async function getBudgetAlerts(workspaceId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  const thresholds = await db
    .select()
    .from(budgetThresholds)
    .where(eq(budgetThresholds.userId, userId));

  const now = Date.now();
  const alerts = [];

  for (const threshold of thresholds) {
    if (!threshold.alertsEnabled) continue;

    const monthlyLimit = threshold.monthlyLimitUsd ? parseFloat(threshold.monthlyLimitUsd as string) : null;
    if (!monthlyLimit) continue;

    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const conditions = [
      eq(llmCostEvents.workspaceId, workspaceId),
      gte(llmCostEvents.eventTimestamp, thirtyDaysAgo),
      ...(threshold.provider !== "all" ? [eq(llmCostEvents.provider, threshold.provider)] : []),
    ];
    const events = await db
      .select()
      .from(llmCostEvents)
      .where(and(...conditions));

    const totalCost = events.reduce((sum, e) => sum + parseFloat(e.costUsd as string), 0);
    const percentOfLimit = (totalCost / monthlyLimit) * 100;

    if (percentOfLimit >= threshold.alertAtPercent) {
      alerts.push({
        provider: threshold.provider,
        currentCost: parseFloat(totalCost.toFixed(8)),
        limit: monthlyLimit,
        percentOfLimit: Math.round(percentOfLimit),
        status: percentOfLimit >= 100 ? "exceeded" : "warning",
      });
    }
  }

  return alerts;
}

export async function setBudgetThreshold(
  workspaceId: number,
  userId: number,
  input: {
    provider?: string;
    monthlyLimitUsd?: string | null;
    alertsEnabled?: boolean;
    alertAtPercent?: number;
  }
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(budgetThresholds)
    .where(
      and(
        eq(budgetThresholds.userId, userId),
        eq(budgetThresholds.provider, input.provider ?? "all")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(budgetThresholds)
      .set({
        monthlyLimitUsd: input.monthlyLimitUsd,
        alertsEnabled: input.alertsEnabled,
        alertAtPercent: input.alertAtPercent,
      })
      .where(eq(budgetThresholds.id, existing[0].id));
    return existing[0];
  }

  const result = await db
    .insert(budgetThresholds)
    .values({
      workspaceId,
      userId,
      provider: input.provider ?? "all",
      monthlyLimitUsd: input.monthlyLimitUsd,
      alertsEnabled: input.alertsEnabled ?? true,
      alertAtPercent: input.alertAtPercent ?? 80,
    });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC REFERENCE
// ─────────────────────────────────────────────────────────────────────────

export function getPricingTable() {
  return PRICING_TABLE;
}

export function getSupportedProviders() {
  return Array.from(
    new Set(Object.keys(PRICING_TABLE).map((model) => {
      if (model.startsWith("claude")) return "anthropic";
      if (model.startsWith("gemini")) return "google";
      if (model.startsWith("o")) return "openai";
      return "openai";
    }))
  );
}
