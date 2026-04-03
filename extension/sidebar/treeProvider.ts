/**
 * DevPulse Sidebar Tree Provider (PHASE 8)
 * ========================================
 * Real-time data tree for VS Code sidebar showing:
 * - Unified risk score (PHASE 4)
 * - LLM costs (PHASE 2/4)
 * - Thinking tokens (PHASE 5)
 * - Active agents + incidents (PHASE 6)
 * - Shadow APIs (PHASE 7)
 * - Vulnerabilities (PHASE 0)
 *
 * PHASE 8C: WebSocket real-time updates with polling fallback
 */

import * as vscode from 'vscode';
import { getApiClient, DevPulseClient } from '../utils/apiClient';

// PHASE 8C: Import real-time service for WebSocket updates
import { getRealtimeService } from '../services/realtimeService';

export interface SidebarData {
  riskScore: RiskScoreData;
  llmCosts: LLMCostData;
  thinkingTokens: ThinkingTokenData;
  agentGuard: AgentGuardData;
  shadowApis: ShadowApiData;
  vulnerabilities: VulnerabilityData;
}

interface RiskScoreData {
  score: number;
  tier: string;
  message: string;
}

interface LLMCostData {
  total: number;
  daily: number;
  topProvider: string;
}

interface ThinkingTokenData {
  total: number;
  cost: number;
  topModel: string;
}

interface AgentGuardData {
  activeCount: number;
  incidents: number;
  riskScore: number;
}

interface ShadowApiData {
  totalDetected: number;
  critical: number;
  high: number;
}

interface VulnerabilityData {
  critical: number;
  high: number;
  medium: number;
}

export class DevPulseSidebarProvider
  implements vscode.TreeDataProvider<SidebarNode>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    SidebarNode | undefined | null | void
  > = new vscode.EventEmitter<SidebarNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    SidebarNode | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private apiClient: DevPulseClient | null;
  private sidebarData: SidebarData | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isLoading: boolean = false;
  
  // PHASE 8C: WebSocket real-time updates
  private wsUnsubscribers: Array<() => void> = [];
  private connectionStatus: 'idle' | 'connecting' | 'connected' | 'polling' = 'idle';

  constructor() {
    this.apiClient = getApiClient();
    this.refresh();
    this.initializeRealtimeUpdates();
  }

  /**
   * PHASE 8C: Initialize real-time updates via WebSocket or polling
   */
  private initializeRealtimeUpdates() {
    const realtimeService = getRealtimeService();
    
    if (realtimeService) {
      this.connectionStatus = 'connecting';
      
      // Subscribe to real-time updates
      this.wsUnsubscribers.push(
        realtimeService.onRiskScoreUpdate((data) => {
          if (this.sidebarData) {
            this.sidebarData.riskScore = {
              score: data.score || 0,
              tier: data.tier || 'UNKNOWN',
              message: data.statusMessage || 'Updated',
            };
            this._onDidChangeTreeData.fire();
          }
        })
      );

      this.wsUnsubscribers.push(
        realtimeService.onCostUpdate((data) => {
          if (this.sidebarData) {
            this.sidebarData.llmCosts = {
              total: data.total || 0,
              daily: data.daily || 0,
              topProvider: data.topProvider || 'N/A',
            };
            this._onDidChangeTreeData.fire();
          }
        })
      );

      this.wsUnsubscribers.push(
        realtimeService.onAgentUpdate((data) => {
          if (this.sidebarData) {
            this.sidebarData.agentGuard = {
              activeCount: data.activeCount || 0,
              incidents: data.incidents || 0,
              riskScore: data.riskScore || 0,
            };
            this._onDidChangeTreeData.fire();
          }
        })
      );

      this.wsUnsubscribers.push(
        realtimeService.onShadowApiUpdate((data) => {
          if (this.sidebarData) {
            this.sidebarData.shadowApis = {
              totalDetected: data.total || 0,
              critical: data.critical || 0,
              high: data.high || 0,
            };
            this._onDidChangeTreeData.fire();
          }
        })
      );

      this.connectionStatus = 'connected';
      console.log('[Sidebar] Real-time WebSocket updates enabled');
    } else {
      // Fallback to polling if WebSocket not available
      this.connectionStatus = 'polling';
      console.log('[Sidebar] WebSocket not available, using polling');
    }

    // Always start polling as fallback or primary refresh
    this.startAutoRefresh();
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'idle' | 'connecting' | 'connected' | 'polling' {
    return this.connectionStatus;
  }

  /**
   * Start auto-refresh every 30 seconds (polling as fallback)
   */
  private startAutoRefresh() {
    // If WebSocket connected, use longer polling interval as fallback
    const interval = this.connectionStatus === 'connected' ? 60000 : 30000;
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, interval);
  }

  /**
   * Stop auto-refresh (for cleanup)
   */
  public stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    // PHASE 8C: Clean up WebSocket subscriptions
    this.wsUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.wsUnsubscribers = [];
  }

  /**
   * Refresh all sidebar data
   */
  async refresh(node?: SidebarNode) {
    if (!this.apiClient) {
      this.apiClient = getApiClient();
      if (!this.apiClient) return;
    }

    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const [riskScore, llmCosts, thinkingTokens, agentGuard, shadowApis, vuln] =
        await Promise.all([
          this.apiClient
            .getUnifiedRiskScore()
            .catch(() => ({ score: 0, tier: 'UNKNOWN', statusMessage: 'Error loading' })),
          this.apiClient
            .getLLMCostSummary()
            .catch(() => ({ totalCost: 0, dailyCost: 0, provider: [], trend: [] })),
          this.apiClient
            .getThinkingTokenSummary()
            .catch(() => ({ totalThinkingTokens: 0, totalThinkingCost: 0, topModels: [] })),
          this.apiClient
            .getAgentGuardStatus()
            .catch(() => ({ activeAgentCount: 0, recentInterventions: [], riskScore: 0 })),
          this.apiClient
            .getShadowApiDetections()
            .catch(() => ({ totalDetected: 0, criticalCount: 0, highCount: 0, topEndpoints: [] })),
          this.apiClient
            .getRecentVulnerabilities()
            .catch(() => ({ critical: 0, high: 0, medium: 0, low: 0, totalOpen: 0 })),
        ]);

      this.sidebarData = {
        riskScore: {
          score: riskScore.score || 0,
          tier: riskScore.tier || 'UNKNOWN',
          message: riskScore.statusMessage || 'N/A',
        },
        llmCosts: {
          total: llmCosts.totalCost || 0,
          daily: llmCosts.dailyCost || 0,
          topProvider: llmCosts.provider?.[0]?.name || 'N/A',
        },
        thinkingTokens: {
          total: thinkingTokens.totalThinkingTokens || 0,
          cost: thinkingTokens.totalThinkingCost || 0,
          topModel: thinkingTokens.topModels?.[0]?.model || 'N/A',
        },
        agentGuard: {
          activeCount: agentGuard.activeAgentCount || 0,
          incidents: agentGuard.recentInterventions?.length || 0,
          riskScore: agentGuard.riskScore || 0,
        },
        shadowApis: {
          totalDetected: shadowApis.totalDetected || 0,
          critical: shadowApis.criticalCount || 0,
          high: shadowApis.highCount || 0,
        },
        vulnerabilities: {
          critical: vuln.critical || 0,
          high: vuln.high || 0,
          medium: vuln.medium || 0,
        },
      };

      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Error refreshing sidebar:', error);
    } finally {
      this.isLoading = false;
    }
  }

  getTreeItem(element: SidebarNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SidebarNode): Promise<SidebarNode[]> {
    if (!this.sidebarData) {
      return [
        new SidebarNode(
          'Loading...',
          vscode.TreeItemCollapsibleState.None,
          'loading'
        ),
      ];
    }

    if (!element) {
      // Root items
      return [
        new SidebarNode(
          `🔴 Risk Score: ${this.sidebarData.riskScore.score}/100`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'risk',
          {
            level: this.sidebarData.riskScore.tier,
            descriptions: [this.sidebarData.riskScore.message],
          }
        ),
        new SidebarNode(
          `💰 LLM Costs: $${this.sidebarData.llmCosts.total.toFixed(2)}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'costs',
          {
            daily: this.sidebarData.llmCosts.daily,
            topProvider: this.sidebarData.llmCosts.topProvider,
          }
        ),
        new SidebarNode(
          `🤔 Thinking Tokens: ${this.sidebarData.thinkingTokens.total.toLocaleString()}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'thinking',
          {
            cost: this.sidebarData.thinkingTokens.cost,
            topModel: this.sidebarData.thinkingTokens.topModel,
          }
        ),
        new SidebarNode(
          `🤖 Agents: ${this.sidebarData.agentGuard.activeCount} active`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'agents',
          {
            incidents: this.sidebarData.agentGuard.incidents,
            riskScore: this.sidebarData.agentGuard.riskScore,
          }
        ),
        new SidebarNode(
          `🚨 Shadow APIs: ${this.sidebarData.shadowApis.totalDetected} detected`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'shadows',
          {
            critical: this.sidebarData.shadowApis.critical,
            high: this.sidebarData.shadowApis.high,
          }
        ),
        new SidebarNode(
          `⚠️ Vulnerabilities: ${this.sidebarData.vulnerabilities.critical + this.sidebarData.vulnerabilities.high} high+`,
          vscode.TreeItemCollapsibleState.Collapsed,
          'vulnerabilities',
          {
            critical: this.sidebarData.vulnerabilities.critical,
            high: this.sidebarData.vulnerabilities.high,
            medium: this.sidebarData.vulnerabilities.medium,
          }
        ),
      ];
    }

    // Expand specific categories
    if (element.type === 'risk') {
      return [
        new SidebarNode(
          `Tier: ${element.metadata?.level || 'N/A'}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `Status: ${element.metadata?.descriptions?.[0] || 'N/A'}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          'View Full Report',
          vscode.TreeItemCollapsibleState.None,
          'action',
          { action: 'viewRiskReport' }
        ),
      ];
    }

    if (element.type === 'costs') {
      return [
        new SidebarNode(
          `Daily: $${element.metadata?.daily.toFixed(2) || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `Top Provider: ${element.metadata?.topProvider || 'N/A'}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          'View Cost Analytics',
          vscode.TreeItemCollapsibleState.None,
          'action',
          { action: 'viewCosts' }
        ),
      ];
    }

    if (element.type === 'thinking') {
      return [
        new SidebarNode(
          `Cost: $${element.metadata?.cost.toFixed(2) || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `Top Model: ${element.metadata?.topModel || 'N/A'}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          'View Token Breakdown',
          vscode.TreeItemCollapsibleState.None,
          'action',
          { action: 'viewThinking' }
        ),
      ];
    }

    if (element.type === 'agents') {
      return [
        new SidebarNode(
          `Recent Incidents: ${element.metadata?.incidents || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `Risk Score: ${element.metadata?.riskScore || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          'Monitor Agents',
          vscode.TreeItemCollapsibleState.None,
          'action',
          { action: 'viewAgents' }
        ),
      ];
    }

    if (element.type === 'shadows') {
      return [
        new SidebarNode(
          `🔴 Critical: ${element.metadata?.critical || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `🟠 High: ${element.metadata?.high || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          'Review Shadow APIs',
          vscode.TreeItemCollapsibleState.None,
          'action',
          { action: 'viewShadows' }
        ),
      ];
    }

    if (element.type === 'vulnerabilities') {
      return [
        new SidebarNode(
          `🔴 Critical: ${element.metadata?.critical || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `🟠 High: ${element.metadata?.high || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          `🟡 Medium: ${element.metadata?.medium || 0}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ),
        new SidebarNode(
          'View Vulnerabilities',
          vscode.TreeItemCollapsibleState.None,
          'action',
          { action: 'viewVulnerabilities' }
        ),
      ];
    }

    return [];
  }

  /**
   * Handle item click (for action items)
   */
  async handleItemClick(node: SidebarNode) {
    if (node.type === 'action' && node.metadata?.action) {
      // Dispatch action to main extension file
      vscode.commands.executeCommand(
        `devpulse.${node.metadata.action}`
      );
    }
  }
}

export class SidebarNode extends vscode.TreeItem {
  public type: string;
  public metadata?: any;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    type: string,
    metadata?: any
  ) {
    super(label, collapsibleState);
    this.type = type;
    this.metadata = metadata;

    // Set icons based on type
    if (type === 'risk') {
      this.iconPath = new vscode.ThemeColor('charts.red');
    } else if (type === 'costs') {
      this.iconPath = new vscode.ThemeColor('charts.green');
    } else if (type === 'thinking') {
      this.iconPath = new vscode.ThemeColor('charts.blue');
    } else if (type === 'action') {
      this.command = {
        title: label,
        command: 'devpulse.triggerAction',
        arguments: [this],
      };
    }
  }
}
