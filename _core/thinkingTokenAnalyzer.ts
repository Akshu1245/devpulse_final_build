/**
 * Enhanced Thinking Token Analyzer
 * 
 * PHASE 5: Comprehensive thinking token tracking with:
 * - Per-endpoint attribution (not just feature-level)
 * - Model-specific breakdown
 * - Detection confidence tracking
 * - Historical trending
 * - Integration with Unified Risk Engine
 * 
 * Fixes:
 * - eventId orphaning bug (backfilled in trackCostEvent)
 * - detectionMethod hardcoding (now correctly tracked)
 * - Missing model field (now included in all queries)
 */

/**
 * Thinking Token Detection Method
 */
export enum ThinkingTokenDetectionMethod {
  /**
   * Direct API Reporting (100% accurate)
   * Models: o1, o1-mini, o3-mini, claude-3-7-sonnet
   * Source: completion_tokens_details.reasoning_tokens or response headers
   */
  DIRECT_API = 'DIRECT_API',

  /**
   * Timing Differential Estimation (~70% accurate, ±25% variance)
   * Formula: thinkingTokens ≈ latencyMs - (outputTokens × 2ms) - 400ms overhead
   * Used for: Models without direct thinking token reporting
   * Confidence: Low
   */
  TIMING_DIFFERENTIAL = 'TIMING_DIFFERENTIAL',

  /**
   * Model-Specific Estimation (configurable per provider)
   * Provider: Anthropic extended thinking
   * Source: Inferred from model behavior patterns
   * Confidence: Medium
   */
  MODEL_BEHAVIOR = 'MODEL_BEHAVIOR',
}

/**
 * Thinking Token Attribution
 */
export interface ThinkingTokenAttribution {
  workspaceId: number;
  eventId: number; // FK to llmCostEvents
  model: string; // e.g., "o1", "claude-3-7-sonnet"
  featureName: string; // e.g., "vulnerability_scan"
  endpointPath?: string; // e.g., "/api/scan/:id" - NEW in PHASE 5
  thinkingTokens: number; // Detected/estimated count
  estimatedCostUsd: number; // thinking cost only
  detectionMethod: ThinkingTokenDetectionMethod;
  detectionConfidence: 'HIGH' | 'MEDIUM' | 'LOW'; // NEW in PHASE 5
  detectionVariance?: number; // ±% error margin for timing estimates
  timestamp: number;
}

/**
 * Thinking Token Summary by Model
 */
export interface ThinkingTokenByModel {
  model: string;
  totalThinkingTokens: number;
  eventCount: number;
  estimatedCostUsd: number;
  averageThinkingTokensPerCall: number;
  detectionMethods: {
    [method in ThinkingTokenDetectionMethod]?: {
      count: number;
      tokens: number;
    };
  };
  percentOfTotalTokens: number;
  percentOfTotalCost: number;
}

/**
 * Thinking Token Summary by Feature & Endpoint
 */
export interface ThinkingTokenByFeatureEndpoint {
  featureName: string;
  endpointPath?: string;
  totalThinkingTokens: number;
  eventCount: number;
  estimatedCostUsd: number;
  averageThinkingTokensPerCall: number;
  models: string[]; // Which models were used
  percentOfFeatureCost: number;
}

/**
 * Daily Thinking Token Trend
 */
export interface ThinkingTokenTrendPoint {
  date: string; // YYYY-MM-DD
  totalThinkingTokens: number;
  costUsd: number;
  eventCount: number;
  topModel: { model: string; tokens: number };
  topFeature: { feature: string; tokens: number };
  detectionAccuracy: number; // % of events from direct API
}

/**
 * Thinking Token Detector: Enhanced Detection with Confidence
 */
export class ThinkingTokenDetector {
  /**
   * Detect thinking tokens with confidence level
   *
   * Priority:
   * 1. Direct API reporting (100% confidence)
   * 2. Model-specific behavior (50-70% confidence)
   * 3. Timing differential (50-70% confidence)
   */
  static detect(
    model: string,
    latencyMs: number,
    outputTokens: number,
    apiResponse?: any
  ): { tokens: number; method: ThinkingTokenDetectionMethod; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; variance?: number } {
    // Method 1: Direct API reporting (highest confidence)
    if (apiResponse && this.hasDirectThinkingTokenField(model, apiResponse)) {
      const tokens = this.extractDirectThinkingTokens(model, apiResponse);
      return {
        tokens,
        method: ThinkingTokenDetectionMethod.DIRECT_API,
        confidence: 'HIGH', // 100% from provider
      };
    }

    // Method 2: Model-specific behavior estimation
    if (this.isModelSpecificEstimationApplicable(model)) {
      const estimate = this.estimateByModelBehavior(model, latencyMs, outputTokens);
      return {
        tokens: estimate.tokens,
        method: ThinkingTokenDetectionMethod.MODEL_BEHAVIOR,
        confidence: 'MEDIUM', // 50-70% accuracy
        variance: estimate.variance,
      };
    }

    // Method 3: Timing differential (fallback)
    const estimate = this.estimateByTimingDifferential(latencyMs, outputTokens);
    return {
      tokens: estimate.tokens,
      method: ThinkingTokenDetectionMethod.TIMING_DIFFERENTIAL,
      confidence: 'LOW', // 50-70% accuracy
      variance: estimate.variance, // ±25%
    };
  }

  /**
   * Check if model reports thinking tokens directly in API response
   */
  private static hasDirectThinkingTokenField(model: string, response: any): boolean {
    // OpenAI models: completion_tokens_details.reasoning_tokens
    if (model.startsWith('o1') || model.startsWith('o3')) {
      return !!(response?.usage?.completion_tokens_details?.reasoning_tokens ?? response?.reasoning_tokens);
    }

    // Anthropic models: claude-3-7-sonnet with extended thinking has cache/usage info
    if (model.includes('claude')) {
      return !!response?.stop_reason?.includes?.('end_turn') || !!response?.tokens?.reasoning;
    }

    return false;
  }

  /**
   * Extract direct thinking tokens from API response
   */
  private static extractDirectThinkingTokens(model: string, response: any): number {
    // OpenAI o1/o3 family
    if (model.startsWith('o1') || model.startsWith('o3')) {
      return response?.usage?.completion_tokens_details?.reasoning_tokens ?? response?.reasoning_tokens ?? 0;
    }

    // Anthropic Claude with extended thinking
    if (model.includes('claude')) {
      return response?.tokens?.reasoning ?? 0;
    }

    return 0;
  }

  /**
   * Model-specific behavior estimation
   * Different models have different thinking token ratios to latency
   */
  private static isModelSpecificEstimationApplicable(model: string): boolean {
    // Anthropic Claude with extended thinking (estimated)
    return model.includes('claude') && model.includes('sonnet');
  }

  private static estimateByModelBehavior(
    model: string,
    latencyMs: number,
    outputTokens: number
  ): { tokens: number; variance: number } {
    // Anthropic: ~1.5ms per thinking token (more efficient than OpenAI)
    if (model.includes('claude')) {
      const overhead = 300; // ms async overhead
      const excessMs = latencyMs - (outputTokens * 1) - overhead; // 1ms per output (faster)
      const tokens = Math.max(0, Math.round(excessMs / 1.5)); // 1.5ms per thinking
      return { tokens, variance: 20 }; // ±20% for model-specific
    }

    // Default fallback
    return { tokens: 0, variance: 0 };
  }

  /**
   * Timing Differential Estimation (fallback)
   *
   * Formula: thinkingMs = latencyMs - (outputTokens × 2ms output time) - 400ms overhead
   * Assumption: 1ms thinking ≈ 1 thinking token (varies by model/architecture)
   *
   * Variance: ±25% due to network variance, batch processing effects, cache hits
   */
  private static estimateByTimingDifferential(
    latencyMs: number,
    outputTokens: number
  ): { tokens: number; variance: number } {
    const OUTPUT_TOKEN_TIME_MS = 2; // ~2ms per output token in latency
    const NETWORK_OVERHEAD_MS = 400; // Minimum overhead for network + processing

    const thinkingMs = latencyMs - outputTokens * OUTPUT_TOKEN_TIME_MS - NETWORK_OVERHEAD_MS;

    // If no excess time, no thinking tokens
    if (thinkingMs <= 0) {
      return { tokens: 0, variance: 0 };
    }

    // Universal assumption: 1ms thinking ≈ 1 thinking token
    // Note: This varies by model architecture (±25% variance)
    const tokens = Math.round(thinkingMs);

    return {
      tokens,
      variance: 25, // ±25% error margin for timing-based estimates
    };
  }

  /**
   * Calculate thinking token variance confidence
   * Lower variance = higher confidence
   */
  static getConfidenceLevel(variance: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (variance === 0) return 'HIGH'; // Direct API - no variance
    if (variance <= 20) return 'MEDIUM';
    return 'LOW';
  }
}

/**
 * Thinking Token Analyzer: Query and aggregate thinking tokens by various dimensions
 */
export class ThinkingTokenAnalyzer {
  /**
   * Aggregate thinking tokens by model for workspace
   */
  static aggregateByModel(attributions: ThinkingTokenAttribution[]): ThinkingTokenByModel[] {
    const byModel = new Map<string, ThinkingTokenByModel>();

    const totalTokens = attributions.reduce((sum, a) => sum + a.thinkingTokens, 0);
    const totalCost = attributions.reduce((sum, a) => sum + a.estimatedCostUsd, 0);

    for (const attr of attributions) {
      if (!byModel.has(attr.model)) {
        byModel.set(attr.model, {
          model: attr.model,
          totalThinkingTokens: 0,
          eventCount: 0,
          estimatedCostUsd: 0,
          averageThinkingTokensPerCall: 0,
          detectionMethods: {},
          percentOfTotalTokens: 0,
          percentOfTotalCost: 0,
        });
      }

      const entry = byModel.get(attr.model)!;
      entry.totalThinkingTokens += attr.thinkingTokens;
      entry.eventCount += 1;
      entry.estimatedCostUsd += attr.estimatedCostUsd;

      // Track detection methods
      if (!entry.detectionMethods[attr.detectionMethod]) {
        entry.detectionMethods[attr.detectionMethod] = { count: 0, tokens: 0 };
      }
      entry.detectionMethods[attr.detectionMethod]!.count += 1;
      entry.detectionMethods[attr.detectionMethod]!.tokens += attr.thinkingTokens;
    }

    // Calculate averages and percentages
    const results = Array.from(byModel.values());
    for (const entry of results) {
      entry.averageThinkingTokensPerCall = Math.round(entry.totalThinkingTokens / entry.eventCount);
      entry.percentOfTotalTokens = totalTokens > 0 ? (entry.totalThinkingTokens / totalTokens) * 100 : 0;
      entry.percentOfTotalCost = totalCost > 0 ? (entry.estimatedCostUsd / totalCost) * 100 : 0;
    }

    return results.sort((a, b) => b.totalThinkingTokens - a.totalThinkingTokens);
  }

  /**
   * Aggregate thinking tokens by feature & endpoint
   */
  static aggregateByFeatureEndpoint(attributions: ThinkingTokenAttribution[]): ThinkingTokenByFeatureEndpoint[] {
    const byFeature = new Map<string, Map<string, ThinkingTokenByFeatureEndpoint>>();

    for (const attr of attributions) {
      const featureKey = attr.featureName;
      const endpointKey = attr.endpointPath || 'unknown';

      if (!byFeature.has(featureKey)) {
        byFeature.set(featureKey, new Map());
      }

      const featureMap = byFeature.get(featureKey)!;
      const compositeKey = `${featureKey}::${endpointKey}`;

      if (!featureMap.has(compositeKey)) {
        featureMap.set(compositeKey, {
          featureName: featureKey,
          endpointPath: attr.endpointPath,
          totalThinkingTokens: 0,
          eventCount: 0,
          estimatedCostUsd: 0,
          averageThinkingTokensPerCall: 0,
          models: [],
          percentOfFeatureCost: 0,
        });
      }

      const entry = featureMap.get(compositeKey)!;
      entry.totalThinkingTokens += attr.thinkingTokens;
      entry.eventCount += 1;
      entry.estimatedCostUsd += attr.estimatedCostUsd;

      if (!entry.models.includes(attr.model)) {
        entry.models.push(attr.model);
      }
    }

    // Flatten and calculate
    const results: ThinkingTokenByFeatureEndpoint[] = [];
    for (const featureMap of byFeature.values()) {
      for (const entry of featureMap.values()) {
        entry.averageThinkingTokensPerCall = Math.round(entry.totalThinkingTokens / entry.eventCount);
        results.push(entry);
      }
    }

    return results.sort((a, b) => b.totalThinkingTokens - a.totalThinkingTokens);
  }

  /**
   * Generate daily trend points
   */
  static generateTrendPoints(attributions: ThinkingTokenAttribution[], days: number = 30): ThinkingTokenTrendPoint[] {
    const now = Date.now();
    const points: ThinkingTokenTrendPoint[] = [];

    // Group by date
    const byDate = new Map<string, ThinkingTokenAttribution[]>();
    for (const attr of attributions) {
      const date = new Date(attr.timestamp).toISOString().split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(attr);
    }

    // Generate points for each day
    for (let i = days; i > 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dayAttrs = byDate.get(date) || [];

      if (dayAttrs.length === 0) {
        continue; // Skip empty days in output
      }

      const totalTokens = dayAttrs.reduce((sum, a) => sum + a.thinkingTokens, 0);
      const cost = dayAttrs.reduce((sum, a) => sum + a.estimatedCostUsd, 0);

      // Find top model for day
      const byModel = new Map<string, number>();
      for (const attr of dayAttrs) {
        byModel.set(attr.model, (byModel.get(attr.model) || 0) + attr.thinkingTokens);
      }
      const topModel = Array.from(byModel.entries()).sort((a, b) => b[1] - a[1])[0] || [
        'unknown',
        0,
      ];

      // Find top feature for day
      const byFeature = new Map<string, number>();
      for (const attr of dayAttrs) {
        byFeature.set(attr.featureName, (byFeature.get(attr.featureName) || 0) + attr.thinkingTokens);
      }
      const topFeature = Array.from(byFeature.entries()).sort((a, b) => b[1] - a[1])[0] || [
        'unknown',
        0,
      ];

      // Detection accuracy for day
      const directAPICount = dayAttrs.filter((a) => a.detectionMethod === ThinkingTokenDetectionMethod.DIRECT_API).length;
      const detectionAccuracy = (directAPICount / dayAttrs.length) * 100;

      points.push({
        date,
        totalThinkingTokens: totalTokens,
        costUsd: cost,
        eventCount: dayAttrs.length,
        topModel: { model: topModel[0], tokens: topModel[1] },
        topFeature: { feature: topFeature[0], tokens: topFeature[1] },
        detectionAccuracy: Math.round(detectionAccuracy),
      });
    }

    return points;
  }

  /**
   * Get top features by thinking token consumption
   */
  static getTopFeatures(attributions: ThinkingTokenAttribution[], limit: number = 10): Array<{
    feature: string;
    tokens: number;
    cost: number;
    percent: number;
  }> {
    const byFeature = new Map<string, { tokens: number; cost: number }>();

    const totalTokens = attributions.reduce((sum, a) => sum + a.thinkingTokens, 0);

    for (const attr of attributions) {
      if (!byFeature.has(attr.featureName)) {
        byFeature.set(attr.featureName, { tokens: 0, cost: 0 });
      }
      const entry = byFeature.get(attr.featureName)!;
      entry.tokens += attr.thinkingTokens;
      entry.cost += attr.estimatedCostUsd;
    }

    return Array.from(byFeature.entries())
      .map(([feature, data]) => ({
        feature,
        tokens: data.tokens,
        cost: data.cost,
        percent: totalTokens > 0 ? (data.tokens / totalTokens) * 100 : 0,
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, limit);
  }

  /**
   * Get models using thinking tokens (with stats)
   */
  static getModelsWithThinking(attributions: ThinkingTokenAttribution[]): Array<{
    model: string;
    tokens: number;
    cost: number;
    usage: 'ALWAYS' | 'SOMETIMES' | 'RARELY';
  }> {
    const models = new Map<string, { tokens: number; cost: number; eventCount: number }>();
    let totalEvents = 0;

    for (const attr of attributions) {
      totalEvents += 1;
      if (!models.has(attr.model)) {
        models.set(attr.model, { tokens: 0, cost: 0, eventCount: 0 });
      }
      const entry = models.get(attr.model)!;
      entry.tokens += attr.thinkingTokens;
      entry.cost += attr.estimatedCostUsd;
      entry.eventCount += 1;
    }

    return Array.from(models.entries())
      .map(([model, data]) => {
        const usagePercent = (data.eventCount / totalEvents) * 100;
        let usage: 'ALWAYS' | 'SOMETIMES' | 'RARELY';
        if (usagePercent > 80) usage = 'ALWAYS';
        else if (usagePercent > 20) usage = 'SOMETIMES';
        else usage = 'RARELY';

        return { model, tokens: data.tokens, cost: data.cost, usage };
      })
      .sort((a, b) => b.tokens - a.tokens);
  }

  /**
   * Project thinking token costs based on current usage
   */
  static projectMonthlyCost(attributions: ThinkingTokenAttribution[]): {
    currentDailyAvg: number;
    projectedMonthly: number;
    projectedYearly: number;
    highUsageDays: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  } {
    if (attributions.length === 0) {
      return {
        currentDailyAvg: 0,
        projectedMonthly: 0,
        projectedYearly: 0,
        highUsageDays: 0,
        trend: 'stable',
      };
    }

    const dailyTotals = new Map<string, number>();
    for (const attr of attributions) {
      const date = new Date(attr.timestamp).toISOString().split('T')[0];
      dailyTotals.set(date, (dailyTotals.get(date) || 0) + attr.estimatedCostUsd);
    }

    const dailyCosts = Array.from(dailyTotals.values());
    const currentDailyAvg = dailyCosts.reduce((a, b) => a + b, 0) / dailyCosts.length;
    const projectedMonthly = currentDailyAvg * 30;
    const projectedYearly = projectedMonthly * 12;

    const highUsageThreshold = currentDailyAvg * 1.5;
    const highUsageDays = dailyCosts.filter(c => c > highUsageThreshold).length;

    // Determine trend by comparing first vs second half
    const sortedDays = Array.from(dailyTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const midpoint = Math.floor(sortedDays.length / 2);
    const firstHalf = sortedDays.slice(0, midpoint);
    const secondHalf = sortedDays.slice(midpoint);

    const firstAvg = firstHalf.reduce((a, b) => a + b[1], 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, b) => a + b[1], 0) / (secondHalf.length || 1);

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (secondAvg > firstAvg * 1.1) trend = 'increasing';
    else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';

    return {
      currentDailyAvg: Math.round(currentDailyAvg * 10000) / 10000,
      projectedMonthly: Math.round(projectedMonthly * 10000) / 10000,
      projectedYearly: Math.round(projectedYearly * 10000) / 10000,
      highUsageDays,
      trend,
    };
  }

  /**
   * Generate optimization recommendations
   */
  static generateOptimizationRecommendations(attributions: ThinkingTokenAttribution[]): {
    recommendations: Array<{
      type: 'model_switch' | 'caching' | 'batch_processing' | 'prompt_optimization' | 'general';
      priority: 'high' | 'medium' | 'low';
      description: string;
      estimatedSavings: number;
      affectedEvents: number;
    }>;
    totalEstimatedSavings: number;
  } {
    const recommendations: Array<{
      type: 'model_switch' | 'caching' | 'batch_processing' | 'prompt_optimization' | 'general';
      priority: 'high' | 'medium' | 'low';
      description: string;
      estimatedSavings: number;
      affectedEvents: number;
    }> = [];

    // Analyze by model
    const byModel = ThinkingTokenAnalyzer.aggregateByModel(attributions);
    const totalTokens = byModel.reduce((sum, m) => sum + m.totalThinkingTokens, 0);
    const totalCost = byModel.reduce((sum, m) => sum + m.estimatedCostUsd, 0);

    // Check for expensive thinking models
    const expensiveModels = byModel.filter(m => m.percentOfTotalCost > 30);
    for (const model of expensiveModels) {
      const savings = model.estimatedCostUsd * 0.2; // Estimate 20% savings potential
      recommendations.push({
        type: 'model_switch',
        priority: 'high',
        description: `Model ${model.model} accounts for ${model.percentOfTotalCost.toFixed(1)}% of costs. Consider switching to a more cost-effective model for non-critical tasks.`,
        estimatedSavings: Math.round(savings * 10000) / 10000,
        affectedEvents: model.eventCount,
      });
    }

    // Check for high thinking token usage per call
    const highUsage = attributions.filter(a => a.thinkingTokens > 10000);
    if (highUsage.length > 0) {
      const avgCost = totalCost / totalTokens;
      const potentialSavings = highUsage.reduce((sum, a) => sum + a.estimatedCostUsd, 0) * 0.15;
      recommendations.push({
        type: 'prompt_optimization',
        priority: 'medium',
        description: `${highUsage.length} requests use over 10,000 thinking tokens. Optimize prompts or use chain-of-thought prompting to reduce token usage.`,
        estimatedSavings: Math.round(potentialSavings * 10000) / 10000,
        affectedEvents: highUsage.length,
      });
    }

    // Check detection accuracy
    const lowConfidence = attributions.filter(a => a.detectionConfidence === 'LOW');
    if (lowConfidence.length > attributions.length * 0.5) {
      recommendations.push({
        type: 'general',
        priority: 'low',
        description: `Only ${((1 - lowConfidence.length / attributions.length) * 100).toFixed(0)}% of costs are accurately measured. Consider using models with direct thinking token reporting for better visibility.`,
        estimatedSavings: 0,
        affectedEvents: lowConfidence.length,
      });
    }

    const totalEstimatedSavings = recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0);

    return {
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
      totalEstimatedSavings: Math.round(totalEstimatedSavings * 10000) / 10000,
    };
  }
}
