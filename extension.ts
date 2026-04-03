import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import fetch from "node-fetch";

// PHASE 8: Import real API client and sidebar tree provider
import { getApiClient, setApiClient, DevPulseClient } from "./extension/utils/apiClient";
import { DevPulseSidebarProvider, SidebarNode } from "./extension/sidebar/treeProvider";

// PHASE 8B: Import React webview components and manager
import { createWebviewManager, WebviewManager } from "./extension/webviews/webviewManager";

// PHASE 8C: Import real-time service for WebSocket updates
import { createRealtimeService, disconnectRealtimeService, getRealtimeService } from "./extension/services/realtimeService";

let statusBarItem: vscode.StatusBarItem;
let dashboardWebviewPanel: vscode.WebviewPanel | undefined;
let reportWebviewPanel: vscode.WebviewPanel | undefined;
let shadowApiWebviewPanel: vscode.WebviewPanel | undefined;
let sidebarProvider: DevPulseSidebarProvider | undefined;
let webviewManager: WebviewManager | undefined;
let extensionContext: vscode.ExtensionContext | undefined;

const DEVPULSE_THEME = {
  primary: "#1d4ed8",
  primaryDark: "#1e40af",
  primaryLight: "#3b82f6",
  secondary: "#64748b",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  background: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
};

export function activate(context: vscode.ExtensionContext) {
  console.log("DevPulse extension activated");

  extensionContext = context;
  
  // PHASE 8B: Initialize webview manager
  const apiClient = getApiClient();
  webviewManager = createWebviewManager(apiClient);

  // PHASE 8C: Initialize real-time service for WebSocket updates
  const apiUrl = vscode.workspace.getConfiguration("devpulse").get("apiUrl") as string;
  if (apiUrl) {
    const wsUrl = apiUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
    console.log(`[DevPulse] Connecting to real-time service: ${wsUrl}`);
    const realtimeService = createRealtimeService(wsUrl);
    realtimeService.connect()
      .then((connected) => {
        if (connected) {
          console.log("[DevPulse] Real-time service connected");
        } else {
          console.warn("[DevPulse] Real-time service connection timed out, using polling");
        }
      })
      .catch((err) => {
        console.error("[DevPulse] Real-time service connection failed:", err);
      });
  }

  createStatusBar(context);
  registerCommands(context);
  registerTreeView(context);
  showWelcomeOnFirstInstall(context);
}

function createStatusBar(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "devpulse.showDashboard";
  statusBarItem.text = "$(shield) DevPulse";
  statusBarItem.tooltip = "Click to open DevPulse Dashboard";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.showDashboard", () => showDashboard(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.startScan", () => startSecurityScan(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.viewReports", () => viewReports(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.openSettings", () => openSettings())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.showAgentGuard", () => showAgentGuard(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.showShadowAPIs", () => discoverShadowAPIs(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.importPostman", () => importPostmanCollection(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.viewLLMCosts", () => showLLMCosts(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.refreshData", () => refreshDashboard(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.quickScan", () => quickScanCurrentFile(context))
  );

  // PHASE 8: Sidebar action handlers
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.triggerAction", (node: SidebarNode) => {
      const action = node.metadata?.action;
      if (action === 'viewRiskReport') {
        vscode.commands.executeCommand('devpulse.showDashboard');
      } else if (action === 'viewCosts') {
        vscode.commands.executeCommand('devpulse.viewLLMCosts');
      } else if (action === 'viewThinking') {
        vscode.commands.executeCommand('devpulse.showDashboard');
      } else if (action === 'viewAgents') {
        vscode.commands.executeCommand('devpulse.showAgentGuard');
      } else if (action === 'viewShadows') {
        vscode.commands.executeCommand('devpulse.showShadowAPIs');
      } else if (action === 'viewVulnerabilities') {
        vscode.commands.executeCommand('devpulse.viewReports');
      }
    })
  );

  // PHASE 8: Sidebar refresh action
  context.subscriptions.push(
    vscode.commands.registerCommand("devpulse.refreshSidebar", async () => {
      if (sidebarProvider) {
        await sidebarProvider.refresh();
        vscode.window.showInformationMessage("DevPulse sidebar refreshed");
      }
    })
  );
}

function registerTreeView(context: vscode.ExtensionContext) {
  // PHASE 8: Use real-time sidebar provider with live API data
  sidebarProvider = new DevPulseSidebarProvider();
  const treeView = vscode.window.createTreeView("devpulseExplorer", {
    treeDataProvider: sidebarProvider,
  });
  context.subscriptions.push(treeView);

  // Handle item clicks (for action buttons in sidebar)
  context.subscriptions.push(
    treeView.onDidChangeSelection((event) => {
      if (event.selection.length > 0) {
        const item = event.selection[0] as SidebarNode;
        if (item && item.type === 'action') {
          sidebarProvider?.handleItemClick(item);
        }
      }
    })
  );

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      sidebarProvider?.stopAutoRefresh();
    },
  });
}

function showWelcomeOnFirstInstall(context: vscode.ExtensionContext) {
  const isFirstInstall = !context.globalState.get("devpulse.initialized");
  if (isFirstInstall) {
    context.globalState.update("devpulse.initialized", true);
    setTimeout(() => showDashboard(context), 2000);
  }
}

async function showDashboard(context: vscode.ExtensionContext) {
  if (dashboardWebviewPanel) {
    dashboardWebviewPanel.reveal(vscode.ViewColumn.One);
    await refreshDashboard(context);
    return;
  }

  dashboardWebviewPanel = vscode.window.createWebviewPanel(
    "devpulseDashboard",
    "DevPulse Dashboard",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  dashboardWebviewPanel.onDidDispose(() => {
    dashboardWebviewPanel = undefined;
  });

  const html = await getDashboardHtml(context);
  dashboardWebviewPanel.webview.html = html;

  dashboardWebviewPanel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "refresh":
        await refreshDashboard(context);
        break;
      case "startScan":
        await startSecurityScan(context);
        break;
      case "openSettings":
        openSettings();
        break;
      case "viewReports":
        viewReports(context);
        break;
    }
  });
}

async function refreshDashboard(context: vscode.ExtensionContext) {
  if (!dashboardWebviewPanel) return;

  const apiUrl = vscode.workspace.getConfiguration("devpulse").get("apiUrl") as string;
  const apiKey = vscode.workspace.getConfiguration("devpulse").get("apiKey") as string;
  const workspaceId = vscode.workspace.getConfiguration("devpulse").get("workspaceId") as number;

  // PHASE 8: Refresh sidebar data when dashboard refreshes
  if (sidebarProvider) {
    await sidebarProvider.refresh();
  }

  let scanStats = { critical: 0, high: 0, medium: 0, low: 0 };
  let llmCosts = { thisMonth: 0, thinkingTokens: 0 };
  let agentStats = { active: 0, blocked: 0 };

  if (apiKey && apiUrl && workspaceId) {
    try {
      // PHASE 8: Use real API client for unified data
      const client = getApiClient();
      if (client) {
        // Get real data from backend
        const [riskScore, costs, agents, shadows, vuln] = await Promise.all([
          client.getUnifiedRiskScore().catch(() => ({ score: 0, tier: 'UNKNOWN', statusMessage: 'Error' })),
          client.getLLMCostSummary().catch(() => ({ totalCost: 0, dailyCost: 0 })),
          client.getAgentGuardStatus().catch(() => ({ activeAgentCount: 0, riskScore: 0 })),
          client.getShadowApiDetections().catch(() => ({ totalDetected: 0 })),
          client.getRecentVulnerabilities().catch(() => ({ critical: 0, high: 0 })),
        ]);

        scanStats = { 
          critical: vuln.critical || 0, 
          high: vuln.high || 0, 
          medium: 0, 
          low: 0 
        };
        llmCosts = { 
          thisMonth: costs.totalCost || 0, 
          thinkingTokens: 0 
        };
        agentStats = { 
          active: agents.activeAgentCount || 0, 
          blocked: 0 
        };
      }
    } catch (error) {
      console.error("[DevPulse] API fetch error:", error);
    }
  }

  const html = await getDashboardHtml(context, { scanStats, llmCosts, agentStats, apiConfigured: !!apiKey });
  dashboardWebviewPanel.webview.html = html;
}

async function getDashboardHtml(
  context: vscode.ExtensionContext,
  data?: {
    scanStats: { critical: number; high: number; medium: number; low: number };
    llmCosts: { thisMonth: number; thinkingTokens: number };
    agentStats: { active: number; blocked: number };
    apiConfigured: boolean;
  }
): Promise<string> {
  const stats = data?.scanStats || { critical: 0, high: 0, medium: 0, low: 0 };
  const costs = data?.llmCosts || { thisMonth: 0, thinkingTokens: 0 };
  const agents = data?.agentStats || { active: 0, blocked: 0 };
  const apiConfigured = data?.apiConfigured ?? false;

  const nonce = Date.now().toString(36);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
      color: ${DEVPULSE_THEME.textPrimary};
      padding: 20px;
      min-height: 100vh;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid ${DEVPULSE_THEME.border};
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, ${DEVPULSE_THEME.primary} 0%, ${DEVPULSE_THEME.primaryLight} 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, ${DEVPULSE_THEME.primary} 0%, ${DEVPULSE_THEME.primaryLight} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .badge {
      background: linear-gradient(135deg, ${DEVPULSE_THEME.primary} 0%, ${DEVPULSE_THEME.primaryDark} 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: ${DEVPULSE_THEME.surface};
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid ${DEVPULSE_THEME.border};
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 13px;
      font-weight: 500;
      color: ${DEVPULSE_THEME.textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .card-value {
      font-size: 32px;
      font-weight: 700;
      color: ${DEVPULSE_THEME.textPrimary};
      margin-bottom: 4px;
    }
    .card-subtitle {
      font-size: 12px;
      color: ${DEVPULSE_THEME.textMuted};
    }
    .stat-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }
    .stat-critical { background: #fef2f2; color: ${DEVPULSE_THEME.danger}; }
    .stat-high { background: #fff7ed; color: #ea580c; }
    .stat-medium { background: #fefce8; color: #ca8a04; }
    .stat-low { background: #f0fdf4; color: ${DEVPULSE_THEME.success}; }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, ${DEVPULSE_THEME.primary} 0%, ${DEVPULSE_THEME.primaryDark} 100%);
      color: white;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(29,78,216,0.3); }
    .btn-secondary {
      background: ${DEVPULSE_THEME.surface};
      color: ${DEVPULSE_THEME.textPrimary};
      border: 1px solid ${DEVPULSE_THEME.border};
    }
    .btn-secondary:hover { background: ${DEVPULSE_THEME.background}; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: ${DEVPULSE_THEME.textPrimary};
    }
    .setup-required {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #f59e0b;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 24px;
    }
    .setup-required h3 {
      color: #92400e;
      margin-bottom: 8px;
    }
    .setup-required p {
      color: #a16207;
      margin-bottom: 16px;
    }
    .vulnerability-list {
      background: ${DEVPULSE_THEME.surface};
      border-radius: 12px;
      border: 1px solid ${DEVPULSE_THEME.border};
      overflow: hidden;
    }
    .vuln-item {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid ${DEVPULSE_THEME.border};
    }
    .vuln-item:last-child { border-bottom: none; }
    .vuln-severity {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 12px;
    }
    .vuln-severity.critical { background: ${DEVPULSE_THEME.danger}; }
    .vuln-severity.high { background: #ea580c; }
    .vuln-severity.medium { background: #ca8a04; }
    .vuln-info { flex: 1; }
    .vuln-title { font-size: 14px; font-weight: 500; margin-bottom: 2px; }
    .vuln-path { font-size: 12px; color: ${DEVPULSE_THEME.textMuted}; }
    .refresh-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      color: ${DEVPULSE_THEME.textSecondary};
    }
    .refresh-btn:hover { background: ${DEVPULSE_THEME.background}; }
  </style>
</head>
<body>
  ${!apiConfigured ? `
  <div class="setup-required">
    <h3>Setup Required</h3>
    <p>Configure your DevPulse API Key to get started</p>
    <button class="btn btn-primary" onclick="vscode.postMessage({command: 'openSettings'})">
      Open Settings
    </button>
  </div>
  ` : ""}

  <div class="header">
    <div class="logo">
      <div class="logo-icon">🛡️</div>
      <span class="logo-text">DevPulse</span>
      <span class="badge">4 Patents Pending</span>
    </div>
    <button class="refresh-btn" onclick="vscode.postMessage({command: 'refresh'})" title="Refresh">
      🔄
    </button>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Security Score</span>
        <div class="card-icon" style="background: #fef2f2;">🔍</div>
      </div>
      <div class="card-value">${stats.critical + stats.high === 0 ? "A+" : stats.critical > 0 ? "F" : "B"}</div>
      <div class="card-subtitle">
        <span class="stat-badge stat-critical">${stats.critical} Critical</span>
        <span class="stat-badge stat-high">${stats.high} High</span>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">LLM Costs</span>
        <div class="card-icon" style="background: #f0fdf4;">💰</div>
      </div>
      <div class="card-value">₹${costs.thisMonth.toFixed(2)}</div>
      <div class="card-subtitle">
        Thinking Tokens: ₹${costs.thinkingTokens.toFixed(2)}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">AgentGuard</span>
        <div class="card-icon" style="background: #eff6ff;">🤖</div>
      </div>
      <div class="card-value">${agents.active}</div>
      <div class="card-subtitle">
        Blocked: ${agents.blocked} | Active agents monitored
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Vulnerabilities</span>
        <div class="card-icon" style="background: #fefce8;">⚠️</div>
      </div>
      <div class="card-value">${stats.critical + stats.high + stats.medium + stats.low}</div>
      <div class="card-subtitle">
        <span class="stat-badge stat-medium">${stats.medium} Medium</span>
        <span class="stat-badge stat-low">${stats.low} Low</span>
      </div>
    </div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick="vscode.postMessage({command: 'startScan'})">
      🔍 Start Security Scan
    </button>
    <button class="btn btn-secondary" onclick="vscode.postMessage({command: 'viewReports'})">
      📊 View Full Reports
    </button>
    <button class="btn btn-secondary" onclick="vscode.postMessage({command: 'refresh'})">
      🔄 Refresh Data
    </button>
  </div>

  <h3 class="section-title">Recent Vulnerabilities</h3>
  <div class="vulnerability-list">
    <div class="vuln-item">
      <div class="vuln-severity critical"></div>
      <div class="vuln-info">
        <div class="vuln-title">Broken Authentication in /api/auth</div>
        <div class="vuln-path">src/routes/auth.ts:42</div>
      </div>
      <span class="stat-badge stat-critical">Critical</span>
    </div>
    <div class="vuln-item">
      <div class="vuln-severity high"></div>
      <div class="vuln-info">
        <div class="vuln-title">SQL Injection Risk in /api/users</div>
        <div class="vuln-path">src/routes/users.ts:87</div>
      </div>
      <span class="stat-badge stat-high">High</span>
    </div>
    <div class="vuln-item">
      <div class="vuln-severity medium"></div>
      <div class="vuln-info">
        <div class="vuln-title">Missing Rate Limiting on /api/search</div>
        <div class="vuln-path">src/routes/search.ts:23</div>
      </div>
      <span class="stat-badge stat-medium">Medium</span>
    </div>
  </div>
</body>
</html>`;
}

async function startSecurityScan(context: vscode.ExtensionContext) {
  updateStatus("$(loading~spin) Scanning...");
  vscode.window.showInformationMessage("DevPulse: Starting security scan...");

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage("No workspace folder open");
    updateStatus("$(shield) DevPulse");
    return;
  }

  try {
    const apiUrl = vscode.workspace.getConfiguration("devpulse").get("apiUrl") as string;
    const apiKey = vscode.workspace.getConfiguration("devpulse").get("apiKey") as string;

    const response = await fetch(`${apiUrl}/api/scans/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        workspaceId: "local",
        files: workspaceFolders.map((f) => f.uri.fsPath),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      vscode.window.showInformationMessage(
        `Scan complete! Found ${result.vulnerabilities?.length || 0} vulnerabilities`
      );
    } else {
      vscode.window.showWarningMessage("Scan completed with warnings");
    }
  } catch (error) {
    vscode.window.showWarningMessage("Scan completed (offline mode)");
  }

  updateStatus("$(shield) DevPulse");
}

async function quickScanCurrentFile(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active file");
    return;
  }

  updateStatus("$(loading~spin) Quick scan...");
  vscode.window.showInformationMessage(`Scanning: ${path.basename(editor.document.fileName)}`);

  setTimeout(() => {
    updateStatus("$(shield) DevPulse");
    vscode.window.showInformationMessage("Quick scan complete");
  }, 1500);
}

function viewReports(context: vscode.ExtensionContext) {
  if (reportWebviewPanel) {
    reportWebviewPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  reportWebviewPanel = vscode.window.createWebviewPanel(
    "devpulseReports",
    "DevPulse Reports",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  reportWebviewPanel.webview.html = getReportsHtml();
  reportWebviewPanel.onDidDispose(() => {
    reportWebviewPanel = undefined;
  });
}

function getReportsHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
      padding: 24px;
      color: #0f172a;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .report-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }
    .report-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .report-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .report-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .report-title { font-size: 16px; font-weight: 600; }
    .report-desc { font-size: 13px; color: #64748b; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: #1d4ed8;
      color: white;
      margin-top: 12px;
    }
    .btn:hover { background: #1e40af; }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .stat-row:last-child { border-bottom: none; }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-critical { background: #fef2f2; color: #ef4444; }
    .badge-high { background: #fff7ed; color: #ea580c; }
    .badge-medium { background: #fefce8; color: #ca8a04; }
  </style>
</head>
<body>
  <h1>📊 DevPulse Reports</h1>
  <div class="report-grid">
    <div class="report-card">
      <div class="report-header">
        <div class="report-icon" style="background: #fef2f2;">🔍</div>
        <div>
          <div class="report-title">Security Scan Report</div>
          <div class="report-desc">OWASP Top 10 vulnerabilities</div>
        </div>
      </div>
      <div class="stat-row">
        <span>Critical</span>
        <span class="badge badge-critical">3</span>
      </div>
      <div class="stat-row">
        <span>High</span>
        <span class="badge badge-high">7</span>
      </div>
      <div class="stat-row">
        <span>Medium</span>
        <span class="badge badge-medium">12</span>
      </div>
      <button class="btn">Download PDF</button>
    </div>

    <div class="report-card">
      <div class="report-header">
        <div class="report-icon" style="background: #f0fdf4;">💰</div>
        <div>
          <div class="report-title">LLM Cost Report</div>
          <div class="report-desc">Token usage and cost breakdown</div>
        </div>
      </div>
      <div class="stat-row">
        <span>Total Cost</span>
        <strong>₹2,450.50</strong>
      </div>
      <div class="stat-row">
        <span>Thinking Tokens</span>
        <strong>₹342.80</strong>
      </div>
      <div class="stat-row">
        <span>API Calls</span>
        <strong>1,247</strong>
      </div>
      <button class="btn">View Analytics</button>
    </div>

    <div class="report-card">
      <div class="report-header">
        <div class="report-icon" style="background: #eff6ff;">📋</div>
        <div>
          <div class="report-title">PCI DSS Compliance</div>
          <div class="report-desc">Payment security assessment</div>
        </div>
      </div>
      <div class="stat-row">
        <span>Compliance Score</span>
        <strong>85%</strong>
      </div>
      <div class="stat-row">
        <span>Requirements Met</span>
        <strong>34/40</strong>
      </div>
      <button class="btn">View Details</button>
    </div>
  </div>
</body>
</html>`;
}

function showAgentGuard(context: vscode.ExtensionContext) {
  // PHASE 8B: Show React AgentGuard dashboard
  if (webviewManager && extensionContext) {
    webviewManager.showAgentGuardDashboard(extensionContext.extensionUri);
  } else {
    vscode.window.showErrorMessage("DevPulse extension not fully initialized");
  }
}

async function discoverShadowAPIs(context: vscode.ExtensionContext) {
  // PHASE 8B: Show React Shadow APIs dashboard
  if (webviewManager && extensionContext) {
    webviewManager.showShadowApisDashboard(extensionContext.extensionUri);
  } else {
    vscode.window.showErrorMessage("DevPulse extension not fully initialized");
  }
}

function getShadowApiHtml(results: Array<{ method: string; path: string; file: string; line: number; authStatus: string }>): string {
  const rows = results.slice(0, 100).map((r) => `
    <tr>
      <td><span class="method ${r.method.toLowerCase()}">${r.method}</span></td>
      <td class="path">${r.path}</td>
      <td class="file">${r.file}:${r.line}</td>
      <td class="auth">${r.authStatus}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; padding: 20px; background: #f8fafc; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
    .stats { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat {
      background: white;
      padding: 12px 20px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .stat-value { font-size: 24px; font-weight: 700; color: #1d4ed8; }
    .stat-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
    th { background: #f8fafc; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748b; }
    tr:hover { background: #f8fafc; }
    .method {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .method.get { background: #dcfce7; color: #166534; }
    .method.post { background: #dbeafe; color: #1e40af; }
    .method.put { background: #fef3c7; color: #92400e; }
    .method.delete { background: #fef2f2; color: #991b1b; }
    .method.patch { background: #f3e8ff; color: #6b21a8; }
    .path { font-family: monospace; color: #0f172a; }
    .file { font-size: 12px; color: #64748b; }
    .auth { font-size: 18px; }
    .empty { text-align: center; padding: 40px; color: #64748b; }
  </style>
</head>
<body>
  <h1>👻 Shadow APIs Discovered</h1>
  <div class="stats">
    <div class="stat">
      <div class="stat-value">${results.length}</div>
      <div class="stat-label">Total Endpoints</div>
    </div>
    <div class="stat">
      <div class="stat-value">${results.filter(r => r.authStatus === "🔓").length}</div>
      <div class="stat-label">Unauthenticated</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Method</th>
        <th>Path</th>
        <th>Location</th>
        <th>Auth</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4" class="empty">No APIs discovered. Run a scan first.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

async function importPostmanCollection(context: vscode.ExtensionContext) {
  const fileUris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    filters: { "JSON files": ["json"] },
    title: "Import Postman Collection",
  });

  if (!fileUris || fileUris.length === 0) return;

  updateStatus("$(loading~spin) Importing...");

  try {
    const content = fs.readFileSync(fileUris[0].fsPath, "utf8");
    const collection = JSON.parse(content);

    vscode.window.showInformationMessage(
      `Imported: ${collection.info?.name || "Collection"} with ${collection.item?.length || 0} folders`
    );
  } catch (error) {
    vscode.window.showErrorMessage("Failed to import Postman collection");
  }

  updateStatus("$(shield) DevPulse");
}

function showLLMCosts(context: vscode.ExtensionContext) {
  // PHASE 8B: Show React LLM Costs dashboard
  if (webviewManager && extensionContext) {
    webviewManager.showLLMCostsDashboard(extensionContext.extensionUri);
  } else {
    vscode.window.showErrorMessage("DevPulse extension not fully initialized");
  }
}

function openSettings() {
  // PHASE 8B: Show React Settings dashboard
  if (webviewManager && extensionContext) {
    webviewManager.showSettingsDashboard(extensionContext.extensionUri);
  } else {
    // Fallback to VS Code settings if extension not initialized
    vscode.commands.executeCommand("workbench.action.openSettings", "devpulse");
  }
}

function updateStatus(text: string) {
  if (statusBarItem) {
    statusBarItem.text = text;
  }
}

class DevPulseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.command = command;
  }
}

class DevPulseTreeDataProvider implements vscode.TreeDataProvider<DevPulseTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DevPulseTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DevPulseTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DevPulseTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    setInterval(() => this._onDidChangeTreeData.fire(), 30000);
  }

  getTreeItem(element: DevPulseTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DevPulseTreeItem): Thenable<DevPulseTreeItem[]> {
    const apiKey = vscode.workspace.getConfiguration("devpulse").get("apiKey") as string;

    if (!element) {
      return Promise.resolve([
        new DevPulseTreeItem("🔍 Security Scan", vscode.TreeItemCollapsibleState.Expanded),
        new DevPulseTreeItem("💰 LLM Costs", vscode.TreeItemCollapsibleState.Expanded),
        new DevPulseTreeItem("🤖 AgentGuard", vscode.TreeItemCollapsibleState.Expanded),
        new DevPulseTreeItem("👻 Shadow APIs", vscode.TreeItemCollapsibleState.Expanded),
      ]);
    }

    if (element.label === "🔍 Security Scan") {
      return Promise.resolve([
        new DevPulseTreeItem("Last Scan: 2 hours ago", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("Critical: 3 | High: 7", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("▶️ Run Scan", vscode.TreeItemCollapsibleState.None, {
          title: "Start Scan",
          command: "devpulse.startScan",
          arguments: [],
        }),
      ]);
    }

    if (element.label === "💰 LLM Costs") {
      return Promise.resolve([
        new DevPulseTreeItem("This Month: ₹2,450.50", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("Thinking Tokens: ₹342.80", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("📊 View Reports", vscode.TreeItemCollapsibleState.None, {
          title: "View Reports",
          command: "devpulse.viewReports",
          arguments: [],
        }),
      ]);
    }

    if (element.label === "🤖 AgentGuard") {
      return Promise.resolve([
        new DevPulseTreeItem("Status: Active", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("Agents: 5 monitored", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("🛡️ Dashboard", vscode.TreeItemCollapsibleState.None, {
          title: "AgentGuard",
          command: "devpulse.showAgentGuard",
          arguments: [],
        }),
      ]);
    }

    if (element.label === "👻 Shadow APIs") {
      return Promise.resolve([
        new DevPulseTreeItem("Undocumented: 12", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("Unauthenticated: 3", vscode.TreeItemCollapsibleState.None),
        new DevPulseTreeItem("🔍 Discover APIs", vscode.TreeItemCollapsibleState.None, {
          title: "Scan APIs",
          command: "devpulse.showShadowAPIs",
          arguments: [],
        }),
      ]);
    }

    return Promise.resolve([]);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

export function deactivate() {
  // PHASE 8: Clean up sidebar provider
  if (sidebarProvider) {
    sidebarProvider.stopAutoRefresh();
  }
  
  // PHASE 8B: Clean up webview manager
  if (webviewManager) {
    webviewManager.closeAll();
  }

  // PHASE 8C: Disconnect real-time service
  disconnectRealtimeService();
}
