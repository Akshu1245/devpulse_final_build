/**
 * PHASE 9B: Redis Sentinel & Cluster Health Monitoring
 * 
 * Provides specialized monitoring for:
 * - Redis Sentinel cluster status
 * - Master/replica synchronization
 * - Failover events and history
 * - Sentinel quorum health
 * - Replication lag tracking
 */

import { RedisSentinelClient } from './redisSentinel';
import {
  sentinelQuorum,
  sentinelFailoversTotal,
  masterElectionDuration,
  replicationLag,
  redisMemoryUsage,
  lastHealthCheckTime,
  serviceAvailability,
} from './prometheus';

export interface SentinelClusterStatus {
  quorumHealthy: boolean;
  activeSentinels: number;
  totalSentinels: number;
  masterName: string;
  masterAddress?: string;
  masterHealthy: boolean;
  replicasHealthy: number;
  totalReplicas: number;
  lastFailover?: Date;
  failoverInProgress: boolean;
  message: string;
}

export interface RedisReplicationStatus {
  masterConnected: boolean;
  masterAddress?: string;
  masterPort?: number;
  slavesConnected: number;
  replicationOffset: number;
  replicationLagSeconds: number;
  masterReplOffset: number;
}

class SentinelHealthMonitor {
  private sentinelClient: RedisSentinelClient;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private clusterStatus: SentinelClusterStatus | null = null;
  private failoverHistory: Array<{ timestamp: Date; details: string }> = [];

  constructor(sentinelClient: RedisSentinelClient) {
    this.sentinelClient = sentinelClient;
  }

  /**
   * Start continuous monitoring of Sentinel cluster
   */
  public startMonitoring(intervalSeconds: number = 30): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.checkClusterHealth();
    }, intervalSeconds * 1000);

    // Perform initial check
    this.checkClusterHealth();

    console.log(`[SentinelMonitor] Started monitoring every ${intervalSeconds}s`);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[SentinelMonitor] Stopped monitoring');
  }

  /**
   * Check Sentinel cluster health comprehensively
   */
  public async checkClusterHealth(): Promise<SentinelClusterStatus> {
    try {
      const sentinel = this.sentinelClient.getSentinel();
      const startTime = Date.now();

      // Get list of masters being monitored
      const masters = await (sentinel as any).masters();
      if (!Array.isArray(masters) || masters.length === 0) {
        throw new Error('No masters configured in Sentinel');
      }

      const masterName = masters[0]?.name || 'devpulse-master';

      // Get Sentinel info
      const sentinelInfo = await (sentinel as any).info('sentinel');
      const activeSentinels = (sentinelInfo.match(/active_sentinels:(\d+)/)?.[1] || '0') as unknown as number;

      // Get master info
      const masterInfo = await (sentinel as any).masterStatus(masterName);
      const masterAddress = `${masterInfo?.ip}:${masterInfo?.port}`;
      const masterHealthy = masterInfo?.pending_commands === 0;

      // Get slaves/replicas info
      const slaves = await (sentinel as any).slaves(masterName);
      const replicasHealthy = Array.isArray(slaves)
        ? slaves.filter((s: any) => s.info_refresh < 10000).length
        : 0;
      const totalReplicas = Array.isArray(slaves) ? slaves.length : 0;

      // Get sentinel status from SENTINEL SENTINELS command
      const sentinelStatus = await (sentinel as any).sentinels(masterName);
      const totalSentinels = Array.isArray(sentinelStatus)
        ? sentinelStatus.length + 1
        : 3; // Default 3

      // Check for active failover
      const failoverInProgress = masterInfo?.pending_commands > 0;

      // Check replication lag
      const replicationLagSeconds = await this.checkReplicationLag(masterAddress);

      const status: SentinelClusterStatus = {
        quorumHealthy: (activeSentinels as unknown as number) >= 2, // Need 2/3 for quorum
        activeSentinels: activeSentinels as unknown as number,
        totalSentinels,
        masterName,
        masterAddress,
        masterHealthy,
        replicasHealthy,
        totalReplicas,
        failoverInProgress,
        message: this.formatStatusMessage(
          activeSentinels as unknown as number,
          totalSentinels,
          masterHealthy,
          replicasHealthy,
          totalReplicas
        ),
      };

      this.clusterStatus = status;

      // Update Prometheus metrics
      this.updateMetrics(status, replicationLagSeconds, Date.now() - startTime);

      // Detect failover and record
      if (failoverInProgress && this.clusterStatus?.lastFailover === undefined) {
        this.recordFailover('failover-initiated', masterAddress);
      }

      return status;
    } catch (error: any) {
      console.error('[SentinelMonitor] Health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Get Sentinel cluster status
   */
  public getClusterStatus(): SentinelClusterStatus | null {
    return this.clusterStatus;
  }

  /**
   * Check replication lag from master
   */
  private async checkReplicationLag(masterAddress: string): Promise<number> {
    try {
      const masterClient = this.sentinelClient.getMasterClient();
      const info = await masterClient.info('replication');

      // Parse replication info
      const offsetMatch = info.match(/master_repl_offset:(\d+)/);
      const masterOffset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

      // Get slave info to calculate lag
      const slavesMatch = info.matchAll(/slave\d+:ip=([^,]+),port=(\d+),offset=(\d+)/g);
      let maxSlaveOffset = 0;
      for (const match of slavesMatch) {
        const slaveOffset = parseInt(match[3], 10);
        maxSlaveOffset = Math.max(maxSlaveOffset, slaveOffset);
      }

      const lag = masterOffset - maxSlaveOffset;
      return lag / 1000; // Normalize (assuming byte offset)
    } catch (error) {
      console.warn('[SentinelMonitor] Replication lag check failed:', error);
      return -1;
    }
  }

  /**
   * Get Redis replication status
   */
  public async getReplicationStatus(): Promise<RedisReplicationStatus> {
    try {
      const masterClient = this.sentinelClient.getMasterClient();
      const info = await masterClient.info('replication');

      const roleMatch = info.match(/role:(\S+)/);
      const masterConnected = roleMatch?.[1] !== 'slave';

      const slavesMatch = info.match(/connected_slaves:(\d+)/);
      const slavesConnected = slavesMatch ? parseInt(slavesMatch[1], 10) : 0;

      const replOffsetMatch = info.match(/repl_offset:(\d+)/);
      const replicationOffset = replOffsetMatch ? parseInt(replOffsetMatch[1], 10) : 0;

      const masterReplOffsetMatch = info.match(/master_repl_offset:(\d+)/);
      const masterReplOffset = masterReplOffsetMatch
        ? parseInt(masterReplOffsetMatch[1], 10)
        : 0;

      return {
        masterConnected,
        slavesConnected,
        replicationOffset,
        masterReplOffset,
        replicationLagSeconds: masterReplOffset - replicationOffset,
      };
    } catch (error) {
      console.error('[SentinelMonitor] Replication status check failed:', error);
      throw error;
    }
  }

  /**
   * Get memory usage from Redis master
   */
  public async getMemoryUsage(): Promise<number> {
    try {
      const masterClient = this.sentinelClient.getMasterClient();
      const info = await masterClient.info('memory');

      const memoryMatch = info.match(/used_memory:(\d+)/);
      return memoryMatch ? parseInt(memoryMatch[1], 10) : 0;
    } catch (error) {
      console.error('[SentinelMonitor] Memory check failed:', error);
      return 0;
    }
  }

  /**
   * Update Prometheus metrics based on checked status
   */
  private updateMetrics(
    status: SentinelClusterStatus,
    lagSeconds: number,
    checkDurationMs: number
  ): void {
    // Sentinel quorum status
    sentinelQuorum.set(status.activeSentinels);

    // Replication lag
    if (lagSeconds >= 0) {
      replicationLag.set(lagSeconds);
    }

    // Master/Replica availability
    serviceAvailability.labels('redis_master').set(status.masterHealthy ? 1 : 0);
    serviceAvailability.labels('redis_replicas').set(status.replicasHealthy > 0 ? 1 : 0);

    // Last health check
    lastHealthCheckTime.labels('sentinel_cluster').set(Date.now() / 1000);
  }

  /**
   * Track failover events
   */
  private recordFailover(type: string, address: string): void {
    const event = {
      timestamp: new Date(),
      details: `${type} on ${address}`,
    };

    this.failoverHistory.push(event);
    if (this.failoverHistory.length > 100) {
      this.failoverHistory.shift();
    }

    if (this.clusterStatus) {
      this.clusterStatus.lastFailover = event.timestamp;
    }

    sentinelFailoversTotal.labels('sentinel').inc();

    console.log(`[SentinelMonitor] Failover recorded: ${event.details}`);
  }

  /**
   * Format status message for logging
   */
  private formatStatusMessage(
    activeSentinels: number,
    totalSentinels: number,
    masterHealthy: boolean,
    replicasHealthy: number,
    totalReplicas: number
  ): string {
    const sentinelStatus = activeSentinels >= 2 ? '✓ Healthy' : '✗ Unhealthy';
    const masterStatus = masterHealthy ? '✓ Up' : '✗ Down';
    const replicaStatus = replicasHealthy > 0 ? `${replicasHealthy}/${totalReplicas} up` : 'All down';

    return `Sentinels: ${activeSentinels}/${totalSentinels} (${sentinelStatus}) | Master: ${masterStatus} | Replicas: ${replicaStatus}`;
  }

  /**
   * Get failover history
   */
  public getFailoverHistory(): typeof this.failoverHistory {
    return [...this.failoverHistory];
  }

  /**
   * Get detailed cluster diagnostics
   */
  public async getDiagnostics(): Promise<{
    clusterStatus: SentinelClusterStatus | null;
    replicationStatus: RedisReplicationStatus;
    memoryUsage: number;
    failoverHistory: Array<{ timestamp: Date; details: string }>;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    const clusterStatus = await this.checkClusterHealth();
    const replicationStatus = await this.getReplicationStatus();
    const memoryUsage = await this.getMemoryUsage();

    // Generate recommendations based on status
    if (!clusterStatus.quorumHealthy) {
      recommendations.push('⚠️ Sentinel quorum unhealthy - failover may not work');
    }

    if (!clusterStatus.masterHealthy) {
      recommendations.push('⚠️ Master is unhealthy - consider manual intervention');
    }

    if (clusterStatus.replicasHealthy < clusterStatus.totalReplicas) {
      recommendations.push(
        `⚠️ Only ${clusterStatus.replicasHealthy}/${clusterStatus.totalReplicas} replicas healthy`
      );
    }

    if (replicationStatus.replicationLagSeconds > 5) {
      recommendations.push(
        `⚠️ High replication lag: ${replicationStatus.replicationLagSeconds}s`
      );
    }

    if (memoryUsage > 0.9 * 1e9) {
      // 90% of assumed 1GB limit
      recommendations.push('⚠️ Redis memory usage is high');
    }

    return {
      clusterStatus,
      replicationStatus,
      memoryUsage,
      failoverHistory: this.getFailoverHistory(),
      recommendations,
    };
  }
}

// Singleton instance
let monitor: SentinelHealthMonitor | null = null;

export function initializeSentinelMonitor(sentinelClient: RedisSentinelClient): SentinelHealthMonitor {
  if (!monitor) {
    monitor = new SentinelHealthMonitor(sentinelClient);
  }
  return monitor;
}

export function getSentinelMonitor(): SentinelHealthMonitor {
  if (!monitor) {
    throw new Error('Sentinel monitor not initialized');
  }
  return monitor;
}

export { SentinelHealthMonitor };
