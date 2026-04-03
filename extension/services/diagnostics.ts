/**
 * DevPulse Diagnostics Provider — Inline Error Squiggles
 * ======================================================
 * Shows vulnerability findings as inline diagnostics
 * with red squiggles on vulnerable lines
 * 
 * Features:
 * - Secret detection highlights
 * - OWASP vulnerability markers
 * - Quick fix suggestions
 * - Severity-based colors
 */

import * as vscode from 'vscode';

export interface DiagnosticFinding {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  code?: string;
  recommendation?: string;
  cwe?: string;
}

export class DevPulseDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private codeActionProvider: vscode.Disposable | null = null;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('devpulse');
    this.registerCodeActionProvider();
  }

  /**
   * Register code action provider for quick fixes
   */
  private registerCodeActionProvider(): void {
    this.codeActionProvider = vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', pattern: '**/*' },
      new DevPulseCodeActionProvider(this.diagnosticCollection),
      {
        providedCodeActionKinds: [
          vscode.CodeActionKind.QuickFix,
          vscode.CodeActionKind.Refactor,
        ],
      }
    );
  }

  /**
   * Update diagnostics for a document
   */
  setDiagnostics(uri: vscode.Uri, findings: DiagnosticFinding[]): void {
    const diagnostics: vscode.Diagnostic[] = findings.map(finding => {
      const range = new vscode.Range(
        Math.max(0, finding.line - 1),
        finding.column ?? 0,
        Math.max(0, (finding.endLine ?? finding.line) - 1),
        finding.endColumn ?? 999
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        this.formatMessage(finding),
        this.mapSeverity(finding.severity)
      );

      diagnostic.source = 'DevPulse';
      diagnostic.code = finding.code || finding.category;
      
      // Add related information
      if (finding.cwe) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(uri, range),
            `CWE: ${finding.cwe}`
          ),
        ];
      }

      // Store recommendation for code actions
      (diagnostic as any).devpulseRecommendation = finding.recommendation;
      (diagnostic as any).devpulseCategory = finding.category;

      return diagnostic;
    });

    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Clear diagnostics for a document
   */
  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  /**
   * Clear all diagnostics
   */
  clearAllDiagnostics(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Map severity to VS Code diagnostic severity
   */
  private mapSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
      case 'high':
        return vscode.DiagnosticSeverity.Error;
      case 'medium':
        return vscode.DiagnosticSeverity.Warning;
      case 'low':
        return vscode.DiagnosticSeverity.Information;
      case 'info':
      default:
        return vscode.DiagnosticSeverity.Hint;
    }
  }

  /**
   * Format diagnostic message
   */
  private formatMessage(finding: DiagnosticFinding): string {
    let message = `[${finding.category}] ${finding.message}`;
    
    if (finding.cwe) {
      message += ` (${finding.cwe})`;
    }
    
    return message;
  }

  /**
   * Create diagnostics from scan results
   */
  static createFromScanResults(results: any[]): Map<string, DiagnosticFinding[]> {
    const findingsByFile = new Map<string, DiagnosticFinding[]>();

    for (const result of results) {
      const file = result.file || result.endpoint;
      if (!file) continue;

      if (!findingsByFile.has(file)) {
        findingsByFile.set(file, []);
      }

      findingsByFile.get(file)!.push({
        file,
        line: result.line || 1,
        column: result.column,
        message: result.message || result.description || result.title,
        severity: result.severity || 'medium',
        category: result.category || 'Security',
        code: result.code,
        recommendation: result.recommendation,
        cwe: result.cwe,
      });
    }

    return findingsByFile;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.diagnosticCollection.dispose();
    if (this.codeActionProvider) {
      this.codeActionProvider.dispose();
    }
  }
}

/**
 * Code Action Provider for quick fixes
 */
class DevPulseCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private diagnosticCollection: vscode.DiagnosticCollection) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'DevPulse') continue;

      const recommendation = (diagnostic as any).devpulseRecommendation;
      const category = (diagnostic as any).devpulseCategory;

      // Add "View Recommendation" action
      if (recommendation) {
        const viewAction = new vscode.CodeAction(
          `DevPulse: ${recommendation.slice(0, 50)}...`,
          vscode.CodeActionKind.QuickFix
        );
        viewAction.diagnostics = [diagnostic];
        viewAction.command = {
          title: 'View Full Recommendation',
          command: 'devpulse.showRecommendation',
          arguments: [recommendation],
        };
        actions.push(viewAction);
      }

      // Add "Add to Whitelist" action for secrets
      if (category?.includes('SECRET') || category?.includes('Credential')) {
        const whitelistAction = new vscode.CodeAction(
          'DevPulse: Add to whitelist (false positive)',
          vscode.CodeActionKind.QuickFix
        );
        whitelistAction.diagnostics = [diagnostic];
        whitelistAction.command = {
          title: 'Add to Whitelist',
          command: 'devpulse.addToWhitelist',
          arguments: [document.uri, diagnostic.range, category],
        };
        actions.push(whitelistAction);
      }

      // Add "View in Dashboard" action
      const dashboardAction = new vscode.CodeAction(
        'DevPulse: View in Dashboard',
        vscode.CodeActionKind.QuickFix
      );
      dashboardAction.diagnostics = [diagnostic];
      dashboardAction.command = {
        title: 'View in Dashboard',
        command: 'devpulse.openInDashboard',
        arguments: [document.uri, diagnostic],
      };
      actions.push(dashboardAction);

      // Add environment variable suggestion for secrets
      if (category?.includes('SECRET') || category?.includes('API_KEY')) {
        const envAction = new vscode.CodeAction(
          'DevPulse: Replace with environment variable',
          vscode.CodeActionKind.Refactor
        );
        envAction.diagnostics = [diagnostic];
        envAction.edit = this.createEnvVarEdit(document, diagnostic.range);
        actions.push(envAction);
      }
    }

    return actions;
  }

  /**
   * Create edit to replace secret with env var
   */
  private createEnvVarEdit(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit();
    const text = document.getText(range);
    
    // Detect likely variable name from context
    const line = document.lineAt(range.start.line).text;
    const keyMatch = line.match(/["']?(\w+)["']?\s*[:=]/);
    const varName = keyMatch ? keyMatch[1].toUpperCase() : 'API_KEY';
    
    // Replace with process.env reference
    const replacement = `process.env.${varName}`;
    
    edit.replace(document.uri, range, replacement);
    
    return edit;
  }
}

/**
 * Secret Detection Patterns for inline diagnostics
 */
export const SECRET_PATTERNS = [
  { 
    regex: /sk-[a-zA-Z0-9]{32,}/g,
    type: 'OpenAI API Key',
    severity: 'critical' as const,
    recommendation: 'Use environment variables: process.env.OPENAI_API_KEY',
  },
  {
    regex: /sk_live_[a-zA-Z0-9]{24,}/g,
    type: 'Stripe Live Key',
    severity: 'critical' as const,
    recommendation: 'Use environment variables: process.env.STRIPE_SECRET_KEY',
  },
  {
    regex: /AKIA[A-Z0-9]{16}/g,
    type: 'AWS Access Key',
    severity: 'critical' as const,
    recommendation: 'Use AWS credentials file or IAM roles instead',
  },
  {
    regex: /ghp_[a-zA-Z0-9]{36}/g,
    type: 'GitHub PAT',
    severity: 'high' as const,
    recommendation: 'Use environment variables or GitHub App authentication',
  },
  {
    regex: /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/g,
    type: 'Slack Bot Token',
    severity: 'high' as const,
    recommendation: 'Use environment variables: process.env.SLACK_BOT_TOKEN',
  },
  {
    regex: /rzp_live_[a-zA-Z0-9]{14}/g,
    type: 'Razorpay Live Key',
    severity: 'critical' as const,
    recommendation: 'Use environment variables: process.env.RAZORPAY_KEY_ID',
  },
];

/**
 * Scan document for secrets
 */
export function scanDocumentForSecrets(document: vscode.TextDocument): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const text = document.getText();

  for (const pattern of SECRET_PATTERNS) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);

      findings.push({
        file: document.uri.fsPath,
        line: pos.line + 1,
        column: pos.character,
        endLine: endPos.line + 1,
        endColumn: endPos.character,
        message: `Exposed ${pattern.type} detected`,
        severity: pattern.severity,
        category: 'SECRET_EXPOSURE',
        recommendation: pattern.recommendation,
        cwe: 'CWE-798',
      });
    }
  }

  return findings;
}
