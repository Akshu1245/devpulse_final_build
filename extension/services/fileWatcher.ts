/**
 * DevPulse File Watcher — Auto-Scan on Changes
 * =============================================
 * Watches for Postman/Bruno/OpenAPI file changes
 * and triggers automatic security scans
 * 
 * Supported files:
 * - Postman collections (.postman_collection.json)
 * - Bruno collections (.bru)
 * - OpenAPI specs (.yaml, .yml, .json with openapi/swagger keys)
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface FileWatcherConfig {
  enabled: boolean;
  debounceMs: number;
  autoScan: boolean;
  filePatterns: string[];
}

export class DevPulseFileWatcher {
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: FileWatcherConfig;
  private onFileChangeCallback: ((uri: vscode.Uri, type: string) => void) | null = null;

  // Patterns for API definition files
  private readonly FILE_PATTERNS = [
    '**/*.postman_collection.json',
    '**/*.postman.json',
    '**/*.bru',
    '**/bruno.json',
    '**/openapi.json',
    '**/openapi.yaml',
    '**/openapi.yml',
    '**/swagger.json',
    '**/swagger.yaml',
    '**/swagger.yml',
    '**/*-openapi.json',
    '**/*-openapi.yaml',
    '**/*-swagger.json',
  ];

  constructor(config?: Partial<FileWatcherConfig>) {
    this.config = {
      enabled: true,
      debounceMs: 1000,
      autoScan: true,
      filePatterns: this.FILE_PATTERNS,
      ...config,
    };
  }

  /**
   * Start watching for file changes
   */
  startWatching(): void {
    if (!this.config.enabled) {
      console.log('[FileWatcher] Disabled by configuration');
      return;
    }

    // Create watchers for each pattern
    for (const pattern of this.config.filePatterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      
      watcher.onDidCreate((uri) => this.handleFileEvent(uri, 'create'));
      watcher.onDidChange((uri) => this.handleFileEvent(uri, 'change'));
      watcher.onDidDelete((uri) => this.handleFileEvent(uri, 'delete'));
      
      this.watchers.push(watcher);
    }

    console.log(`[FileWatcher] Started watching ${this.config.filePatterns.length} patterns`);
  }

  /**
   * Stop all watchers
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    
    // Clear pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    console.log('[FileWatcher] Stopped all watchers');
  }

  /**
   * Handle file system event with debouncing
   */
  private handleFileEvent(uri: vscode.Uri, eventType: 'create' | 'change' | 'delete'): void {
    const filePath = uri.fsPath;
    const fileType = this.detectFileType(filePath);
    
    if (!fileType) {
      return; // Unknown file type
    }

    console.log(`[FileWatcher] ${eventType}: ${path.basename(filePath)} (${fileType})`);

    // Debounce rapid changes
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.processFileChange(uri, fileType, eventType);
    }, this.config.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Process file change after debounce
   */
  private async processFileChange(
    uri: vscode.Uri,
    fileType: 'postman' | 'bruno' | 'openapi',
    eventType: 'create' | 'change' | 'delete'
  ): Promise<void> {
    // Notify callback if registered
    if (this.onFileChangeCallback) {
      this.onFileChangeCallback(uri, fileType);
    }

    // Skip auto-scan for deletions
    if (eventType === 'delete') {
      return;
    }

    // Auto-scan if enabled
    if (this.config.autoScan) {
      await this.triggerAutoScan(uri, fileType);
    }
  }

  /**
   * Trigger automatic security scan
   */
  private async triggerAutoScan(uri: vscode.Uri, fileType: string): Promise<void> {
    const fileName = path.basename(uri.fsPath);
    
    // Show progress notification
    const message = `DevPulse: Scanning ${fileName}...`;
    
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: message,
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // Execute appropriate scan command based on file type
          if (fileType === 'postman') {
            await vscode.commands.executeCommand('devpulse.importPostman', uri.fsPath);
          } else if (fileType === 'bruno') {
            await vscode.commands.executeCommand('devpulse.importBruno', uri.fsPath);
          } else if (fileType === 'openapi') {
            await vscode.commands.executeCommand('devpulse.importOpenApi', uri.fsPath);
          }

          progress.report({ increment: 100 });
          
          vscode.window.showInformationMessage(
            `DevPulse: Scan complete for ${fileName}`,
            'View Results'
          ).then(action => {
            if (action === 'View Results') {
              vscode.commands.executeCommand('devpulse.showSecurityFindings');
            }
          });
        } catch (error: any) {
          vscode.window.showErrorMessage(
            `DevPulse: Scan failed for ${fileName}: ${error.message}`
          );
        }
      }
    );
  }

  /**
   * Detect file type from path
   */
  private detectFileType(filePath: string): 'postman' | 'bruno' | 'openapi' | null {
    const lower = filePath.toLowerCase();
    const ext = path.extname(lower);
    const base = path.basename(lower);

    // Postman collections
    if (lower.includes('.postman_collection.json') || 
        lower.includes('.postman.json')) {
      return 'postman';
    }

    // Bruno files
    if (ext === '.bru' || base === 'bruno.json') {
      return 'bruno';
    }

    // OpenAPI/Swagger specs
    if (base.includes('openapi') || base.includes('swagger')) {
      if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
        return 'openapi';
      }
    }

    return null;
  }

  /**
   * Register callback for file changes
   */
  onFileChange(callback: (uri: vscode.Uri, type: string) => void): void {
    this.onFileChangeCallback = callback;
  }

  /**
   * Manually scan a specific file
   */
  async scanFile(uri: vscode.Uri): Promise<void> {
    const fileType = this.detectFileType(uri.fsPath);
    if (fileType) {
      await this.triggerAutoScan(uri, fileType);
    } else {
      vscode.window.showWarningMessage(
        'DevPulse: Unknown file type. Supported: Postman, Bruno, OpenAPI/Swagger'
      );
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FileWatcherConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart watchers if patterns changed
    if (config.filePatterns) {
      this.stopWatching();
      this.startWatching();
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopWatching();
  }
}

/**
 * Check if current workspace has API definition files
 */
export async function findApiDefinitionFiles(): Promise<vscode.Uri[]> {
  const patterns = [
    '**/*.postman_collection.json',
    '**/*.bru',
    '**/openapi.{json,yaml,yml}',
    '**/swagger.{json,yaml,yml}',
  ];

  const files: vscode.Uri[] = [];
  
  for (const pattern of patterns) {
    const found = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50);
    files.push(...found);
  }

  return files;
}
