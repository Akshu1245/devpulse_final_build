/**
 * DevPulse Commands — VS Code Extension Commands
 * ===============================================
 * All extension commands for the command palette and keybindings
 * 
 * Commands:
 * - devpulse.scanCurrentFile
 * - devpulse.importPostman
 * - devpulse.importBruno
 * - devpulse.importOpenAPI
 * - devpulse.showCostDashboard
 * - devpulse.showAgentGuard
 * - devpulse.runFullScan
 * - devpulse.showRecommendation
 * - devpulse.addToWhitelist
 * - devpulse.openInDashboard
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ScanResult {
  endpoint: string;
  method: string;
  vulnerabilities: Array<{
    title: string;
    severity: string;
    category: string;
    recommendation: string;
  }>;
  secrets: Array<{
    type: string;
    line: number;
    severity: string;
  }>;
  riskScore: number;
}

export class DevPulseCommands {
  private context: vscode.ExtensionContext;
  private apiUrl: string;
  private outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.apiUrl = vscode.workspace.getConfiguration('devpulse').get('apiUrl') || 'http://localhost:3001';
    this.outputChannel = vscode.window.createOutputChannel('DevPulse');
    
    this.registerCommands();
  }

  /**
   * Register all commands
   */
  private registerCommands(): void {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('devpulse.scanCurrentFile', () => this.scanCurrentFile()),
      vscode.commands.registerCommand('devpulse.importPostman', () => this.importPostman()),
      vscode.commands.registerCommand('devpulse.importBruno', () => this.importBruno()),
      vscode.commands.registerCommand('devpulse.importOpenAPI', () => this.importOpenAPI()),
      vscode.commands.registerCommand('devpulse.showCostDashboard', () => this.showCostDashboard()),
      vscode.commands.registerCommand('devpulse.showAgentGuard', () => this.showAgentGuard()),
      vscode.commands.registerCommand('devpulse.runFullScan', () => this.runFullScan()),
      vscode.commands.registerCommand('devpulse.showRecommendation', (recommendation: string) => this.showRecommendation(recommendation)),
      vscode.commands.registerCommand('devpulse.addToWhitelist', (uri: vscode.Uri, range: vscode.Range, category: string) => this.addToWhitelist(uri, range, category)),
      vscode.commands.registerCommand('devpulse.openInDashboard', (uri: vscode.Uri, diagnostic: vscode.Diagnostic) => this.openInDashboard(uri, diagnostic)),
      vscode.commands.registerCommand('devpulse.refresh', () => this.refresh()),
      vscode.commands.registerCommand('devpulse.pauseAgent', (agentId: string) => this.pauseAgent(agentId)),
      vscode.commands.registerCommand('devpulse.resumeAgent', (agentId: string) => this.resumeAgent(agentId)),
      vscode.commands.registerCommand('devpulse.setBudget', (agentId: string) => this.setBudget(agentId)),
    );
  }

  /**
   * Scan the currently open file
   */
  async scanCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No file is currently open');
      return;
    }

    const document = editor.document;
    const filePath = document.uri.fsPath;
    const content = document.getText();

    this.outputChannel.show();
    this.outputChannel.appendLine(`\n[${new Date().toISOString()}] Scanning: ${filePath}`);

    try {
      // Detect file type
      const ext = path.extname(filePath).toLowerCase();
      let scanType: 'postman' | 'bruno' | 'openapi' | 'source' = 'source';

      if (ext === '.json') {
        // Check if it's a Postman collection
        try {
          const json = JSON.parse(content);
          if (json.info?.schema?.includes('postman')) {
            scanType = 'postman';
          } else if (json.openapi || json.swagger) {
            scanType = 'openapi';
          }
        } catch {
          // Not valid JSON, treat as source
        }
      } else if (ext === '.bru') {
        scanType = 'bruno';
      } else if (ext === '.yaml' || ext === '.yml') {
        // Check if it's OpenAPI
        if (content.includes('openapi:') || content.includes('swagger:')) {
          scanType = 'openapi';
        }
      }

      // Call backend API
      const response = await this.callBackendApi('/api/scan', {
        method: 'POST',
        body: JSON.stringify({
          type: scanType,
          filePath,
          content,
          workspaceId: this.getWorkspaceId(),
        }),
      });

      if (response.ok) {
        const results: ScanResult[] = await response.json();
        this.displayScanResults(results, document);
      } else {
        const error = await response.text();
        this.outputChannel.appendLine(`Error: ${error}`);
        vscode.window.showErrorMessage(`Scan failed: ${error}`);
      }
    } catch (err) {
      this.outputChannel.appendLine(`Error: ${err}`);
      vscode.window.showErrorMessage(`Scan failed: ${err}`);
    }
  }

  /**
   * Import a Postman collection
   */
  async importPostman(): Promise<void> {
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      filters: {
        'Postman Collections': ['json'],
      },
      title: 'Select Postman Collection(s)',
    });

    if (!files || files.length === 0) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing Postman Collections',
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          progress.report({
            message: `Processing ${path.basename(file.fsPath)}...`,
            increment: (100 / files.length),
          });

          try {
            const content = fs.readFileSync(file.fsPath, 'utf-8');
            const response = await this.callBackendApi('/api/postman/import', {
              method: 'POST',
              body: JSON.stringify({
                collectionJson: content,
                workspaceId: this.getWorkspaceId(),
                scanOptions: {
                  owaspScan: true,
                  secretScan: true,
                  pciMapping: true,
                },
              }),
            });

            if (response.ok) {
              const result = await response.json();
              vscode.window.showInformationMessage(
                `Imported ${result.endpointCount} endpoints from ${path.basename(file.fsPath)}`
              );
            }
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to import ${path.basename(file.fsPath)}: ${err}`);
          }
        }
      }
    );

    // Refresh sidebar
    vscode.commands.executeCommand('devpulse.refresh');
  }

  /**
   * Import Bruno collections
   */
  async importBruno(): Promise<void> {
    const folder = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Bruno Collection Folder',
    });

    if (!folder || folder.length === 0) return;

    const brunoDir = folder[0].fsPath;
    
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing Bruno Collection',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Scanning Bruno files...' });

        // Find all .bru files
        const bruFiles = this.findFiles(brunoDir, '.bru');
        
        progress.report({ message: `Found ${bruFiles.length} Bruno files, importing...` });

        const files: Array<{ path: string; content: string }> = [];
        for (const file of bruFiles) {
          files.push({
            path: file,
            content: fs.readFileSync(file, 'utf-8'),
          });
        }

        const response = await this.callBackendApi('/api/bruno/import', {
          method: 'POST',
          body: JSON.stringify({
            files,
            workspaceId: this.getWorkspaceId(),
            scanOptions: {
              owaspScan: true,
              secretScan: true,
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          vscode.window.showInformationMessage(
            `Imported ${result.endpointCount} endpoints from Bruno collection`
          );
        } else {
          const error = await response.text();
          vscode.window.showErrorMessage(`Import failed: ${error}`);
        }
      }
    );

    vscode.commands.executeCommand('devpulse.refresh');
  }

  /**
   * Import OpenAPI specification
   */
  async importOpenAPI(): Promise<void> {
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      filters: {
        'OpenAPI/Swagger': ['json', 'yaml', 'yml'],
      },
      title: 'Select OpenAPI Specification(s)',
    });

    if (!files || files.length === 0) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Importing OpenAPI Specifications',
        cancellable: false,
      },
      async (progress) => {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          progress.report({
            message: `Processing ${path.basename(file.fsPath)}...`,
            increment: (100 / files.length),
          });

          try {
            const content = fs.readFileSync(file.fsPath, 'utf-8');
            const response = await this.callBackendApi('/api/openapi/import', {
              method: 'POST',
              body: JSON.stringify({
                specContent: content,
                workspaceId: this.getWorkspaceId(),
                scanOptions: {
                  owaspScan: true,
                  secretScan: true,
                },
              }),
            });

            if (response.ok) {
              const result = await response.json();
              vscode.window.showInformationMessage(
                `Imported ${result.endpointCount} endpoints from ${path.basename(file.fsPath)}`
              );
            }
          } catch (err) {
            vscode.window.showErrorMessage(`Failed to import ${path.basename(file.fsPath)}: ${err}`);
          }
        }
      }
    );

    vscode.commands.executeCommand('devpulse.refresh');
  }

  /**
   * Show cost dashboard webview
   */
  async showCostDashboard(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'devpulseCostDashboard',
      'DevPulse Cost Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Fetch cost data
    try {
      const response = await this.callBackendApi('/api/costs/dashboard', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        panel.webview.html = this.getCostDashboardHtml(data);
      } else {
        panel.webview.html = this.getErrorHtml('Failed to load cost data');
      }
    } catch (err) {
      panel.webview.html = this.getErrorHtml(`Error: ${err}`);
    }
  }

  /**
   * Show AgentGuard panel
   */
  async showAgentGuard(): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'devpulseAgentGuard',
      'DevPulse AgentGuard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    try {
      const response = await this.callBackendApi('/api/agentguard/status', {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        panel.webview.html = this.getAgentGuardHtml(data);
      } else {
        panel.webview.html = this.getErrorHtml('Failed to load AgentGuard data');
      }
    } catch (err) {
      panel.webview.html = this.getErrorHtml(`Error: ${err}`);
    }
  }

  /**
   * Run full workspace scan
   */
  async runFullScan(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showWarningMessage('No workspace folder is open');
      return;
    }

    const result = await vscode.window.showQuickPick(
      [
        { label: 'Full Scan', description: 'OWASP + Secrets + Shadow APIs', value: 'full' },
        { label: 'Security Scan', description: 'OWASP vulnerabilities only', value: 'security' },
        { label: 'Secret Scan', description: 'API keys and credentials only', value: 'secrets' },
        { label: 'Shadow API Scan', description: 'Undocumented endpoints only', value: 'shadow' },
      ],
      { placeHolder: 'Select scan type' }
    );

    if (!result) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Running DevPulse Scan',
        cancellable: true,
      },
      async (progress, token) => {
        const rootPath = workspaceFolders[0].uri.fsPath;
        
        progress.report({ message: 'Collecting files...' });

        // Collect all relevant files
        const files = this.collectWorkspaceFiles(rootPath);
        
        if (token.isCancellationRequested) return;

        progress.report({ message: `Scanning ${files.length} files...` });

        const response = await this.callBackendApi('/api/scan/workspace', {
          method: 'POST',
          body: JSON.stringify({
            workspacePath: rootPath,
            files: files.slice(0, 1000), // Limit to 1000 files
            scanType: result.value,
            workspaceId: this.getWorkspaceId(),
          }),
        });

        if (response.ok) {
          const scanResult = await response.json();
          vscode.window.showInformationMessage(
            `Scan complete: ${scanResult.vulnerabilities} vulnerabilities, ${scanResult.secrets} secrets, ${scanResult.shadowApis} shadow APIs`
          );
          vscode.commands.executeCommand('devpulse.refresh');
        } else {
          vscode.window.showErrorMessage('Scan failed');
        }
      }
    );
  }

  /**
   * Show recommendation in a modal
   */
  showRecommendation(recommendation: string): void {
    vscode.window.showInformationMessage(recommendation, { modal: true });
  }

  /**
   * Add finding to whitelist (false positive)
   */
  async addToWhitelist(uri: vscode.Uri, range: vscode.Range, category: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const text = document.getText(range);

    try {
      await this.callBackendApi('/api/whitelist', {
        method: 'POST',
        body: JSON.stringify({
          file: uri.fsPath,
          line: range.start.line + 1,
          pattern: text,
          category,
          workspaceId: this.getWorkspaceId(),
        }),
      });

      vscode.window.showInformationMessage('Added to whitelist');
      vscode.commands.executeCommand('devpulse.scanCurrentFile');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to whitelist: ${err}`);
    }
  }

  /**
   * Open finding in dashboard
   */
  openInDashboard(uri: vscode.Uri, diagnostic: vscode.Diagnostic): void {
    const dashboardUrl = `${this.apiUrl}/dashboard/findings?file=${encodeURIComponent(uri.fsPath)}&line=${diagnostic.range.start.line + 1}`;
    vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
  }

  /**
   * Refresh all views
   */
  refresh(): void {
    vscode.commands.executeCommand('devpulseTreeView.refresh');
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string): Promise<void> {
    try {
      await this.callBackendApi(`/api/agentguard/pause/${agentId}`, {
        method: 'POST',
      });
      vscode.window.showInformationMessage(`Agent ${agentId} paused`);
      this.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to pause agent: ${err}`);
    }
  }

  /**
   * Resume an agent
   */
  async resumeAgent(agentId: string): Promise<void> {
    try {
      await this.callBackendApi(`/api/agentguard/resume/${agentId}`, {
        method: 'POST',
      });
      vscode.window.showInformationMessage(`Agent ${agentId} resumed`);
      this.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to resume agent: ${err}`);
    }
  }

  /**
   * Set budget for an agent
   */
  async setBudget(agentId: string): Promise<void> {
    const budget = await vscode.window.showInputBox({
      prompt: 'Enter daily budget limit in USD',
      placeHolder: '50.00',
      validateInput: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number';
        }
        return null;
      },
    });

    if (!budget) return;

    try {
      await this.callBackendApi(`/api/agentguard/budget/${agentId}`, {
        method: 'POST',
        body: JSON.stringify({ dailyBudget: parseFloat(budget) }),
      });
      vscode.window.showInformationMessage(`Budget set to $${budget}/day for agent ${agentId}`);
      this.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to set budget: ${err}`);
    }
  }

  // ============ Helper Methods ============

  private async callBackendApi(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.apiUrl}${endpoint}`;
    const apiKey = vscode.workspace.getConfiguration('devpulse').get('apiKey');

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(options.headers || {}),
      },
    });
  }

  private getWorkspaceId(): number {
    return vscode.workspace.getConfiguration('devpulse').get('workspaceId') || 1;
  }

  private findFiles(dir: string, ext: string): string[] {
    const results: string[] = [];
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        results.push(...this.findFiles(fullPath, ext));
      } else if (item.isFile() && item.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
    
    return results;
  }

  private collectWorkspaceFiles(rootPath: string): string[] {
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php'];
    const results: string[] = [];

    const walk = (dir: string) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '__pycache__') {
            continue;
          }
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            walk(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (extensions.includes(ext)) {
              results.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    walk(rootPath);
    return results;
  }

  private displayScanResults(results: ScanResult[], document: vscode.TextDocument): void {
    this.outputChannel.appendLine(`\nScan Results:`);
    this.outputChannel.appendLine(`=============`);
    
    let totalVulns = 0;
    let totalSecrets = 0;

    for (const result of results) {
      this.outputChannel.appendLine(`\nEndpoint: ${result.method} ${result.endpoint}`);
      this.outputChannel.appendLine(`Risk Score: ${result.riskScore}/100`);
      
      if (result.vulnerabilities.length > 0) {
        this.outputChannel.appendLine(`\nVulnerabilities:`);
        for (const vuln of result.vulnerabilities) {
          this.outputChannel.appendLine(`  - [${vuln.severity.toUpperCase()}] ${vuln.title}`);
          this.outputChannel.appendLine(`    Category: ${vuln.category}`);
          this.outputChannel.appendLine(`    Fix: ${vuln.recommendation}`);
          totalVulns++;
        }
      }

      if (result.secrets.length > 0) {
        this.outputChannel.appendLine(`\nSecrets Detected:`);
        for (const secret of result.secrets) {
          this.outputChannel.appendLine(`  - [${secret.severity.toUpperCase()}] ${secret.type} at line ${secret.line}`);
          totalSecrets++;
        }
      }
    }

    this.outputChannel.appendLine(`\n--------------`);
    this.outputChannel.appendLine(`Total: ${totalVulns} vulnerabilities, ${totalSecrets} secrets`);

    vscode.window.showInformationMessage(
      `Scan complete: ${totalVulns} vulnerabilities, ${totalSecrets} secrets found`
    );
  }

  private getCostDashboardHtml(data: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse Cost Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #333; }
    .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 10px 0; }
    .metric h3 { margin: 0 0 10px 0; color: #666; }
    .metric .value { font-size: 2em; font-weight: bold; color: #2196F3; }
    .warning { color: #FF9800; }
    .critical { color: #F44336; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    h1 { color: #1976D2; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>💰 Cost Dashboard</h1>
  
  <div class="grid">
    <div class="metric">
      <h3>Today's Spend</h3>
      <div class="value">$${data.todaySpend?.toFixed(2) || '0.00'}</div>
    </div>
    <div class="metric">
      <h3>This Month</h3>
      <div class="value ${data.monthlySpend > data.monthlyBudget * 0.8 ? 'warning' : ''}">
        $${data.monthlySpend?.toFixed(2) || '0.00'}
      </div>
    </div>
    <div class="metric">
      <h3>Active Agents</h3>
      <div class="value">${data.activeAgents || 0}</div>
    </div>
    <div class="metric">
      <h3>Cost/Request Avg</h3>
      <div class="value">$${data.avgCostPerRequest?.toFixed(4) || '0.0000'}</div>
    </div>
  </div>

  <h2>Top Spending Endpoints</h2>
  <table>
    <thead>
      <tr>
        <th>Endpoint</th>
        <th>Provider</th>
        <th>Requests</th>
        <th>Cost</th>
      </tr>
    </thead>
    <tbody>
      ${(data.topEndpoints || []).map((ep: any) => `
        <tr>
          <td>${ep.endpoint}</td>
          <td>${ep.provider}</td>
          <td>${ep.requests}</td>
          <td>$${ep.cost.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
  }

  private getAgentGuardHtml(data: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse AgentGuard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #333; }
    .agent { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #4CAF50; }
    .agent.paused { border-left-color: #FF9800; }
    .agent.killed { border-left-color: #F44336; }
    .agent h3 { margin: 0 0 10px 0; }
    .agent .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; }
    .status.active { background: #E8F5E9; color: #4CAF50; }
    .status.paused { background: #FFF3E0; color: #FF9800; }
    .status.killed { background: #FFEBEE; color: #F44336; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
    .stat { text-align: center; }
    .stat .value { font-size: 1.5em; font-weight: bold; }
    .stat .label { color: #666; font-size: 0.9em; }
    h1 { color: #4CAF50; }
    .kill-log { background: #FFEBEE; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .kill-log h3 { color: #F44336; margin: 0 0 10px 0; }
  </style>
</head>
<body>
  <h1>🛡️ AgentGuard</h1>
  
  <h2>Active Agents</h2>
  ${(data.agents || []).map((agent: any) => `
    <div class="agent ${agent.status}">
      <h3>${agent.name}</h3>
      <span class="status ${agent.status}">${agent.status.toUpperCase()}</span>
      <div class="stats">
        <div class="stat">
          <div class="value">$${agent.todaySpend?.toFixed(2) || '0.00'}</div>
          <div class="label">Today</div>
        </div>
        <div class="stat">
          <div class="value">${agent.requestsPerMin || 0}</div>
          <div class="label">Req/min</div>
        </div>
        <div class="stat">
          <div class="value">$${agent.budgetLimit?.toFixed(0) || '--'}</div>
          <div class="label">Budget</div>
        </div>
      </div>
    </div>
  `).join('')}

  ${data.killLog && data.killLog.length > 0 ? `
    <div class="kill-log">
      <h3>🚨 Recent Kill Switch Events</h3>
      <ul>
        ${data.killLog.map((event: any) => `
          <li>
            <strong>${event.agentId}</strong> - ${event.reason}
            <br>
            <small>Cost: $${event.costAtIntervention?.toFixed(2)} | Prevented: $${event.projectedOverrun?.toFixed(2)}</small>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : ''}
</body>
</html>`;
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 40px; text-align: center; color: #666; }
    .error { color: #F44336; font-size: 1.2em; }
  </style>
</head>
<body>
  <h2 class="error">⚠️ Error</h2>
  <p>${message}</p>
  <p>Please check your API connection settings.</p>
</body>
</html>`;
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
