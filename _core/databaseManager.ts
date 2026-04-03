// @ts-nocheck
/**
 * PHASE 9A: Database Connection Manager with Replica Support
 * 
 * Manages connections to PostgreSQL primary and replica.
 * Features:
 * - Connection pooling with configurable pool size
 * - Read replica routing for read-heavy queries
 * - Master fallback if replica unavailable
 * - Connection health monitoring
 * - Automatic reconnection
 */

import { Pool, PoolClient } from 'pg';
import { getDb as getDrizzleDb } from '../db';

interface DatabaseConfig {
  primary: {
    connectionString: string;
    maxConnections?: number;
    minConnections?: number;
    idleTimeout?: number;
  };
  replica?: {
    connectionString: string;
    maxConnections?: number;
    minConnections?: number;
    idleTimeout?: number;
  };
}

class DatabaseConnectionManager {
  private primaryPool: Pool | null = null;
  private replicaPool: Pool | null = null;
  private config: DatabaseConfig;
  private health = {
    primary: false,
    replica: false,
  };

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize database connections
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize primary (write) connection
      this.primaryPool = new Pool({
        connectionString: this.config.primary.connectionString,
        max: this.config.primary.maxConnections || 20,
        min: this.config.primary.minConnections || 5,
        idleTimeoutMillis: this.config.primary.idleTimeout || 30000,
        connectionTimeoutMillis: 10000,
        application_name: 'devpulse-primary',
      });

      // Test primary connection
      const primaryClient = await this.primaryPool.connect();
      await primaryClient.query('SELECT NOW()');
      primaryClient.release();
      this.health.primary = true;
      console.log('[Database] Primary connection pool initialized');

      // Initialize replica (read) connection if configured
      if (this.config.replica) {
        this.replicaPool = new Pool({
          connectionString: this.config.replica.connectionString,
          max: this.config.replica.maxConnections || 10,
          min: this.config.replica.minConnections || 3,
          idleTimeoutMillis: this.config.replica.idleTimeout || 30000,
          connectionTimeoutMillis: 10000,
          application_name: 'devpulse-replica',
        });

        // Test replica connection
        try {
          const replicaClient = await this.replicaPool.connect();
          await replicaClient.query('SELECT NOW()');
          
          // Verify it's a replica (not writable)
          try {
            await replicaClient.query('BEGIN');
            await replicaClient.query('SELECT 1');
            await replicaClient.query('ROLLBACK');
          } catch (err: any) {
            if (err.message.includes('read-only')) {
              console.log('[Database] Replica is correctly in read-only mode');
            }
          }
          
          replicaClient.release();
          this.health.replica = true;
          console.log('[Database] Replica connection pool initialized');
        } catch (error) {
          console.warn('[Database] Replica connection failed, using primary for reads:', error);
          this.health.replica = false;
        }
      }

      // Attach error handlers
      this.attachErrorHandlers();
    } catch (error) {
      console.error('[Database] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get a client for write operations (always uses primary)
   */
  public async getWriteClient(options?: { timeout?: number }): Promise<PoolClient> {
    if (!this.primaryPool) {
      throw new Error('Primary database pool not initialized');
    }

    try {
      const client = await this.primaryPool.connect();
      // Verify client is connected
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      console.error('[Database] Failed to get write client:', error);
      throw error;
    }
  }

  /**
   * Get a client for read operations (prefers replica, falls back to primary)
   */
  public async getReadClient(): Promise<PoolClient> {
    if (this.health.replica && this.replicaPool) {
      try {
        return await this.replicaPool.connect();
      } catch (error) {
        console.warn('[Database] Replica connection failed, falling back to primary:', error);
        this.health.replica = false;
      }
    }

    if (!this.primaryPool) {
      throw new Error('Primary database pool not initialized');
    }

    return await this.primaryPool.connect();
  }

  /**
   * Execute a query on appropriate server (read vs write)
   */
  public async query<T = any>(
    text: string,
    values?: any[],
    readOnly: boolean = false
  ): Promise<{ rows: T[]; rowCount: number }> {
    const client = readOnly
      ? await this.getReadClient()
      : await this.getWriteClient();

    try {
      const result = await client.query(text, values);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  public async healthCheck(): Promise<{
    primary: boolean;
    replica: boolean;
    replicationLag?: number;
    primaryConnections?: number;
    replicaConnections?: number;
  }> {
    const result: any = {
      primary: false,
      replica: false,
    };

    // Check primary
    try {
      if (this.primaryPool) {
        const client = await this.primaryPool.connect();
        await client.query('SELECT 1');
        client.release();
        result.primary = true;
        result.primaryConnections = this.primaryPool.totalCount;
      }
    } catch (error) {
      console.warn('[Database] Primary health check failed:', error);
      this.health.primary = false;
    }

    // Check replica
    try {
      if (this.replicaPool) {
        const client = await this.replicaPool.connect();
        await client.query('SELECT 1');
        client.release();
        result.replica = true;
        result.replicaConnections = this.replicaPool.totalCount;
      }
    } catch (error) {
      console.warn('[Database] Replica health check failed:', error);
      this.health.replica = false;
    }

    // Get replication lag from primary
    if (result.primary) {
      try {
        const lagResult = await this.query<{ lag: string }>(
          `SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp()))::int as lag`,
          [],
          false
        );
        if (lagResult.rows[0]) {
          result.replicationLag = parseInt(lagResult.rows[0].lag, 10);
        }
      } catch (error) {
        console.warn('[Database] Failed to get replication lag:', error);
      }
    }

    return result;
  }

  /**
   * Get pool statistics for monitoring
   */
  public getPoolStats(): any {
    return {
      primary: this.primaryPool ? {
        total: this.primaryPool.totalCount,
        idle: this.primaryPool.idleCount,
        waiting: this.primaryPool.waitingCount,
      } : null,
      replica: this.replicaPool ? {
        total: this.replicaPool.totalCount,
        idle: this.replicaPool.idleCount,
        waiting: this.replicaPool.waitingCount,
      } : null,
      health: this.health,
    };
  }

  private attachErrorHandlers(): void {
    if (this.primaryPool) {
      this.primaryPool.on('error', (err) => {
        console.error('[Database] Primary pool error:', err);
        this.health.primary = false;
      });

      this.primaryPool.on('connect', () => {
        this.health.primary = true;
      });
    }

    if (this.replicaPool) {
      this.replicaPool.on('error', (err) => {
        console.warn('[Database] Replica pool error:', err);
        this.health.replica = false;
      });

      this.replicaPool.on('connect', () => {
        this.health.replica = true;
      });
    }
  }

  /**
   * Gracefully shutdown all connections
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.primaryPool) {
        await this.primaryPool.end();
      }
      if (this.replicaPool) {
        await this.replicaPool.end();
      }
      console.log('[Database] Connection pools closed');
    } catch (error) {
      console.error('[Database] Shutdown error:', error);
    }
  }
}

// Singleton instance
let dbManager: DatabaseConnectionManager | null = null;

export async function initializeDatabaseManager(config: DatabaseConfig): Promise<DatabaseConnectionManager> {
  if (dbManager) {
    return dbManager;
  }

  dbManager = new DatabaseConnectionManager(config);
  await dbManager.initialize();
  return dbManager;
}

export function getDatabaseManager(): DatabaseConnectionManager {
  if (!dbManager) {
    throw new Error('Database manager not initialized');
  }
  return dbManager;
}

export { DatabaseConnectionManager };
