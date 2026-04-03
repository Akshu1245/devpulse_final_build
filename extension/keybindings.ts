/**
 * DevPulse Keybindings System
 * 
 * Keyboard shortcuts for power users to quickly access DevPulse features.
 * Inspired by Claude Code's keybindings system.
 * 
 * @module DevPulse/Keybindings
 */

import * as vscode from 'vscode';

/**
 * Keybinding action definition
 */
export interface KeybindingAction {
  id: string;
  label: string;
  description: string;
  keySequence: string;
  category: 'scan' | 'navigation' | 'agent' | 'cost' | 'settings' | 'help';
  when?: string;  // VS Code when clause context
  handler: () => Promise<void> | void;
}

/**
 * Keybinding categories
 */
export const KEYBINDING_CATEGORIES = {
  scan: { label: '🔍 Scanning', icon: '🔍' },
  navigation: { label: '🧭 Navigation', icon: '🧭' },
  agent: { label: '🤖 Agent Control', icon: '🤖' },
  cost: { label: '💰 Cost Management', icon: '💰' },
  settings: { label: '⚙️ Settings', icon: '⚙️' },
  help: { label: '❓ Help', icon: '❓' },
} as const;

/**
 * Default DevPulse keybindings
 */
export const DEFAULT_KEYBINDINGS: KeybindingAction[] = [
  // Scan actions
  {
    id: 'devpulse.scan.start',
    label: 'Start Security Scan',
    description: 'Start a new security scan for the current workspace',
    keySequence: 'ctrl+shift+alt+s',
    category: 'scan',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.startScan');
    },
  },
  {
    id: 'devpulse.scan.quick',
    label: 'Quick Scan',
    description: 'Run a quick scan for critical vulnerabilities only',
    keySequence: 'ctrl+shift+alt+q',
    category: 'scan',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.quickScan');
    },
  },
  {
    id: 'devpulse.scan.postman',
    label: 'Import Postman Collection',
    description: 'Import and scan a Postman collection',
    keySequence: 'ctrl+shift+alt+p',
    category: 'scan',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.importPostman');
    },
  },
  {
    id: 'devpulse.scan.stop',
    label: 'Stop Current Scan',
    description: 'Stop the currently running scan',
    keySequence: 'ctrl+shift+alt+x',
    category: 'scan',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.stopScan');
    },
  },
  {
    id: 'devpulse.scan.results',
    label: 'View Scan Results',
    description: 'View the latest scan results',
    keySequence: 'ctrl+shift+alt+r',
    category: 'scan',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showResults');
    },
  },

  // Navigation actions
  {
    id: 'devpulse.nav.dashboard',
    label: 'Go to Dashboard',
    description: 'Navigate to the main dashboard',
    keySequence: 'ctrl+shift+alt+d',
    category: 'navigation',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showDashboard');
    },
  },
  {
    id: 'devpulse.nav.security',
    label: 'Go to Security Page',
    description: 'Navigate to the security vulnerabilities page',
    keySequence: 'ctrl+shift+alt+v',
    category: 'navigation',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showSecurity');
    },
  },
  {
    id: 'devpulse.nav.costs',
    label: 'Go to Cost Analytics',
    description: 'Navigate to the LLM cost analytics page',
    keySequence: 'ctrl+shift+alt+c',
    category: 'navigation',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showCosts');
    },
  },
  {
    id: 'devpulse.nav.agents',
    label: 'Go to Agent Guard',
    description: 'Navigate to the Agent Guard page',
    keySequence: 'ctrl+shift+alt+g',
    category: 'navigation',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showAgentGuard');
    },
  },
  {
    id: 'devpulse.nav.compliance',
    label: 'Go to Compliance',
    description: 'Navigate to the compliance page',
    keySequence: 'ctrl+shift+alt+o',
    category: 'navigation',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showCompliance');
    },
  },

  // Agent control actions
  {
    id: 'devpulse.agent.list',
    label: 'List All Agents',
    description: 'Show list of all monitored agents',
    keySequence: 'ctrl+shift+alt+l',
    category: 'agent',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.listAgents');
    },
  },
  {
    id: 'devpulse.agent.pauseAll',
    label: 'Pause All Agents',
    description: 'Pause all running agents',
    keySequence: 'ctrl+shift+alt+pause',
    category: 'agent',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.pauseAllAgents');
    },
  },
  {
    id: 'devpulse.agent.resumeAll',
    label: 'Resume All Agents',
    description: 'Resume all paused agents',
    keySequence: 'ctrl+shift+alt+play',
    category: 'agent',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.resumeAllAgents');
    },
  },

  // Cost management actions
  {
    id: 'devpulse.cost.current',
    label: 'View Current Costs',
    description: 'Show current LLM cost summary',
    keySequence: 'ctrl+shift+alt+t',
    category: 'cost',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showCurrentCost');
    },
  },
  {
    id: 'devpulse.cost.budget',
    label: 'Set Budget',
    description: 'Set cost budget for agents',
    keySequence: 'ctrl+shift+alt+b',
    category: 'cost',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.setBudget');
    },
  },
  {
    id: 'devpulse.cost.report',
    label: 'Generate Cost Report',
    description: 'Generate a detailed cost report',
    keySequence: 'ctrl+shift+alt+m',
    category: 'cost',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.generateCostReport');
    },
  },

  // Settings actions
  {
    id: 'devpulse.settings.open',
    label: 'Open Settings',
    description: 'Open DevPulse settings',
    keySequence: 'ctrl+shift+alt+,',
    category: 'settings',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.openSettings');
    },
  },
  {
    id: 'devpulse.settings.refresh',
    label: 'Refresh Data',
    description: 'Refresh all DevPulse data',
    keySequence: 'ctrl+shift+alt+f5',
    category: 'settings',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.refresh');
    },
  },

  // Help actions
  {
    id: 'devpulse.help.shortcuts',
    label: 'Show Keyboard Shortcuts',
    description: 'Display all DevPulse keyboard shortcuts',
    keySequence: 'ctrl+shift+alt+h',
    category: 'help',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showShortcuts');
    },
  },
  {
    id: 'devpulse.help.docs',
    label: 'Open Documentation',
    description: 'Open DevPulse documentation',
    keySequence: 'ctrl+shift+alt+/',
    category: 'help',
    handler: async () => {
      await vscode.commands.executeCommand('devpulse.showDocs');
    },
  },
];

/**
 * Keybindings manager
 */
export class KeybindingsManager {
  private keybindings: Map<string, KeybindingAction> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onDidChangeEmitter = new vscode.EventEmitter<void>();

  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor() {
    // Register default keybindings
    for (const binding of DEFAULT_KEYBINDINGS) {
      this.register(binding);
    }
  }

  /**
   * Register a keybinding
   */
  register(action: KeybindingAction): void {
    // Unregister existing if any
    this.unregister(action.id);

    // Create command
    const commandId = action.id;
    
    const disposable = vscode.commands.registerCommand(
      commandId,
      async () => {
        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: action.label,
              cancellable: false,
            },
            async () => {
              await action.handler();
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`DevPulse: ${action.label} failed - ${message}`);
        }
      }
    );

    this.disposables.push(disposable);
    this.keybindings.set(commandId, action);
    this.onDidChangeEmitter.fire();
  }

  /**
   * Unregister a keybinding
   */
  unregister(id: string): void {
    const disposable = this.disposables.find(d => {
      // Find disposable for this command
      return true; // Simplified - in production would track properly
    });

    if (disposable) {
      disposable.dispose();
      this.disposables = this.disposables.filter(d => d !== disposable);
    }

    this.keybindings.delete(id);
    this.onDidChangeEmitter.fire();
  }

  /**
   * Get all keybindings
   */
  getAll(): KeybindingAction[] {
    return Array.from(this.keybindings.values());
  }

  /**
   * Get keybindings by category
   */
  getByCategory(category: KeybindingAction['category']): KeybindingAction[] {
    return this.getAll().filter(k => k.category === category);
  }

  /**
   * Get keybinding by ID
   */
  get(id: string): KeybindingAction | undefined {
    return this.keybindings.get(id);
  }

  /**
   * Search keybindings
   */
  search(query: string): KeybindingAction[] {
    const q = query.toLowerCase();
    return this.getAll().filter(k =>
      k.label.toLowerCase().includes(q) ||
      k.description.toLowerCase().includes(q) ||
      k.keySequence.toLowerCase().includes(q)
    );
  }

  /**
   * Show keybindings picker
   */
  async showPicker(): Promise<void> {
    const items = this.getAll().map(k => ({
      label: k.keySequence,
      description: k.label,
      detail: k.description,
      keybinding: k,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Type a command name or keybinding...',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      await selected.keybinding.handler();
    }
  }

  /**
   * Show keybindings by category
   */
  async showCategoryPicker(): Promise<void> {
    const categories = Object.entries(KEYBINDING_CATEGORIES).map(([key, value]) => ({
      label: value.icon + ' ' + value.label,
      key,
    }));

    const selected = await vscode.window.showQuickPick(categories, {
      placeHolder: 'Select a category...',
    });

    if (selected) {
      const categoryKeybindings = this.getByCategory(selected.key as KeybindingAction['category']);
      
      const items = categoryKeybindings.map(k => ({
        label: k.keySequence,
        description: k.label,
        detail: k.description,
        keybinding: k,
      }));

      const selectedBinding = await vscode.window.showQuickPick(items, {
        placeHolder: `DevPulse ${selected.label} - Select an action...`,
      });

      if (selectedBinding) {
        await selectedBinding.keybinding.handler();
      }
    }
  }

  /**
   * Generate keybindings JSON for VS Code
   */
  generateKeybindingsJson(): string {
    const bindings = this.getAll().map(k => ({
      key: k.keySequence,
      command: k.id,
      when: k.when || 'editorTextFocus',
      description: k.description,
    }));

    return JSON.stringify(bindings, null, 2);
  }

  /**
   * Dispose all keybindings
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.keybindings.clear();
  }
}

// Global instance
let keybindingsManager: KeybindingsManager | null = null;

export function getKeybindingsManager(): KeybindingsManager {
  if (!keybindingsManager) {
    keybindingsManager = new KeybindingsManager();
  }
  return keybindingsManager;
}

/**
 * Register all DevPulse keybindings with VS Code
 */
export function registerKeybindings(context: vscode.ExtensionContext): void {
  const manager = getKeybindingsManager();

  // Register the keybindings picker command
  context.subscriptions.push(
    vscode.commands.registerCommand('devpulse.showShortcuts', async () => {
      await manager.showPicker();
    }),

    vscode.commands.registerCommand('devpulse.showShortcutsByCategory', async () => {
      await manager.showCategoryPicker();
    })
  );

  // Register individual commands for each keybinding
  for (const binding of DEFAULT_KEYBINDINGS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(binding.id, async () => {
        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: binding.label,
              cancellable: false,
            },
            async () => {
              await binding.handler();
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`DevPulse: ${binding.label} failed - ${message}`);
        }
      })
    );
  }

  console.log('[DevPulse] Registered', DEFAULT_KEYBINDINGS.length, 'keybindings');
}

/**
 * Show a notification with keybinding information
 */
export async function showKeybindingNotification(
  action: string,
  keybinding: string
): Promise<void> {
  const setting = vscode.workspace.getConfiguration('devpulse');
  const showNotifications = setting.get<boolean>('showKeybindingNotifications', true);

  if (showNotifications) {
    await vscode.window.showInformationMessage(
      `${action}: Press ${keybinding}`,
      'OK',
      'Don\'t show again'
    ).then(selection => {
      if (selection === 'Don\'t show again') {
        setting.update('showKeybindingNotifications', false, true);
      }
    });
  }
}
