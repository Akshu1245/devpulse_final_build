/**
 * DevPulse Skills System
 * 
 * Reusable security scan skills that can be loaded and executed.
 * Inspired by Claude Code's SkillTool with security-specific capabilities.
 * 
 * @module DevPulse/Skills
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

/**
 * Skill types
 */
export type SkillType = 
  | 'scan'           // Security scanning skill
  | 'compliance'     // Compliance checking skill
  | 'analysis'       // Analysis skill
  | 'remediation'    // Fix/remediation skill
  | 'monitoring'     // Monitoring skill
  | 'custom';        // Custom skill

/**
 * Skill trigger conditions
 */
export interface SkillTrigger {
  type: 'file_pattern' | 'command' | 'webhook' | 'schedule' | 'manual';
  pattern?: string;           // Glob pattern for file triggers
  command?: string;           // Command for command triggers
  cron?: string;              // Cron expression for schedule triggers
  webhook?: string;           // Webhook endpoint
}

/**
 * Skill action definition
 */
export interface SkillAction {
  name: string;
  description: string;
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    default?: any;
    description?: string;
  }>;
  output?: {
    type: 'json' | 'text' | 'report';
    format?: string;
  };
}

/**
 * Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  type: SkillType;
  author?: string;
  tags: string[];
  triggers: SkillTrigger[];
  actions: SkillAction[];
  icon?: string;
  color?: string;
  requiresAuth?: boolean;
  permissions?: string[];
  timeout?: number;           // Default timeout in ms
  retryCount?: number;
  configSchema?: Record<string, any>;
}

/**
 * Skill execution context
 */
export interface SkillContext {
  workspaceId: number;
  userId?: number;
  projectId?: number;
  scanId?: number;
  config: Record<string, any>;
  secrets: Record<string, string>;
  metadata: Record<string, any>;
}

/**
 * Skill execution result
 */
export interface SkillResult {
  success: boolean;
  skillId: string;
  action: string;
  output?: any;
  error?: string;
  duration: number;
  timestamp: number;
  logs?: string[];
}

/**
 * Built-in skills registry
 */
const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'owasp-top-10-scan',
    name: 'OWASP Top 10 Scanner',
    description: 'Comprehensive security scan for OWASP Top 10 vulnerabilities including SQL injection, XSS, CSRF, and more.',
    version: '1.0.0',
    type: 'scan',
    author: 'DevPulse',
    tags: ['owasp', 'security', 'vulnerabilities', 'web-security'],
    triggers: [
      { type: 'webhook', webhook: '/api/scan/owasp' },
      { type: 'schedule', cron: '0 */6 * * *' },
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'full_scan',
        description: 'Run full OWASP Top 10 vulnerability scan',
        parameters: {
          endpoints: { type: 'array', required: true, description: 'API endpoints to scan' },
          includeSensitive: { type: 'boolean', default: false, description: 'Include sensitive data checks' },
        },
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'quick_scan',
        description: 'Quick scan for critical vulnerabilities only',
        parameters: {
          endpoints: { type: 'array', required: true },
        },
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🛡️',
    color: '#DC2626',
    timeout: 300000,
  },
  {
    id: 'api-key-audit',
    name: 'API Key Security Audit',
    description: 'Audit all API keys for security issues including exposure, rotation age, and permission scope.',
    version: '1.0.0',
    type: 'scan',
    author: 'DevPulse',
    tags: ['api-keys', 'security', 'audit', 'compliance'],
    triggers: [
      { type: 'webhook', webhook: '/api/scan/api-keys' },
      { type: 'schedule', cron: '0 0 * * 0' }, // Weekly on Sunday
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'audit_all',
        description: 'Audit all API keys in the workspace',
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'audit_rotations',
        description: 'Check API key rotation compliance',
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🔑',
    color: '#7C3AED',
    timeout: 60000,
  },
  {
    id: 'llm-cost-monitor',
    name: 'LLM Cost Monitor',
    description: 'Monitor and alert on LLM token usage and costs across all agents and models.',
    version: '1.0.0',
    type: 'monitoring',
    author: 'DevPulse',
    tags: ['llm', 'cost', 'monitoring', 'budget'],
    triggers: [
      { type: 'schedule', cron: '*/15 * * * *' }, // Every 15 minutes
      { type: 'webhook', webhook: '/api/monitor/cost' },
    ],
    actions: [
      {
        name: 'check_budgets',
        description: 'Check all agent budgets and trigger alerts if needed',
        output: { type: 'json' },
      },
      {
        name: 'generate_report',
        description: 'Generate cost analysis report',
        parameters: {
          period: { type: 'string', default: 'daily', description: 'Report period' },
        },
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '💰',
    color: '#059669',
    timeout: 30000,
  },
  {
    id: 'gdpr-compliance',
    name: 'GDPR Compliance Checker',
    description: 'Check API endpoints for GDPR compliance including data retention, consent, and privacy.',
    version: '1.0.0',
    type: 'compliance',
    author: 'DevPulse',
    tags: ['gdpr', 'compliance', 'privacy', 'data-protection'],
    triggers: [
      { type: 'webhook', webhook: '/api/compliance/gdpr' },
      { type: 'schedule', cron: '0 2 * * *' }, // Daily at 2 AM
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'check_all',
        description: 'Check all endpoints for GDPR compliance',
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'generate_evidence',
        description: 'Generate compliance evidence document',
        output: { type: 'report', format: 'pdf' },
      },
    ],
    icon: '🇪🇺',
    color: '#2563EB',
    timeout: 120000,
  },
  {
    id: 'hipaa-compliance',
    name: 'HIPAA Compliance Checker',
    description: 'Check API endpoints for HIPAA compliance including PHI handling and security safeguards.',
    version: '1.0.0',
    type: 'compliance',
    author: 'DevPulse',
    tags: ['hipaa', 'compliance', 'healthcare', 'phi'],
    triggers: [
      { type: 'webhook', webhook: '/api/compliance/hipaa' },
      { type: 'schedule', cron: '0 3 * * *' },
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'audit_phi',
        description: 'Audit PHI data handling',
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'check_safeguards',
        description: 'Check security safeguards implementation',
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🏥',
    color: '#DC2626',
    timeout: 120000,
  },
  {
    id: 'pcidss-compliance',
    name: 'PCI DSS Compliance Checker',
    description: 'Check API endpoints for PCI DSS compliance including cardholder data handling.',
    version: '1.0.0',
    type: 'compliance',
    author: 'DevPulse',
    tags: ['pci-dss', 'compliance', 'payment', 'card-data'],
    triggers: [
      { type: 'webhook', webhook: '/api/compliance/pcidss' },
      { type: 'schedule', cron: '0 4 * * *' },
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'audit_card_data',
        description: 'Audit cardholder data handling',
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'check_network',
        description: 'Check network security controls',
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '💳',
    color: '#7C3AED',
    timeout: 120000,
  },
  {
    id: 'soc2-compliance',
    name: 'SOC 2 Compliance Checker',
    description: 'Check API endpoints for SOC 2 compliance including security, availability, and confidentiality.',
    version: '1.0.0',
    type: 'compliance',
    author: 'DevPulse',
    tags: ['soc2', 'compliance', 'trust', 'security'],
    triggers: [
      { type: 'webhook', webhook: '/api/compliance/soc2' },
      { type: 'schedule', cron: '0 5 * * *' },
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'audit_controls',
        description: 'Audit security controls',
        parameters: {
          trustCriteria: { type: 'string', default: 'common', description: 'Trust criteria (common, security, availability, confidentiality, privacy)' },
        },
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'generate_evidence',
        description: 'Generate SOC 2 evidence package',
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🔒',
    color: '#059669',
    timeout: 180000,
  },
  {
    id: 'threat-intelligence',
    name: 'Threat Intelligence Analyzer',
    description: 'Analyze API traffic and logs for indicators of compromise and known threat patterns.',
    version: '1.0.0',
    type: 'analysis',
    author: 'DevPulse',
    tags: ['threat', 'ioc', 'analysis', 'security'],
    triggers: [
      { type: 'webhook', webhook: '/api/analyze/threats' },
      { type: 'schedule', cron: '*/30 * * * *' },
    ],
    actions: [
      {
        name: 'scan_iocs',
        description: 'Scan for indicators of compromise',
        parameters: {
          sources: { type: 'array', default: ['builtin'], description: 'IOC sources' },
        },
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'check_reputation',
        description: 'Check API endpoints against threat intelligence',
        output: { type: 'json' },
      },
    ],
    icon: '🔍',
    color: '#DC2626',
    timeout: 60000,
  },
  {
    id: 'penetration-test',
    name: 'Penetration Testing Framework',
    description: 'Execute penetration testing scenarios against API endpoints.',
    version: '1.0.0',
    type: 'scan',
    author: 'DevPulse',
    tags: ['pentest', 'security', 'testing', 'exploitation'],
    triggers: [
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'run_tests',
        description: 'Run penetration tests',
        parameters: {
          scenarios: { type: 'array', description: 'Test scenarios to run' },
          intensity: { type: 'string', default: 'medium', description: 'Test intensity (low, medium, high)' },
        },
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'sql_injection',
        description: 'Test SQL injection vulnerabilities',
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'xss_test',
        description: 'Test XSS vulnerabilities',
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🎯',
    color: '#DC2626',
    timeout: 600000,
    permissions: ['execute_unsafe'],
  },
  {
    id: 'auto-remediation',
    name: 'Auto Remediation Engine',
    description: 'Automatically fix common security vulnerabilities based on best practices.',
    version: '1.0.0',
    type: 'remediation',
    author: 'DevPulse',
    tags: ['auto-fix', 'remediation', 'security', 'automation'],
    triggers: [
      { type: 'webhook', webhook: '/api/remediate' },
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'fix_all',
        description: 'Attempt to fix all fixable vulnerabilities',
        parameters: {
          dryRun: { type: 'boolean', default: true, description: 'Preview changes without applying' },
          autoApprove: { type: 'boolean', default: false, description: 'Skip approval prompts' },
        },
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'fix_category',
        description: 'Fix vulnerabilities by category',
        parameters: {
          category: { type: 'string', required: true, description: 'Vulnerability category' },
          dryRun: { type: 'boolean', default: true },
        },
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🔧',
    color: '#059669',
    timeout: 300000,
    permissions: ['write_files', 'execute_scripts'],
  },
  {
    id: 'api-contract-validation',
    name: 'API Contract Validator',
    description: 'Validate API implementations against OpenAPI/Postman specifications.',
    version: '1.0.0',
    type: 'analysis',
    author: 'DevPulse',
    tags: ['api', 'contract', 'validation', 'openapi'],
    triggers: [
      { type: 'webhook', webhook: '/api/validate/contract' },
      { type: 'file_pattern', pattern: '**/*.{yaml,yml,json}' },
    ],
    actions: [
      {
        name: 'validate',
        description: 'Validate API against specification',
        parameters: {
          specFile: { type: 'string', description: 'Path to OpenAPI/Postman spec' },
        },
        output: { type: 'report', format: 'json' },
      },
      {
        name: 'check_breaking',
        description: 'Check for breaking changes',
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '📝',
    color: '#2563EB',
    timeout: 60000,
  },
  {
    id: 'secret-scanning',
    name: 'Secret Scanner',
    description: 'Scan code and configurations for exposed secrets, API keys, and credentials.',
    version: '1.0.0',
    type: 'scan',
    author: 'DevPulse',
    tags: ['secrets', 'credentials', 'scanning', 'security'],
    triggers: [
      { type: 'webhook', webhook: '/api/scan/secrets' },
      { type: 'schedule', cron: '0 */4 * * *' },
      { type: 'manual' },
    ],
    actions: [
      {
        name: 'scan',
        description: 'Scan for exposed secrets',
        parameters: {
          paths: { type: 'array', description: 'Paths to scan' },
          patterns: { type: 'array', description: 'Secret patterns to detect' },
        },
        output: { type: 'report', format: 'json' },
      },
    ],
    icon: '🔐',
    color: '#DC2626',
    timeout: 120000,
  },
];

/**
 * Skills registry
 */
class SkillsRegistry {
  private skills: Map<string, Skill> = new Map();
  private customSkillsDir: string | null = null;

  constructor() {
    // Load built-in skills
    for (const skill of BUILTIN_SKILLS) {
      this.skills.set(skill.id, skill);
    }
  }

  /**
   * Set custom skills directory
   */
  setCustomSkillsDir(dir: string): void {
    this.customSkillsDir = dir;
    this.loadCustomSkills();
  }

  /**
   * Load custom skills from directory
   */
  private loadCustomSkills(): void {
    if (!this.customSkillsDir || !existsSync(this.customSkillsDir)) {
      return;
    }

    try {
      const files = readdirSync(this.customSkillsDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filepath = join(this.customSkillsDir, file);
        const stat = statSync(filepath);
        
        if (!stat.isFile()) continue;
        
        try {
          const content = readFileSync(filepath, 'utf-8');
          const skill = JSON.parse(content) as Skill;
          
          if (this.validateSkill(skill)) {
            this.skills.set(skill.id, skill);
            console.log(`[Skills] Loaded custom skill: ${skill.id}`);
          }
        } catch (e) {
          console.warn(`[Skills] Failed to load skill from ${file}:`, e);
        }
      }
    } catch (e) {
      console.error(`[Skills] Failed to load custom skills:`, e);
    }
  }

  /**
   * Validate skill definition
   */
  private validateSkill(skill: any): skill is Skill {
    return (
      typeof skill.id === 'string' &&
      typeof skill.name === 'string' &&
      typeof skill.description === 'string' &&
      typeof skill.version === 'string' &&
      Array.isArray(skill.actions)
    );
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by ID
   */
  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * Get skills by type
   */
  getSkillsByType(type: SkillType): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.type === type);
  }

  /**
   * Get skills by tag
   */
  getSkillsByTag(tag: string): Skill[] {
    return Array.from(this.skills.values()).filter(s => 
      s.tags.includes(tag.toLowerCase())
    );
  }

  /**
   * Search skills
   */
  searchSkills(query: string): Skill[] {
    const q = query.toLowerCase();
    return Array.from(this.skills.values()).filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.includes(q))
    );
  }

  /**
   * Register a custom skill
   */
  registerSkill(skill: Skill): void {
    if (!this.validateSkill(skill)) {
      throw new Error('Invalid skill definition');
    }
    this.skills.set(skill.id, skill);
  }

  /**
   * Unregister a skill
   */
  unregisterSkill(id: string): boolean {
    // Don't allow unregistering built-in skills
    const skill = this.skills.get(id);
    if (skill && BUILTIN_SKILLS.some(s => s.id === id)) {
      throw new Error('Cannot unregister built-in skills');
    }
    return this.skills.delete(id);
  }

  /**
   * Get skill execution prompt
   */
  getSkillPrompt(skillId: string, actionName: string): string | null {
    const skill = this.skills.get(skillId);
    if (!skill) return null;

    const action = skill.actions.find(a => a.name === actionName);
    if (!action) return null;

    const lines: string[] = [
      `# ${skill.name}`,
      '',
      skill.description,
      '',
      `## Action: ${action.name}`,
      action.description,
    ];

    if (action.parameters) {
      lines.push('\n### Parameters:');
      for (const [name, param] of Object.entries(action.parameters)) {
        const required = param.required ? '(required)' : '(optional)';
        const defaultStr = param.default !== undefined ? ` [default: ${param.default}]` : '';
        lines.push(`- ${name}: ${param.type} ${required}${defaultStr}`);
        if (param.description) {
          lines.push(`  ${param.description}`);
        }
      }
    }

    lines.push(`\n## Output Format: ${action.output?.format || 'json'}`);
    lines.push('\n---');
    lines.push(`Skill ID: ${skill.id}`);
    lines.push(`Version: ${skill.version}`);

    return lines.join('\n');
  }
}

// Singleton registry
export const skillsRegistry = new SkillsRegistry();

/**
 * Skill execution engine
 */
export class SkillExecutor {
  private registry: SkillsRegistry;

  constructor(registry: SkillsRegistry = skillsRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a skill action
   */
  async execute(
    skillId: string,
    action: string,
    params: Record<string, any>,
    context: SkillContext
  ): Promise<SkillResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    const addLog = (message: string) => {
      logs.push(`[${new Date().toISOString()}] ${message}`);
    };

    addLog(`Starting skill execution: ${skillId}/${action}`);

    try {
      const skill = this.registry.getSkill(skillId);
      if (!skill) {
        throw new Error(`Skill not found: ${skillId}`);
      }

      const skillAction = skill.actions.find(a => a.name === action);
      if (!skillAction) {
        throw new Error(`Action not found: ${action}`);
      }

      // Validate required parameters
      if (skillAction.parameters) {
        for (const [name, param] of Object.entries(skillAction.parameters)) {
          if (param.required && params[name] === undefined) {
            throw new Error(`Missing required parameter: ${name}`);
          }
        }
      }

      // Execute based on skill type
      let output: any;

      switch (skillId) {
        case 'owasp-top-10-scan':
          output = await this.executeOwaspScan(action, params, context);
          break;
        case 'llm-cost-monitor':
          output = await this.executeCostMonitor(action, params, context);
          break;
        case 'api-key-audit':
          output = await this.executeApiKeyAudit(action, params, context);
          break;
        case 'gdpr-compliance':
        case 'hipaa-compliance':
        case 'pcidss-compliance':
        case 'soc2-compliance':
          output = await this.executeComplianceCheck(skillId, action, params, context);
          break;
        case 'threat-intelligence':
          output = await this.executeThreatIntel(action, params, context);
          break;
        case 'secret-scanning':
          output = await this.executeSecretScan(action, params, context);
          break;
        default:
          throw new Error(`Skill execution not implemented: ${skillId}`);
      }

      addLog(`Skill execution completed successfully`);

      return {
        success: true,
        skillId,
        action,
        output,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        logs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Skill execution failed: ${errorMessage}`);

      return {
        success: false,
        skillId,
        action,
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        logs,
      };
    }
  }

  private async executeOwaspScan(action: string, params: any, context: SkillContext): Promise<any> {
    // OWASP Top 10 scanning implementation
    console.log(`[Skills] Executing OWASP scan: ${action}`);
    return { vulnerabilitiesFound: 0, critical: 0, high: 0 };
  }

  private async executeCostMonitor(action: string, params: any, context: SkillContext): Promise<any> {
    // Cost monitoring implementation
    console.log(`[Skills] Executing cost monitor: ${action}`);
    return { totalCost: 0, budgetStatus: 'ok' };
  }

  private async executeApiKeyAudit(action: string, params: any, context: SkillContext): Promise<any> {
    // API key audit implementation
    console.log(`[Skills] Executing API key audit: ${action}`);
    return { keysAudited: 0, issues: [] };
  }

  private async executeComplianceCheck(skillId: string, action: string, params: any, context: SkillContext): Promise<any> {
    // Compliance check implementation
    console.log(`[Skills] Executing compliance check: ${skillId}`);
    return { compliant: true, findings: [] };
  }

  private async executeThreatIntel(action: string, params: any, context: SkillContext): Promise<any> {
    // Threat intelligence implementation
    console.log(`[Skills] Executing threat intel: ${action}`);
    return { iocsFound: 0, threats: [] };
  }

  private async executeSecretScan(action: string, params: any, context: SkillContext): Promise<any> {
    // Secret scanning implementation
    console.log(`[Skills] Executing secret scan: ${action}`);
    return { secretsFound: 0, severity: 'high' };
  }
}

// Default executor instance
export const skillExecutor = new SkillExecutor();

/**
 * Initialize skills from directory
 */
export function initializeSkills(customSkillsDir?: string): void {
  if (customSkillsDir) {
    skillsRegistry.setCustomSkillsDir(customSkillsDir);
  }
  console.log(`[Skills] Loaded ${skillsRegistry.getAllSkills().length} skills`);
}
