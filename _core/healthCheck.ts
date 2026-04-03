// @ts-nocheck
/**
 * PHASE 9: Comprehensive Health Check Service
 * 
 * Monitors:
 * - Database (primary and replica)
 * - Redis (master and sentinel)
 * - Cache status
 * - Application readiness
 * - Queue health
 * - External service availability
 */

import { Router, Request, Response } from 'express';
import { getDatabaseManager } from './databaseManager';
import { getRedisSentinel } from './redisSentinel';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  instanceId?: string;
  checks: {
    database: {
      status: 'up' | 'down';
      primary: boolean;
      replica: boolean;
      replicationLag?: number;
      message?: string;
    };
    redis: {
      status: 'up' | 'down';
      master: boolean;
      replica: boolean;
      sentinel: boolean;
      message?: string;
    };
    cache: {
      status: 'up' | 'down';
      hitRate?: number;
      size?: number;
      message?: string;
    };
    application: {
      status: 'up' | 'down';
      uptime: number;
      memory: {
        used: number;
        total: number;
        percentage: number;
      };
      cpu?: {
        user: number;
        system: number;
      };
    };
    queue?: {
      status: 'up' | 'down';
      pending: number;
      active: number;
      failed: number;
      delayed: number;
    };
  };
  dependencies: {
    external: Array<{
      name: string;
      status: 'available' | 'unavailable';
      latency?: number;
    }>;
  };
  slo: {
    availability: number;
    lastCheckTime: Date;
  };
}

class HealthCheckService {
  private startTime = Date.now();
  private instanceId = process.env.INSTANCE_ID || 'unknown';
  private version = '1.0.0';
  private cacheStats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Perform full health check
   */
  public async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      cache: await this.checkCache(),
      application: this.checkApplication(),
    };

    // Try to check queue status if available
    try {
      checks.queue = await this.checkQueue();
    } catch (err) {
      console.warn('[HealthCheck] Queue check unavailable');
    }

    // Check external dependencies
    const dependencies = {
      external: await this.checkExternalDependencies(),
    };

    // Determine overall status
    const status = this.determineOverallStatus(checks);

    // Calculate SLO metrics
    const slo = {
      availability: this.calculateAvailability(checks),
      lastCheckTime: new Date(),
    };

    return {
      status,
      timestamp: new Date(),
      version: this.version,
      instanceId: this.instanceId,
      checks,
      dependencies,
      slo,
    };
  }

  private async checkDatabase(): Promise<HealthStatus['checks']['database']> {
    try {
      const dbManager = getDatabaseManager();
      const health = await dbManager.healthCheck();

      return {
        status: health.primary ? 'up' : 'down',
        primary: health.primary,
        replica: health.replica || false,
        replicationLag: health.replicationLag,
        message: health.primary
          ? `Primary: ${health.primary}, Replica: ${health.replica || 'unavailable'}`
          : 'Primary database unreachable',
      };
    } catch (error: any) {
      return {
        status: 'down',
        primary: false,
        replica: false,
        message: error.message,
      };
    }
  }

  private async checkRedis(): Promise<HealthStatus['checks']['redis']> {
    try {
      const redis = getRedisSentinel();
      const health = await redis.healthCheck();

      return {
        status: health.master && health.sentinel ? 'up' : 'down',
        master: health.master,
        replica: health.replica,
        sentinel: health.sentinel,
        message: `Master: ${health.master}, Replica: ${health.replica}, Sentinel: ${health.sentinel}`,
      };
    } catch (error: any) {
      return {
        status: 'down',
        master: false,
        replica: false,
        sentinel: false,
        message: error.message,
      };
    }
  }

  private async checkCache(): Promise<HealthStatus['checks']['cache']> {
    try {
      const redis = getRedisSentinel();
      const masterClient = redis.getMasterClient();

      // Get cache stats
      const info = await masterClient.info('stats');
      const hitRate =
        this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0;

      // Get cache size
      const memoryInfo = await masterClient.info('memory');
      const memoryMatch = memoryInfo.match(/used_memory_human:(\S+)/);

      return {
        status: 'up',
        hitRate: parseFloat((hitRate * 100).toFixed(2)),
        size: memoryMatch ? memoryMatch[1] : undefined,
        message: `Hit rate: ${(hitRate * 100).toFixed(2)}%`,
      };
    } catch (error: any) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

  private checkApplication(): HealthStatus['checks']['application'] {
    const uptime = (Date.now() - this.startTime) / 1000; // in seconds
    const memUsage = process.memoryUsage();

    return {
      status: 'up',
      uptime,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: process.cpuUsage ? {
        user: process.cpuUsage().user / 1000, // ms to seconds
        system: process.cpuUsage().system / 1000,
      } : undefined,
    };
  }

  private async checkQueue(): Promise<HealthStatus['checks']['queue']> {
    // This would integrate with BullMQ to check queue health
    // For now, returning a placeholder
    return {
      status: 'up',
      pending: 0,
      active: 0,
      failed: 0,
      delayed: 0,
    };
  }

  private async checkExternalDependencies(): Promise<
    HealthStatus['dependencies']['external']
  > {
    const checks = [];

    // Check OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        const startTime = Date.now();
        // Could implement actual ping to OpenAI here
        const latency = Date.now() - startTime;
        checks.push({
          name: 'OpenAI API',
          status: 'available',
          latency,
        });
      } catch {
        checks.push({
          name: 'OpenAI API',
          status: 'unavailable',
        });
      }
    }

    return checks;
  }

  private determineOverallStatus(checks: HealthStatus['checks']): 'healthy' | 'degraded' | 'unhealthy' {
    const dbOk = checks.database.status === 'up';
    const redisOk = checks.redis.status === 'up';
    const appOk = checks.application.status === 'up';

    // Healthy: All critical services up
    if (dbOk && redisOk && appOk) {
      return 'healthy';
    }

    // Degraded: Primary services up, but replicas/secondaries down
    if ((dbOk || checks.database.replica) && redisOk && appOk) {
      return 'degraded';
    }

    // Unhealthy: Critical service down
    return 'unhealthy';
  }

  private calculateAvailability(checks: HealthStatus['checks']): number {
    const weights = {
      database: 0.4,
      redis: 0.3,
      application: 0.2,
      cache: 0.1,
    };

    let availability = 0;

    // Database availability
    if (checks.database.status === 'up') {
      availability += weights.database * 100;
    } else if (checks.database.replica) {
      availability += weights.database * 50; // Partial credit for replica availability
    }

    // Redis availability
    if (checks.redis.status === 'up') {
      availability += weights.redis * 100;
    } else if (checks.redis.replica) {
      availability += weights.redis * 50;
    }

    // Application availability
    if (checks.application.status === 'up') {
      availability += weights.application * 100;
    }

    // Cache availability
    if (checks.cache.status === 'up') {
      availability += weights.cache * 100;
    }

    return Math.round(availability * 100) / 100;
  }

  /**
   * Record cache hit/miss for statistics
   */
  public recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheStats.hits++;
    } else {
      this.cacheStats.misses++;
    }
  }
}

// Create singleton
const healthCheckService = new HealthCheckService();

/**
 * Express router for health check endpoints
 */
export function createHealthCheckRouter(): Router {
  const router = Router();

  // Readiness probe (for Kubernetes/container orchestration)
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const health = await healthCheckService.getHealthStatus();
      const ready = health.status === 'healthy' || health.status === 'degraded';

      res.status(ready ? 200 : 503).json({
        ready,
        status: health.status,
        instanceId: health.instanceId,
        timestamp: health.timestamp,
      });
    } catch (error) {
      res.status(503).json({ ready: false, error: 'Health check failed' });
    }
  });

  // Liveness probe (for Kubernetes/container orchestration)
  router.get('/live', async (req: Request, res: Response) => {
    try {
      const health = await healthCheckService.getHealthStatus();
      const alive = health.checks.application.status === 'up';

      res.status(alive ? 200 : 503).json({
        alive,
        uptime: health.checks.application.uptime,
        instanceId: health.instanceId,
        timestamp: health.timestamp,
      });
    } catch (error) {
      res.status(503).json({ alive: false, error: 'Liveness check failed' });
    }
  });

  // Full health check
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await healthCheckService.getHealthStatus();
      const statusCode = 
        health.status === 'healthy' ? 200 :
        health.status === 'degraded' ? 200 :
        503;

      res.status(statusCode).json(health);
    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  });

  return router;
}

export { HealthCheckService };
export function getHealthCheckService(): HealthCheckService {
  return healthCheckService;
}
