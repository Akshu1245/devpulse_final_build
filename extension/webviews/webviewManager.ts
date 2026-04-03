import * as vscode from 'vscode';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import AgentGuardDashboard from './AgentGuardDashboard';
import LLMCostsDashboard from './LLMCostsDashboard';
import ShadowApisDashboard from './ShadowApisDashboard';
import SettingsDashboard from './SettingsDashboard';
import { DevPulseClient } from '../utils/apiClient';

interface WebviewPanelConfig {
  title: string;
  viewType: string;
  column: vscode.ViewColumn;
  component: React.ComponentType<any>;
  iconPath?: vscode.Uri;
}

export class WebviewManager {
  private panels: Map<string, vscode.WebviewPanel> = new Map();
  private apiClient: DevPulseClient | null;

  constructor(apiClient: DevPulseClient | null) {
    this.apiClient = apiClient;
  }

  /**
   * Create and show a new webview panel
   */
  createPanel(
    config: WebviewPanelConfig,
    extensionUri: vscode.Uri
  ): vscode.WebviewPanel {
    // Check if panel already exists
    const existing = this.panels.get(config.viewType);
    if (existing) {
      existing.reveal(config.column);
      return existing;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      config.viewType,
      config.title,
      config.column,
      {
        enableScripts: true,
        enableForms: true,
        localResourceRoots: [extensionUri],
      }
    );

    // Generate HTML content
    panel.webview.html = this.getWebviewHtml(
      config.component,
      extensionUri,
      panel.webview
    );

    // Handle disposal
    panel.onDidDispose(() => {
      this.panels.delete(config.viewType);
    });

    // Store panel
    this.panels.set(config.viewType, panel);

    return panel;
  }

  /**
   * Generate HTML for React component webview
   */
  private getWebviewHtml(
    Component: React.ComponentType<any>,
    extensionUri: vscode.Uri,
    webview: vscode.Webview
  ): string {
    // Get the path to resources
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'resources', 'webview.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'resources', 'webview.js')
    );

    // Render React component to string
    const componentHtml = ReactDOMServer.renderToString(
      React.createElement(Component)
    );

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DevPulse Dashboard</title>
        <link rel="stylesheet" href="${styleUri}">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
              'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          a {
            color: var(--vscode-textLink-foreground);
          }
          a:hover {
            color: var(--vscode-textLink-activeForeground);
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-family: inherit;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          input, select {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-inputBorder, transparent);
            padding: 6px 8px;
            border-radius: 2px;
            font-family: inherit;
          }
          input::placeholder {
            color: var(--vscode-input-placeholderForeground);
          }
        </style>
      </head>
      <body>
        <div id="root">${componentHtml}</div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  /**
   * Show AgentGuard dashboard
   */
  showAgentGuardDashboard(extensionUri: vscode.Uri): vscode.WebviewPanel {
    return this.createPanel(
      {
        title: 'AgentGuard Dashboard',
        viewType: 'devpulse.agentGuard',
        column: vscode.ViewColumn.One,
        component: AgentGuardDashboard,
      },
      extensionUri
    );
  }

  /**
   * Show LLM Costs dashboard
   */
  showLLMCostsDashboard(extensionUri: vscode.Uri): vscode.WebviewPanel {
    return this.createPanel(
      {
        title: 'LLM Costs',
        viewType: 'devpulse.llmCosts',
        column: vscode.ViewColumn.One,
        component: LLMCostsDashboard,
      },
      extensionUri
    );
  }

  /**
   * Show Shadow APIs dashboard
   */
  showShadowApisDashboard(extensionUri: vscode.Uri): vscode.WebviewPanel {
    return this.createPanel(
      {
        title: 'Shadow APIs',
        viewType: 'devpulse.shadowApis',
        column: vscode.ViewColumn.One,
        component: ShadowApisDashboard,
      },
      extensionUri
    );
  }

  /**
   * Show Settings dashboard
   */
  showSettingsDashboard(extensionUri: vscode.Uri): vscode.WebviewPanel {
    return this.createPanel(
      {
        title: 'DevPulse Settings',
        viewType: 'devpulse.settings',
        column: vscode.ViewColumn.One,
        component: SettingsDashboard,
      },
      extensionUri
    );
  }

  /**
   * Close all panels
   */
  closeAll(): void {
    this.panels.forEach((panel) => {
      panel.dispose();
    });
    this.panels.clear();
  }

  /**
   * Close specific panel
   */
  closePanel(viewType: string): void {
    const panel = this.panels.get(viewType);
    if (panel) {
      panel.dispose();
      this.panels.delete(viewType);
    }
  }

  /**
   * Get panel by view type
   */
  getPanel(viewType: string): vscode.WebviewPanel | undefined {
    return this.panels.get(viewType);
  }

  /**
   * Refresh specific panel
   */
  refreshPanel(viewType: string): void {
    const panel = this.panels.get(viewType);
    if (panel) {
      // Recreate the webview content
      // In a real implementation, this would trigger a data refresh
      panel.webview.postMessage({ command: 'refresh' });
    }
  }

  /**
   * Broadcast message to all panels
   */
  broadcastMessage(message: any): void {
    this.panels.forEach((panel) => {
      panel.webview.postMessage(message);
    });
  }

  /**
   * Handle webview messages
   */
  handleWebviewMessage(message: any, viewType: string): void {
    const { command, data } = message;
    console.log(`Webview [${viewType}] command: ${command}`, data);

    switch (command) {
      case 'killAgent':
        this.apiClient?.killAgent(data.agentId, data.reason);
        break;
      case 'whitelistEndpoint':
        this.apiClient?.whitelistEndpoint(data.endpoint, data.reason);
        break;
      case 'triggerScan':
        this.apiClient?.triggerScan(data.projectId);
        break;
      case 'refreshData':
        this.refreshPanel(viewType);
        break;
      default:
        console.warn(`Unknown command: ${command}`);
    }
  }
}

/**
 * Get webview manager instance for the extension
 */
let webviewManager: WebviewManager | null = null;

export function getWebviewManager(
  apiClient: DevPulseClient | null
): WebviewManager {
  if (!webviewManager) {
    webviewManager = new WebviewManager(apiClient);
  }
  return webviewManager;
}

export function createWebviewManager(
  apiClient: DevPulseClient | null
): WebviewManager {
  return new WebviewManager(apiClient);
}
