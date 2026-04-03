/**
 * DevPulse Distributed Rate Limiter
 * 
 * Redis-backed distributed rate limiting with sliding window algorithm.
 * Supports multiple limit types: global, per-workspace, per-user, per-endpoint.
 * 
 * @module DevPulse/RateLimiter
 */

// Rate limit types
export type LimitType = 'global' | 'workspace' | 'user' | 'endpoint' | 'ip';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  type: LimitType;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

// In-memory fallback when Redis is unavailable
const memoryStore: Map<string, { count: number; resetAt: number }> = new Map();

// Configuration defaults
const DEFAULT_LIMITS: RateLimitConfig[] = [
  { windowMs: 60000, maxRequests: 100, type: 'ip', blockDurationMs: 300000 },
  { windowMs: 60000, maxRequests: 1000, type: 'global', blockDurationMs: 60000 },
  { windowMs: 60000, maxRequests: 100, type: 'workspace', blockDurationMs: 300000 },
  { windowMs: 60000, maxRequests: 60, type: 'user', blockDurationMs: 300000 },
  { windowMs: 1000, maxRequests: 10, type: 'endpoint', blockDurationMs: 60000 },
];

class RateLimiter {
  private config: RateLimitConfig[];
  private redis: any = null;
  private redisUrl: string | null = null;

  constructor(config?: RateLimitConfig[]) {
    this.config = config || DEFAULT_LIMITS;
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      // Dynamic import to avoid issues when Redis is not available
      const { createClient } = await import('redis');
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = createClient({ url });
      this.redis.on('error', (err: Error) => console.error('[RateLimiter] Redis error:', err));
      
      await this.redis.connect().catch(() => {
        console.warn('[RateLimiter] Redis not available, using memory store');
        this.redis = null;
      });
    } catch (error) {
      console.warn('[RateLimiter] Redis initialization failed, using memory store');
      this.redis = null;
    }
  }

  /**
   * Generate rate limit key based on type
   */
  private generateKey(type: LimitType, identifier: string, endpoint?: string): string {
    switch (type) {
      case 'global':
        return `ratelimit:global`;
      case 'workspace':
        return `ratelimit:workspace:${identifier}`;
      case 'user':
        return `ratelimit:user:${identifier}`;
      case 'endpoint':
        return `ratelimit:endpoint:${endpoint}:ip:${identifier}`;
      case 'ip':
      default:
        return `ratelimit:ip:${identifier}`;
    }
  }

  /**
   * Get config for a limit type
   */
  private getConfigForType(type: LimitType, overrideConfig?: Partial<RateLimitConfig>): RateLimitConfig {
    const baseConfig = this.config.find(c => c.type === type) || {
      windowMs: 60000,
      maxRequests: 100,
      type,
    };
    return { ...baseConfig, ...overrideConfig };
  }

  /**
   * Check rate limit using sliding window algorithm
   */
  async checkLimit(
    type: LimitType,
    identifier: string,
    overrideConfig?: Partial<RateLimitConfig>,
    endpoint?: string
  ): Promise<RateLimitResult> {
    const config = this.getConfigForType(type, overrideConfig);
    const key = this.generateKey(type, identifier, endpoint);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const resetAt = now + config.windowMs;

    // Try Redis first
    if (this.redis && this.redis.isReady) {
      try {
        return await this.checkLimitRedis(key, config, now, windowStart, resetAt);
      } catch (error) {
        console.error('[RateLimiter] Redis check failed, using memory:', error);
      }
    }

    // Fallback to memory store
    return this.checkLimitMemory(key, config, now, windowStart, resetAt);
  }

  /**
   * Check limit using Redis (sliding window)
   */
  private async checkLimitRedis(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number,
    resetAt: number
  ): Promise<RateLimitResult> {
    const blockedKey = `${key}:blocked`;
    
    // Check if blocked
    const blocked = await this.redis.get(blockedKey);
    if (blocked) {
      const ttl = await this.redis.ttl(blockedKey);
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + (ttl * 1000),
        retryAfterMs: ttl * 1000,
      };
    }

    // Remove old entries outside window
    await this.redis.zRemRangeByScore(key, 0, windowStart);
    
    // Count current requests in window
    const count = await this.redis.zCard(key);
    
    if (count >= config.maxRequests) {
      // Block if configured
      if (config.blockDurationMs) {
        await this.redis.set(blockedKey, '1', { PX: config.blockDurationMs });
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: config.windowMs,
      };
    }

    // Add current request
    await this.redis.zAdd(key, { score: now, value: now.toString() });
    await this.redis.expire(key, Math.ceil(config.windowMs / 1000));

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetAt,
    };
  }

  /**
   * Check limit using memory store (fallback)
   */
  private checkLimitMemory(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number,
    resetAt: number
  ): RateLimitResult {
    const blockedKey = `${key}:blocked`;
    const blocked = memoryStore.get(blockedKey);
    
    if (blocked && blocked.resetAt > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: blocked.resetAt,
        retryAfterMs: blocked.resetAt - now,
      };
    }

    const entry = memoryStore.get(key);
    let requests: number[] = [];

    if (entry) {
      // Filter out expired requests
      const lastTime = entry.count;
      if (lastTime > windowStart) {
        requests = [lastTime];
      }
    }

    if (requests.length >= config.maxRequests) {
      if (config.blockDurationMs) {
        memoryStore.set(blockedKey, {
          count: 1,
          resetAt: now + config.blockDurationMs,
        });
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: config.windowMs,
      };
    }

    memoryStore.set(key, { count: now, resetAt: resetAt });

    return {
      allowed: true,
      remaining: config.maxRequests - requests.length - 1,
      resetAt,
    };
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(type: LimitType, identifier: string, endpoint?: string): Promise<void> {
    const key = this.generateKey(type, identifier, endpoint);
    const blockedKey = `${key}:blocked`;

    if (this.redis && this.redis.isReady) {
      await this.redis.del(key);
      await this.redis.del(blockedKey);
    } else {
      memoryStore.delete(key);
      memoryStore.delete(blockedKey);
    }
  }

  /**
   * Reset all rate limits for a workspace
   */
  async resetWorkspaceLimits(workspaceId: number): Promise<void> {
    if (this.redis && this.redis.isReady) {
      const keys = await this.redis.keys(`ratelimit:*:workspace:${workspaceId}:*`);
      const blockedKeys = await this.redis.keys(`ratelimit:*:workspace:${workspaceId}:*:blocked`);
      
      if (keys.length > 0) await this.redis.del(keys);
      if (blockedKeys.length > 0) await this.redis.del(blockedKeys);
    } else {
      for (const key of memoryStore.keys()) {
        if (key.includes(`workspace:${workspaceId}`)) {
          memoryStore.delete(key);
        }
      }
    }
  }

  /**
   * Get current rate limit status
   */
  async getStatus(
    type: LimitType,
    identifier: string,
    endpoint?: string
  ): Promise<{ used: number; limit: number; remaining: number; resetAt: number }> {
    const key = this.generateKey(type, identifier, endpoint);
    const now = Date.now();
    const windowStart = now - 60000;

    const config = this.getConfigForType(type);
    const limit = config.maxRequests;

    let used = 0;

    if (this.redis && this.redis.isReady) {
      try {
        await this.redis.zRemRangeByScore(key, 0, windowStart);
        used = await this.redis.zCard(key);
      } catch {
        used = 0;
      }
    } else {
      const entry = memoryStore.get(key);
      if (entry && entry.count > windowStart) {
        used = 1;
      }
    }

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: now + config.windowMs,
    };
  }

  /**
   * Cleanup expired entries from memory store
   */
  cleanupMemoryStore(): void {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }
}

// Singleton instance
let rateLimiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

// Express middleware factory
export function rateLimitMiddleware(
  type: LimitType,
  getIdentifier: (req: any) => string,
  config?: Partial<RateLimitConfig>
) {
  return async (req: any, res: any, next: any): Promise<void> => {
    const limiter = getRateLimiter();
    const identifier = getIdentifier(req);
    const endpoint = req.path;

    const result = await limiter.checkLimit(type, identifier, config, endpoint);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config?.maxRequests || 100);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));

    if (!result.allowed) {
      if (result.retryAfterMs) {
        res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
      }
      
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
        retryAfter: result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : undefined,
      });
      return;
    }

    next();
  };
}

// Common middleware presets
export function createGlobalRateLimit() {
  return rateLimitMiddleware('global', () => 'global');
}

export function createIpRateLimit() {
  return rateLimitMiddleware('ip', (req) => req.ip || 'unknown');
}

export function createWorkspaceRateLimit() {
  return rateLimitMiddleware('workspace', (req) => 
    req.user?.workspaceId?.toString() || req.headers['x-workspace-id']?.toString() || 'unknown'
  );
}

export function createUserRateLimit() {
  return rateLimitMiddleware('user', (req) => 
    req.user?.id?.toString() || req.headers['x-user-id']?.toString() || 'unknown'
  );
}

export function createEndpointRateLimit() {
  return rateLimitMiddleware('endpoint', 
    (req) => req.ip || 'unknown',
    { windowMs: 1000, maxRequests: 10 }
  );
}

// Cleanup memory store periodically
setInterval(() => {
  if (rateLimiter) {
    rateLimiter.cleanupMemoryStore();
  }
}, 60000); // Every minute

export default RateLimiter;
