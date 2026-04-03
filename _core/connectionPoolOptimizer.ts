/**
 * PHASE 9C: Connection Pool & Resource Optimization
 * 
 * Manages connection pool tuning based on:
 * - Application load
 * - Available system resources
 * - Observed latency patterns
 * - Service scaling requirements
 */

export interface PoolOptimizationMetrics {
  poolType: 'database' | 'redis' | 'http';
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  utilizationPercent: number;
  avgWaitTime: number; // milliseconds
  p99WaitTime: number; // milliseconds
  connectionTimeout: number; // milliseconds
  idleTimeout: number; // milliseconds
}

export interface PoolRecommendation {
  metric: string;
  current: number;
  recommended: number;
  reason: string;
  impact: 'high' | 'medium' | 'low';
}

class ConnectionPoolOptimizer {
  private metrics: Map<string, PoolOptimizationMetrics> = new Map();
  private history: Map<string, PoolOptimizationMetrics[]> = new Map();
  private recommendations: Map<string, PoolRecommendation[]> = new Map();

  /**
   * Record pool metrics
   */
  public recordMetrics(poolId: string, metrics: PoolOptimizationMetrics): void {
    this.metrics.set(poolId, metrics);

    // Keep rolling history (last 100 samples)
    const history = this.history.get(poolId) || [];
    history.push(metrics);
    if (history.length > 100) {
      history.shift();
    }
    this.history.set(poolId, history);

    // Update recommendations based on current metrics
    this.updateRecommendations(poolId, metrics);
  }

  /**
   * Analyze pool metrics and generate recommendations
   */
  private updateRecommendations(poolId: string, metrics: PoolOptimizationMetrics): void {
    const recommendations: PoolRecommendation[] = [];

    // 1. Pool Size Analysis
    if (metrics.utilizationPercent > 90) {
      recommendations.push({
        metric: 'total_connections',
        current: metrics.totalConnections,
        recommended: Math.floor(metrics.totalConnections * 1.5),
        reason: 'Pool utilization consistently >90%, increase max connections',
        impact: 'high',
      });
    } else if (metrics.utilizationPercent < 20 && metrics.totalConnections > 10) {
      recommendations.push({
        metric: 'total_connections',
        current: metrics.totalConnections,
        recommended: Math.max(5, Math.floor(metrics.totalConnections * 0.7)),
        reason: 'Pool utilization <20%, consider reducing max connections',
        impact: 'low',
      });
    }

    // 2. Idle Timeout Analysis
    if (metrics.idleConnections > metrics.totalConnections * 0.5 && metrics.idleTimeout > 10000) {
      recommendations.push({
        metric: 'idle_timeout_ms',
        current: metrics.idleTimeout,
        recommended: 10000, // 10 seconds
        reason: 'High idle connection count, reduce idle timeout to free resources',
        impact: 'medium',
      });
    }

    // 3. Connection Timeout Analysis
    if (metrics.avgWaitTime > metrics.connectionTimeout * 0.8) {
      recommendations.push({
        metric: 'connection_timeout_ms',
        current: metrics.connectionTimeout,
        recommended: Math.floor(metrics.connectionTimeout * 1.5),
        reason: 'Connection acquisition time near timeout, increase timeout or pool size',
        impact: 'high',
      });
    }

    // 4. Waiting Requests Analysis
    if (metrics.waitingRequests > metrics.totalConnections) {
      recommendations.push({
        metric: 'total_connections',
        current: metrics.totalConnections,
        recommended: Math.floor(metrics.totalConnections * 1.2),
        reason: `${metrics.waitingRequests} requests queued, increase pool size`,
        impact: 'high',
      });
    }

    // 5. Performance Analysis
    if (metrics.p99WaitTime > 500) {
      // > 500ms for P99 is high
      recommendations.push({
        metric: 'pool_performance',
        current: metrics.p99WaitTime,
        recommended: 200,
        reason: `P99 wait time (${metrics.p99WaitTime}ms) exceeds target (200ms)`,
        impact: 'high',
      });
    }

    this.recommendations.set(poolId, recommendations);
  }

  /**
   * Get pool metrics
   */
  public getMetrics(poolId: string): PoolOptimizationMetrics | undefined {
    return this.metrics.get(poolId);
  }

  /**
   * Get all pool metrics
   */
  public getAllMetrics(): Record<string, PoolOptimizationMetrics> {
    const result: Record<string, PoolOptimizationMetrics> = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Get recommendations for a pool
   */
  public getRecommendations(poolId: string): PoolRecommendation[] {
    return this.recommendations.get(poolId) || [];
  }

  /**
   * Get historical trend for a pool
   */
  public getTrend(
    poolId: string,
    metric: keyof PoolOptimizationMetrics
  ): {
    values: any[];
    trend: 'increasing' | 'decreasing' | 'stable';
    slope: number; // Rate of change per sample
  } {
    const history = this.history.get(poolId) || [];
    if (history.length < 2) {
      return { values: [], trend: 'stable', slope: 0 };
    }

    const values = history.map((h) => h[metric]);
    const firstValue = values[0] as unknown as number;
    const lastValue = values[values.length - 1] as unknown as number;
    const slope = (lastValue - firstValue) / history.length;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > firstValue * 0.05) {
      trend = 'increasing';
    } else if (slope < -firstValue * 0.05) {
      trend = 'decreasing';
    }

    return { values, trend, slope };
  }

  /**
   * Get optimal pool configuration based on analysis
   */
  public getOptimalConfiguration(poolId: string): {
    minConnections: number;
    maxConnections: number;
    connectionTimeoutMs: number;
    idleTimeoutMs: number;
    reason: string;
  } {
    const metrics = this.metrics.get(poolId);
    if (!metrics) {
      throw new Error(`No metrics found for pool: ${poolId}`);
    }

    let minConnections = Math.max(2, Math.floor(metrics.totalConnections * 0.3));
    let maxConnections = metrics.totalConnections;
    let connectionTimeoutMs = metrics.connectionTimeout;
    let idleTimeoutMs = metrics.idleTimeout;
    const reasons: string[] = [];

    // Analyze wait times
    const waitTrend = this.getTrend(poolId, 'avgWaitTime');
    if (waitTrend.trend === 'increasing') {
      maxConnections = Math.min(maxConnections * 1.2, maxConnections + 10);
      reasons.push('Wait time increasing - increasing max connections');
    }

    // Analyze utilization
    if (metrics.utilizationPercent > 85) {
      maxConnections = Math.ceil(maxConnections * 1.25);
      reasons.push('High utilization - increasing pool size');
    } else if (metrics.utilizationPercent < 25) {
      minConnections = Math.max(2, Math.floor(minConnections * 0.8));
      idleTimeoutMs = 15000; // Aggressive cleanup
      reasons.push('Low utilization - reducing min connections and idle timeout');
    }

    // Ensure min <= max
    minConnections = Math.min(minConnections, maxConnections);

    return {
      minConnections,
      maxConnections: Math.ceil(maxConnections),
      connectionTimeoutMs,
      idleTimeoutMs,
      reason: reasons.join('; '),
    };
  }

  /**
   * Generate optimization report
   */
  public generateReport(): {
    pools: Record<string, any>;
    summary: {
      totalPoolsMonitored: number;
      healthyPools: number;
      poolsNeedingAttention: number;
      criticalIssues: PoolRecommendation[];
    };
  } {
    const pools: Record<string, any> = {};
    const criticalIssues: PoolRecommendation[] = [];

    this.metrics.forEach((metrics, poolId) => {
      const recommendations = this.recommendations.get(poolId) || [];
      const optimalConfig = this.getOptimalConfiguration(poolId);
      const trend = this.getTrend(poolId, 'avgWaitTime');

      pools[poolId] = {
        current: metrics,
        optimal: optimalConfig,
        recommendations,
        trend: trend.trend,
        status: recommendations.length === 0 ? 'healthy' : 'needs_attention',
      };

      // Collect critical issues
      recommendations
        .filter((r) => r.impact === 'high')
        .forEach((r) => criticalIssues.push(r));
    });

    const healthyPools = Object.values(pools).filter((p: any) => p.status === 'healthy')
      .length;
    const poolsNeedingAttention = this.metrics.size - healthyPools;

    return {
      pools,
      summary: {
        totalPoolsMonitored: this.metrics.size,
        healthyPools,
        poolsNeedingAttention,
        criticalIssues,
      },
    };
  }
}

export const connectionPoolOptimizer = new ConnectionPoolOptimizer();

// ==================== COMMON POOL CONFIGURATIONS ====================

export const DATABASE_POOL_CONFIG = {
  production: {
    minConnections: 5,
    maxConnections: 20,
    connectionTimeoutMs: 30000,
    idleTimeoutMs: 30000,
  },
  development: {
    minConnections: 2,
    maxConnections: 5,
    connectionTimeoutMs: 10000,
    idleTimeoutMs: 30000,
  },
};

export const REDIS_POOL_CONFIG = {
  production: {
    minConnections: 3,
    maxConnections: 10,
    connectionTimeoutMs: 10000,
    idleTimeoutMs: 30000,
  },
  development: {
    minConnections: 1,
    maxConnections: 3,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 30000,
  },
};

export const HTTP_POOL_CONFIG = {
  production: {
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    keepAliveTimeout: 60000,
  },
  development: {
    maxSockets: 50,
    maxFreeSockets: 5,
    timeout: 30000,
    keepAliveTimeout: 30000,
  },
};
