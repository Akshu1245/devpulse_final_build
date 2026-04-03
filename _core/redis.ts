/**
 * DevPulse Redis Client
 * 
 * Centralized Redis client with proper error handling and fallbacks.
 * All modules should import redis from here instead of creating their own instances.
 * 
 * @module DevPulse/Redis
 */

import Redis from 'ioredis';
import { ENV } from './env.js';

// Redis client singleton
let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Get the Redis client instance
 * Creates a new connection if one doesn't exist
 */
export function getRedis(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 10) {
          console.warn('[Redis] Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Connected');
    });

    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Error:', err.message);
      isConnected = false;
    });

    redisClient.on('close', () => {
      isConnected = false;
      console.log('[Redis] Connection closed');
    });

    // Auto-connect
    redisClient.connect().catch((err) => {
      console.error('[Redis] Initial connection failed:', err.message);
    });
  }

  return redisClient;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Close the Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
  }
}

// Export the redis instance for backwards compatibility
// This is the recommended way to access Redis
export const redis = {
  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    try {
      return await getRedis().get(key);
    } catch (error) {
      console.warn('[Redis] Get failed:', error);
      return null;
    }
  },

  /**
   * Set a value in Redis with optional expiry
   */
  async set(key: string, value: string, expiryMode?: string, duration?: number): Promise<string | null> {
    try {
      const client = getRedis();
      if (expiryMode && duration) {
        // Use setEx for simple expiry (seconds)
        if (expiryMode === 'EX') {
          return await client.setex(key, duration, value);
        }
        return await client.set(key, value, expiryMode as any, duration);
      }
      return await client.set(key, value);
    } catch (error) {
      console.warn('[Redis] Set failed:', error);
      return null;
    }
  },

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    try {
      return await getRedis().del(key);
    } catch (error) {
      console.warn('[Redis] Del failed:', error);
      return 0;
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    try {
      return await getRedis().exists(key);
    } catch (error) {
      console.warn('[Redis] Exists failed:', error);
      return 0;
    }
  },

  /**
   * Increment a value
   */
  async incr(key: string): Promise<number> {
    try {
      return await getRedis().incr(key);
    } catch (error) {
      console.warn('[Redis] Incr failed:', error);
      return 0;
    }
  },

  /**
   * Set expiry on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await getRedis().expire(key, seconds);
    } catch (error) {
      console.warn('[Redis] Expire failed:', error);
      return 0;
    }
  },

  /**
   * Get multiple keys
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    try {
      return await getRedis().mget(...keys);
    } catch (error) {
      console.warn('[Redis] MGet failed:', error);
      return keys.map(() => null);
    }
  },

  /**
   * Set multiple keys
   */
  async mset(...keyValues: string[]): Promise<string> {
    try {
      return await getRedis().mset(...keyValues);
    } catch (error) {
      console.warn('[Redis] MSet failed:', error);
      return 'OK';
    }
  },

  /**
   * Execute a Lua script
   */
  async eval(script: string, keys: string[], args: (string | number)[]): Promise<any> {
    try {
      return await getRedis().eval(script, keys.length, ...keys, ...args);
    } catch (error) {
      console.warn('[Redis] Eval failed:', error);
      return null;
    }
  },

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string): Promise<number> {
    try {
      return await getRedis().publish(channel, message);
    } catch (error) {
      console.warn('[Redis] Publish failed:', error);
      return 0;
    }
  },

  /**
   * Subscribe to a channel (returns a new subscriber connection)
   */
  subscribe(channel: string, callback: (message: string) => void): Redis {
    const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(msg);
      }
    });
    return subscriber;
  },

  /**
   * Get the raw Redis client for advanced operations
   */
  getClient(): Redis {
    return getRedis();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Set operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add member(s) to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await getRedis().sadd(key, ...members);
    } catch (error) {
      console.warn('[Redis] SAdd failed:', error);
      return 0;
    }
  },

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await getRedis().smembers(key);
    } catch (error) {
      console.warn('[Redis] SMembers failed:', error);
      return [];
    }
  },

  /**
   * Remove member(s) from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await getRedis().srem(key, ...members);
    } catch (error) {
      console.warn('[Redis] SRem failed:', error);
      return 0;
    }
  },

  /**
   * Check if member is in set
   */
  async sismember(key: string, member: string): Promise<number> {
    try {
      return await getRedis().sismember(key, member);
    } catch (error) {
      console.warn('[Redis] SIsMember failed:', error);
      return 0;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // List operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Push to the left of a list
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await getRedis().lpush(key, ...values);
    } catch (error) {
      console.warn('[Redis] LPush failed:', error);
      return 0;
    }
  },

  /**
   * Pop from the right of a list
   */
  async rpop(key: string): Promise<string | null> {
    try {
      return await getRedis().rpop(key);
    } catch (error) {
      console.warn('[Redis] RPop failed:', error);
      return null;
    }
  },

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    try {
      return await getRedis().llen(key);
    } catch (error) {
      console.warn('[Redis] LLen failed:', error);
      return 0;
    }
  },

  /**
   * Get range of list elements
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await getRedis().lrange(key, start, stop);
    } catch (error) {
      console.warn('[Redis] LRange failed:', error);
      return [];
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Hash operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all fields and values of a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await getRedis().hgetall(key);
    } catch (error) {
      console.warn('[Redis] HGetAll failed:', error);
      return {};
    }
  },

  /**
   * Get value of a hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await getRedis().hget(key, field);
    } catch (error) {
      console.warn('[Redis] HGet failed:', error);
      return null;
    }
  },

  /**
   * Set value of a hash field
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await getRedis().hset(key, field, value);
    } catch (error) {
      console.warn('[Redis] HSet failed:', error);
      return 0;
    }
  },

  /**
   * Increment value of a hash field by amount
   */
  async hincrby(key: string, field: string, amount: number): Promise<number> {
    try {
      return await getRedis().hincrby(key, field, amount);
    } catch (error) {
      console.warn('[Redis] HIncrBy failed:', error);
      return 0;
    }
  },

  /**
   * Delete hash fields
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await getRedis().hdel(key, ...fields);
    } catch (error) {
      console.warn('[Redis] HDel failed:', error);
      return 0;
    }
  },

  /**
   * Check if hash field exists
   */
  async hexists(key: string, field: string): Promise<number> {
    try {
      return await getRedis().hexists(key, field);
    } catch (error) {
      console.warn('[Redis] HExists failed:', error);
      return 0;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Key operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await getRedis().keys(pattern);
    } catch (error) {
      console.warn('[Redis] Keys failed:', error);
      return [];
    }
  },

  /**
   * Set key TTL
   */
  async ttl(key: string): Promise<number> {
    try {
      return await getRedis().ttl(key);
    } catch (error) {
      console.warn('[Redis] TTL failed:', error);
      return -1;
    }
  },

  /**
   * Rename a key
   */
  async rename(oldKey: string, newKey: string): Promise<string> {
    try {
      return await getRedis().rename(oldKey, newKey);
    } catch (error) {
      console.warn('[Redis] Rename failed:', error);
      return 'OK';
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Sorted Set operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add to sorted set
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await getRedis().zadd(key, score, member);
    } catch (error) {
      console.warn('[Redis] ZAdd failed:', error);
      return 0;
    }
  },

  /**
   * Get range of sorted set by rank
   */
  async zrange(key: string, start: number, stop: number, withScores?: 'WITHSCORES'): Promise<string[]> {
    try {
      return await getRedis().zrange(key, start, stop, withScores as any);
    } catch (error) {
      console.warn('[Redis] ZRange failed:', error);
      return [];
    }
  },

  /**
   * Remove from sorted set by range
   */
  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    try {
      return await getRedis().zremrangebyscore(key, min, max);
    } catch (error) {
      console.warn('[Redis] ZRemRangeByScore failed:', error);
      return 0;
    }
  },
};

export default redis;
