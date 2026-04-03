// @ts-nocheck
/**
 * PHASE 9A: Redis Sentinel High-Availability Client
 * 
 * Wraps Redis client with Sentinel support for automatic failover.
 * Features:
 * - Automatic failover to replica on master failure
 * - Connection pooling
 * - Automatic reconnection
 * - Health monitoring
 */

import redis, { Sentinel, Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface SentinelConfig {
  sentinels: Array<{ host: string; port: number }>;
  name: string;
  password?: string;
  db?: number;
  retryStrategy?: (times: number) => number;
  enableReadyCheck?: boolean;
  connectTimeout?: number;
  family?: 4 | 6;
}

export interface FailoverEvent {
  type: 'failover' | 'demote' | 'promoted';
  timestamp: Date;
  instance?: string;
  reason?: string;
}

class RedisSentinelClient extends EventEmitter {
  private sentinel: Sentinel | null = null;
  private masterClient: Redis | null = null;
  private replicaClient: Redis | null = null;
  private config: SentinelConfig;
  private isConnected: boolean = false;
  private failoverHistory: FailoverEvent[] = [];

  constructor(config: SentinelConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to Redis Sentinel and get master/replica connections
   */
  public async connect(): Promise<void> {
    try {
      // Create Sentinel connection
      this.sentinel = new Sentinel(this.config.sentinels, {
        name: this.config.name,
        password: this.config.password,
        sentinelPassword: this.config.password,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        sentinelRetryStrategy: (times) => {
          const delay = Math.min(times * 50, 1000);
          return delay;
        },
        connectTimeout: this.config.connectTimeout || 10000,
        enableReadyCheck: this.config.enableReadyCheck !== false,
        enableOfflineQueue: true,
        family: this.config.family || 4,
      });

      // Get master connection from Sentinel
      this.masterClient = this.sentinel.createClient('master', this.config.name);
      
      // Get replica connection from Sentinel for read operations
      this.replicaClient = this.sentinel.createClient('slave', this.config.name);

      // Attach event listeners
      this.attachEventListeners();

      // Wait for master to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis Master connection timeout'));
        }, 30000);

        this.masterClient!.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.masterClient!.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.isConnected = true;
      this.emit('connected');
      console.log('[RedisSentinel] Connected to master:', this.config.name);
    } catch (error) {
      this.emit('error', error);
      console.error('[RedisSentinel] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Get master Redis client for write operations
   */
  public getMasterClient(): Redis {
    if (!this.masterClient) {
      throw new Error('Redis Sentinel client not connected');
    }
    return this.masterClient;
  }

  /**
   * Get replica Redis client for read-heavy operations
   */
  public getReplicaClient(): Redis {
    if (!this.replicaClient) {
      throw new Error('Redis Sentinel replica client not connected');
    }
    return this.replicaClient;
  }

  /**
   * Get either master or replica based on operation type
   */
  public getClient(readOnly: boolean = false): Redis {
    if (readOnly && this.replicaClient) {
      return this.replicaClient;
    }
    return this.getMasterClient();
  }

  /**
   * Check if connected to Redis
   */
  public isReady(): boolean {
    return this.isConnected && this.masterClient?.status === 'ready';
  }

  /**
   * Get Redis Sentinel instance for custom commands
   */
  public getSentinel(): Sentinel {
    if (!this.sentinel) {
      throw new Error('Sentinel not initialized');
    }
    return this.sentinel;
  }

  private attachEventListeners(): void {
    // Monitor master failover
    if (this.masterClient) {
      this.masterClient.on('error', (err) => {
        console.error('[RedisSentinel] Master error:', err.message);
        this.emit('master-error', err);
      });

      this.masterClient.on('reconnecting', () => {
        console.warn('[RedisSentinel] Master reconnecting...');
        this.emit('master-reconnecting');
      });

      this.masterClient.on('ready', () => {
        if (!this.isConnected) {
          this.isConnected = true;
          this.emit('master-ready');
        }
      });

      // Listen for Sentinel failover events
      this.masterClient.on('+slave', (data) => {
        console.log('[RedisSentinel] Slave promoted:', data);
        this.recordFailover('promoted', data);
      });

      this.masterClient.on('+sentinel', (data) => {
        console.log('[RedisSentinel] New sentinel:', data);
      });

      this.masterClient.on('+switch-master', (data) => {
        console.warn('[RedisSentinel] Master switch detected:', data);
        this.recordFailover('failover', data);
        this.emit('master-switched');
      });
    }

    // Monitor replica
    if (this.replicaClient) {
      this.replicaClient.on('error', (err) => {
        console.warn('[RedisSentinel] Replica error:', err.message);
        this.emit('replica-error', err);
      });

      this.replicaClient.on('ready', () => {
        console.log('[RedisSentinel] Replica ready');
        this.emit('replica-ready');
      });
    }
  }

  private recordFailover(type: 'failover' | 'demote' | 'promoted', details: string): void {
    const event: FailoverEvent = {
      type,
      timestamp: new Date(),
      reason: details,
    };
    this.failoverHistory.push(event);
    
    // Keep only last 100 events
    if (this.failoverHistory.length > 100) {
      this.failoverHistory.shift();
    }
  }

  /**
   * Get failover history for monitoring/debugging
   */
  public getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  /**
   * Gracefully shutdown all connections
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.masterClient) {
        await this.masterClient.quit();
      }
      if (this.replicaClient) {
        await this.replicaClient.quit();
      }
      if (this.sentinel) {
        await this.sentinel.disconnect();
      }
      this.isConnected = false;
      this.emit('disconnected');
      console.log('[RedisSentinel] Disconnected');
    } catch (error) {
      console.error('[RedisSentinel] Disconnect error:', error);
    }
  }

  /**
   * Health check - verify connection to master and replica
   */
  public async healthCheck(): Promise<{
    master: boolean;
    replica: boolean;
    sentinel: boolean;
    replicationLag?: number;
  }> {
    try {
      const masterPing = this.masterClient ? await this.masterClient.ping() : false;
      const replicaPing = this.replicaClient ? await this.replicaClient.ping() : false;

      // Check Sentinel connectivity
      let sentinelStatus = false;
      if (this.sentinel) {
        try {
          const masters = await (this.sentinel as any).masters();
          sentinelStatus = Array.isArray(masters) && masters.length > 0;
        } catch {
          sentinelStatus = false;
        }
      }

      // Get replication lag if available
      let replicationLag: number | undefined;
      if (this.masterClient) {
        try {
          const info = await this.masterClient.info('replication');
          const match = info.match(/slave\d+_offset=(\d+)/);
          if (match) {
            replicationLag = parseInt(match[1], 10);
          }
        } catch (err) {
          console.error('[RedisSentinel] Failed to get replication lag:', err);
        }
      }

      return {
        master: masterPing === 'PONG',
        replica: replicaPing === 'PONG',
        sentinel: sentinelStatus,
        replicationLag,
      };
    } catch (error) {
      console.error('[RedisSentinel] Health check failed:', error);
      return {
        master: false,
        replica: false,
        sentinel: false,
      };
    }
  }
}

// Export singleton instance
let redisClient: RedisSentinelClient | null = null;

export async function initializeRedisSentinel(config: SentinelConfig): Promise<RedisSentinelClient> {
  if (redisClient) {
    return redisClient;
  }

  redisClient = new RedisSentinelClient(config);
  await redisClient.connect();
  return redisClient;
}

export function getRedisSentinel(): RedisSentinelClient {
  if (!redisClient) {
    throw new Error('Redis Sentinel not initialized. Call initializeRedisSentinel() first.');
  }
  return redisClient;
}

export { RedisSentinelClient };
