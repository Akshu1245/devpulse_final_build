/**
 * Unified Risk Engine — DevPulse Patent 1
 * 
 * Merges security risk and LLM cost metrics into a single 0-100 score.
 * Enables holistic prioritization of features by combined risk + cost impact.
 * Integrates with OWASP API Security Top 10 (2023) and compliance mappings.
 * 
 * Scoring Model:
 * - Risk Component (0-100): Based on vulnerability severity distribution
 * - Cost Component (0-100): Normalized against budget thresholds
 * - Unified Score: Weighted combination (60% security, 40% cost)
 * - Risk Tiers: CRITICAL (90-100), HIGH (70-89), MEDIUM (50-69), LOW (30-49), HEALTHY (0-29)
 */

// ─── OWASP Category Definitions ───────────────────────────────────────────────

export const OWASP_CATEGORIES = {
  BOLA: {
    id: 'API1:2023',
    name: 'Broken Object Level Authorization',
    pciRequirements: ['6.2.4', '6.3.1'],
  },
  BROKEN_AUTH: {
    id: 'API2:2023',
    name: 'Broken Authentication',
    pciRequirements: ['8.2.1', '8.3.1'],
  },
  DATA_EXPOSURE: {
    id: 'API3:2023',
    name: 'Broken Object Property Level Authorization',
    pciRequirements: ['6.2.4', '3.3'],
  },
  RATE_LIMIT: {
    id: 'API4:2023',
    name: 'Unrestricted Resource Consumption',
    pciRequirements: ['6.4.1'],
  },
  BFLA: {
    id: 'API5:2023',
    name: 'Broken Function Level Authorization',
    pciRequirements: ['6.2.4', '7.1.1'],
  },
  SENSITIVE_BUSINESS: {
    id: 'API6:2023',
    name: 'Unrestricted Access to Sensitive Business Flows',
    pciRequirements: ['6.4.2'],
  },
  SSRF: {
    id: 'API7:2023',
    name: 'Server Side Request Forgery',
    pciRequirements: ['6.2.4'],
  },
  MISCONFIG: {
    id: 'API8:2023',
    name: 'Security Misconfiguration',
    pciRequirements: ['2.2.1', '6.2.4'],
  },
  INVENTORY: {
    id: 'API9:2023',
    name: 'Improper Inventory Management',
    pciRequirements: ['6.3.2', '12.3.1'],
  },
  UNSAFE_CONSUMPTION: {
    id: 'API10:2023',
    name: 'Unsafe Consumption of APIs',
    pciRequirements: ['6.2.4'],
  },
} as const;

export type OWASPCategoryKey = keyof typeof OWASP_CATEGORIES;

/**
 * Risk tier enumeration for UI display
 */
export enum UnifiedRiskTier {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  HEALTHY = 'HEALTHY',
}

/**
 * Severity counts for risk calculation
 */
export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

/**
 * Cost metrics normalized for scoring
 */
export interface CostMetrics {
  currentMonthCostUsd: number;
  monthlyBudgetUsd: number;
  costPercentOfBudget: number;
  averageDailyCostTrend: number; // -X% to +X% vs previous 30 days
  thinkingTokenUsagePercent: number; // % of total tokens that are thinking tokens
}

/**
 * Unified risk assessment result
 */
export interface UnifiedRiskAssessment {
  workspaceId: number;
  riskScore: number; // 0-100: security severity distribution
  costScore: number; // 0-100: cost consumption vs budget
  unifiedScore: number; // 0-100: weighted combination
  tier: UnifiedRiskTier;
  riskComponent: {
    score: number;
    severity: SeverityDistribution;
    criticalityIndex: number; // Weighted average of severities
  };
  costComponent: {
    score: number;
    currentMonthUsd: number;
    budgetUsd: number;
    percentOfBudget: number;
    trend: number;
  };
  issuePriority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  recommendation: string;
  timestamp: number;
}

/**
 * Feature-level risk breakdown
 */
export interface FeatureRiskProfile {
  featureName: string;
  vulnerabilityCount: number;
  highestSeverity: string; // critical|high|medium|low|info
  costUsdThisMonth: number;
  costPercentOfWorkspace: number;
  unifiedScore: number;
  tier: UnifiedRiskTier;
  lastUpdated: number;
}

/**
 * Unified Risk Engine: Main scoring engine
 */
export class UnifiedRiskEngine {
  /**
   * Calculate risk score (0-100) from severity distribution
   * 
   * Formula:
   * riskScore = (critical_count × 20 + high_count × 10 + medium_count × 4) 
   *             / (total_vulnerabilities × 5) × 100
   * 
   * This gives diminishing returns:
   * - 1x critical = 40 points / 5 = 8
   * - 5x critical = 100 points / 25 = 20
   * - 25x critical = 500 points / 125 = 100 (capped)
   */
  static calculateRiskScore(severity: SeverityDistribution): number {
    if (severity.total === 0) {
      return 0;
    }

    const weightedSum =
      severity.critical * 20 +
      severity.high * 10 +
      severity.medium * 4 +
      severity.low * 1 +
      severity.info * 0;

    const potentialMax = severity.total * 5; // Max if all are critical
    let score = (weightedSum / potentialMax) * 100;

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Calculate criticality index (weighted average severity)
   * Ranges 0-100 where 100 = all critical
   */
  static calculateCriticalityIndex(severity: SeverityDistribution): number {
    if (severity.total === 0) {
      return 0;
    }

    const weightedSum =
      severity.critical * 100 +
      severity.high * 75 +
      severity.medium * 50 +
      severity.low * 25 +
      severity.info * 10;

    return Math.round((weightedSum / (severity.total * 100)) * 100);
  }

  /**
   * Calculate cost score (0-100) normalized against budget
   * 
   * Formula:
   * costScore = (current_month_cost / monthly_budget) × 100
   * - 0-79% of budget: Low score (low risk)
   * - 80-99% of budget: High score (alert threshold)
   * - 100%+ of budget: 100 (critical)
   * 
   * Bonus penalty: If spending is trending upward >20% MoM, add 10 points
   */
  static calculateCostScore(cost: CostMetrics): number {
    let score = cost.costPercentOfBudget * 100;

    // Cap at 100
    score = Math.min(score, 100);

    // Add penalty for upward trend (>20% MoM increase)
    if (cost.averageDailyCostTrend > 20) {
      score = Math.min(score + 10, 100);
    }

    // Add penalty for excessive thinking token usage (>30%)
    if (cost.thinkingTokenUsagePercent > 30) {
      score = Math.min(score + 5, 100);
    }

    return Math.round(score);
  }

  /**
   * Calculate unified risk score (0-100)
   * 
   * Weighting: 60% security, 40% cost
   * Rationale:
   * - Security vulnerabilities are the primary concern (blocking)
   * - Cost is important but less critical than exploitable vulnerabilities
   * - Adjustable in production based on customer priorities
   */
  static calculateUnifiedScore(riskScore: number, costScore: number): number {
    const unified = riskScore * 0.6 + costScore * 0.4;
    return Math.round(Math.min(unified, 100));
  }

  /**
   * Map unified score to tier for UI display
   * 
   * Tier Thresholds:
   * 0-29: HEALTHY (green) - low risk, all systems normal
   * 30-49: LOW (yellow-green) - minor concerns, no immediate action
   * 50-69: MEDIUM (yellow) - manageable risk, review recommended
   * 70-89: HIGH (orange) - significant risk, prompt attention
   * 90-100: CRITICAL (red) - severe risk, urgent attention required
   */
  static scoreTier(score: number): UnifiedRiskTier {
    if (score >= 90) return UnifiedRiskTier.CRITICAL;
    if (score >= 70) return UnifiedRiskTier.HIGH;
    if (score >= 50) return UnifiedRiskTier.MEDIUM;
    if (score >= 30) return UnifiedRiskTier.LOW;
    return UnifiedRiskTier.HEALTHY;
  }

  /**
   * Determine issue priority based on tier and delta
   * 
   * URGENT: CRITICAL tier + rapidly increasing score
   * HIGH: HIGH tier + multiple critical vulns
   * MEDIUM: MEDIUM tier + budget approaching limit
   * LOW: LOW tier
   * NONE: HEALTHY tier
   */
  static issuePriority(
    tier: UnifiedRiskTier,
    score: number,
    previousScore: number | undefined,
    severity: SeverityDistribution
  ): 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
    const scoreIncrease = previousScore ? score - previousScore : 0;

    if (tier === UnifiedRiskTier.CRITICAL && scoreIncrease > 10) {
      return 'URGENT';
    }
    if (tier === UnifiedRiskTier.CRITICAL || (tier === UnifiedRiskTier.HIGH && severity.critical > 0)) {
      return 'HIGH';
    }
    if (tier === UnifiedRiskTier.HIGH) {
      return 'MEDIUM';
    }
    if (tier === UnifiedRiskTier.LOW) {
      return 'LOW';
    }
    return 'NONE';
  }

  /**
   * Generate human-readable recommendation based on assessment
   */
  static generateRecommendation(assessment: Omit<UnifiedRiskAssessment, 'recommendation'>): string {
    const { tier, riskComponent, costComponent } = assessment;

    const riskMsg = (() => {
      if (riskComponent.severity.critical > 0) {
        return `Address ${riskComponent.severity.critical} critical vulnerability(ies) immediately.`;
      }
      if (riskComponent.severity.high > 0) {
        return `Review ${riskComponent.severity.high} high-severity vulnerability(ies).`;
      }
      if (riskComponent.severity.medium > 0) {
        return `Plan remediation for ${riskComponent.severity.medium} medium-severity issue(s).`;
      }
      return 'Vulnerability posture is healthy.';
    })();

    const costMsg = (() => {
      if (costComponent.percentOfBudget > 100) {
        return `You've exceeded your monthly budget by ${Math.round((costComponent.percentOfBudget - 100) * 10) / 10}%. Review LLM usage.`;
      }
      if (costComponent.percentOfBudget > 80) {
        return `Cost consumption is at ${Math.round(costComponent.percentOfBudget * 10) / 10}% of budget. Monitor closely.`;
      }
      if (costComponent.trend > 20) {
        return `Costs increasing ${Math.round(costComponent.trend)}% MoM. Investigate usage patterns.`;
      }
      return 'LLM costs are within budget and stable.';
    })();

    const actionMsg = (() => {
      if (tier === UnifiedRiskTier.CRITICAL) {
        return 'CRITICAL: This workspace requires urgent attention. Both security and cost concerns are severe.';
      }
      if (tier === UnifiedRiskTier.HIGH) {
        return 'HIGH: Significant concerns detected. Prioritize high-severity vulnerabilities and cost optimization.';
      }
      if (tier === UnifiedRiskTier.MEDIUM) {
        return 'MEDIUM: Standard review recommended. Address medium-severity issues during regular maintenance.';
      }
      return '';
    })();

    return `${riskMsg} ${costMsg} ${actionMsg}`.trim();
  }

  /**
   * Complete assessment: Input severity + cost, output full assessment
   */
  static assess(
    workspaceId: number,
    severity: SeverityDistribution,
    cost: CostMetrics,
    previousScore?: number
  ): UnifiedRiskAssessment {
    const riskScore = this.calculateRiskScore(severity);
    const costScore = this.calculateCostScore(cost);
    const unifiedScore = this.calculateUnifiedScore(riskScore, costScore);
    const tier = this.scoreTier(unifiedScore);
    const criticality = this.calculateCriticalityIndex(severity);
    const priority = this.issuePriority(tier, unifiedScore, previousScore, severity);

    const assessment: Omit<UnifiedRiskAssessment, 'recommendation'> = {
      workspaceId,
      riskScore,
      costScore,
      unifiedScore,
      tier,
      issuePriority: priority,
      riskComponent: {
        score: riskScore,
        severity,
        criticalityIndex: criticality,
      },
      costComponent: {
        score: costScore,
        currentMonthUsd: cost.currentMonthCostUsd,
        budgetUsd: cost.monthlyBudgetUsd,
        percentOfBudget: cost.costPercentOfBudget * 100,
        trend: cost.averageDailyCostTrend,
      },
      timestamp: Date.now(),
    };

    const recommendation = this.generateRecommendation(assessment);

    return { ...assessment, recommendation };
  }
}

/**
 * Feature Risk Analyzer: Break down risk by feature/LLM call
 * 
 * Enables drill-down analysis:
 * - Which features have the most vulnerabilities?
 * - Which features cost the most?
 * - Which features are highest risk overall?
 */
export class FeatureRiskAnalyzer {
  /**
   * Calculate risk for a specific feature
   * 
   * Factor in:
   * 1. Number of vulnerabilities in endpoints this feature uses
   * 2. Severity of those vulnerabilities
   * 3. Cost of LLM calls made by this feature
   * 4. Cost as % of workspace total
   */
  static calculateFeatureRisk(
    featureName: string,
    vulnerabilityCount: number,
    highestSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    costUsdThisMonth: number,
    workspaceTotalCostUsd: number,
    workspaceTotalVulnerabilities: number
  ): FeatureRiskProfile {
    // Risk component: vulnerability-based
    let featureRiskScore = 0;

    const severityWeights = {
      critical: 25,
      high: 15,
      medium: 7,
      low: 2,
      info: 0,
    };

    if (workspaceTotalVulnerabilities > 0) {
      featureRiskScore += (vulnerabilityCount / workspaceTotalVulnerabilities) * 50; // 0-50 points from vuln count
    }

    featureRiskScore += severityWeights[highestSeverity]; // 0-25 points from severity

    // Cost component: spend fraction × 50
    const costFraction = workspaceTotalCostUsd > 0 ? costUsdThisMonth / workspaceTotalCostUsd : 0;
    featureRiskScore += costFraction * 50; // 0-50 points from cost

    // Cap at 100
    featureRiskScore = Math.min(featureRiskScore, 100);

    const tier = UnifiedRiskEngine.scoreTier(featureRiskScore);

    return {
      featureName,
      vulnerabilityCount,
      highestSeverity,
      costUsdThisMonth,
      costPercentOfWorkspace: workspaceTotalCostUsd > 0 ? (costUsdThisMonth / workspaceTotalCostUsd) * 100 : 0,
      unifiedScore: Math.round(featureRiskScore),
      tier,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Rank features by unified risk score (descending)
   * Useful for dashboard: "Top 10 highest-risk features"
   */
  static rankFeatures(features: FeatureRiskProfile[]): FeatureRiskProfile[] {
    return [...features].sort((a, b) => b.unifiedScore - a.unifiedScore);
  }

  /**
   * Filter features by tier threshold
   */
  static filterByTier(features: FeatureRiskProfile[], minTier: UnifiedRiskTier): FeatureRiskProfile[] {
    const tierOrder = [UnifiedRiskTier.HEALTHY, UnifiedRiskTier.LOW, UnifiedRiskTier.MEDIUM, UnifiedRiskTier.HIGH, UnifiedRiskTier.CRITICAL];
    const minTierIndex = tierOrder.indexOf(minTier);
    return features.filter((f) => tierOrder.indexOf(f.tier) >= minTierIndex);
  }
}

/**
 * Risk Trend Analyzer: Track changes over time
 * 
 * Useful for:
 * - 7/30 day trends
 * - Anomaly detection
 * - Improvement tracking
 */
export interface RiskTrendPoint {
  date: string; // YYYY-MM-DD
  unifiedScore: number;
  riskScore: number;
  costScore: number;
  tier: UnifiedRiskTier;
  vulnerabilityCount: number;
  costUsd: number;
}

export class RiskTrendAnalyzer {
  /**
   * Calculate trend direction and rate (% change)
   * Returns negative value if improving, positive if worsening
   */
  static calculateTrendRate(recent: RiskTrendPoint[], baseline: RiskTrendPoint): number {
    if (recent.length === 0) return 0;

    const averageRecent = recent.reduce((sum, r) => sum + r.unifiedScore, 0) / recent.length;
    const change = averageRecent - baseline.unifiedScore;
    const changePercent = (change / baseline.unifiedScore) * 100;

    return Math.round(changePercent * 10) / 10; // One decimal place
  }

  /**
   * Identify anomalies: score increased >15% in single day
   */
  static detectAnomalies(trend: RiskTrendPoint[]): RiskTrendPoint[] {
    const anomalies: RiskTrendPoint[] = [];

    for (let i = 1; i < trend.length; i++) {
      const current = trend[i];
      const previous = trend[i - 1];

      const changePercent = Math.abs((current.unifiedScore - previous.unifiedScore) / previous.unifiedScore) * 100;

      if (changePercent > 15) {
        anomalies.push(current);
      }
    }

    return anomalies;
  }

  /**
   * Generate trend summary for dashboard/notifications
   */
  static generateTrendSummary(trend: RiskTrendPoint[]): string {
    if (trend.length < 2) {
      return 'Insufficient data for trend analysis.';
    }

    const oldest = trend[0];
    const newest = trend[trend.length - 1];
    const change = newest.unifiedScore - oldest.unifiedScore;
    const changePercent = (change / oldest.unifiedScore) * 100;

    if (change < -5) {
      return `📉 Improving: Risk score decreased ${Math.abs(changePercent).toFixed(1)}% over this period.`;
    }
    if (change > 5) {
      return `📈 Worsening: Risk score increased ${changePercent.toFixed(1)}% over this period.`;
    }
    return `➡️ Stable: Risk score holding steady around ${newest.unifiedScore}.`;
  }
}

// ─── OWASP Category Mapping Utilities ─────────────────────────────────────────

/**
 * Map vulnerability category string to OWASP category
 */
export function mapToOWASP(category: string): OWASPCategoryKey | null {
  const normalized = category.toUpperCase().replace(/[^A-Z]/g, '_');
  
  const mappings: Record<string, OWASPCategoryKey> = {
    'BOLA': 'BOLA',
    'IDOR': 'BOLA',
    'BROKEN_OBJECT': 'BOLA',
    'BROKEN_AUTH': 'BROKEN_AUTH',
    'AUTHENTICATION': 'BROKEN_AUTH',
    'EXCESSIVE_DATA': 'DATA_EXPOSURE',
    'MASS_ASSIGNMENT': 'DATA_EXPOSURE',
    'DATA_EXPOSURE': 'DATA_EXPOSURE',
    'RATE_LIMIT': 'RATE_LIMIT',
    'DOS': 'RATE_LIMIT',
    'RESOURCE_CONSUMPTION': 'RATE_LIMIT',
    'BFLA': 'BFLA',
    'BROKEN_FUNCTION': 'BFLA',
    'AUTHORIZATION': 'BFLA',
    'BUSINESS_FLOW': 'SENSITIVE_BUSINESS',
    'SCALPING': 'SENSITIVE_BUSINESS',
    'SSRF': 'SSRF',
    'REQUEST_FORGERY': 'SSRF',
    'MISCONFIGURATION': 'MISCONFIG',
    'SECURITY_CONFIG': 'MISCONFIG',
    'CORS': 'MISCONFIG',
    'SHADOW_API': 'INVENTORY',
    'IMPROPER_INVENTORY': 'INVENTORY',
    'INVENTORY': 'INVENTORY',
    'THIRD_PARTY': 'UNSAFE_CONSUMPTION',
    'UNSAFE_CONSUMPTION': 'UNSAFE_CONSUMPTION',
    'INJECTION': 'UNSAFE_CONSUMPTION',
  };

  return mappings[normalized] || null;
}

/**
 * Get OWASP details for a category key
 */
export function getOWASPDetails(categoryKey: OWASPCategoryKey): {
  id: string;
  name: string;
  pciRequirements: readonly string[];
} {
  return OWASP_CATEGORIES[categoryKey];
}

/**
 * Calculate compliance status based on OWASP findings
 */
export function calculateComplianceStatus(
  findings: Array<{ category: string; severity: string }>
): {
  pciCompliancePercentage: number;
  totalRequirements: number;
  requirementsPassed: number;
  requirementsFailed: number;
  affectedCategories: OWASPCategoryKey[];
} {
  const affectedCategories = new Set<OWASPCategoryKey>();
  let criticalOrHighCount = 0;

  for (const finding of findings) {
    const categoryKey = mapToOWASP(finding.category);
    if (categoryKey) {
      affectedCategories.add(categoryKey);
    }
    if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') {
      criticalOrHighCount++;
    }
  }

  // Count total PCI requirements across affected categories
  const affectedReqs = new Set<string>();
  for (const cat of affectedCategories) {
    for (const req of OWASP_CATEGORIES[cat].pciRequirements) {
      affectedReqs.add(req);
    }
  }

  const totalRequirements = affectedReqs.size;
  const requirementsFailed = criticalOrHighCount;
  const requirementsPassed = Math.max(0, totalRequirements - requirementsFailed);
  const pciCompliancePercentage = totalRequirements > 0 
    ? Math.round((requirementsPassed / totalRequirements) * 100) 
    : 100;

  return {
    pciCompliancePercentage,
    totalRequirements,
    requirementsPassed,
    requirementsFailed,
    affectedCategories: Array.from(affectedCategories),
  };
}

// ─── Severity Weights for OWASP ──────────────────────────────────────────────

export const OWASP_SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 10,
  HIGH: 7.5,
  MEDIUM: 5,
  LOW: 2.5,
  INFO: 0,
};

/**
 * Calculate OWASP risk score (0-100) from findings
 */
export function calculateOWASPRiskScore(
  findings: Array<{ owaspId: string; severity: string }>
): {
  score: number;
  byCategory: Record<string, { count: number; maxSeverity: string }>;
  owaspCategoriesDetected: string[];
} {
  const byCategory: Record<string, { count: number; maxSeverity: string }> = {};
  let totalScore = 0;

  for (const finding of findings) {
    const owaspId = finding.owaspId;
    const severity = finding.severity.toUpperCase();
    const weight = OWASP_SEVERITY_WEIGHTS[severity] || 0;

    if (!byCategory[owaspId]) {
      byCategory[owaspId] = { count: 0, maxSeverity: 'INFO' };
    }
    byCategory[owaspId].count++;
    
    // Update max severity
    const severityOrder = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (severityOrder.indexOf(severity) > severityOrder.indexOf(byCategory[owaspId].maxSeverity)) {
      byCategory[owaspId].maxSeverity = severity;
    }

    totalScore += weight;
  }

  // Normalize to 0-100
  const maxPossibleScore = findings.length * OWASP_SEVERITY_WEIGHTS.CRITICAL;
  const score = maxPossibleScore > 0 ? Math.min(100, Math.round((totalScore / maxPossibleScore) * 100)) : 0;

  return {
    score,
    byCategory,
    owaspCategoriesDetected: Object.keys(byCategory),
  };
}
