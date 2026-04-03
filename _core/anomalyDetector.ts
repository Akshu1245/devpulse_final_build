/**
 * DevPulse Anomaly Detector
 * 
 * ML-based anomaly detection for API traffic and security events.
 * Detects unusual patterns, bot activity, and potential attacks.
 * 
 * @module DevPulse/AnomalyDetector
 */

import Redis from 'ioredis';

// Redis client
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }
  return redisClient;
}

// Anomaly types
export type AnomalyType =
  | 'unusual_traffic_volume'
  | 'unusual_endpoint_access'
  | 'unusual_time_access'
  | 'bot_detection'
  | 'brute_force'
  | 'credential_stuffing'
  | 'scraping'
  | 'ddos'
  | 'sql_injection_pattern'
  | 'xss_pattern'
  | 'unusual_error_rate'
  | 'unusual_response_time'
  | 'api_abuse';

// Anomaly severity
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

// Anomaly detection result
export interface AnomalyResult {
  detected: boolean;
  type?: AnomalyType;
  severity?: AnomalySeverity;
  score: number;           // 0-100 anomaly score
  confidence: number;       // 0-1 confidence
  description: string;
  indicators: string[];
  recommendations: string[];
  metadata?: Record<string, any>;
}

// API request features
export interface RequestFeatures {
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userId?: string;
  workspaceId: number;
  requestSize: number;
  responseSize: number;
  country?: string;
  asn?: string;
}

// Traffic baseline
export interface TrafficBaseline {
  endpoint: string;
  method: string;
  avgRequestsPerMinute: number;
  stdDevRequests: number;
  avgResponseTime: number;
  stdDevResponseTime: number;
  avgErrorRate: number;
  peakHour: number;
  commonUserAgents: string[];
  knownBots: string[];
}

/**
 * Anomaly Detector
 */
export class AnomalyDetector {
  private redis: Redis;
  private modelWindowMs: number = 86400000 * 7; // 7 days for baseline
  private anomalyThreshold: number = 75; // Score threshold for anomaly

  constructor() {
    this.redis = getRedis();
  }

  /**
   * Analyze a request for anomalies
   */
  async analyze(features: RequestFeatures): Promise<AnomalyResult> {
    const indicators: string[] = [];
    let totalScore = 0;
    let confidence = 0;
    let anomalyType: AnomalyType | undefined;
    let severity: AnomalySeverity = 'low';

    // Get baseline for this endpoint
    const baseline = await this.getEndpointBaseline(features.endpoint, features.method);

    // 1. Check for unusual traffic volume
    const trafficCheck = await this.checkTrafficVolume(features, baseline);
    if (trafficCheck.score > 0) {
      indicators.push(...trafficCheck.indicators);
      totalScore += trafficCheck.score * 0.3;
      if (trafficCheck.isAnomaly) {
        anomalyType = anomalyType || trafficCheck.type;
      }
    }

    // 2. Check for bot detection
    const botCheck = await this.checkBotDetection(features);
    if (botCheck.score > 0) {
      indicators.push(...botCheck.indicators);
      totalScore += botCheck.score * 0.4;
      if (botCheck.isAnomaly) {
        anomalyType = 'bot_detection';
        severity = 'medium';
      }
    }

    // 3. Check for brute force
    const bruteForceCheck = await this.checkBruteForce(features);
    if (bruteForceCheck.score > 0) {
      indicators.push(...bruteForceCheck.indicators);
      totalScore += bruteForceCheck.score * 0.5;
      if (bruteForceCheck.isAnomaly) {
        anomalyType = 'brute_force';
        severity = 'high';
      }
    }

    // 4. Check for scraping patterns
    const scrapingCheck = await this.checkScraping(features, baseline);
    if (scrapingCheck.score > 0) {
      indicators.push(...scrapingCheck.indicators);
      totalScore += scrapingCheck.score * 0.3;
      if (scrapingCheck.isAnomaly) {
        anomalyType = 'scraping';
        severity = 'medium';
      }
    }

    // 5. Check for injection patterns
    const injectionCheck = await this.checkInjectionPatterns(features);
    if (injectionCheck.score > 0) {
      indicators.push(...injectionCheck.indicators);
      totalScore += injectionCheck.score * 0.6;
      if (injectionCheck.isAnomaly) {
        anomalyType = injectionCheck.type;
        severity = 'critical';
      }
    }

    // 6. Check for unusual error rates
    const errorRateCheck = await this.checkErrorRate(features, baseline);
    if (errorRateCheck.score > 0) {
      indicators.push(...errorRateCheck.indicators);
      totalScore += errorRateCheck.score * 0.25;
      if (errorRateCheck.isAnomaly) {
        anomalyType = anomalyType || 'unusual_error_rate';
      }
    }

    // 7. Check for unusual response times
    const responseTimeCheck = await this.checkResponseTime(features, baseline);
    if (responseTimeCheck.score > 0) {
      indicators.push(...responseTimeCheck.indicators);
      totalScore += responseTimeCheck.score * 0.2;
      if (responseTimeCheck.isAnomaly) {
        anomalyType = anomalyType || 'unusual_response_time';
      }
    }

    // 8. Check for unusual access times
    const timeCheck = await this.checkUnusualTime(features);
    if (timeCheck.score > 0) {
      indicators.push(...timeCheck.indicators);
      totalScore += timeCheck.score * 0.1;
    }

    // Calculate confidence based on number of checks
    confidence = Math.min(1, indicators.length / 5);

    // Normalize score
    totalScore = Math.min(100, totalScore);

    // Determine final severity
    if (totalScore >= 90) severity = 'critical';
    else if (totalScore >= 75) severity = 'high';
    else if (totalScore >= 50) severity = 'medium';

    const detected = totalScore >= this.anomalyThreshold;

    return {
      detected,
      type: detected ? anomalyType : undefined,
      severity: detected ? severity : undefined,
      score: Math.round(totalScore),
      confidence,
      description: this.generateDescription(detected, totalScore, anomalyType, indicators),
      indicators,
      recommendations: this.generateRecommendations(detected, anomalyType, indicators),
      metadata: {
        ip: features.ip,
        endpoint: features.endpoint,
        timestamp: features.timestamp,
      },
    };
  }

  /**
   * Check for unusual traffic volume
   */
  private async checkTrafficVolume(
    features: RequestFeatures,
    baseline: TrafficBaseline | null
  ): Promise<{ score: number; isAnomaly: boolean; indicators: string[]; type?: AnomalyType }> {
    if (!baseline) {
      return { score: 0, isAnomaly: false, indicators: [] };
    }

    const indicators: string[] = [];
    let score = 0;

    // Check if request volume is unusual
    const key = `anomaly:volume:${features.endpoint}:${features.method}`;
    const count = await this.redis.incr(key);
    await this.redis.pexpire(key, 60000); // 1 minute window

    if (count > baseline.avgRequestsPerMinute * 3) {
      indicators.push(`Traffic volume ${count}x above baseline`);
      score += 30;
    } else if (count > baseline.avgRequestsPerMinute * 2) {
      indicators.push(`Traffic volume ${count.toFixed(1)}x above baseline`);
      score += 15;
    }

    // Check standard deviation
    const zScore = (count - baseline.avgRequestsPerMinute) / Math.max(1, baseline.stdDevRequests);
    if (Math.abs(zScore) > 3) {
      indicators.push(`Request count z-score: ${zScore.toFixed(2)}`);
      score += 20;
    }

    return {
      score,
      isAnomaly: score >= 40,
      indicators,
      type: score >= 40 ? 'unusual_traffic_volume' : undefined,
    };
  }

  /**
   * Check for bot detection
   */
  private async checkBotDetection(features: RequestFeatures): Promise<{ score: number; isAnomaly: boolean; indicators: string[] }> {
    const indicators: string[] = [];
    let score = 0;

    const ua = features.userAgent.toLowerCase();

    // Known bot patterns
    const botPatterns = [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests',
      'postman', 'insomnia', 'httpie', 'axios', 'node-fetch', 'go-http',
      'java/', 'ruby', 'perl', 'powershell', 'curl/', 'libcurl'
    ];

    for (const pattern of botPatterns) {
      if (ua.includes(pattern) && !ua.includes('chrome')) {
        // Non-browser user agent
        if (pattern === 'curl' || pattern === 'wget' || pattern === 'python-requests') {
          indicators.push(`CLI tool detected: ${pattern}`);
          score += 50;
        } else {
          indicators.push(`Possible bot: ${pattern}`);
          score += 30;
        }
        break;
      }
    }

    // Missing or minimal user agent
    if (features.userAgent.length < 20) {
      indicators.push('Minimal or missing User-Agent');
      score += 25;
    }

    // Check for automation headers
    const automationHeaders = [
      'x-requested-with',
      'x-scraper',
      'x-bot'
    ];

    for (const header of automationHeaders) {
      // Would check req.headers here in real implementation
    }

    return {
      score,
      isAnomaly: score >= 40,
      indicators,
    };
  }

  /**
   * Check for brute force attacks
   */
  private async checkBruteForce(features: RequestFeatures): Promise<{ score: number; isAnomaly: boolean; indicators: string[] }> {
    const indicators: string[] = [];
    let score = 0;

    // Check for rapid auth attempts
    const key = `anomaly:auth:${features.ip}`;
    const authAttempts = await this.redis.incr(key);
    await this.redis.pexpire(key, 300000); // 5 minute window

    if (authAttempts > 10) {
      indicators.push(`${authAttempts} auth attempts in 5 minutes`);
      score += 60;
    } else if (authAttempts > 5) {
      indicators.push(`${authAttempts} auth attempts in 5 minutes`);
      score += 30;
    }

    // Check for failed logins
    if (features.statusCode === 401 || features.statusCode === 403) {
      const failedKey = `anomaly:failed:${features.ip}`;
      const failedAttempts = await this.redis.incr(failedKey);
      await this.redis.pexpire(failedKey, 900000); // 15 minute window

      if (failedAttempts > 20) {
        indicators.push(`${failedAttempts} failed login attempts`);
        score += 70;
      } else if (failedAttempts > 10) {
        indicators.push(`${failedAttempts} failed login attempts`);
        score += 40;
      }
    }

    return {
      score,
      isAnomaly: score >= 50,
      indicators,
    };
  }

  /**
   * Check for scraping patterns
   */
  private async checkScraping(
    features: RequestFeatures,
    baseline: TrafficBaseline | null
  ): Promise<{ score: number; isAnomaly: boolean; indicators: string[] }> {
    const indicators: string[] = [];
    let score = 0;

    // Check for sequential endpoint access
    const seqKey = `anomaly:seq:${features.ip}`;
    const sequence = await this.redis.lrange(seqKey, 0, -1);
    await this.redis.rpush(seqKey, features.endpoint);
    await this.redis.expire(seqKey, 300);

    // Detect systematic access patterns
    if (sequence.length >= 10) {
      const uniqueEndpoints = new Set(sequence).size;
      const ratio = uniqueEndpoints / sequence.length;

      if (ratio > 0.9 && sequence.length >= 20) {
        indicators.push('Systematic endpoint crawling detected');
        score += 40;
      }
    }

    // Check for pagination abuse
    if (features.endpoint.includes('offset') || features.endpoint.includes('page')) {
      const pageKey = `anomaly:pages:${features.ip}`;
      const pageCount = await this.redis.incr(pageKey);
      await this.redis.pexpire(pageKey, 60000);

      if (pageCount > 100) {
        indicators.push(`Excessive pagination: ${pageCount} pages`);
        score += 50;
      }
    }

    return {
      score,
      isAnomaly: score >= 40,
      indicators,
    };
  }

  /**
   * Check for SQL injection and XSS patterns
   */
  private checkInjectionPatterns(features: RequestFeatures): { score: number; isAnomaly: boolean; indicators: string[]; type?: AnomalyType } {
    const indicators: string[] = [];
    let score = 0;
    let type: AnomalyType | undefined;

    const dangerousPatterns = {
      sql_injection: [
        /('|"|;|--|\/\*|\*\/|union|select|insert|update|delete|drop|exec|execute)/i,
        /(or|and)\s+\d+\s*=\s*\d+/i,
        /('\s*(or|and)\s*')/i,
        /(union\s+all\s+select)/i,
      ],
      xss: [
        /<script|<\/script>|<iframe|javascript:|on\w+\s*=/i,
        /(\%3C|\%3E|\%22|\%27)/i,
        /(&#x|<|>)/i,
      ],
      command_injection: [
        /(\||;|`|\$\(|\\x)/i,
        /(rm\s+-rf|wget|curl|nc\s+-e)/i,
      ],
      path_traversal: [
        /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f)/i,
      ],
    };

    // Check request URL/params
    const checkString = `${features.endpoint}`.toLowerCase();

    for (const [patternType, patterns] of Object.entries(dangerousPatterns)) {
      for (const pattern of patterns as RegExp[]) {
        if (pattern.test(checkString)) {
          indicators.push(`Potential ${patternType} pattern detected`);
          
          if (patternType === 'sql_injection') {
            type = 'sql_injection_pattern';
            score += 60;
          } else if (patternType === 'xss') {
            type = 'xss_pattern';
            score += 50;
          }
          break;
        }
      }
    }

    return {
      score,
      isAnomaly: score >= 40,
      indicators,
      type,
    };
  }

  /**
   * Check for unusual error rates
   */
  private async checkErrorRate(
    features: RequestFeatures,
    baseline: TrafficBaseline | null
  ): Promise<{ score: number; isAnomaly: boolean; indicators: string[] }> {
    const indicators: string[] = [];
    let score = 0;

    if (features.statusCode >= 400) {
      const errorKey = `anomaly:errors:${features.endpoint}`;
      const errorCount = await this.redis.incr(errorKey);
      await this.redis.pexpire(errorKey, 300000); // 5 minutes

      if (baseline && baseline.avgErrorRate > 0) {
        const errorRate = errorCount / Math.max(1, baseline.avgRequestsPerMinute);
        
        if (errorRate > baseline.avgErrorRate * 5) {
          indicators.push(`Error rate ${errorRate.toFixed(2)} is ${(errorRate / baseline.avgErrorRate).toFixed(1)}x above baseline`);
          score += 40;
        }
      }

      if (errorCount > 50) {
        indicators.push(`${errorCount} errors in 5 minutes`);
        score += 30;
      }
    }

    return {
      score,
      isAnomaly: score >= 35,
      indicators,
    };
  }

  /**
   * Check for unusual response times
   */
  private async checkResponseTime(
    features: RequestFeatures,
    baseline: TrafficBaseline | null
  ): Promise<{ score: number; isAnomaly: boolean; indicators: string[] }> {
    const indicators: string[] = [];
    let score = 0;

    if (baseline) {
      const zScore = (features.responseTime - baseline.avgResponseTime) / Math.max(1, baseline.stdDevResponseTime);

      if (Math.abs(zScore) > 5) {
        indicators.push(`Response time z-score: ${zScore.toFixed(2)}`);
        score += 30;
      }

      if (features.responseTime > baseline.avgResponseTime * 10) {
        indicators.push('Response time 10x above average');
        score += 40;
      }
    }

    // Absolute thresholds
    if (features.responseTime > 30000) {
      indicators.push('Response time > 30 seconds');
      score += 20;
    }

    return {
      score,
      isAnomaly: score >= 30,
      indicators,
    };
  }

  /**
   * Check for unusual access times
   */
  private async checkUnusualTime(features: RequestFeatures): Promise<{ score: number; isAnomaly: boolean; indicators: string[] }> {
    const indicators: string[] = [];
    let score = 0;

    const hour = new Date(features.timestamp).getHours();

    // Very unusual hours (2 AM - 5 AM) for non-admin operations
    if (hour >= 2 && hour <= 5) {
      const lateNightKey = `anomaly:latenight:${features.ip}`;
      const lateNightCount = await this.redis.incr(lateNightKey);
      await this.redis.pexpire(lateNightKey, 3600000); // 1 hour

      if (lateNightCount > 20) {
        indicators.push('High activity during unusual hours');
        score += 15;
      }
    }

    return {
      score,
      isAnomaly: score >= 15,
      indicators,
    };
  }

  /**
   * Get endpoint baseline
   */
  private async getEndpointBaseline(endpoint: string, method: string): Promise<TrafficBaseline | null> {
    const key = `baseline:${endpoint}:${method}`;
    const data = await this.redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      endpoint,
      method,
      avgRequestsPerMinute: parseFloat(data.avgRequestsPerMinute || '0'),
      stdDevRequests: parseFloat(data.stdDevRequests || '0'),
      avgResponseTime: parseFloat(data.avgResponseTime || '0'),
      stdDevResponseTime: parseFloat(data.stdDevResponseTime || '0'),
      avgErrorRate: parseFloat(data.avgErrorRate || '0'),
      peakHour: parseInt(data.peakHour || '12'),
      commonUserAgents: [],
      knownBots: [],
    };
  }

  /**
   * Generate anomaly description
   */
  private generateDescription(
    detected: boolean,
    score: number,
    type?: AnomalyType,
    indicators?: string[]
  ): string {
    if (!detected) {
      return 'No anomaly detected. Request appears normal.';
    }

    const typeDescriptions: Record<string, string> = {
      unusual_traffic_volume: 'Unusual traffic volume detected',
      unusual_endpoint_access: 'Unusual endpoint access pattern',
      unusual_time_access: 'Access during unusual time period',
      bot_detection: 'Automated bot activity detected',
      brute_force: 'Potential brute force attack',
      credential_stuffing: 'Credential stuffing attack detected',
      scraping: 'Web scraping activity detected',
      ddos: 'Potential DDoS attack detected',
      sql_injection_pattern: 'SQL injection attempt detected',
      xss_pattern: 'Cross-site scripting attempt detected',
      unusual_error_rate: 'Unusual error rate detected',
      unusual_response_time: 'Unusual response time detected',
      api_abuse: 'API abuse pattern detected',
    };

    const base = typeDescriptions[type || 'api_abuse'] || 'Anomalous behavior detected';
    return `${base} (score: ${score}, ${indicators?.length || 0} indicators)`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    detected: boolean,
    type?: AnomalyType,
    indicators?: string[]
  ): string[] {
    if (!detected) {
      return [];
    }

    const recommendations: string[] = [];

    switch (type) {
      case 'brute_force':
      case 'credential_stuffing':
        recommendations.push('Implement account lockout after failed attempts');
        recommendations.push('Enable CAPTCHA after 3 failed attempts');
        recommendations.push('Consider implementing 2FA');
        recommendations.push('Block IP after excessive failed attempts');
        break;
      case 'scraping':
        recommendations.push('Implement rate limiting per IP');
        recommendations.push('Add CAPTCHA for high-volume endpoints');
        recommendations.push('Consider implementing API key authentication');
        break;
      case 'sql_injection_pattern':
      case 'xss_pattern':
        recommendations.push('Validate and sanitize all input');
        recommendations.push('Use parameterized queries');
        recommendations.push('Implement input filtering');
        recommendations.push('Review and update WAF rules');
        break;
      case 'bot_detection':
        recommendations.push('Implement bot detection middleware');
        recommendations.push('Consider adding CAPTCHA challenges');
        recommendations.push('Require authentication for sensitive endpoints');
        break;
      case 'unusual_traffic_volume':
        recommendations.push('Investigate source of traffic');
        recommendations.push('Consider scaling infrastructure');
        recommendations.push('Review CDN or DDoS protection');
        break;
      case 'api_abuse':
        recommendations.push('Review API usage patterns');
        recommendations.push('Implement stricter rate limits');
        recommendations.push('Consider IP-based blocking');
        break;
      default:
        recommendations.push('Investigate the detected anomalies');
        recommendations.push('Review security logs for related activity');
    }

    return recommendations;
  }

  /**
   * Update baseline with new data point
   */
  async updateBaseline(
    endpoint: string,
    method: string,
    responseTime: number,
    isError: boolean
  ): Promise<void> {
    const key = `baseline:${endpoint}:${method}`;
    const now = Date.now();

    // Update running totals (simplified - production would use more sophisticated stats)
    await this.redis.hincrbyfloat(key, 'totalRequests', 1);
    await this.redis.hincrbyfloat(key, 'totalResponseTime', responseTime);
    await this.redis.hincrbyfloat(key, 'totalErrors', isError ? 1 : 0);

    // Set expiration (7 days)
    await this.redis.expire(key, 86400 * 7);
  }

  /**
   * Get anomaly statistics
   */
  async getStatistics(workspaceId: number): Promise<{
    totalAnomalies: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentAnomalies: any[];
  }> {
    const statsKey = `anomaly:stats:${workspaceId}`;
    const stats = await this.redis.hgetall(statsKey);

    const recentKey = `anomaly:recent:${workspaceId}`;
    const recentData = await this.redis.lrange(recentKey, 0, 99);
    const recentAnomalies = recentData.map(d => JSON.parse(d));

    return {
      totalAnomalies: parseInt(stats.total || '0'),
      byType: JSON.parse(stats.byType || '{}'),
      bySeverity: JSON.parse(stats.bySeverity || '{}'),
      recentAnomalies,
    };
  }
}

// Singleton instance
let anomalyDetector: AnomalyDetector | null = null;

export function getAnomalyDetector(): AnomalyDetector {
  if (!anomalyDetector) {
    anomalyDetector = new AnomalyDetector();
  }
  return anomalyDetector;
}

// Convenience function
export async function detectAnomaly(features: RequestFeatures): Promise<AnomalyResult> {
  const detector = getAnomalyDetector();
  const result = await detector.analyze(features);

  // Store anomaly if detected
  if (result.detected) {
    await storeAnomaly(features.workspaceId, result);
  }

  return result;
}

// Store detected anomaly
async function storeAnomaly(workspaceId: number, result: AnomalyResult): Promise<void> {
  const redis = getRedis();
  const key = `anomaly:recent:${workspaceId}`;

  const anomaly = {
    ...result,
    timestamp: Date.now(),
  };

  await redis.lpush(key, JSON.stringify(anomaly));
  await redis.ltrim(key, 0, 999); // Keep last 1000

  // Update stats
  const statsKey = `anomaly:stats:${workspaceId}`;
  await redis.hincrby(statsKey, 'total', 1);

  if (result.type) {
    await getRedis().hincrby(statsKey, `type:${result.type}`, 1);
  }

  if (result.severity) {
    await getRedis().hincrby(statsKey, `severity:${result.severity}`, 1);
  }
}
