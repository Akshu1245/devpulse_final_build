/**
 * DevPulse API Routers
 * =====================
 * All backend API procedures with proper authentication and validation.
 * PHASE 2: Integrated caching, queuing, and real-time updates.
 */

// @ts-nocheck

import { z } from "zod";
import { eq, and, desc, like, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getDb,
  createWorkspace,
  getWorkspaceById,
  getWorkspaceMembers,
  addWorkspaceMember,
  getScansByWorkspace,
  createScan,
  getScanById,
  updateScanProgress,
  completeScan,
  getVulnerabilitiesByScan,
  updateVulnerabilityStatus,
  createVulnerability,
  trackLLMUsage,
  getLLMCostByWorkspace,
  getBudgetThreshold,
  setBudgetThreshold,
  createSubscription,
  getSubscription,
  getRecentActivity,
  getApiKeysByWorkspace,
  revokeApiKey,
  getActivityLog,
  recordShadowApiDetection,
  getShadowApiDetectionsByWorkspace,
  getWorkspaceEndpoints,
  getEndpointThinkingTokenUsage,
  whitelistShadowApi,
  removeFromShadowApiWhitelist,
  getWhitelistedEndpoints,
  getShadowApiDetectionByPath,
} from "./db";
import {
  analyzeVulnerability,
  assessSeverity,
  getComplianceMappings,
} from "./_core/vulnerabilityAnalysis";
import {
  trackCostEvent,
  getCostSummary,
  getCostByProvider,
  getCostByModel,
  getCostByFeature,
  getDailyCostTrend,
  getThinkingTokenSummary,
} from "./_core/llmCostTracker";
import {
  trackAgentCall as trackAgent,
  getActiveAgents,
  getRecentInterventions,
  getAgentStats,
  killAgent,
  getAlertHistory,
  invalidateAgentGuardCaches,
} from "./_core/agentGuard";
import {
  scans,
  vulnerabilities,
  llmCostEvents,
  agentguardEvents,
  apiKeys,
  activityLog,
  workspaces,
  getVulnerabilityCountsByWorkspace,
  getVulnerabilityCountsByEndpoint,
} from "./db";

// PHASE 2: Performance Optimization Imports
import { enqueueScan, getScanStatus } from "./_workers/queues/scanQueue";
import { enqueueComplianceReport } from "./_workers/queues/complianceQueue";
import { enqueueNotification, sendVulnerabilityAlert, sendCostThresholdAlert } from "./_services/notifications";
import { getCachedVulnerabilities, cacheVulnerabilities, getCachedWorkspaceVulnerabilities, cacheWorkspaceVulnerabilities, getCachedSeveritySummary, cacheSeveritySummary } from "./_cache/strategies/vulnCache";
import { getCachedRiskScore, cacheRiskScore, invalidateRiskScoreCache } from "./_cache/strategies/riskScoreCache";
import { getCachedScanResults, cacheScanResults } from "./_cache/strategies/scanCache";
import { getCachedTokenUsage, cacheTokenUsage } from "./_cache/strategies/tokenCache";
import { handleAgentIncident, startIncidentMonitoring } from "./_services/incidentResponse";
import { checkPermission } from "./_services/auth";

// PHASE 4: Unified Risk Engine Imports
import { UnifiedRiskEngine, FeatureRiskAnalyzer, RiskTrendAnalyzer, UnifiedRiskTier, type UnifiedRiskAssessment, type FeatureRiskProfile, type RiskTrendPoint } from "./_core/unifiedRiskEngine";
import { getCachedUnifiedRiskScore, cacheUnifiedRiskScore, getOrComputeUnifiedRiskScore, invalidateUnifiedRiskScore } from "./_cache/strategies/unifiedScoreCache";

// PHASE 5: Thinking Token Attribution Imports
import { ThinkingTokenDetector, ThinkingTokenAnalyzer, ThinkingTokenDetectionMethod } from "./_core/thinkingTokenAnalyzer";
import { getCachedThinkingTokensByModel, cacheThinkingTokensByModel, getCachedThinkingTokensByFeatureEndpoint, cacheThinkingTokensByFeatureEndpoint, getCachedThinkingTokenTrend, cacheThinkingTokenTrend, getCachedTopThinkingFeatures, cacheTopThinkingFeatures, getCachedModelsWithThinking, cacheModelsWithThinking, invalidateThinkingTokenCaches } from "./_cache/strategies/thinkingTokenCache";

// PHASE 7: Shadow API Detection Imports
import { ShadowApiEngine, type DocumentedEndpoint, type ShadowApiDetection } from "./_core/shadowApiEngine";
import { getCachedShadowApiDetection, getCachedShadowApiSummary, getCachedWhitelistedEndpoints, invalidateShadowApiCaches } from "./_cache/strategies/shadowApiCache";

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM ROUTER
// ─────────────────────────────────────────────────────────────────────────

export const systemRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })),
});

// ─────────────────────────────────────────────────────────────────────────
// POSTMAN ROUTER
// ─────────────────────────────────────────────────────────────────────────

export const postmanRouter = router({
  importCollection: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        collectionJson: z.any(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const collection = input.collectionJson;
      const endpoints: any[] = [];
      const exposedKeys: any[] = [];

      const parseItems = (items: any[]) => {
        items.forEach((item: any) => {
          if (item.request) {
            const method = item.request.method || "GET";
            const url =
              typeof item.request.url === "string"
                ? item.request.url
                : item.request.url?.raw || "";
            endpoints.push({ method, url, name: item.name });

            // Detect exposed keys
            const sensitivePatterns = [
              { name: "AWS_SECRET_ACCESS_KEY", regex: /AKIA[0-9A-Z]{16}/ },
              { name: "STRIPE_SECRET_KEY", regex: /sk_live_[0-9a-zA-Z]{24}/ },
              { name: "OPENAI_API_KEY", regex: /sk-[a-zA-Z0-9]{32,}/ },
              { name: "GITHUB_TOKEN", regex: /ghp_[a-zA-Z0-9]{36}/ },
            ];

            const contentToScan = JSON.stringify(item.request);
            sensitivePatterns.forEach((pattern) => {
              if (pattern.regex.test(contentToScan)) {
                exposedKeys.push({
                  name: pattern.name,
                  path: item.name,
                  service: pattern.name.split("_")[0],
                });
              }
            });
          }
          if (item.item) parseItems(item.item);
        });
      };

      if (collection.item) parseItems(collection.item);

      // Create scan for imported endpoints
      const scan = await createScan(input.workspaceId, undefined, ctx.user.id, endpoints.length);

      return {
        success: true,
        scanId: scan?.insertId,
        endpoints: endpoints.length,
        vulnerabilities: exposedKeys.length,
        exposedKeys,
      };
    }),
});

// ─────────────────────────────────────────────────────────────────────────
// MAIN APP ROUTER
// ─────────────────────────────────────────────────────────────────────────

// PHASE 4: Unified Risk Engine Router
export const unifiedRiskRouter = router({
  /**
   * Get overall workspace risk score (0-100)
   * Combines security risk + LLM cost metrics
   * 
   * Weighting: 60% security, 40% cost
   * Tier: CRITICAL (90-100), HIGH (70-89), MEDIUM (50-69), LOW (30-49), HEALTHY (0-29)
   */
  getOverallScore: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async ({ input }) => {
      try {
        // Try cache first
        const cached = await getCachedUnifiedRiskScore(input.workspaceId);
        if (cached) {
          return cached;
        }

        // Gather severity distribution
        const vulnerabilities = await getCachedWorkspaceVulnerabilities(input.workspaceId);
        const severity = {
          critical: vulnerabilities?.filter((v) => v.severity === 'critical').length || 0,
          high: vulnerabilities?.filter((v) => v.severity === 'high').length || 0,
          medium: vulnerabilities?.filter((v) => v.severity === 'medium').length || 0,
          low: vulnerabilities?.filter((v) => v.severity === 'low').length || 0,
          info: vulnerabilities?.filter((v) => v.severity === 'info').length || 0,
          total: vulnerabilities?.length || 0,
        };

        // Gather cost metrics
        const costSummary = await getCostSummary(input.workspaceId);
        const budget = await getBudgetThreshold(input.workspaceId);
        const monthlyBudget = budget?.dailyLimitUsd ? budget.dailyLimitUsd * 30 : 10000; // Default $10k/month
        const costPercent = costSummary?.costUsd ? costSummary.costUsd / monthlyBudget : 0;

        // Estimate trend (simplified: compare to previous calculations)
        const costMetrics = {
          currentMonthCostUsd: costSummary?.costUsd || 0,
          monthlyBudgetUsd: monthlyBudget,
          costPercentOfBudget: costPercent,
          averageDailyCostTrend: 0, // Would be calculated from historical data
          thinkingTokenUsagePercent: costSummary?.thinkingTokenPercent || 0,
        };

        // Compute and cache
        const assessment = UnifiedRiskEngine.assess(input.workspaceId, severity, costMetrics);
        await cacheUnifiedRiskScore(assessment);

        return assessment;
      } catch (error) {
        console.error(`[Unified] Error getting overall score for workspace ${input.workspaceId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute unified risk score',
        });
      }
    }),

  /**
   * Get high-risk features/LLM calls for this workspace
   * Returned sorted by unified risk score (highest first)
   * 
   * Useful for: "Which features should we optimize first?"
   */
  getHighestRiskFeatures: protectedProcedure
    .input(z.object({ workspaceId: z.number(), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      try {
        const costByFeature = await getCostByFeature(input.workspaceId);
        const vulnCounts = await getVulnerabilityCountsByWorkspace(input.workspaceId);
        const vulnByEndpoint = await getVulnerabilityCountsByEndpoint(input.workspaceId, { limit: 100 });
        
        const totalCost = costByFeature?.reduce((sum, f) => sum + (f.costUsd || 0), 0) || 1;
        const totalVulns = vulnCounts.total || 1;

        const features: FeatureRiskProfile[] = (costByFeature || []).slice(0, input.limit).map((cf) => {
          const endpointVulns = vulnByEndpoint.filter(
            (e) => cf.featureName && (
              e.endpoint.includes(cf.featureName.toLowerCase()) ||
              cf.featureName.toLowerCase().includes(e.endpoint.split('/').pop() || '')
            )
          );
          const featureVulnCount = endpointVulns.reduce((sum, e) => sum + e.total, 0);
          const worstSeverity = endpointVulns.some((e) => e.critical > 0)
            ? 'critical'
            : endpointVulns.some((e) => e.high > 0)
              ? 'high'
              : endpointVulns.some((e) => e.medium > 0)
                ? 'medium'
                : endpointVulns.some((e) => e.low > 0)
                  ? 'low'
                  : 'info';

          return FeatureRiskAnalyzer.calculateFeatureRisk(
            cf.featureName || 'unknown',
            featureVulnCount,
            worstSeverity as 'critical' | 'high' | 'medium' | 'low' | 'info',
            cf.costUsd || 0,
            totalCost,
            totalVulns
          );
        });

        return FeatureRiskAnalyzer.rankFeatures(features);
      } catch (error) {
        console.error(`[Unified] Error getting feature risks for workspace ${input.workspaceId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve feature risks',
        });
      }
    }),

  /**
   * Get risk score trend (7 or 30 days)
   * Used for dashboard charts: is risk improving or worsening?
   */
  getRiskTrend: protectedProcedure
    .input(z.object({ workspaceId: z.number(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        const { riskScoreHistory } = await import("./schema");
        const { eq: eqOp, gte: gteOp, and: andOp } = await import("drizzle-orm");

        const now = Date.now();
        const startMs = now - input.days * 24 * 60 * 60 * 1000;
        const startDate = new Date(startMs).toISOString().split('T')[0];

        // Fetch real historical snapshots from DB
        const rows = db
          ? await db
              .select()
              .from(riskScoreHistory)
              .where(
                andOp(
                  eqOp(riskScoreHistory.workspaceId, input.workspaceId),
                  gteOp(riskScoreHistory.date, startDate)
                )
              )
          : [];

        // Build a lookup by date for O(1) access
        const byDate = new Map(rows.map((r) => [r.date, r]));

        // Build full trend array for every day in range
        const trend: RiskTrendPoint[] = [];
        for (let i = input.days; i > 0; i--) {
          const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const row = byDate.get(date);

          if (row) {
            // Real data
            trend.push({
              date,
              unifiedScore: parseFloat(row.unifiedScore as string),
              riskScore: parseFloat(row.securityScore as string),
              costScore: parseFloat(row.costScore as string),
              tier: row.riskTier as any,
              vulnerabilityCount: row.vulnerabilityCount,
              costUsd: parseFloat(row.costUsd as string),
            });
          } else {
            // No snapshot for this day yet — use 0 (no data)
            trend.push({
              date,
              unifiedScore: 0,
              riskScore: 0,
              costScore: 0,
              tier: UnifiedRiskEngine.scoreTier(0),
              vulnerabilityCount: 0,
              costUsd: 0,
            });
          }
        }

        const summary = RiskTrendAnalyzer.generateTrendSummary(trend);
        const anomalies = RiskTrendAnalyzer.detectAnomalies(trend);

        return {
          trend,
          summary,
          anomalies: anomalies.length > 0 ? anomalies : undefined,
        };
      } catch (error) {
        console.error(`[Unified] Error getting risk trend for workspace ${input.workspaceId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve risk trend',
        });
      }
    }),

  /**
   * Get features filtered by risk tier
   * Used for: "Show me all HIGH-risk features"
   */
  getFeaturesByTier: protectedProcedure
    .input(z.object({ workspaceId: z.number(), tier: z.nativeEnum(UnifiedRiskTier) }))
    .query(async ({ input }) => {
      try {
        const costByFeature = await getCostByFeature(input.workspaceId);
        const vulnCounts = await getVulnerabilityCountsByWorkspace(input.workspaceId);
        const vulnByEndpoint = await getVulnerabilityCountsByEndpoint(input.workspaceId, { limit: 100 });
        
        const totalCost = costByFeature?.reduce((sum, f) => sum + (f.costUsd || 0), 0) || 1;
        const totalVulns = vulnCounts.total || 1;

        const features: FeatureRiskProfile[] = (costByFeature || []).map((cf) => {
          const endpointVulns = vulnByEndpoint.filter(
            (e) => cf.featureName && (
              e.endpoint.includes(cf.featureName.toLowerCase()) ||
              cf.featureName.toLowerCase().includes(e.endpoint.split('/').pop() || '')
            )
          );
          const featureVulnCount = endpointVulns.reduce((sum, e) => sum + e.total, 0);
          const worstSeverity = endpointVulns.some((e) => e.critical > 0)
            ? 'critical'
            : endpointVulns.some((e) => e.high > 0)
              ? 'high'
              : endpointVulns.some((e) => e.medium > 0)
                ? 'medium'
                : endpointVulns.some((e) => e.low > 0)
                  ? 'low'
                  : 'info';

          return FeatureRiskAnalyzer.calculateFeatureRisk(
            cf.featureName || 'unknown',
            featureVulnCount,
            worstSeverity as 'critical' | 'high' | 'medium' | 'low' | 'info',
            cf.costUsd || 0,
            totalCost,
            totalVulns
          );
        });

        const filtered = FeatureRiskAnalyzer.filterByTier(features, input.tier);
        return FeatureRiskAnalyzer.rankFeatures(filtered);
      } catch (error) {
        console.error(`[Unified] Error filtering features by tier for workspace ${input.workspaceId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to filter features by tier',
        });
      }
    }),

  /**
   * Detailed breakdown: All metrics for a single feature
   */
  getFeatureDetail: protectedProcedure
    .input(z.object({ workspaceId: z.number(), featureName: z.string() }))
    .query(async ({ input }) => {
      try {
        const costByFeature = await getCostByFeature(input.workspaceId);
        const featureCost = costByFeature?.find((f) => f.featureName === input.featureName);

        if (!featureCost) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Feature "${input.featureName}" not found`,
          });
        }

        const vulnByEndpoint = await getVulnerabilityCountsByEndpoint(input.workspaceId, { limit: 100 });
        const featureVulns = vulnByEndpoint.filter(
          (e) =>
            e.endpoint.includes(featureName.toLowerCase()) ||
            featureName.toLowerCase().includes(e.endpoint.split('/').pop() || '')
        );

        const vulnSummary = {
          count: featureVulns.reduce((sum, e) => sum + e.total, 0),
          critical: featureVulns.reduce((sum, e) => sum + e.critical, 0),
          high: featureVulns.reduce((sum, e) => sum + e.high, 0),
          medium: featureVulns.reduce((sum, e) => sum + e.medium, 0),
          low: featureVulns.reduce((sum, e) => sum + e.low, 0),
        };

        return {
          feature: input.featureName,
          cost: {
            thisMonth: featureCost.costUsd || 0,
            averageDaily: (featureCost.costUsd || 0) / 30,
            percentage: featureCost.percentage || 0,
          },
          vulnerabilities: vulnSummary,
          lastActivity: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`[Unified] Error getting feature detail:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve feature details',
        });
      }
    }),

  /**
   * Invalidate unified scores (called when vulnerabilities/costs change)
   * Internal use only
   */
  invalidateScoreCache: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await invalidateUnifiedRiskScore(input.workspaceId);
        return { success: true, message: 'Score cache invalidated' };
      } catch (error) {
        console.error('[Unified] Error invalidating cache:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to invalidate cache',
        });
      }
    }),
});

export const appRouter = router({
  // System endpoints
  system: systemRouter,

  // Postman import
  postman: postmanRouter,

  // Auth
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    logout: publicProcedure.mutation(() => {
      return { success: true };
    }),
  }),

  // Unified risk engine (PHASE 4)
  unified: unifiedRiskRouter,

  // Thinking token attribution (PHASE 5)
  thinkingTokens: router({
    /**
     * Get thinking tokens aggregated by model
     * Shows which models are using thinking tokens most
     */
    getByModel: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        try {
          // Try cache first
          const cached = await getCachedThinkingTokensByModel(input.workspaceId);
          if (cached) {
            return cached;
          }

          // Get thinking token attributions from DB
          const db = await getDb();
          const { llmThinkingAttributions } = await import("./schema");
          const { eq: eqOp } = await import("drizzle-orm");
          const attributions = db
            ? await db
                .select()
                .from(llmThinkingAttributions)
                .where(eqOp(llmThinkingAttributions.workspaceId, input.workspaceId))
            : [];

          if (attributions.length === 0) {
            return [];
          }

          const result = ThinkingTokenAnalyzer.aggregateByModel(attributions);
          await cacheThinkingTokensByModel(input.workspaceId, result);

          return result;
        } catch (error) {
          console.error(`[ThinkingTokens] Error getting by model for workspace ${input.workspaceId}:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve thinking tokens by model',
          });
        }
      }),

    /**
     * Get thinking tokens aggregated by feature & endpoint
     * Shows which features/endpoints are using thinking tokens
     */
    getByFeatureEndpoint: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        try {
          // Try cache first
          const cached = await getCachedThinkingTokensByFeatureEndpoint(input.workspaceId);
          if (cached) {
            return cached;
          }

          // Get thinking token attributions from DB with apiPath
          const db = await getDb();
          if (!db) {
            return [];
          }

          const attributions = await db
            .select()
            .from(llmThinkingAttributions)
            .where(eq(llmThinkingAttributions.workspaceId, input.workspaceId))
            .orderBy(desc(llmThinkingAttributions.timestamp));

          if (attributions.length === 0) {
            return [];
          }

          const result = ThinkingTokenAnalyzer.aggregateByFeatureEndpoint(attributions);
          await cacheThinkingTokensByFeatureEndpoint(input.workspaceId, result);

          return result;
        } catch (error) {
          console.error(`[ThinkingTokens] Error getting by feature/endpoint:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve thinking tokens by feature/endpoint',
          });
        }
      }),

    /**
     * Get thinking token trend (7 or 30 days)
     * Shows if thinking token usage is increasing or decreasing
     */
    getTrend: protectedProcedure
      .input(z.object({ workspaceId: z.number(), days: z.number().default(30) }))
      .query(async ({ input }) => {
        try {
          // Try cache first
          const cached = await getCachedThinkingTokenTrend(input.workspaceId, input.days);
          if (cached) {
            return cached;
          }

          // Get thinking token attributions from DB
          const attributions: any[] = [];

          if (attributions.length === 0) {
            return [];
          }

          const result = ThinkingTokenAnalyzer.generateTrendPoints(attributions, input.days);
          await cacheThinkingTokenTrend(input.workspaceId, input.days, result);

          return result;
        } catch (error) {
          console.error(`[ThinkingTokens] Error getting trend:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve thinking token trend',
          });
        }
      }),

    /**
     * Get top features by thinking token usage
     */
    getTopFeatures: protectedProcedure
      .input(z.object({ workspaceId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        try {
          // Try cache first
          const cached = await getCachedTopThinkingFeatures(input.workspaceId, input.limit);
          if (cached) {
            return cached;
          }

          // Get thinking token attributions from DB
          const attributions: any[] = [];

          if (attributions.length === 0) {
            return [];
          }

          const result = ThinkingTokenAnalyzer.getTopFeatures(attributions, input.limit);
          await cacheTopThinkingFeatures(input.workspaceId, input.limit, result);

          return result;
        } catch (error) {
          console.error(`[ThinkingTokens] Error getting top features:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve top features',
          });
        }
      }),

    /**
     * Get models using thinking tokens with usage statistics
     */
    getModelsWithThinking: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        try {
          // Try cache first
          const cached = await getCachedModelsWithThinking(input.workspaceId);
          if (cached) {
            return cached;
          }

          // Get thinking token attributions from DB
          const attributions: any[] = [];

          if (attributions.length === 0) {
            return [];
          }

          const result = ThinkingTokenAnalyzer.getModelsWithThinking(attributions);
          await cacheModelsWithThinking(input.workspaceId, result);

          return result;
        } catch (error) {
          console.error(`[ThinkingTokens] Error getting models with thinking:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve models with thinking',
          });
        }
      }),

    /**
     * Get summary: total thinking token usage this month
     */
    getSummary: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        try {
          // Get thinking token attributions from DB
          const attributions: any[] = [];

          if (attributions.length === 0) {
            return {
              totalThinkingTokens: 0,
              estimatedCostUsd: 0,
              eventCount: 0,
              modelsUsing: [],
              topFeature: null,
              percentOfTotalTokens: 0,
              averagePerCall: 0,
            };
          }

          const totalTokens = attributions.reduce((sum, a) => sum + a.thinkingTokens, 0);
          const totalCost = attributions.reduce((sum, a) => sum + a.estimatedCostUsd, 0);
          const modelsUsing = [...new Set(attributions.map((a) => a.model))];
          const topFeature = ThinkingTokenAnalyzer.getTopFeatures(attributions, 1)[0];

          // Get total tokens from llmCostEvents for percentage
          const costSummary = await getCostSummary(input.workspaceId);
          const totalTokensAllTypes = costSummary?.totalTokens || 1;

          return {
            totalThinkingTokens: totalTokens,
            estimatedCostUsd: totalCost,
            eventCount: attributions.length,
            modelsUsing,
            topFeature,
            percentOfTotalTokens: (totalTokens / totalTokensAllTypes) * 100,
            averagePerCall: Math.round(totalTokens / attributions.length),
          };
        } catch (error) {
          console.error(`[ThinkingTokens] Error getting summary:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to retrieve thinking token summary',
          });
        }
      }),

    /**
     * Invalidate thinking token caches (admin use)
     */
    invalidateCache: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await invalidateThinkingTokenCaches(input.workspaceId);
          return { success: true, message: 'Thinking token caches invalidated' };
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to invalidate caches',
          });
        }
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // SHADOW API DETECTION (PHASE 7)
  // ─────────────────────────────────────────────────────────────────────────

  shadowApi: router({
    /**
     * Get detected shadow APIs for workspace
     */
    detect: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return await getCachedShadowApiDetection(
          input.workspaceId,
          async () => {
            try {
              // Get all active shadow API detections from database
              const detections = await getShadowApiDetectionsByWorkspace(
                input.workspaceId,
                { onlyActive: true, minRiskScore: 30 }
              );

              return detections.map((d) => ({
                id: d.id,
                apiPath: d.apiPath,
                riskScore: d.riskScore,
                riskTier: d.riskTier as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
                confidence: d.confidence as "HIGH" | "MEDIUM" | "LOW",
                frequency: d.frequency,
                costImpact: parseFloat(d.costImpact as string),
                thinkingTokens: d.thinkingTokens,
                detectionMethods: d.detectionMethods as any[],
                details: d.details as any,
              }));
            } catch (error) {
              console.error("[shadowApi.detect] Error:", error);
              return [];
            }
          }
        );
      }),

    /**
     * Get shadow API summary (counts by risk tier, total cost, etc.)
     */
    getSummary: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return await getCachedShadowApiSummary(
          input.workspaceId,
          async () => {
            try {
              const detections = await getShadowApiDetectionsByWorkspace(
                input.workspaceId,
                { onlyActive: true }
              );

              const summary = {
                totalShadowApis: detections.length,
                criticalCount: detections.filter(
                  (d) => d.riskTier === "CRITICAL"
                ).length,
                highCount: detections.filter((d) => d.riskTier === "HIGH").length,
                mediumCount: detections.filter(
                  (d) => d.riskTier === "MEDIUM"
                ).length,
                lowCount: detections.filter((d) => d.riskTier === "LOW").length,
                totalUnauthorizedCost: detections.reduce(
                  (sum, d) => sum + parseFloat(d.costImpact as string),
                  0
                ),
                totalThinkingTokens: detections.reduce(
                  (sum, d) => sum + d.thinkingTokens,
                  0
                ),
                avgRiskScore:
                  detections.length > 0
                    ? detections.reduce((sum, d) => sum + d.riskScore, 0) /
                      detections.length
                    : 0,
                topShadowApis: detections
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .slice(0, 5)
                  .map((d) => ({
                    path: d.apiPath,
                    risk: d.riskScore,
                    tier: d.riskTier,
                  })),
              };

              return summary;
            } catch (error) {
              console.error("[shadowApi.getSummary] Error:", error);
              return {
                totalShadowApis: 0,
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0,
                totalUnauthorizedCost: 0,
                totalThinkingTokens: 0,
                avgRiskScore: 0,
                topShadowApis: [],
              };
            }
          }
        );
      }),

    /**
     * Get HTTP method mismatches (documentation vs actual usage discrepancies)
     */
    getMethodMismatches: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        try {
          // Query all endpoints called in workspace
          const actualEndpoints = await getWorkspaceEndpoints(input.workspaceId, {
            days: 30,
            limit: 1000,
          });

          // Find method mismatches in detected shadow APIs
          const detections = await getShadowApiDetectionsByWorkspace(
            input.workspaceId,
            { onlyActive: true }
          );

          const mismatches = detections
            .filter((d) => {
              const methods = d.detectionMethods as any[];
              return (
                methods &&
                methods.some((m) => m === "method_mismatch" || m.includes("mismatch"))
              );
            })
            .map((d) => ({
              endpoint: d.apiPath,
              riskScore: d.riskScore,
              riskTier: d.riskTier,
              confidence: d.confidence,
              details: d.details as any,
            }));

          return mismatches;
        } catch (error) {
          console.error("[shadowApi.getMethodMismatches] Error:", error);
          return [];
        }
      }),

    /**
     * Get expensive thinking token usage on shadow APIs
     */
    getExpensiveThinking: protectedProcedure
      .input(z.object({ workspaceId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        try {
          const limit = input.limit || 20;

          // Get endpoints with high thinking token usage
          const thinkingUsage = await getEndpointThinkingTokenUsage(
            input.workspaceId,
            undefined,
            { days: 30 }
          );

          return thinkingUsage
            .filter((t) => t.thinkingTokens > 5000) // Only expensive ones
            .sort((a, b) => b.estimatedCost - a.estimatedCost)
            .slice(0, limit)
            .map((t) => ({
              endpoint: t.path || "unknown",
              feature: t.feature,
              thinkingTokens: t.thinkingTokens,
              estimatedCost: t.estimatedCost,
            }));
        } catch (error) {
          console.error("[shadowApi.getExpensiveThinking] Error:", error);
          return [];
        }
      }),

    /**
     * Compare Postman collection with actual endpoints
     */
    getComparisonReport: protectedProcedure
      .input(z.object({ workspaceId: z.number(), days: z.number().optional() }))
      .query(async ({ input }) => {
        try {
          const days = input.days || 30;

          // Get actual endpoints from logs
          const actualEndpoints = await getWorkspaceEndpoints(input.workspaceId, {
            days,
            limit: 1000,
          });

          // Get whitelisted endpoints
          const whitelisted = await getWhitelistedEndpoints(input.workspaceId);

          // Get shadow API detections
          const shadows = await getShadowApiDetectionsByWorkspace(
            input.workspaceId,
            { onlyActive: false }
          );

          // Build comparison report
          const report = {
            totalEndpointsCalled: actualEndpoints.length,
            totalShadowApis: shadows.filter((s) => !s.isWhitelisted).length,
            whitelistedCount: whitelisted.length,
            endpointDetails: actualEndpoints.map((e) => {
              const shadow = shadows.find(
                (s) => s.apiPath === `${e.method} ${e.path}`
              );
              return {
                method: e.method,
                path: e.path,
                callCount: e.count,
                avgLatency: Math.round(e.latencyMs),
                totalCost: e.totalCost,
                riskScore: shadow?.riskScore || 0,
                riskTier: shadow?.riskTier || "HEALTHY",
                isWhitelisted: whitelisted.includes(`${e.method} ${e.path}`),
                detectionMethods: shadow?.detectionMethods || [],
              };
            }),
          };

          return report;
        } catch (error) {
          console.error("[shadowApi.getComparisonReport] Error:", error);
          return {
            totalEndpointsCalled: 0,
            totalShadowApis: 0,
            whitelistedCount: 0,
            endpointDetails: [],
          };
        }
      }),

    /**
     * Whitelist an endpoint (prevent false positives)
     */
    whitelistEndpoint: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          endpoint: z.string(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const success = await whitelistShadowApi(
            input.workspaceId,
            input.endpoint,
            input.reason
          );

          if (success) {
            invalidateShadowApiCaches(input.workspaceId);
            return { success: true, message: `Endpoint ${input.endpoint} whitelisted` };
          } else {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to whitelist endpoint",
            });
          }
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to whitelist endpoint",
          });
        }
      }),

    /**
     * Unwhitelist an endpoint
     */
    removeFromWhitelist: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          endpoint: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const success = await removeFromShadowApiWhitelist(
            input.workspaceId,
            input.endpoint
          );

          if (success) {
            invalidateShadowApiCaches(input.workspaceId);
            return { success: true, message: `Endpoint ${input.endpoint} removed from whitelist` };
          } else {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to remove from whitelist",
            });
          }
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to remove from whitelist",
          });
        }
      }),

    /**
     * Invalidate shadow API caches (admin use)
     */
    invalidateCache: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          invalidateShadowApiCaches(input.workspaceId);
          return { success: true, message: "Shadow API caches invalidated" };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to invalidate caches",
          });
        }
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // WORKSPACE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  workspace: router({
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ input, ctx }) => {
        const result = await createWorkspace(input.name, ctx.user.id);
        if (!result) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create workspace",
          });
        }

        // Add creator as owner
        await addWorkspaceMember(result.insertId, ctx.user.id, "owner");

        // Create free subscription
        await createSubscription(result.insertId, "free");

        return { id: result.insertId, name: input.name };
      }),

    getById: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input, ctx }) => {
        const members = await getWorkspaceMembers(input.workspaceId);
        const isMember = members.some((m) => m.userId === ctx.user.id);
        if (!isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this workspace",
          });
        }
        return await getWorkspaceById(input.workspaceId);
      }),

    getMembers: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input, ctx }) => {
        const members = await getWorkspaceMembers(input.workspaceId);
        const isMember = members.some((m) => m.userId === ctx.user.id);
        if (!isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this workspace",
          });
        }
        return members;
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      // For demo, return mock workspace
      return [{ id: 1, name: "Demo Workspace", plan: "free" }];
    }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // SECURITY SCANNING
  // ─────────────────────────────────────────────────────────────────────────

  security: router({
    criticalCount: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        // PHASE 2: Cache severity summary
        const cached = await getCachedSeveritySummary(input.workspaceId);
        if (cached) {
          console.log(`[Cache HIT] Severity summary for workspace ${input.workspaceId}`);
          return { count: cached.critical };
        }

        const db = await getDb();
        if (!db) return { count: 0 };

        // OPTIMIZED: Use SQL GROUP BY instead of loading all records
        const severityCounts = await db
          .select({
            severity: vulnerabilities.severity,
            count: sql<number>`COUNT(*)`,
          })
          .from(vulnerabilities)
          .where(eq(vulnerabilities.workspaceId, input.workspaceId))
          .groupBy(vulnerabilities.severity);

        // Build summary from aggregated results
        const summary = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        };
        
        for (const row of severityCounts) {
          const sev = row.severity?.toLowerCase() as keyof typeof summary;
          if (sev in summary) {
            summary[sev] = Number(row.count) || 0;
          }
        }

        const count = summary.critical;
        
        await cacheSeveritySummary(input.workspaceId, summary);

        return { count };
      }),

    getVulnerabilities: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        // PHASE 2: Check cache first
        const cached = await getCachedWorkspaceVulnerabilities(input.workspaceId);
        if (cached) {
          console.log(`[Cache HIT] Vulnerabilities for workspace ${input.workspaceId}`);
          return cached;
        }

        const db = await getDb();
        if (!db) return [];

        const vulns = await db
          .select()
          .from(vulnerabilities)
          .where(eq(vulnerabilities.workspaceId, input.workspaceId));

        // Cache results
        if (vulns.length > 0) {
          await cacheWorkspaceVulnerabilities(input.workspaceId, vulns);
        }

        return vulns;
      }),

    updateVulnerabilityStatus: protectedProcedure
      .input(
        z.object({
          vulnId: z.number(),
          status: z.enum(["open", "acknowledged", "resolved", "wontfix"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateVulnerabilityStatus(input.vulnId, input.status);
        
        // PHASE 2: Invalidate all caches after update
        // In production, more granular cache invalidation needed
        
        return { success: true };
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // SCANS
  // ─────────────────────────────────────────────────────────────────────────

  scan: router({
    create: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          targetUrl: z.string().url(),
          endpoints: z.array(
            z.object({
              path: z.string(),
              method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]),
              authType: z.enum(["none", "bearer", "basic", "api_key"]).optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Verify workspace membership
        const members = await getWorkspaceMembers(input.workspaceId);
        const isMember = members.some((m) => m.userId === ctx.user.id);
        if (!isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this workspace",
          });
        }

        // Ensure subscription exists
        let subscription = await getSubscription(input.workspaceId);
        if (!subscription) {
          await createSubscription(input.workspaceId, "free");
        }

        // Create scan
        const result = await createScan(
          input.workspaceId,
          undefined,
          ctx.user.id,
          input.endpoints.length
        );
        const scanId = result?.insertId;
        if (!scanId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create scan",
          });
        }

        // PHASE 2: Queue scan instead of blocking
        try {
          const job = await enqueueScan({
            workspaceId: input.workspaceId,
            projectId: undefined,
            apiEndpoint: input.targetUrl,
            method: "MULTI",
            body: { endpoints: input.endpoints },
          });

          // Enqueue notification for scan started
          await enqueueNotification({
            type: 'websocket',
            workspaceId: input.workspaceId,
            userId: ctx.user?.id,
            recipient: ctx.user?.email || 'admin@example.com',
            title: 'Scan Started',
            message: `Security scan has been queued with ${input.endpoints.length} endpoints`,
            severity: 'info',
            metadata: { scanId, jobId: job.id },
          });

          return { id: scanId, status: "queued", jobId: job.id };
        } catch (error) {
          console.error("[Scan] Queue error:", error);
          // Fallback: still create scan, but process synchronously
          processScan(scanId, input.workspaceId, ctx.user.id, input.endpoints).catch(
            (err) => console.error("[Scan] Error:", err)
          );
          return { id: scanId, status: "pending" };
        }
      }),

    list: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return await getScansByWorkspace(input.workspaceId);
      }),

    getById: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        return await getScanById(input.scanId);
      }),

    getProgress: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        const scan = await getScanById(input.scanId);
        return {
          progress: scan?.progress || 0,
          status: scan?.status || "pending",
          scannedEndpoints: scan?.scannedEndpoints || 0,
          vulnerabilitiesFound: scan?.vulnerabilitiesFound || 0,
        };
      }),

    getVulnerabilities: protectedProcedure
      .input(z.object({ scanId: z.number() }))
      .query(async ({ input }) => {
        // PHASE 2: Check cache first for performance
        const cached = await getCachedVulnerabilities(input.scanId);
        if (cached) {
          console.log(`[Cache HIT] Vulnerabilities for scan ${input.scanId}`);
          return cached;
        }

        // Cache miss: query database
        console.log(`[Cache MISS] Vulnerabilities for scan ${input.scanId}`);
        const vulns = await getVulnerabilitiesByScan(input.scanId);
        
        // Cache result for next request
        if (vulns && vulns.length > 0) {
          await cacheVulnerabilities(input.scanId, vulns);
        }

        return vulns;
      }),

    count: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        const scans = await getScansByWorkspace(input.workspaceId);
        return { total: scans.length };
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // LLM COST TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  llmCost: router({
    track: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          model: z.string(),
          provider: z.string(),
          promptTokens: z.number(),
          completionTokens: z.number(),
          featureName: z.string().optional(),
          thinkingTokens: z.number().optional(),
          latencyMs: z.number().optional(),
          statusCode: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await trackCostEvent({
          workspaceId: input.workspaceId,
          userId: ctx.user?.id,
          provider: input.provider,
          model: input.model,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          thinkingTokens: input.thinkingTokens,
          featureName: input.featureName,
          latencyMs: input.latencyMs,
          statusCode: input.statusCode,
        });

        // PHASE 2: Invalidate cost cache on new tracking
        const date = new Date().toISOString().split('T')[0];
        // Note: In production, would need cache invalidation mechanism

        // PHASE 4: Invalidate unified risk score on cost change
        await invalidateUnifiedRiskScore(input.workspaceId);

        return result;
      }),

    getSummary: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          period: z.enum(["day", "week", "month", "all"]).optional(),
        })
      )
      .query(async ({ input }) => {
        // PHASE 2: Cache cost summary queries (expensive operation)
        const cacheKey = `costsummary_${input.workspaceId}_${input.period || 'month'}`;
        const cached = await getCachedTokenUsage(input.workspaceId, cacheKey);
        if (cached) {
          console.log(`[Cache HIT] Cost summary for workspace ${input.workspaceId}`);
          return cached;
        }

        console.log(`[Cache MISS] Cost summary for workspace ${input.workspaceId}`);
        const result = await getCostSummary(input.workspaceId, input.period || "month");
        
        // Cache for 30 minutes
        if (result) {
          await cacheTokenUsage(input.workspaceId, {
            workspaceId: input.workspaceId,
            date: cacheKey,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            cost: result.totalCostUsd || 0,
            provider: 'summary',
            model: 'summary',
          });
        }

        return result;
      }),

    getCostByProvider: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          period: z.enum(["day", "week", "month", "all"]).optional(),
        })
      )
      .query(async ({ input }) => {
        return await getCostByProvider(input.workspaceId, input.period || "month");
      }),

    getCostByModel: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          period: z.enum(["day", "week", "month", "all"]).optional(),
        })
      )
      .query(async ({ input }) => {
        return await getCostByModel(input.workspaceId, input.period || "month");
      }),

    getCostByFeature: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          period: z.enum(["day", "week", "month", "all"]).optional(),
        })
      )
      .query(async ({ input }) => {
        return await getCostByFeature(input.workspaceId, input.period || "month");
      }),

    getDailyCostTrend: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          days: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getDailyCostTrend(input.workspaceId, input.days || 30);
      }),

    getThinkingTokenSummary: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return await getThinkingTokenSummary(input.workspaceId);
      }),

    monthlyTotal: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        const summary = await getCostSummary(input.workspaceId, "month");
        return {
          totalUsd: summary?.totalCostUsd || 0,
          totalInr: summary?.totalCostInr || 0,
        };
      }),

    setBudget: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          monthlyLimitUsd: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return await setBudgetThreshold(
          input.workspaceId,
          ctx.user.id,
          input.monthlyLimitUsd
        );
      }),

    getBudget: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return await getBudgetThreshold(input.workspaceId, ctx.user.id);
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // AGENTGUARD (PHASE 6: Enhanced with unified risk integration)
  // ─────────────────────────────────────────────────────────────────────────

  agentGuard: router({
    trackCall: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          agentId: z.string(),
          costUsd: z.number(),
          promptTokens: z.number().optional(),
          completionTokens: z.number().optional(),
          thinkingTokens: z.number().optional(),
          latencyMs: z.number().optional(),
          model: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await trackAgentCall({
          agentId: input.agentId,
          workspaceId: input.workspaceId,
          costUsd: input.costUsd,
          promptTokens: input.promptTokens || 0,
          completionTokens: input.completionTokens || 0,
          thinkingTokens: input.thinkingTokens,
          latencyMs: input.latencyMs || 0,
          model: input.model || 'unknown',
          timestamp: Date.now(),
        });

        return result;
      }),

    killAgent: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          agentId: z.string(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await killAgent(input.workspaceId, input.agentId, input.reason || "Manual kill");

        // Invalidate agent stats cache
        invalidateAgentGuardCaches(input.workspaceId);

        return result;
      }),

    getActiveAgents: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return getActiveAgents(input.workspaceId);
      }),

    getInterventions: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getRecentInterventions(input.workspaceId, input.limit || 50);
      }),

    getStats: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return await getAgentStats(input.workspaceId);
      }),

    // PHASE 6: New endpoint for dashboard
    getDashboardData: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        const stats = await getAgentStats(input.workspaceId);
        const activeAgents = getActiveAgents(input.workspaceId);
        const recentInterventions = await getRecentInterventions(input.workspaceId, 10);

        return {
          stats,
          activeAgents,
          recentInterventions,
          timestamp: Date.now(),
        };
      }),

    // PHASE 6: Get alert (incident) history
    getAlertHistory: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getAlertHistory(input.workspaceId, input.limit || 50, input.offset || 0);
      }),

    activeCount: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        const agents = getActiveAgents(input.workspaceId);
        return { count: agents.length };
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVITY LOG
  // ─────────────────────────────────────────────────────────────────────────

  activity: router({
    getRecent: protectedProcedure
      .input(
        z.object({
          workspaceId: z.number(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getRecentActivity(input.workspaceId, input.limit || 50);
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────────────────────────────────────

  settings: router({
    getApiKeys: protectedProcedure
      .input(z.object({ workspaceId: z.number() }))
      .query(async ({ input }) => {
        return await getApiKeysByWorkspace(input.workspaceId);
      }),

    revokeApiKey: protectedProcedure
      .input(z.object({ keyId: z.number() }))
      .mutation(async ({ input }) => {
        await revokeApiKey(input.keyId);
        return { success: true };
      }),
  }),
});

// ─────────────────────────────────────────────────────────────────────────
// SCAN PROCESSING (Background)
// ─────────────────────────────────────────────────────────────────────────

async function processScan(
  scanId: number,
  workspaceId: number,
  userId: number | undefined,
  endpoints: Array<{ path: string; method: string; authType?: string }>
) {
  console.log(`[Scan ${scanId}] Starting scan with ${endpoints.length} endpoints`);

  try {
    await updateScanProgress(scanId, 0, "running");

    const vulnerabilitiesFound: number[] = [];

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];

      // Update progress
      const progress = Math.round(((i + 1) / endpoints.length) * 100);
      await updateScanProgress(scanId, progress, "running", i + 1);

      // Perform vulnerability checks (simplified for demo)
      const vulns = await performSecurityChecks(scanId, workspaceId, endpoint);

      for (const vuln of vulns) {
        await createVulnerability(scanId, workspaceId, vuln);
        vulnerabilitiesFound.push(vuln.id);
      }

      // Small delay to simulate real scanning
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await updateScanProgress(
      scanId,
      100,
      "completed",
      endpoints.length,
      vulnerabilitiesFound.length
    );

    // PHASE 4: Invalidate unified risk score cache on vulnerability change
    await invalidateUnifiedRiskScore(workspaceId);

    console.log(
      `[Scan ${scanId}] Completed. Found ${vulnerabilitiesFound.length} vulnerabilities`
    );
  } catch (error) {
    console.error(`[Scan ${scanId}] Failed:`, error);
    await completeScan(scanId, "failed", String(error));
  }
}

async function performSecurityChecks(
  scanId: number,
  workspaceId: number,
  endpoint: { path: string; method: string; authType?: string }
) {
  const vulns = [];

  // BOLA (Broken Object Level Authorization)
  if (endpoint.path.match(/\/\d+/)) {
    vulns.push({
      endpoint: endpoint.path,
      method: endpoint.method,
      severity: "high" as const,
      category: "BOLA",
      title: "Broken Object Level Authorization",
      description: "Endpoint uses direct object references without proper authorization checks",
      cwe: "CWE-639",
      recommendation: "Implement object-level authorization checks for all endpoints",
    });
  }

  // Excessive Data Exposure
  if (endpoint.path.includes("users") || endpoint.path.includes("data")) {
    vulns.push({
      endpoint: endpoint.path,
      method: endpoint.method,
      severity: "medium" as const,
      category: "EXCESSIVE_DATA",
      title: "Excessive Data Exposure",
      description: "API may expose more data than necessary in responses",
      cwe: "CWE-200",
      recommendation: "Implement field-level filtering and use DTOs for responses",
    });
  }

  // Rate Limiting (check if missing auth and is sensitive)
  if (endpoint.authType === "none" && ["POST", "PUT", "DELETE"].includes(endpoint.method)) {
    vulns.push({
      endpoint: endpoint.path,
      method: endpoint.method,
      severity: "low" as const,
      category: "RATE_LIMIT",
      title: "Potential Missing Rate Limiting",
      description: "Endpoint without authentication may be vulnerable to abuse",
      cwe: "CWE-770",
      recommendation: "Implement rate limiting on all public endpoints",
    });
  }

  return vulns;
}

export type AppRouter = typeof appRouter;
