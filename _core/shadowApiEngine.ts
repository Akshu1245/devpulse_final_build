/**
 * Shadow API Detection Engine (PHASE 7)
 * =====================================
 * Identifies undocumented API endpoints using endpoint tracking,
 * Postman collection comparison, and pattern analysis.
 */

export interface DocumentedEndpoint {
  path: string;
  method: string;
  description?: string;
  auth?: string;
  headers?: Record<string, string>;
}

export interface ShadowApiDetection {
  endpoint: string;
  method: string;
  callCount: number;
  totalCost: number;
  avgLatencyMs: number;
  lastSeenTimestamp: number;
  thinkingTokensUsed: number;
  modelsUsed: string[];
  riskScore: number; // 0-100
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  riskFactors: string[];
  detectionReason: 'undocumented' | 'expensive_thinking' | 'latency_anomaly' | 'method_mismatch' | 'high_volume' | 'suspicious_model_usage';
  firstSeen: number;
  isWhitelisted: boolean;
}

export interface ShadowApiSummary {
  totalShadowApis: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalUnauthorizedCost: number;
  topRiskEndpoints: ShadowApiDetection[];
  trendingEndpoints: ShadowApiDetection[]; // By call frequency
}

/**
 * Shadow API Engine
 * Detects undocumented, expensive, or suspicious API endpoints
 */
export class ShadowApiEngine {
  /**
   * Normalize API path to handle parameters and variation
   * Examples:
   *   /api/scan/:id/analyze → /api/scan/{id}/analyze
   *   /api/users/123 → /api/users/{id}
   *   /api/projects/proj-123/settings → /api/projects/{id}/settings
   */
  static normalizePath(path: string): string {
    // Replace UUID/ID patterns
    let normalized = path
      // Replace numeric IDs
      .replace(/\/\d+/g, '/{id}')
      // Replace UUID patterns
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{id}')
      // Replace GUID patterns
      .replace(/\/[a-zA-Z0-9-_]{20,}/g, '/{id}')
      // Collapse multiple slashes
      .replace(/\/+/g, '/');

    return normalized;
  }

  /**
   * Check if endpoint is documented in Postman collection
   */
  static isDocumented(
    path: string,
    method: string,
    documentedEndpoints: DocumentedEndpoint[]
  ): boolean {
    const normalizedPath = this.normalizePath(path);

    return documentedEndpoints.some((doc) => {
      const normalizedDoc = this.normalizePath(doc.path);
      return normalizedDoc === normalizedPath && doc.method.toUpperCase() === method.toUpperCase();
    });
  }

  /**
   * Calculate risk score based on multiple factors
   */
  static calculateRiskScore(
    isUndocumented: boolean,
    callCount: number,
    totalCost: number,
    avgLatencyMs: number,
    thinkingTokens: number,
    isExpensiveModel: boolean
  ): number {
    let score = 0;

    // Factor 1: Undocumented endpoint (base risk)
    if (isUndocumented) {
      score += 30;
    }

    // Factor 2: Thinking token usage (expensive)
    if (thinkingTokens > 5000) {
      score += 25; // CRITICAL: Using thinking tokens on shadow API
    } else if (thinkingTokens > 1000) {
      score += 15;
    } else if (thinkingTokens > 0) {
      score += 10;
    }

    // Factor 3: High call volume (suggests intentional, not typo)
    if (callCount > 100) {
      score += 15;
    } else if (callCount > 50) {
      score += 10;
    } else if (callCount > 20) {
      score += 5;
    }

    // Factor 4: Latency anomaly (>5000ms unusual)
    if (avgLatencyMs > 5000) {
      score += 10;
    } else if (avgLatencyMs > 3000) {
      score += 5;
    }

    // Factor 5: Cost (high cost + undocumented = risky)
    if (isUndocumented && totalCost > 10) {
      score += 15;
    } else if (isUndocumented && totalCost > 1) {
      score += 10;
    }

    // Factor 6: Expensive models (o1, claude = higher risk amplifier)
    if (isExpensiveModel && isUndocumented) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Map numeric score to risk tier
   */
  static getRiskTier(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'INFO';
  }

  /**
   * Analyze endpoints and detect shadow APIs
   * @param actualEndpoints - API calls made (from logs)
   * @param documentedEndpoints - Known endpoints (from Postman)
   * @param thinkingTokensByEndpoint - Thinking token usage per endpoint
   * @returns Array of detected shadow APIs
   */
  static detectShadowApis(
    actualEndpoints: Array<{
      path: string;
      method: string;
      callCount: number;
      totalCost: number;
      avgLatencyMs: number;
      lastSeenTimestamp: number;
      firstSeenTimestamp: number;
      modelsUsed: string[];
    }>,
    documentedEndpoints: DocumentedEndpoint[],
    thinkingTokensByEndpoint: Record<string, number> = {},
    whitelistedEndpoints: string[] = []
  ): ShadowApiDetection[] {
    const shadowApis: ShadowApiDetection[] = [];

    for (const actual of actualEndpoints) {
      const endpointKey = `${actual.method} ${this.normalizePath(actual.path)}`;

      // Skip whitelisted endpoints
      if (whitelistedEndpoints.some((w) => endpointKey.includes(w))) {
        continue;
      }

      const isDocumented = this.isDocumented(actual.path, actual.method, documentedEndpoints);
      const thinkingTokens = thinkingTokensByEndpoint[endpointKey] || 0;
      const isExpensiveModel = actual.modelsUsed.some((m) => ['o1', 'o3', 'claude-3-7-sonnet'].includes(m));

      // Determine if this should be flagged
      const shouldFlag =
        !isDocumented || // Undocumented
        thinkingTokens > 5000 || // Very expensive thinking
        actual.avgLatencyMs > 10000 || // Extremely slow (timeout suspicious)
        (actual.callCount > 100 && !isDocumented); // High volume undocumented

      if (!shouldFlag) {
        continue; // Not suspicious, skip
      }

      const riskScore = this.calculateRiskScore(
        !isDocumented,
        actual.callCount,
        actual.totalCost,
        actual.avgLatencyMs,
        thinkingTokens,
        isExpensiveModel
      );

      const riskFactors: string[] = [];
      let detectionReason: ShadowApiDetection['detectionReason'] = 'undocumented';

      if (!isDocumented) {
        riskFactors.push('Endpoint not in Postman collection');
        detectionReason = 'undocumented';
      }
      if (thinkingTokens > 5000) {
        riskFactors.push(`Heavy thinking token usage (${thinkingTokens} tokens)`);
        detectionReason = 'expensive_thinking';
      }
      if (actual.avgLatencyMs > 5000) {
        riskFactors.push(`High latency (${actual.avgLatencyMs}ms)`);
        detectionReason = 'latency_anomaly';
      }
      if (actual.callCount > 100) {
        riskFactors.push(`High call volume (${actual.callCount} calls)`);
      }
      if (isExpensiveModel) {
        riskFactors.push(`Uses expensive models: ${actual.modelsUsed.join(', ')}`);
        detectionReason = 'suspicious_model_usage';
      }

      shadowApis.push({
        endpoint: actual.path,
        method: actual.method,
        callCount: actual.callCount,
        totalCost: actual.totalCost,
        avgLatencyMs: actual.avgLatencyMs,
        lastSeenTimestamp: actual.lastSeenTimestamp,
        thinkingTokensUsed: thinkingTokens,
        modelsUsed: actual.modelsUsed,
        riskScore,
        riskTier: this.getRiskTier(riskScore),
        riskFactors,
        detectionReason,
        firstSeen: actual.firstSeenTimestamp,
        isWhitelisted: false,
      });
    }

    // Sort by risk score descending
    return shadowApis.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Generate summary of shadow API detection
   */
  static generateSummary(shadowApis: ShadowApiDetection[]): ShadowApiSummary {
    const tiers = {
      CRITICAL: shadowApis.filter((a) => a.riskTier === 'CRITICAL'),
      HIGH: shadowApis.filter((a) => a.riskTier === 'HIGH'),
      MEDIUM: shadowApis.filter((a) => a.riskTier === 'MEDIUM'),
      LOW: shadowApis.filter((a) => a.riskTier === 'LOW'),
      INFO: shadowApis.filter((a) => a.riskTier === 'INFO'),
    };

    const topRiskEndpoints = shadowApis.slice(0, 10);
    const trendingEndpoints = [...shadowApis].sort((a, b) => b.callCount - a.callCount).slice(0, 10);

    return {
      totalShadowApis: shadowApis.length,
      criticalCount: tiers.CRITICAL.length,
      highCount: tiers.HIGH.length,
      mediumCount: tiers.MEDIUM.length,
      lowCount: tiers.LOW.length,
      infoCount: tiers.INFO.length,
      totalUnauthorizedCost: shadowApis.reduce((sum, a) => sum + a.totalCost, 0),
      topRiskEndpoints,
      trendingEndpoints,
    };
  }

  /**
   * Find method mismatches between documented and actual usage
   */
  static findMethodMismatches(
    actualEndpoints: Array<{
      path: string;
      method: string;
      callCount: number;
    }>,
    documentedEndpoints: DocumentedEndpoint[]
  ): Array<{
    endpoint: string;
    documentedMethod: string;
    actualMethods: string[];
    mismatchCount: number;
  }> {
    const mismatches = [];

    for (const doc of documentedEndpoints) {
      const normalizedDocPath = this.normalizePath(doc.path);

      // Find actual endpoints matching this path but different method
      const actualForPath = actualEndpoints.filter(
        (a) => this.normalizePath(a.path) === normalizedDocPath && a.method !== doc.method
      );

      if (actualForPath.length > 0) {
        mismatches.push({
          endpoint: doc.path,
          documentedMethod: doc.method,
          actualMethods: actualForPath.map((a) => a.method),
          mismatchCount: actualForPath.reduce((sum, a) => sum + a.callCount, 0),
        });
      }
    }

    return mismatches;
  }

  /**
   * Whitelist an endpoint (prevent false positives)
   */
  static whitelistEndpoint(endpoint: string): void {
    if (!this.whitelist) {
      this.whitelist = new Set<string>();
    }
    this.whitelist.add(this.normalizePath(endpoint));
  }

  private static whitelist: Set<string> = new Set();
}
