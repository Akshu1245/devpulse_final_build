// @ts-nocheck
import { db } from '../db';
import { schema } from '../schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import { Logger } from 'pino';
import { EventEmitter } from 'events';

/**
 * Usage-Based Billing Metering Service
 * Tracks API usage, quota enforcement, and usage reporting for billing
 */

export interface MeteringConfig {
  sampleInterval?: number; // ms
  aggregationInterval?: number; // ms
  reportingInterval?: number; // ms
}

export interface UsageMetric {
  customerId: string;
  metric: string;
  value: number;
  unitPrice?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface QuotaInfo {
  metric: string;
  limit: number;
  period: 'day' | 'month' | 'year';
  resetDate: Date;
}

export interface UsageReport {
  customerId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: Array<{
    metric: string;
    value: number;
    overageCharge?: number;
  }>;
  totalCost: number;
}

export class MeteringService extends EventEmitter {
  private logger: Logger;
  private config: MeteringConfig;
  private metricsBuffer: UsageMetric[] = [];
  private sampleTimer?: NodeJS.Timer;
  private aggregationTimer?: NodeJS.Timer;

  constructor(logger: Logger, config: MeteringConfig = {}) {
    super();
    this.logger = logger;
    this.config = {
      sampleInterval: config.sampleInterval || 5000, // 5s
      aggregationInterval: config.aggregationInterval || 60000, // 1min
      reportingInterval: config.reportingInterval || 300000, // 5min
    };

    this.logger.info('MeteringService initialized');
    this.startBackgroundProcesses();
  }

  /**
   * Record a usage metric
   */
  async recordUsage(metric: UsageMetric): Promise<void> {
    try {
      // Add to buffer
      this.metricsBuffer.push(metric);

      // Check quota immediately if critical
      if (this.isCriticalMetric(metric.metric)) {
        await this.checkQuota(metric.customerId, metric.metric);
      }

      this.emit('usage_recorded', metric);
    } catch (error) {
      this.logger.error({ error, metric }, 'Failed to record usage metric');
    }
  }

  /**
   * Record multiple metrics at once
   */
  async recordBatchUsage(metrics: UsageMetric[]): Promise<void> {
    for (const metric of metrics) {
      await this.recordUsage(metric);
    }
  }

  /**
   * Check if usage exceeds quota
   */
  async checkQuota(customerId: string, metric: string): Promise<boolean> {
    try {
      const quota = await this.getQuota(customerId, metric);
      if (!quota) return false;

      const usage = await this.getCurrentUsage(customerId, metric, quota.period);
      const exceeded = usage >= quota.limit;

      if (exceeded) {
        this.logger.warn(
          { customerId, metric, usage, limit: quota.limit },
          'Usage quota exceeded'
        );
        this.emit('quota_exceeded', { customerId, metric, usage, limit: quota.limit });
      }

      return exceeded;
    } catch (error) {
      this.logger.error({ error, customerId, metric }, 'Failed to check quota');
      return false;
    }
  }

  /**
   * Get quota for metric
   */
  private async getQuota(customerId: string, metric: string): Promise<QuotaInfo | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.customerId, customerId),
      });

      if (!subscription) return null;

      const plan = await db.query.billingPlans.findFirst({
        where: eq(schema.billingPlans.id, subscription.planId),
      });

      if (!plan) return null;

      const quotas = JSON.parse(plan.quotas || '{}');
      return quotas[metric] || null;
    } catch (error) {
      this.logger.error({ error, customerId, metric }, 'Failed to get quota');
      return null;
    }
  }

  /**
   * Get current usage for metric in period
   */
  async getCurrentUsage(
    customerId: string,
    metric: string,
    period: 'day' | 'month' | 'year'
  ): Promise<number> {
    try {
      const { start, end } = this.getPeriodBounds(new Date(), period);

      const result = await db
        .select({ total: sum(schema.usageRecords.value) })
        .from(schema.usageRecords)
        .where(
          and(
            eq(schema.usageRecords.customerId, customerId),
            eq(schema.usageRecords.metric, metric),
            gte(schema.usageRecords.timestamp, start),
            lte(schema.usageRecords.timestamp, end)
          )
        );

      return result[0]?.total || 0;
    } catch (error) {
      this.logger.error(
        { error, customerId, metric, period },
        'Failed to get current usage'
      );
      return 0;
    }
  }

  /**
   * Get usage report for billing period
   */
  async getUsageReport(customerId: string, startDate: Date, endDate: Date): Promise<UsageReport | null> {
    try {
      const subscription = await db.query.subscriptions.findFirst({
        where: and(
          eq(schema.subscriptions.customerId, customerId),
          eq(schema.subscriptions.status, 'active' as const)
        ),
      });

      if (!subscription) return null;

      const usageData = await db
        .select({
          metric: schema.usageRecords.metric,
          total: sum(schema.usageRecords.value),
        })
        .from(schema.usageRecords)
        .where(
          and(
            eq(schema.usageRecords.customerId, customerId),
            gte(schema.usageRecords.timestamp, startDate),
            lte(schema.usageRecords.timestamp, endDate)
          )
        )
        .groupBy(schema.usageRecords.metric);

      // Get pricing from plan
      const plan = await db.query.billingPlans.findFirst({
        where: eq(schema.billingPlans.id, subscription.planId),
      });

      if (!plan) return null;

      const pricing = JSON.parse(plan.meterPricing || '{}');

      // Calculate costs
      let totalCost = plan.monthlyPrice;
      const metrics = usageData.map((row) => {
        const unitPrice = pricing[row.metric] || 0;
        const cost = (row.total || 0) * unitPrice;
        totalCost += cost;

        return {
          metric: row.metric,
          value: row.total || 0,
          overageCharge: cost > 0 ? cost : undefined,
        };
      });

      return {
        customerId,
        period: { start: startDate, end: endDate },
        metrics,
        totalCost,
      };
    } catch (error) {
      this.logger.error(
        { error, customerId, startDate, endDate },
        'Failed to generate usage report'
      );
      return null;
    }
  }

  /**
   * Flush metrics buffer to database
   */
  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    try {
      const metricsToWrite = [...this.metricsBuffer];
      this.metricsBuffer = [];

      await db.insert(schema.usageRecords).values(
        metricsToWrite.map((m) => ({
          customerId: m.customerId,
          metric: m.metric,
          value: m.value,
          timestamp: m.timestamp,
          metadata: m.metadata ? JSON.stringify(m.metadata) : null,
        }))
      );

      this.logger.debug(
        { count: metricsToWrite.length },
        'Flushed metrics buffer to database'
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to flush metrics buffer');
      // Re-add to buffer for retry
      this.metricsBuffer.push(...this.metricsBuffer);
    }
  }

  /**
   * Generate aggregated metrics
   */
  private async generateAggregatedMetrics(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const aggregated = await db
        .select({
          customerId: schema.usageRecords.customerId,
          metric: schema.usageRecords.metric,
          total: sum(schema.usageRecords.value),
        })
        .from(schema.usageRecords)
        .where(
          and(
            gte(schema.usageRecords.timestamp, fiveMinutesAgo),
            lte(schema.usageRecords.timestamp, now)
          )
        )
        .groupBy(schema.usageRecords.customerId, schema.usageRecords.metric);

      // Store in aggregated table for quick access
      for (const record of aggregated) {
        // Update or insert
        const existing = await db.query.aggregatedMetrics.findFirst({
          where: and(
            eq(schema.aggregatedMetrics.customerId, record.customerId),
            eq(schema.aggregatedMetrics.metric, record.metric)
          ),
        });

        if (existing) {
          await db
            .update(schema.aggregatedMetrics)
            .set({ value: record.total || 0, lastUpdated: now })
            .where(
              and(
                eq(schema.aggregatedMetrics.customerId, record.customerId),
                eq(schema.aggregatedMetrics.metric, record.metric)
              )
            );
        } else {
          await db.insert(schema.aggregatedMetrics).values({
            customerId: record.customerId,
            metric: record.metric,
            value: record.total || 0,
            lastUpdated: now,
          });
        }
      }

      this.logger.debug('Generated aggregated metrics');
    } catch (error) {
      this.logger.error({ error }, 'Failed to generate aggregated metrics');
    }
  }

  /**
   * Start background processes
   */
  private startBackgroundProcesses(): void {
    // Flush buffer periodically
    this.sampleTimer = setInterval(() => {
      this.flushMetricsBuffer().catch((err) =>
        this.logger.error({ error: err }, 'Error in sample timer')
      );
    }, this.config.sampleInterval);

    // Aggregate metrics periodically
    this.aggregationTimer = setInterval(() => {
      this.generateAggregatedMetrics().catch((err) =>
        this.logger.error({ error: err }, 'Error in aggregation timer')
      );
    }, this.config.aggregationInterval);

    this.logger.info('Background metering processes started');
  }

  /**
   * Stop background processes
   */
  stop(): void {
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.aggregationTimer) clearInterval(this.aggregationTimer);

    this.logger.info('Background metering processes stopped');
  }

  /**
   * Check if metric is critical (needs immediate quota check)
   */
  private isCriticalMetric(metric: string): boolean {
    const criticalMetrics = [
      'api_calls_limit',
      'storage_bytes_limit',
      'concurrent_connections_limit',
    ];
    return criticalMetrics.includes(metric);
  }

  /**
   * Get period bounds for calculation
   */
  private getPeriodBounds(date: Date, period: 'day' | 'month' | 'year'): { start: Date; end: Date } {
    const start = new Date(date);
    const end = new Date(date);

    switch (period) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;

      case 'year':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11);
        end.setDate(31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }
}

export default MeteringService;
