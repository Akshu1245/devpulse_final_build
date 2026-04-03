/**
 * DevPulse Advanced LLM Cost Tracker
 * 
 * Inspired by Claude Code's cost-tracker.ts with enhanced features:
 * - Multi-model cost tracking
 * - Cache read/write token tracking
 * - Token budget management
 * - Cost persistence across sessions
 * - Real-time cost alerts
 * 
 * @module DevPulse/AdvancedCostTracker
 */

import Redis from 'ioredis';
import { ENV } from './env.js';

// Model cost per 1M tokens (as of 2024)
const MODEL_COSTS: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }> = {
  // OpenAI
  'gpt-4o': { input: 5.0, output: 15.0, cacheRead: 1.25, cacheWrite: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, cacheRead: 0.03, cacheWrite: 0.12 },
  'gpt-4-turbo': { input: 10.0, output: 30.0, cacheRead: 2.5, cacheWrite: 10.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  
  // Anthropic
  'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-opus': { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-3-sonnet': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-3-haiku': { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.3 },
  
  // Google
  'gemini-1.5-pro': { input: 1.25, output: 5.0, cacheRead: 0.1, cacheWrite: 0.5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30, cacheRead: 0.01, cacheWrite: 0.075 },
  'gemini-1.0-pro': { input: 0.5, output: 1.5 },
  
  // Meta
  'llama-3-70b-instruct': { input: 0.65, output: 2.75 },
  'llama-3-8b-instruct': { input: 0.05, output: 0.08 },
  'llama-2-70b-chat': { input: 0.7, output: 2.4 },
  
  // Mistral
  'mistral-large': { input: 2.0, output: 6.0 },
  'mistral-medium': { input: 0.5, output: 1.5 },
  'mistral-small': { input: 0.1, output: 0.3 },
  'mixtral-8x7b': { input: 0.24, output: 0.24 },
  
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  
  // Azure OpenAI (same as OpenAI)
  'azure-gpt-4o': { input: 5.0, output: 15.0 },
  'azure-gpt-4o-mini': { input: 0.15, output: 0.60 },
  
  // AWS Bedrock (same as above)
  'bedrock-claude-3-5-sonnet': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'bedrock-claude-3-sonnet': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
};

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface CostSnapshot {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalWebSearchRequests: number;
  sessionDuration: number;
  modelUsage: Record<string, ModelUsage>;
  timestamp: number;
}

export interface TokenBudget {
  maxTokens: number;
  currentUsage: number;
  resetAt: Date;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface CostAlert {
  type: 'warning' | 'critical' | 'budget_exceeded';
  currentCost: number;
  threshold: number;
  percentageUsed: number;
  message: string;
  timestamp: number;
}

// Redis client for persistence
let redisClient: Redis | null = null;

export function initializeRedisClient(client: Redis): void {
  redisClient = client;
}

function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedisClient() first.');
  }
  return redisClient;
}

/**
 * Advanced LLM Cost Tracker
 * Provides comprehensive cost tracking, budget management, and real-time alerts
 */
export class AdvancedCostTracker {
  private workspaceId: number;
  private sessionId: string;
  private modelUsage: Map<string, ModelUsage> = new Map();
  private totalCost: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  private totalCacheReadTokens: number = 0;
  private totalCacheCreationTokens: number = 0;
  private totalWebSearchRequests: number = 0;
  private sessionStartTime: number = Date.now();
  private alertCallbacks: ((alert: CostAlert) => void)[] = [];
  
  constructor(workspaceId: number, sessionId?: string) {
    this.workspaceId = workspaceId;
    this.sessionId = sessionId || crypto.randomUUID();
  }
  
  /**
   * Calculate USD cost for a given model and token usage
   */
  calculateUSDCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number = 0,
    cacheCreationTokens: number = 0
  ): number {
    const modelLower = model.toLowerCase();
    let costs = MODEL_COSTS[modelLower] || MODEL_COSTS[model];
    
    // Try partial matches for provider-specific models
    if (!costs) {
      for (const [key, value] of Object.entries(MODEL_COSTS)) {
        if (modelLower.includes(key) || key.includes(modelLower.split('-')[0])) {
          costs = value;
          break;
        }
      }
    }
    
    // Default cost estimate if model not found
    if (!costs) {
      console.warn(`[CostTracker] Unknown model: ${model}, using default estimate`);
      costs = { input: 1.0, output: 2.0 };
    }
    
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;
    const cacheReadCost = costs.cacheRead 
      ? (cacheReadTokens / 1_000_000) * costs.cacheRead 
      : 0;
    const cacheWriteCost = costs.cacheWrite 
      ? (cacheCreationTokens / 1_000_000) * costs.cacheWrite 
      : 0;
    
    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
  }
  
  /**
   * Add cost for a single API call
   */
  addCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cacheReadTokens: number = 0,
    cacheCreationTokens: number = 0,
    webSearchRequests: number = 0
  ): number {
    const cost = this.calculateUSDCost(
      model, 
      inputTokens, 
      outputTokens, 
      cacheReadTokens, 
      cacheCreationTokens
    );
    
    // Update totals
    this.totalCost += cost;
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.totalCacheReadTokens += cacheReadTokens;
    this.totalCacheCreationTokens += cacheCreationTokens;
    this.totalWebSearchRequests += webSearchRequests;
    
    // Update per-model usage
    const existing = this.modelUsage.get(model) || {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0,
      contextWindow: 128000,
      maxOutputTokens: 4096,
    };
    
    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    existing.cacheReadInputTokens += cacheReadTokens;
    existing.cacheCreationInputTokens += cacheCreationTokens;
    existing.webSearchRequests += webSearchRequests;
    existing.costUSD += cost;
    
    this.modelUsage.set(model, existing);
    
    // Check for budget alerts
    this.checkBudgetAlerts();
    
    // Persist to Redis
    this.persistToRedis().catch(console.error);
    
    return cost;
  }
  
  /**
   * Check budget thresholds and trigger alerts
   */
  private async checkBudgetAlerts(): Promise<void> {
    const budgetKey = `budget:${this.workspaceId}`;
    
    try {
      const redis = getRedis();
      const budgetStr = await redis.get(budgetKey);
      if (!budgetStr) return;
      
      const budget = JSON.parse(budgetStr);
      const hourlyLimit = budget.hourlyLimit || 10;
      const dailyLimit = budget.dailyLimit || 100;
      const monthlyLimit = budget.monthlyLimit || 500;
      
      // Calculate current period costs
      const hourlyCost = await this.getPeriodCost('hourly', this.workspaceId);
      const dailyCost = await this.getPeriodCost('daily', this.workspaceId);
      const monthlyCost = await this.getPeriodCost('monthly', this.workspaceId);
      
      // Check hourly budget
      if (hourlyCost >= hourlyLimit * 0.9) {
        const alert: CostAlert = {
          type: hourlyCost >= hourlyLimit ? 'budget_exceeded' : 'critical',
          currentCost: hourlyCost,
          threshold: hourlyLimit,
          percentageUsed: (hourlyCost / hourlyLimit) * 100,
          message: `Hourly budget ${hourlyCost >= hourlyLimit ? 'exceeded' : '90%+ used'}: $${hourlyCost.toFixed(4)} / $${hourlyLimit}`,
          timestamp: Date.now(),
        };
        this.triggerAlert(alert);
      }
      
      // Check daily budget
      if (dailyCost >= dailyLimit * 0.8) {
        const alert: CostAlert = {
          type: dailyCost >= dailyLimit ? 'budget_exceeded' : 'warning',
          currentCost: dailyCost,
          threshold: dailyLimit,
          percentageUsed: (dailyCost / dailyLimit) * 100,
          message: `Daily budget ${dailyCost >= dailyLimit ? 'exceeded' : '80%+ used'}: $${dailyCost.toFixed(4)} / $${dailyLimit}`,
          timestamp: Date.now(),
        };
        this.triggerAlert(alert);
      }
      
      // Check monthly budget
      if (monthlyCost >= monthlyLimit * 0.7) {
        const alert: CostAlert = {
          type: 'warning',
          currentCost: monthlyCost,
          threshold: monthlyLimit,
          percentageUsed: (monthlyCost / monthlyLimit) * 100,
          message: `Monthly budget 70%+ used: $${monthlyCost.toFixed(4)} / $${monthlyLimit}`,
          timestamp: Date.now(),
        };
        this.triggerAlert(alert);
      }
    } catch (e) {
      console.error('[CostTracker] Error checking budgets:', e);
    }
  }
  
  /**
   * Get cost for a specific time period
   */
  async getPeriodCost(period: 'hourly' | 'daily' | 'monthly', workspaceId: number): Promise<number> {
    const now = Date.now();
    let startTime: number;
    
    switch (period) {
      case 'hourly':
        startTime = new Date(now).setMinutes(0, 0, 0);
        break;
      case 'daily':
        startTime = new Date(now).setHours(0, 0, 0, 0);
        break;
      case 'monthly': {
        const date = new Date(now);
        startTime = new Date(date.getFullYear(), date.getMonth(), 1).setHours(0, 0, 0, 0);
        break;
      }
    }
    
    const costKey = `llmcost:${workspaceId}:${period}:${startTime}`;
    
    try {
      const redis = getRedis();
      const cost = await redis.get(costKey);
      return cost ? parseFloat(cost) : 0;
    } catch {
      return 0;
    }
  }
  
  /**
   * Trigger cost alert
   */
  private triggerAlert(alert: CostAlert): void {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (e) {
        console.error('[CostTracker] Alert callback error:', e);
      }
    }
    
    // Also send to notification service
    this.sendAlertNotification(alert).catch(console.error);
  }
  
  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: CostAlert): Promise<void> {
    const notificationKey = `alerts:${this.workspaceId}`;
    
    try {
      const redis = getRedis();
      await redis.lpush(notificationKey, JSON.stringify(alert));
      await redis.ltrim(notificationKey, 0, 99);
      await redis.expire(notificationKey, 86400 * 7);
    } catch (e) {
      console.error('[CostTracker] Failed to store alert:', e);
    }
  }
  
  /**
   * Register alert callback
   */
  onAlert(callback: (alert: CostAlert) => void): void {
    this.alertCallbacks.push(callback);
  }
  
  /**
   * Persist current state to Redis
   */
  async persistToRedis(): Promise<void> {
    const stateKey = `coststate:${this.workspaceId}:${this.sessionId}`;
    const snapshot: CostSnapshot = {
      totalCostUSD: this.totalCost,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCacheReadTokens: this.totalCacheReadTokens,
      totalCacheCreationTokens: this.totalCacheCreationTokens,
      totalWebSearchRequests: this.totalWebSearchRequests,
      sessionDuration: Date.now() - this.sessionStartTime,
      modelUsage: Object.fromEntries(this.modelUsage),
      timestamp: Date.now(),
    };
    
    try {
      const redis = getRedis();
      await redis.set(stateKey, JSON.stringify(snapshot), 'EX', 86400 * 7);
      
      // Update period costs
      const now = Date.now();
      const hourStart = new Date(now).setMinutes(0, 0, 0);
      const dayStart = new Date(now).setHours(0, 0, 0, 0);
      const date = new Date(now);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).setHours(0, 0, 0, 0);
      
      await redis.incrbyfloat(`llmcost:${this.workspaceId}:hourly:${hourStart}`, this.totalCost);
      await redis.expire(`llmcost:${this.workspaceId}:hourly:${hourStart}`, 86400);
      
      await redis.incrbyfloat(`llmcost:${this.workspaceId}:daily:${dayStart}`, this.totalCost);
      await redis.expire(`llmcost:${this.workspaceId}:daily:${dayStart}`, 86400 * 30);
      
      await redis.incrbyfloat(`llmcost:${this.workspaceId}:monthly:${monthStart}`, this.totalCost);
      await redis.expire(`llmcost:${this.workspaceId}:monthly:${monthStart}`, 86400 * 365);
    } catch (e) {
      console.error('[CostTracker] Failed to persist state:', e);
    }
  }
  
  /**
   * Restore state from Redis
   */
  async restoreFromRedis(sessionId: string): Promise<boolean> {
    const stateKey = `coststate:${this.workspaceId}:${sessionId}`;
    
    try {
      const redis = getRedis();
      const stateStr = await redis.get(stateKey);
      if (!stateStr) return false;
      
      const state: CostSnapshot = JSON.parse(stateStr);
      this.totalCost = state.totalCostUSD;
      this.totalInputTokens = state.totalInputTokens;
      this.totalOutputTokens = state.totalOutputTokens;
      this.totalCacheReadTokens = state.totalCacheReadTokens;
      this.totalCacheCreationTokens = state.totalCacheCreationTokens;
      this.totalWebSearchRequests = state.totalWebSearchRequests;
      this.sessionStartTime = Date.now() - state.sessionDuration;
      this.modelUsage = new Map(Object.entries(state.modelUsage));
      this.sessionId = sessionId;
      
      return true;
    } catch (e) {
      console.error('[CostTracker] Failed to restore state:', e);
      return false;
    }
  }
  
  /**
   * Get current snapshot
   */
  getSnapshot(): CostSnapshot {
    return {
      totalCostUSD: this.totalCost,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCacheReadTokens: this.totalCacheReadTokens,
      totalCacheCreationTokens: this.totalCacheCreationTokens,
      totalWebSearchRequests: this.totalWebSearchRequests,
      sessionDuration: Date.now() - this.sessionStartTime,
      modelUsage: Object.fromEntries(this.modelUsage),
      timestamp: Date.now(),
    };
  }
  
  /**
   * Get usage by model
   */
  getModelUsage(): Record<string, ModelUsage> {
    return Object.fromEntries(this.modelUsage);
  }
  
  /**
   * Get total cost
   */
  getTotalCost(): number {
    return this.totalCost;
  }
  
  /**
   * Get cost formatted for display
   */
  formatCost(cost: number, maxDecimalPlaces: number = 4): string {
    return `$${cost > 0.5 ? Math.round(cost * 100) / 100 : cost.toFixed(maxDecimalPlaces)}`;
  }
  
  /**
   * Get formatted usage report
   */
  formatUsageReport(): string {
    const lines: string[] = [];
    
    lines.push(`Total cost: ${this.formatCost(this.totalCost)}`);
    lines.push(`Total input tokens: ${this.totalInputTokens.toLocaleString()}`);
    lines.push(`Total output tokens: ${this.totalOutputTokens.toLocaleString()}`);
    lines.push(`Cache read tokens: ${this.totalCacheReadTokens.toLocaleString()}`);
    lines.push(`Cache creation tokens: ${this.totalCacheCreationTokens.toLocaleString()}`);
    lines.push(`Web search requests: ${this.totalWebSearchRequests}`);
    lines.push('');
    
    if (this.modelUsage.size > 0) {
      lines.push('Usage by model:');
      for (const [model, usage] of this.modelUsage) {
        lines.push(`  ${model}:`);
        lines.push(`    Input: ${usage.inputTokens.toLocaleString()}`);
        lines.push(`    Output: ${usage.outputTokens.toLocaleString()}`);
        lines.push(`    Cache read: ${usage.cacheReadInputTokens.toLocaleString()}`);
        lines.push(`    Cache write: ${usage.cacheCreationInputTokens.toLocaleString()}`);
        lines.push(`    Cost: ${this.formatCost(usage.costUSD)}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Reset cost state
   */
  reset(): void {
    this.totalCost = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCacheReadTokens = 0;
    this.totalCacheCreationTokens = 0;
    this.totalWebSearchRequests = 0;
    this.modelUsage.clear();
    this.sessionStartTime = Date.now();
  }
  
  /**
   * Set workspace budget
   */
  async setBudget(limits: {
    hourlyLimit?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
    alertEmail?: string;
    slackWebhook?: string;
  }): Promise<void> {
    const budgetKey = `budget:${this.workspaceId}`;
    const budget = {
      ...limits,
      updatedAt: Date.now(),
    };
    
    const redis = getRedis();
    await redis.set(budgetKey, JSON.stringify(budget));
  }
  
  /**
   * Get workspace budget
   */
  async getBudget(): Promise<{
    hourlyLimit?: number;
    dailyLimit?: number;
    monthlyLimit?: number;
    alertEmail?: string;
    slackWebhook?: string;
  } | null> {
    const budgetKey = `budget:${this.workspaceId}`;
    
    try {
      const redis = getRedis();
      const budgetStr = await redis.get(budgetKey);
      return budgetStr ? JSON.parse(budgetStr) : null;
    } catch {
      return null;
    }
  }
  
  /**
   * Get cost trends
   */
  async getCostTrends(days: number = 7): Promise<{
    date: string;
    hourly: number;
    daily: number;
  }[]> {
    const trends: { date: string; hourly: number; daily: number }[] = [];
    const now = Date.now();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 86400000);
      const dayStart = date.setHours(0, 0, 0, 0);
      const dateStr = new Date(dayStart).toISOString().split('T')[0];
      
      try {
        const redis = getRedis();
        const dailyCost = await redis.get(`llmcost:${this.workspaceId}:daily:${dayStart}`);
        trends.push({
          date: dateStr,
          hourly: 0,
          daily: dailyCost ? parseFloat(dailyCost) : 0,
        });
      } catch {
        trends.push({ date: dateStr, hourly: 0, daily: 0 });
      }
    }
    
    return trends.reverse();
  }
}

// Singleton instance
const trackers = new Map<number, AdvancedCostTracker>();

/**
 * Get or create a cost tracker for a workspace
 */
export function getCostTracker(workspaceId: number, sessionId?: string): AdvancedCostTracker {
  const key = workspaceId;
  if (!trackers.has(key)) {
    trackers.set(key, new AdvancedCostTracker(workspaceId, sessionId));
  }
  return trackers.get(key)!;
}

/**
 * Reset a workspace's cost tracker
 */
export function resetCostTracker(workspaceId: number): void {
  trackers.delete(workspaceId);
}

// Export utilities
export {
  MODEL_COSTS,
  formatNumber,
  formatDuration,
};

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
