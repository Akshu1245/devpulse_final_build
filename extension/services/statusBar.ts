/**
 * DevPulse StatusBar — Live Agent Spend Rate
 * ==========================================
 * Shows real-time agent spend rate updating every 5 seconds
 * 
 * Displays:
 * - Current spend rate ($/min)
 * - Total daily spend
 * - Active agent count
 * - Warning/Critical indicators
 */

import * as vscode from 'vscode';

export interface StatusBarData {
  spendRatePerMin: number;
  dailySpend: number;
  activeAgents: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  budgetLimit?: number;
  budgetUsedPercent?: number;
}

export class DevPulseStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private updateInterval: NodeJS.Timeout | null = null;
  private data: StatusBarData = {
    spendRatePerMin: 0,
    dailySpend: 0,
    activeAgents: 0,
    status: 'unknown',
  };

  // Thresholds for status colors
  private readonly THRESHOLDS = {
    warning: { spendRatePerMin: 0.50, budgetPercent: 70 },
    critical: { spendRatePerMin: 1.00, budgetPercent: 90 },
  };

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'devpulse.showCostDashboard';
    this.statusBarItem.tooltip = 'DevPulse: Click to view cost dashboard';
    this.updateDisplay();
  }

  /**
   * Start auto-refresh every 5 seconds
   */
  startAutoRefresh(fetchDataFn: () => Promise<StatusBarData>): void {
    this.updateInterval = setInterval(async () => {
      try {
        this.data = await fetchDataFn();
        this.updateDisplay();
      } catch (err) {
        console.error('[StatusBar] Error fetching data:', err);
        this.data.status = 'unknown';
        this.updateDisplay();
      }
    }, 5000);

    // Immediate first fetch
    fetchDataFn().then((data) => {
      this.data = data;
      this.updateDisplay();
    }).catch(console.error);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update display with current data
   */
  private updateDisplay(): void {
    const { spendRatePerMin, dailySpend, activeAgents, status, budgetUsedPercent } = this.data;

    // Format spend rate
    const rateText = spendRatePerMin >= 0.01 
      ? `$${spendRatePerMin.toFixed(2)}/min`
      : `$${(spendRatePerMin * 60).toFixed(2)}/hr`;

    // Build display text
    let text = `$(pulse) `;
    
    if (status === 'critical') {
      text += `$(warning) ${rateText}`;
    } else if (status === 'warning') {
      text += `$(alert) ${rateText}`;
    } else {
      text += rateText;
    }

    // Add agent count if > 0
    if (activeAgents > 0) {
      text += ` | ${activeAgents} $(robot)`;
    }

    // Add budget indicator if near limit
    if (budgetUsedPercent && budgetUsedPercent > 70) {
      text += ` | ${budgetUsedPercent.toFixed(0)}%`;
    }

    this.statusBarItem.text = text;

    // Set background color based on status
    if (status === 'critical') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
      this.statusBarItem.color = new vscode.ThemeColor(
        'statusBarItem.errorForeground'
      );
    } else if (status === 'warning') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
      this.statusBarItem.color = new vscode.ThemeColor(
        'statusBarItem.warningForeground'
      );
    } else {
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.color = undefined;
    }

    // Update tooltip
    this.statusBarItem.tooltip = this.buildTooltip();
  }

  /**
   * Build detailed tooltip
   */
  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    
    md.appendMarkdown('### DevPulse Agent Monitor\n\n');
    md.appendMarkdown(`**Spend Rate:** $${this.data.spendRatePerMin.toFixed(4)}/min\n\n`);
    md.appendMarkdown(`**Today's Spend:** $${this.data.dailySpend.toFixed(2)}\n\n`);
    md.appendMarkdown(`**Active Agents:** ${this.data.activeAgents}\n\n`);
    
    if (this.data.budgetLimit) {
      md.appendMarkdown(`**Budget:** $${this.data.budgetLimit.toFixed(2)}\n\n`);
      md.appendMarkdown(`**Used:** ${this.data.budgetUsedPercent?.toFixed(1)}%\n\n`);
    }

    const statusEmoji = this.data.status === 'healthy' ? '✅' : 
                        this.data.status === 'warning' ? '⚠️' : 
                        this.data.status === 'critical' ? '🔴' : '❓';
    md.appendMarkdown(`**Status:** ${statusEmoji} ${this.data.status.toUpperCase()}\n\n`);
    
    md.appendMarkdown('---\n\n');
    md.appendMarkdown('[View Dashboard](command:devpulse.showCostDashboard) | ');
    md.appendMarkdown('[View Agents](command:devpulse.showAgentGuard)');

    return md;
  }

  /**
   * Show status bar
   */
  show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide status bar
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Update data directly (for WebSocket updates)
   */
  updateData(data: Partial<StatusBarData>): void {
    this.data = { ...this.data, ...data };
    this.calculateStatus();
    this.updateDisplay();
  }

  /**
   * Calculate status based on thresholds
   */
  private calculateStatus(): void {
    const { spendRatePerMin, budgetUsedPercent } = this.data;

    if (spendRatePerMin >= this.THRESHOLDS.critical.spendRatePerMin ||
        (budgetUsedPercent && budgetUsedPercent >= this.THRESHOLDS.critical.budgetPercent)) {
      this.data.status = 'critical';
    } else if (spendRatePerMin >= this.THRESHOLDS.warning.spendRatePerMin ||
               (budgetUsedPercent && budgetUsedPercent >= this.THRESHOLDS.warning.budgetPercent)) {
      this.data.status = 'warning';
    } else {
      this.data.status = 'healthy';
    }
  }

  /**
   * Flash warning animation for kill switch events
   */
  flashKillSwitchAlert(agentId: string, reason: string): void {
    const originalText = this.statusBarItem.text;
    const alertText = `$(warning) KILL SWITCH: ${agentId}`;
    
    // Flash 3 times
    let count = 0;
    const flashInterval = setInterval(() => {
      this.statusBarItem.text = count % 2 === 0 ? alertText : originalText;
      this.statusBarItem.backgroundColor = count % 2 === 0 
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : undefined;
      count++;
      
      if (count >= 6) {
        clearInterval(flashInterval);
        this.updateDisplay();
      }
    }, 500);

    // Show notification
    vscode.window.showWarningMessage(
      `DevPulse Kill Switch activated for agent ${agentId}: ${reason}`,
      'View Details'
    ).then(action => {
      if (action === 'View Details') {
        vscode.commands.executeCommand('devpulse.showAgentGuard');
      }
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopAutoRefresh();
    this.statusBarItem.dispose();
  }
}
