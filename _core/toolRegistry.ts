/**
 * DevPulse Tool Registry
 * 
 * Central registry for all DevPulse tools with validation, permissions, and execution.
 * Inspired by Claude Code's tools system.
 * 
 * @module DevPulse/ToolRegistry
 */

import { EventEmitter } from 'events';

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  pattern?: string;         // Regex pattern for string validation
  minimum?: number;        // For numbers
  maximum?: number;        // For numbers
  items?: { type: string; name?: string };   // For arrays - simplified
  properties?: Record<string, ToolParameter>;  // For objects
}

/**
 * Tool output definition
 */
export interface ToolOutput {
  type: 'text' | 'json' | 'html' | 'file';
  format?: string;
  mimeType?: string;
}

/**
 * Tool permission requirements
 */
export interface ToolPermissions {
  resources?: string[];     // e.g., ['workspace:read', 'scan:write']
  dangerous?: boolean;       // If true, requires explicit user approval
  rateLimited?: boolean;     // If true, limited calls per minute
  rateLimit?: number;        // Calls per minute if rateLimited
}

/**
 * Tool definition
 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'security' | 'cost' | 'compliance' | 'agent' | 'utility';
  parameters?: ToolParameter[];
  output?: ToolOutput;
  permissions?: ToolPermissions;
  examples?: { input: any; output: any }[];
  tags?: string[];
  deprecationWarning?: string;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  workspaceId: number;
  userId?: number;
  userRole?: 'admin' | 'developer' | 'viewer';
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  toolId: string;
  output?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  executionTime: number;
  timestamp: number;
  cached?: boolean;
}

/**
 * Tool registry events
 */
export interface ToolRegistryEvents {
  toolRegistered: [Tool];
  toolUnregistered: [string];
  toolExecuted: [string, ToolResult];
  toolError: [string, Error];
}

/**
 * Built-in DevPulse tools
 */
const BUILTIN_TOOLS: Tool[] = [
  // Security tools
  {
    id: 'devpulse.scan.create',
    name: 'Create Scan',
    description: 'Create and start a new security scan',
    version: '1.0.0',
    category: 'security',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true, description: 'Workspace ID' },
      { name: 'projectId', type: 'number', description: 'Project ID (optional)' },
      { name: 'type', type: 'string', enum: ['full', 'quick', 'critical', 'custom'], default: 'full' },
      { name: 'endpoints', type: 'array', items: { type: 'string' }, description: 'Specific endpoints to scan' },
    ],
    output: { type: 'json' },
    tags: ['scan', 'security'],
  },
  {
    id: 'devpulse.scan.status',
    name: 'Get Scan Status',
    description: 'Get the status of a running or completed scan',
    version: '1.0.0',
    category: 'security',
    parameters: [
      { name: 'scanId', type: 'number', required: true, description: 'Scan ID' },
    ],
    output: { type: 'json' },
    tags: ['scan', 'status'],
  },
  {
    id: 'devpulse.scan.results',
    name: 'Get Scan Results',
    description: 'Get detailed results of a completed scan',
    version: '1.0.0',
    category: 'security',
    parameters: [
      { name: 'scanId', type: 'number', required: true, description: 'Scan ID' },
      { name: 'format', type: 'string', enum: ['json', 'sarif', 'html'], default: 'json' },
    ],
    output: { type: 'json' },
    tags: ['scan', 'results'],
  },
  {
    id: 'devpulse.vuln.list',
    name: 'List Vulnerabilities',
    description: 'List all vulnerabilities in a workspace',
    version: '1.0.0',
    category: 'security',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'severity', type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
      { name: 'status', type: 'string', enum: ['open', 'fixed', 'ignored'] },
      { name: 'limit', type: 'number', default: 50, maximum: 500 },
      { name: 'offset', type: 'number', default: 0 },
    ],
    output: { type: 'json' },
    tags: ['vulnerability', 'security'],
  },
  {
    id: 'devpulse.vuln.details',
    name: 'Get Vulnerability Details',
    description: 'Get detailed information about a specific vulnerability',
    version: '1.0.0',
    category: 'security',
    parameters: [
      { name: 'vulnerabilityId', type: 'number', required: true },
    ],
    output: { type: 'json' },
    tags: ['vulnerability', 'details'],
  },
  {
    id: 'devpulse.vuln.fix',
    name: 'Get Fix Recommendation',
    description: 'Get recommended fix for a vulnerability',
    version: '1.0.0',
    category: 'security',
    parameters: [
      { name: 'vulnerabilityId', type: 'number', required: true },
    ],
    output: { type: 'json' },
    tags: ['vulnerability', 'fix'],
  },

  // Cost tools
  {
    id: 'devpulse.cost.current',
    name: 'Get Current Costs',
    description: 'Get current LLM cost for a workspace',
    version: '1.0.0',
    category: 'cost',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'period', type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
    ],
    output: { type: 'json' },
    tags: ['cost', 'llm'],
  },
  {
    id: 'devpulse.cost.breakdown',
    name: 'Get Cost Breakdown',
    description: 'Get detailed cost breakdown by model, agent, endpoint',
    version: '1.0.0',
    category: 'cost',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'groupBy', type: 'string', enum: ['model', 'agent', 'endpoint', 'user'], default: 'model' },
      { name: 'limit', type: 'number', default: 10, maximum: 100 },
    ],
    output: { type: 'json' },
    tags: ['cost', 'breakdown'],
  },
  {
    id: 'devpulse.cost.budget.set',
    name: 'Set Cost Budget',
    description: 'Set cost budget limits for a workspace or agent',
    version: '1.0.0',
    category: 'cost',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'agentId', type: 'string', description: 'Optional: set budget for specific agent' },
      { name: 'hourlyLimit', type: 'number', description: 'Hourly limit in USD' },
      { name: 'dailyLimit', type: 'number', description: 'Daily limit in USD' },
      { name: 'monthlyLimit', type: 'number', description: 'Monthly limit in USD' },
    ],
    output: { type: 'json' },
    tags: ['cost', 'budget'],
  },
  {
    id: 'devpulse.cost.trends',
    name: 'Get Cost Trends',
    description: 'Get cost trends over time',
    version: '1.0.0',
    category: 'cost',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'days', type: 'number', default: 7, maximum: 90 },
    ],
    output: { type: 'json' },
    tags: ['cost', 'trends'],
  },

  // Compliance tools
  {
    id: 'devpulse.compliance.check',
    name: 'Check Compliance',
    description: 'Check compliance status for a framework',
    version: '1.0.0',
    category: 'compliance',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'framework', type: 'string', enum: ['GDPR', 'HIPAA', 'PCI-DSS', 'SOC2', 'ISO27001', 'NIST'], required: true },
    ],
    output: { type: 'json' },
    tags: ['compliance', 'check'],
  },
  {
    id: 'devpulse.compliance.report',
    name: 'Generate Compliance Report',
    description: 'Generate a compliance report',
    version: '1.0.0',
    category: 'compliance',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'frameworks', type: 'array', items: { type: 'string' }, required: true },
      { name: 'format', type: 'string', enum: ['json', 'pdf', 'html'], default: 'json' },
    ],
    output: { type: 'json' },
    tags: ['compliance', 'report'],
  },
  {
    id: 'devpulse.compliance.evidence',
    name: 'Generate Evidence',
    description: 'Generate compliance evidence package',
    version: '1.0.0',
    category: 'compliance',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'framework', type: 'string', required: true },
      { name: 'requirements', type: 'array', items: { type: 'string' } },
    ],
    output: { type: 'json' },
    tags: ['compliance', 'evidence'],
  },

  // Agent tools
  {
    id: 'devpulse.agent.list',
    name: 'List Agents',
    description: 'List all monitored LLM agents',
    version: '1.0.0',
    category: 'agent',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'status', type: 'string', enum: ['active', 'paused', 'all'] },
    ],
    output: { type: 'json' },
    tags: ['agent', 'list'],
  },
  {
    id: 'devpulse.agent.pause',
    name: 'Pause Agent',
    description: 'Pause a running agent',
    version: '1.0.0',
    category: 'agent',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'agentId', type: 'string', required: true },
      { name: 'reason', type: 'string', description: 'Reason for pausing' },
    ],
    output: { type: 'json' },
    permissions: { dangerous: true },
    tags: ['agent', 'control'],
  },
  {
    id: 'devpulse.agent.resume',
    name: 'Resume Agent',
    description: 'Resume a paused agent',
    version: '1.0.0',
    category: 'agent',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
      { name: 'agentId', type: 'string', required: true },
    ],
    output: { type: 'json' },
    tags: ['agent', 'control'],
  },

  // Utility tools
  {
    id: 'devpulse.workspace.info',
    name: 'Get Workspace Info',
    description: 'Get information about a workspace',
    version: '1.0.0',
    category: 'utility',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
    ],
    output: { type: 'json' },
    tags: ['workspace', 'info'],
  },
  {
    id: 'devpulse.dashboard.stats',
    name: 'Get Dashboard Stats',
    description: 'Get dashboard statistics for a workspace',
    version: '1.0.0',
    category: 'utility',
    parameters: [
      { name: 'workspaceId', type: 'number', required: true },
    ],
    output: { type: 'json' },
    tags: ['dashboard', 'stats'],
  },
  {
    id: 'devpulse.health',
    name: 'Health Check',
    description: 'Check DevPulse API health',
    version: '1.0.0',
    category: 'utility',
    output: { type: 'json' },
    tags: ['health'],
  },
];

/**
 * Tool registry
 */
export class ToolRegistry extends EventEmitter {
  private tools: Map<string, Tool> = new Map();
  private executionCounters: Map<string, number> = new Map();
  private executionTimestamps: Map<string, number[]> = new Map();

  constructor() {
    super();
    
    // Register built-in tools
    for (const tool of BUILTIN_TOOLS) {
      this.register(tool);
    }
  }

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] Tool already registered: ${tool.id}`);
      return;
    }

    this.tools.set(tool.id, tool);
    this.executionCounters.set(tool.id, 0);
    this.executionTimestamps.set(tool.id, []);
    
    this.emit('toolRegistered', tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.id}`);
  }

  /**
   * Unregister a tool
   */
  unregister(id: string): boolean {
    const tool = this.tools.get(id);
    if (!tool) {
      return false;
    }

    this.tools.delete(id);
    this.executionCounters.delete(id);
    this.executionTimestamps.delete(id);
    
    this.emit('toolUnregistered', id);
    return true;
  }

  /**
   * Get a tool by ID
   */
  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  /**
   * Get all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: Tool['category']): Tool[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search tools
   */
  search(query: string): Tool[] {
    const q = query.toLowerCase();
    return this.getAll().filter(t =>
      t.id.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }

  /**
   * Validate tool parameters
   */
  validateParameters(toolId: string, params: Record<string, any>): { valid: boolean; errors: string[] } {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { valid: false, errors: [`Tool not found: ${toolId}`] };
    }

    const errors: string[] = [];
    const parameters = tool.parameters || [];

    for (const param of parameters) {
      const value = params[param.name];

      // Check required
      if (param.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      if (value === undefined || value === null) {
        continue; // Optional parameter not provided
      }

      // Check type
      if (param.type === 'string' && typeof value !== 'string') {
        errors.push(`Parameter ${param.name} must be a string`);
      } else if (param.type === 'number' && typeof value !== 'number') {
        errors.push(`Parameter ${param.name} must be a number`);
      } else if (param.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Parameter ${param.name} must be a boolean`);
      } else if (param.type === 'array' && !Array.isArray(value)) {
        errors.push(`Parameter ${param.name} must be an array`);
      } else if (param.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(`Parameter ${param.name} must be an object`);
      }

      // Check enum
      if (param.enum && !param.enum.includes(value)) {
        errors.push(`Parameter ${param.name} must be one of: ${param.enum.join(', ')}`);
      }

      // Check range for numbers
      if (param.type === 'number' && typeof value === 'number') {
        if (param.minimum !== undefined && value < param.minimum) {
          errors.push(`Parameter ${param.name} must be >= ${param.minimum}`);
        }
        if (param.maximum !== undefined && value > param.maximum) {
          errors.push(`Parameter ${param.name} must be <= ${param.maximum}`);
        }
      }

      // Check pattern for strings
      if (param.type === 'string' && typeof value === 'string' && param.pattern) {
        const regex = new RegExp(param.pattern);
        if (!regex.test(value)) {
          errors.push(`Parameter ${param.name} does not match required pattern`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check tool rate limit
   */
  checkRateLimit(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool?.permissions?.rateLimited) {
      return true;
    }

    const limit = tool.permissions.rateLimit || 60;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    const timestamps = this.executionTimestamps.get(toolId) || [];
    const recentTimestamps = timestamps.filter(t => t > windowStart);
    
    if (recentTimestamps.length >= limit) {
      return false;
    }

    recentTimestamps.push(now);
    this.executionTimestamps.set(toolId, recentTimestamps);
    return true;
  }

  /**
   * Check tool permissions
   */
  checkPermissions(toolId: string, context: ToolContext): { allowed: boolean; reason?: string } {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { allowed: false, reason: 'Tool not found' };
    }

    // Admin can do everything
    if (context.userRole === 'admin') {
      return { allowed: true };
    }

    // Check dangerous permissions
    if (tool.permissions?.dangerous) {
      // Admin has already returned above. Any remaining role is not allowed.
      return { allowed: false, reason: 'This tool requires admin permissions' };
    }

    return { allowed: true };
  }

  /**
   * Execute a tool (placeholder - actual execution would be implemented elsewhere)
   */
  async execute(
    toolId: string,
    params: Record<string, any>,
    context: ToolContext,
    executor: (tool: Tool, params: any, context: ToolContext) => Promise<any>
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolId);

    if (!tool) {
      return {
        success: false,
        toolId,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool not found: ${toolId}` },
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Validate parameters
    const validation = this.validateParameters(toolId, params);
    if (!validation.valid) {
      return {
        success: false,
        toolId,
        error: { 
          code: 'INVALID_PARAMETERS', 
          message: 'Parameter validation failed',
          details: validation.errors 
        },
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Check rate limit
    if (!this.checkRateLimit(toolId)) {
      return {
        success: false,
        toolId,
        error: { code: 'RATE_LIMITED', message: 'Tool rate limit exceeded' },
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Check permissions
    const permissions = this.checkPermissions(toolId, context);
    if (!permissions.allowed) {
      return {
        success: false,
        toolId,
        error: { code: 'PERMISSION_DENIED', message: permissions.reason || 'Permission denied' },
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    try {
      const output = await executor(tool, params, context);
      
      // Update execution counter
      const count = (this.executionCounters.get(toolId) || 0) + 1;
      this.executionCounters.set(toolId, count);

      const result: ToolResult = {
        success: true,
        toolId,
        output,
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };

      this.emit('toolExecuted', toolId, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      const result: ToolResult = {
        success: false,
        toolId,
        error: { code: 'EXECUTION_ERROR', message },
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };

      this.emit('toolError', toolId, error as Error);
      this.emit('toolExecuted', toolId, result);
      return result;
    }
  }

  /**
   * Get tool usage statistics
   */
  getUsageStats(): Record<string, { totalCalls: number; avgExecutionTime: number }> {
    const stats: Record<string, { totalCalls: number; avgExecutionTime: number }> = {};
    
    for (const [toolId, count] of this.executionCounters) {
      const timestamps = this.executionTimestamps.get(toolId) || [];
      const now = Date.now();
      const recentTimestamps = timestamps.filter(t => now - t < 60000);
      
      stats[toolId] = {
        totalCalls: count,
        avgExecutionTime: 0, // Would need to track this properly
      };
    }
    
    return stats;
  }
}

// Singleton instance
let toolRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistry) {
    toolRegistry = new ToolRegistry();
  }
  return toolRegistry;
}

export function initializeToolRegistry(): ToolRegistry {
  if (!toolRegistry) {
    toolRegistry = new ToolRegistry();
  }
  return toolRegistry;
}

// Note: Types are already exported via interface declarations above
