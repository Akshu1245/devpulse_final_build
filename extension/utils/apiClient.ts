/**
 * DevPulse Extension API Client (PHASE 8)
 * ========================================
 * Type-safe REST wrapper for VS Code extension to communicate with DevPulse backend.
 * Handles authentication, error handling, retry logic, and response caching.
 */

import * as vscode from 'vscode';

export interface ExtensionConfig {
  apiUrl: string;
  apiKey: string;
  workspaceId: number;
  refreshInterval: number;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: ApiError;
}

/**
 * DevPulse API Client
 * Provides type-safe access to backend endpoints with caching and retry logic
 */
export class DevPulseClient {
  private config: ExtensionConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 30000; // 30 seconds
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor(config: ExtensionConfig) {
    this.config = config;
  }

  /**
   * Update configuration (e.g., after settings change)
   */
  updateConfig(config: Partial<ExtensionConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Make authenticated request to tRPC endpoint
   */
  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const cacheKey = `${path}:${JSON.stringify(options?.body || '')}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }

    // Retry logic
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const url = `${this.config.apiUrl}${path}`;

        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            ...options?.headers,
          },
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data: T = await response.json();

        // Cache successful response
        this.cache.set(cacheKey, { data, timestamp: Date.now() });

        return data;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retryAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * (attempt + 1))
          );
        }
      }
    }

    throw lastError || new Error('Unknown API error');
  }

  /**
   * Get workspace unified risk score (PHASE 4)
   */
  async getUnifiedRiskScore(): Promise<{
    score: number;
    tier: string;
    statusMessage: string;
    riskFactors: string[];
  }> {
    return this.request(
      `/api/trpc/unified.getWorkspaceRisk?input={"workspaceId":${this.config.workspaceId}}`
    );
  }

  /**
   * Get thinking token summary (PHASE 5)
   */
  async getThinkingTokenSummary(): Promise<{
    totalThinkingTokens: number;
    totalThinkingCost: number;
    topModels: Array<{ model: string; tokens: number; cost: number }>;
  }> {
    return this.request(
      `/api/trpc/thinkingTokens.getSummary?input={"workspaceId":${this.config.workspaceId}}`
    );
  }

  /**
   * Get LLM cost summary (PHASE 2/4)
   */
  async getLLMCostSummary(): Promise<{
    totalCost: number;
    dailyCost: number;
    provider: Array<{ name: string; cost: number; percentage: number }>;
    trend: Array<{ date: string; cost: number }>;
  }> {
    return this.request(
      `/api/trpc/llmCost.getSummary?input={"workspaceId":${this.config.workspaceId}}`
    );
  }

  /**
   * Get active agents + incidents (PHASE 6)
   */
  async getAgentGuardStatus(): Promise<{
    activeAgentCount: number;
    recentInterventions: Array<{
      agentId: string;
      action: string;
      reason: string;
      timestamp: number;
    }>;
    riskScore: number;
  }> {
    return this.request(
      `/api/trpc/agentGuard.getStatus?input={"workspaceId":${this.config.workspaceId}}`
    );
  }

  /**
   * Get shadow API detections (PHASE 7)
   */
  async getShadowApiDetections(): Promise<{
    totalDetected: number;
    criticalCount: number;
    highCount: number;
    topEndpoints: Array<{
      path: string;
      riskScore: number;
      riskTier: string;
      frequency: number;
      cost: number;
    }>;
  }> {
    return this.request(
      `/api/trpc/shadowApi.getSummary?input={"workspaceId":${this.config.workspaceId}}`
    );
  }

  /**
   * Get recent vulnerabilities
   */
  async getRecentVulnerabilities(): Promise<{
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalOpen: number;
  }> {
    return this.request(
      `/api/trpc/security.getSummary?input={"workspaceId":${this.config.workspaceId}}`
    );
  }

  /**
   * Trigger a scan
   */
  async triggerScan(projectId?: string): Promise<{
    scanId: number;
    status: string;
    message: string;
  }> {
    return this.request('/api/trpc/scan.create', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: this.config.workspaceId,
        projectId,
      }),
    });
  }

  /**
   * Kill a rogue agent (PHASE 6 - AgentGuard)
   */
  async killAgent(agentId: string, reason: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/api/trpc/agentGuard.killAgent', {
      method: 'POST',
      body: JSON.stringify({ agentId, reason }),
    });
  }

  /**
   * Whitelist shadow API endpoint (PHASE 7)
   */
  async whitelistEndpoint(endpoint: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request('/api/trpc/shadowApi.whitelistEndpoint', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: this.config.workspaceId,
        endpoint,
        reason,
      }),
    });
  }

  /**
   * Clear cache (useful for force-refresh)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache stats (for debugging)
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      ttl: this.cacheTTL,
    };
  }
}

/**
 * Get or create singleton API client
 */
let client: DevPulseClient | null = null;

export function getApiClient(forceNew = false): DevPulseClient | null {
  if (forceNew || !client) {
    const config = vscode.workspace.getConfiguration('devpulse');
    const apiUrl = config.get<string>('apiUrl') || 'http://localhost:3000';
    const apiKey = config.get<string>('apiKey') || '';
    const workspaceId = config.get<number>('workspaceId') || 0;
    const refreshInterval = config.get<number>('refreshInterval') || 30000;

    if (!apiKey || !workspaceId) {
      vscode.window.showErrorMessage(
        'DevPulse: API key and workspace ID not configured. Please configure in settings.'
      );
      return null;
    }

    client = new DevPulseClient({
      apiUrl,
      apiKey,
      workspaceId,
      refreshInterval,
    });
  }

  return client;
}

export function setApiClient(newClient: DevPulseClient) {
  client = newClient;
}
