/**
 * DevPulse Webhook Service
 * 
 * Manages webhook subscriptions, event delivery, and retry logic.
 * Supports custom triggers for Slack, PagerDuty, Jira, and custom endpoints.
 * 
 * @module DevPulse/WebhookService
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { redis } from './redis.js';
import { ENV } from './env.js';

// Webhook event types
export type WebhookEventType =
  | 'scan.completed'
  | 'scan.started'
  | 'scan.failed'
  | 'vulnerability.found'
  | 'vulnerability.fixed'
  | 'vulnerability.severity_changed'
  | 'risk_score.changed'
  | 'budget.threshold_reached'
  | 'budget.exceeded'
  | 'agent.paused'
  | 'agent.resumed'
  | 'agent.created'
  | 'compliance.check.completed'
  | 'compliance.status.changed'
  | 'shadow_api.detected'
  | 'api_key.exposed'
  | 'attack.detected'
  | 'system.alert';

// Webhook delivery status
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

// Webhook subscription
export interface WebhookSubscription {
  id: string;
  workspaceId: number;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  filters?: {
    severity?: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
    riskTier?: ('critical' | 'high' | 'medium' | 'low')[];
    scanId?: number;
  };
}

// Webhook delivery
export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: WebhookEventType;
  payload: any;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  createdAt: string;
}

// Webhook payload
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  workspaceId: number;
  data: any;
  signature: string;
}

/**
 * Webhook Service
 */
export class WebhookService extends EventEmitter {
  private deliveryQueue: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing: boolean = false;
  private maxConcurrentDeliveries: number = 10;
  private activeDeliveries: number = 0;

  constructor() {
    super();
    this.startDeliveryProcessor();
  }

  /**
   * Create a new webhook subscription
   */
  async createSubscription(params: {
    workspaceId: number;
    url: string;
    events: WebhookEventType[];
    secret?: string;
    headers?: Record<string, string>;
    retryConfig?: {
      maxRetries?: number;
      retryDelay?: number;
      backoffMultiplier?: number;
    };
    filters?: WebhookSubscription['filters'];
  }): Promise<WebhookSubscription> {
    const id = crypto.randomUUID();
    const secret = params.secret || crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    const subscription: WebhookSubscription = {
      id,
      workspaceId: params.workspaceId,
      url: params.url,
      events: params.events,
      secret,
      active: true,
      createdAt: now,
      updatedAt: now,
      headers: params.headers,
      retryConfig: {
        maxRetries: params.retryConfig?.maxRetries ?? 3,
        retryDelay: params.retryConfig?.retryDelay ?? 1000,
        backoffMultiplier: params.retryConfig?.backoffMultiplier ?? 2,
      },
      filters: params.filters,
    };

    // Store in Redis
    await redis.set(
      `webhook:subscription:${id}`,
      JSON.stringify(subscription),
      'EX',
      86400 * 30 // 30 days
    );

    // Add to workspace subscriptions set
    await redis.sadd(`webhook:workspace:${params.workspaceId}`, id);

    this.emit('subscription:created', subscription);
    console.log(`[Webhook] Created subscription ${id} for workspace ${params.workspaceId}`);

    return subscription;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string): Promise<WebhookSubscription | null> {
    const data = await redis.get(`webhook:subscription:${id}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get all subscriptions for a workspace
   */
  async getWorkspaceSubscriptions(workspaceId: number): Promise<WebhookSubscription[]> {
    const ids = await redis.smembers(`webhook:workspace:${workspaceId}`);
    const subscriptions: WebhookSubscription[] = [];

    for (const id of ids) {
      const sub = await this.getSubscription(id);
      if (sub) {
        subscriptions.push(sub);
      }
    }

    return subscriptions;
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    id: string,
    updates: Partial<Omit<WebhookSubscription, 'id' | 'createdAt'>>
  ): Promise<WebhookSubscription | null> {
    const subscription = await this.getSubscription(id);
    if (!subscription) return null;

    const updated: WebhookSubscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(
      `webhook:subscription:${id}`,
      JSON.stringify(updated)
    );

    this.emit('subscription:updated', updated);
    return updated;
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(id: string): Promise<boolean> {
    const subscription = await this.getSubscription(id);
    if (!subscription) return false;

    await redis.del(`webhook:subscription:${id}`);
    await redis.srem(`webhook:workspace:${subscription.workspaceId}`, id);

    this.emit('subscription:deleted', id);
    console.log(`[Webhook] Deleted subscription ${id}`);
    return true;
  }

  /**
   * Toggle subscription active state
   */
  async toggleSubscription(id: string, active: boolean): Promise<WebhookSubscription | null> {
    return this.updateSubscription(id, { active });
  }

  /**
   * Trigger a webhook event
   */
  async trigger(event: WebhookEventType, workspaceId: number, data: any): Promise<void> {
    const subscriptions = await this.getWorkspaceSubscriptions(workspaceId);
    
    for (const subscription of subscriptions) {
      if (!subscription.active) continue;
      if (!subscription.events.includes(event)) continue;

      // Apply filters
      if (subscription.filters && !this.matchesFilters(data, subscription.filters)) {
        continue;
      }

      // Queue for delivery
      await this.queueDelivery(subscription, event, data);
    }

    this.emit('event:triggered', { event, workspaceId, data });
  }

  /**
   * Check if data matches subscription filters
   */
  private matchesFilters(
    data: any,
    filters: WebhookSubscription['filters']
  ): boolean {
    if (!filters) return true;

    if (filters.severity && data.severity) {
      if (!filters.severity.includes(data.severity)) {
        return false;
      }
    }

    if (filters.riskTier && data.riskTier) {
      if (!filters.riskTier.includes(data.riskTier)) {
        return false;
      }
    }

    if (filters.scanId && data.scanId !== filters.scanId) {
      return false;
    }

    return true;
  }

  /**
   * Queue a webhook delivery
   */
  private async queueDelivery(
    subscription: WebhookSubscription,
    event: WebhookEventType,
    data: any
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      event,
      payload: data,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    // Store delivery in Redis
    await redis.set(
      `webhook:delivery:${delivery.id}`,
      JSON.stringify(delivery)
    );

    // Add to delivery queue
    await redis.lpush(`webhook:queue:${subscription.id}`, delivery.id);

    // Try immediate delivery if capacity available
    this.processDelivery(delivery, subscription);
  }

  /**
   * Process a webhook delivery
   */
  private async processDelivery(
    delivery: WebhookDelivery,
    subscription: WebhookSubscription
  ): Promise<void> {
    if (this.activeDeliveries >= this.maxConcurrentDeliveries) {
      return; // Will be picked up by processor
    }

    this.activeDeliveries++;

    try {
      const payload: WebhookPayload = {
        event: delivery.event,
        timestamp: new Date().toISOString(),
        workspaceId: subscription.workspaceId,
        data: delivery.payload,
        signature: this.generateSignature(subscription.secret, delivery.payload),
      };

      const response = await this.deliverWebhook(subscription, payload);

      // Update delivery status
      delivery.status = 'delivered';
      delivery.responseStatus = response.status;
      delivery.responseBody = response.body?.slice(0, 1000);
      delivery.lastAttemptAt = new Date().toISOString();

      this.emit('delivery:success', delivery);
      console.log(`[Webhook] Delivered ${delivery.id} to ${subscription.url}`);

    } catch (error) {
      const err = error as Error;
      delivery.attempts++;
      delivery.error = err.message;
      delivery.lastAttemptAt = new Date().toISOString();

      const maxRetries = subscription.retryConfig?.maxRetries || 3;

      if (delivery.attempts < maxRetries) {
        delivery.status = 'retrying';
        const delay = this.calculateRetryDelay(delivery.attempts, subscription.retryConfig);
        delivery.nextRetryAt = new Date(Date.now() + delay).toISOString();

        // Schedule retry
        const timeout = setTimeout(() => {
          this.processDelivery(delivery, subscription);
        }, delay);
        this.deliveryQueue.set(delivery.id, timeout);
      } else {
        delivery.status = 'failed';
        this.emit('delivery:failed', delivery);
        console.error(`[Webhook] Failed to deliver ${delivery.id} after ${delivery.attempts} attempts`);
      }
    }

    // Update delivery in Redis
    await redis.set(
      `webhook:delivery:${delivery.id}`,
      JSON.stringify(delivery),
      'EX',
      86400 // 24 hours
    );

    this.activeDeliveries--;
  }

  /**
   * Deliver webhook to endpoint
   */
  private async deliverWebhook(
    subscription: WebhookSubscription,
    payload: WebhookPayload
  ): Promise<{ status: number; body: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-DevPulse-Signature': payload.signature,
      'X-DevPulse-Event': payload.event,
      'X-DevPulse-Timestamp': payload.timestamp,
      'User-Agent': 'DevPulse-Webhook/1.0',
      ...subscription.headers,
    };

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    return { status: response.status, body };
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(secret: string, payload: any): string {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');
    return `sha256=${signature}`;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    config?: WebhookSubscription['retryConfig']
  ): number {
    const baseDelay = config?.retryDelay || 1000;
    const multiplier = config?.backoffMultiplier || 2;
    const delay = baseDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, 300000); // Max 5 minutes
  }

  /**
   * Start delivery processor
   */
  private startDeliveryProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        // Get pending deliveries from all subscription queues
        const keys = await redis.keys('webhook:queue:*');
        
        for (const key of keys) {
          if (this.activeDeliveries >= this.maxConcurrentDeliveries) break;

          const deliveryId = await redis.rpop(key);
          if (!deliveryId) continue;

          const deliveryData = await redis.get(`webhook:delivery:${deliveryId}`);
          if (!deliveryData) continue;

          const delivery: WebhookDelivery = JSON.parse(deliveryData);
          if (delivery.status !== 'pending' && delivery.status !== 'retrying') continue;

          // Check if it's time to retry
          if (delivery.nextRetryAt && new Date(delivery.nextRetryAt) > new Date()) {
            // Put back in queue
            await redis.lpush(key, deliveryId);
            continue;
          }

          const subscription = await this.getSubscription(delivery.subscriptionId);
          if (!subscription || !subscription.active) continue;

          this.processDelivery(delivery, subscription);
        }
      } catch (error) {
        console.error('[Webhook] Delivery processor error:', error);
      }

      this.isProcessing = false;
    }, 1000); // Check every second
  }

  /**
   * Get delivery status
   */
  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    const data = await redis.get(`webhook:delivery:${id}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(id: string): Promise<boolean> {
    const delivery = await this.getDelivery(id);
    if (!delivery || delivery.status !== 'failed') return false;

    const subscription = await this.getSubscription(delivery.subscriptionId);
    if (!subscription || !subscription.active) return false;

    delivery.status = 'pending';
    delivery.attempts = 0;
    delivery.error = undefined;

    await redis.lpush(`webhook:queue:${subscription.id}`, id);
    await this.processDelivery(delivery, subscription);

    return true;
  }

  /**
   * Get webhook statistics
   */
  async getStatistics(workspaceId: number): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageDeliveryTime: number;
  }> {
    const subscriptions = await this.getWorkspaceSubscriptions(workspaceId);
    
    let totalDeliveries = 0;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    let totalTime = 0;

    for (const sub of subscriptions) {
      const keys = await redis.keys(`webhook:delivery:*`);
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (!data) continue;
        
        const delivery: WebhookDelivery = JSON.parse(data);
        if (delivery.subscriptionId !== sub.id) continue;
        
        totalDeliveries++;
        if (delivery.status === 'delivered') {
          successfulDeliveries++;
        } else if (delivery.status === 'failed') {
          failedDeliveries++;
        }
      }
    }

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(s => s.active).length,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime: totalDeliveries > 0 ? totalTime / totalDeliveries : 0,
    };
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(secret: string, payload: any, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
      .digest('hex');
    return `sha256=${expected}` === signature;
  }

  /**
   * Test a webhook endpoint
   */
  async testEndpoint(
    url: string,
    headers?: Record<string, string>
  ): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DevPulse-Webhook-Test/1.0',
          ...headers,
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          data: { message: 'This is a test webhook from DevPulse' },
        }),
        signal: AbortSignal.timeout(10000),
      });

      return {
        success: response.ok,
        status: response.status,
      };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Cleanup old deliveries
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 86400000;
    let cleaned = 0;

    const keys = await redis.keys('webhook:delivery:*');
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;

      const delivery: WebhookDelivery = JSON.parse(data);
      if (new Date(delivery.createdAt).getTime() < cutoff) {
        await redis.del(key);
        cleaned++;
      }
    }

    console.log(`[Webhook] Cleaned up ${cleaned} old deliveries`);
    return cleaned;
  }
}

// Singleton instance
let webhookService: WebhookService | null = null;

export function getWebhookService(): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService();
  }
  return webhookService;
}

export function initializeWebhookService(): WebhookService {
  return getWebhookService();
}

// Convenience functions for triggering events
export async function triggerWebhook(
  event: WebhookEventType,
  workspaceId: number,
  data: any
): Promise<void> {
  const service = getWebhookService();
  await service.trigger(event, workspaceId, data);
}

// Predefined event creators
export const WebhookEvents = {
  scanCompleted: (workspaceId: number, scan: any) =>
    triggerWebhook('scan.completed', workspaceId, scan),
  
  scanStarted: (workspaceId: number, scan: any) =>
    triggerWebhook('scan.started', workspaceId, scan),
  
  vulnerabilityFound: (workspaceId: number, vuln: any) =>
    triggerWebhook('vulnerability.found', workspaceId, vuln),
  
  vulnerabilityFixed: (workspaceId: number, vuln: any) =>
    triggerWebhook('vulnerability.fixed', workspaceId, vuln),
  
  riskScoreChanged: (workspaceId: number, data: { oldScore: number; newScore: number; tier: string }) =>
    triggerWebhook('risk_score.changed', workspaceId, data),
  
  budgetThresholdReached: (workspaceId: number, data: { budget: number; current: number; percent: number }) =>
    triggerWebhook('budget.threshold_reached', workspaceId, data),
  
  budgetExceeded: (workspaceId: number, data: { budget: number; current: number; agentId?: string }) =>
    triggerWebhook('budget.exceeded', workspaceId, data),
  
  agentPaused: (workspaceId: number, agent: any) =>
    triggerWebhook('agent.paused', workspaceId, agent),
  
  agentResumed: (workspaceId: number, agent: any) =>
    triggerWebhook('agent.resumed', workspaceId, agent),
  
  complianceCheckCompleted: (workspaceId: number, data: { framework: string; score: number; passed: boolean }) =>
    triggerWebhook('compliance.check.completed', workspaceId, data),
  
  shadowApiDetected: (workspaceId: number, api: any) =>
    triggerWebhook('shadow_api.detected', workspaceId, api),
  
  apiKeyExposed: (workspaceId: number, data: { keyId: string; exposure: string }) =>
    triggerWebhook('api_key.exposed', workspaceId, data),
  
  attackDetected: (workspaceId: number, data: { type: string; source: string; severity: string }) =>
    triggerWebhook('attack.detected', workspaceId, data),
};

// Note: Types are already exported via interface declarations above
