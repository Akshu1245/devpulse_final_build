/**
 * DevPulse MCP (Model Context Protocol) Integration
 * 
 * Enables DevPulse to act as an MCP server for AI agents.
 * Provides security context, vulnerability analysis, and LLM cost intelligence.
 * 
 * @module DevPulse/MCP
 */

import { EventEmitter } from 'events';

/**
 * MCP message types
 */
export type McpMessageType = 
  | 'initialize'
  | 'initialized'
  | 'tools/list'
  | 'tools/list/result'
  | 'tools/call'
  | 'tools/call/result'
  | 'resources/list'
  | 'resources/list/result'
  | 'resources/read'
  | 'resources/read/result'
  | 'prompts/list'
  | 'prompts/list/result'
  | 'prompts/get'
  | 'prompts/get/result'
  | 'error';

/**
 * MCP tool definition
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP resource definition
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP prompt definition
 */
export interface McpPrompt {
  name: string;
  description: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

/**
 * MCP message
 */
export interface McpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP Client interface
 */
export interface McpClient {
  send(message: McpMessage): Promise<void>;
  onMessage(handler: (message: McpMessage) => void): void;
  onError(handler: (error: Error) => void): void;
  close(): void;
}

/**
 * MCP Server capabilities
 */
export interface McpServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
}

/**
 * MCP Server implementation for DevPulse
 */
export class DevPulseMcpServer extends EventEmitter {
  private capabilities: McpServerCapabilities;
  private tools: Map<string, McpTool> = new Map();
  private resources: Map<string, McpResource> = new Map();
  private prompts: Map<string, McpPrompt> = new Map();
  private clients: Set<McpClient> = new Set();
  private initialized: boolean = false;

  constructor() {
    super();
    this.capabilities = {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
    };
    
    this.registerDefaultTools();
    this.registerDefaultResources();
    this.registerDefaultPrompts();
  }

  /**
   * Register default DevPulse tools
   */
  private registerDefaultTools(): void {
    // Security scanning tools
    this.registerTool({
      name: 'security_scan',
      description: 'Run a comprehensive security scan on API endpoints',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number', description: 'Workspace ID' },
          endpoints: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of API endpoints to scan' 
          },
          scanType: { 
            type: 'string', 
            enum: ['quick', 'full', 'critical'],
            description: 'Type of scan to perform'
          },
        },
        required: ['workspaceId', 'endpoints'],
      },
    });

    this.registerTool({
      name: 'check_vulnerability',
      description: 'Check if an endpoint is vulnerable to a specific attack type',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          endpoint: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          attackType: { 
            type: 'string',
            enum: ['sql_injection', 'xss', 'csrf', 'auth_bypass', 'rate_limit', 'cors'],
          },
        },
        required: ['workspaceId', 'endpoint', 'method', 'attackType'],
      },
    });

    this.registerTool({
      name: 'get_risk_score',
      description: 'Get the current risk score for a workspace',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          includeHistory: { type: 'boolean', default: false },
        },
        required: ['workspaceId'],
      },
    });

    this.registerTool({
      name: 'list_vulnerabilities',
      description: 'List all vulnerabilities in a workspace',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          severity: { 
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'info'],
          },
          status: { type: 'string', enum: ['open', 'fixed', 'ignored'] },
          limit: { type: 'number', default: 50 },
        },
        required: ['workspaceId'],
      },
    });

    // LLM Cost tools
    this.registerTool({
      name: 'get_llm_cost',
      description: 'Get LLM cost information for a workspace',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          period: { 
            type: 'string',
            enum: ['hour', 'day', 'week', 'month'],
            default: 'day',
          },
          model: { type: 'string', description: 'Specific model to query' },
        },
        required: ['workspaceId'],
      },
    });

    this.registerTool({
      name: 'get_cost_breakdown',
      description: 'Get detailed cost breakdown by model, agent, and endpoint',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          groupBy: { 
            type: 'string',
            enum: ['model', 'agent', 'endpoint', 'user'],
          },
          limit: { type: 'number', default: 10 },
        },
        required: ['workspaceId'],
      },
    });

    this.registerTool({
      name: 'set_cost_budget',
      description: 'Set cost budget limits for an agent or workspace',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          agentId: { type: 'string' },
          hourlyLimit: { type: 'number', description: 'Hourly limit in USD' },
          dailyLimit: { type: 'number', description: 'Daily limit in USD' },
          monthlyLimit: { type: 'number', description: 'Monthly limit in USD' },
        },
        required: ['workspaceId'],
      },
    });

    // Compliance tools
    this.registerTool({
      name: 'check_compliance',
      description: 'Check compliance status for a framework',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          framework: { 
            type: 'string',
            enum: ['GDPR', 'HIPAA', 'PCI-DSS', 'SOC2', 'ISO27001', 'NIST'],
          },
          reportType: { type: 'string', enum: ['summary', 'detailed', 'evidence'] },
        },
        required: ['workspaceId', 'framework'],
      },
    });

    this.registerTool({
      name: 'generate_compliance_report',
      description: 'Generate a compliance report',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          frameworks: { type: 'array', items: { type: 'string' } },
          format: { type: 'string', enum: ['json', 'pdf', 'html'], default: 'json' },
        },
        required: ['workspaceId', 'frameworks'],
      },
    });

    // Agent Guard tools
    this.registerTool({
      name: 'list_agents',
      description: 'List all monitored agents',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          status: { type: 'string', enum: ['active', 'paused', 'all'] },
        },
        required: ['workspaceId'],
      },
    });

    this.registerTool({
      name: 'pause_agent',
      description: 'Pause/kill an agent due to budget or security concerns',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          agentId: { type: 'string' },
          reason: { type: 'string', description: 'Reason for pausing' },
        },
        required: ['workspaceId', 'agentId'],
      },
    });

    this.registerTool({
      name: 'resume_agent',
      description: 'Resume a paused agent',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          agentId: { type: 'string' },
        },
        required: ['workspaceId', 'agentId'],
      },
    });

    // Shadow API tools
    this.registerTool({
      name: 'detect_shadow_apis',
      description: 'Detect undocumented/unauthorized API endpoints',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          scanTraffic: { type: 'boolean', default: true },
        },
        required: ['workspaceId'],
      },
    });

    this.registerTool({
      name: 'whitelist_endpoint',
      description: 'Add an endpoint to the shadow API whitelist',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'number' },
          endpoint: { type: 'string' },
          method: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['workspaceId', 'endpoint'],
      },
    });
  }

  /**
   * Register default DevPulse resources
   */
  private registerDefaultResources(): void {
    // Security resources
    this.registerResource({
      uri: 'devpulse://workspace/{id}/overview',
      name: 'Workspace Overview',
      description: 'Overview of a workspace including risk score and recent vulnerabilities',
      mimeType: 'application/json',
    });

    this.registerResource({
      uri: 'devpulse://workspace/{id}/vulnerabilities',
      name: 'Vulnerability List',
      description: 'List of all vulnerabilities in a workspace',
      mimeType: 'application/json',
    });

    this.registerResource({
      uri: 'devpulse://workspace/{id}/risk-history',
      name: 'Risk Score History',
      description: 'Historical risk score data',
      mimeType: 'application/json',
    });

    this.registerResource({
      uri: 'devpulse://workspace/{id}/llm-costs',
      name: 'LLM Cost Summary',
      description: 'LLM cost summary and breakdown',
      mimeType: 'application/json',
    });

    this.registerResource({
      uri: 'devpulse://workspace/{id}/compliance/{framework}',
      name: 'Compliance Status',
      description: 'Compliance status for a specific framework',
      mimeType: 'application/json',
    });

    this.registerResource({
      uri: 'devpulse://workspace/{id}/agents',
      name: 'Agent List',
      description: 'List of monitored agents with their status',
      mimeType: 'application/json',
    });

    this.registerResource({
      uri: 'devpulse://workspace/{id}/shadow-apis',
      name: 'Shadow API Detections',
      description: 'Detected shadow/unauthorized APIs',
      mimeType: 'application/json',
    });
  }

  /**
   * Register default DevPulse prompts
   */
  private registerDefaultPrompts(): void {
    this.registerPrompt({
      name: 'security_review',
      description: 'Generate a security review for API endpoints',
      arguments: [
        { name: 'workspaceId', description: 'Workspace ID', required: true },
        { name: 'focus', description: 'Focus area (vulnerabilities, compliance, costs)', required: false },
      ],
    });

    this.registerPrompt({
      name: 'cost_analysis',
      description: 'Generate LLM cost analysis with recommendations',
      arguments: [
        { name: 'workspaceId', description: 'Workspace ID', required: true },
        { name: 'period', description: 'Time period (day, week, month)', required: false },
      ],
    });

    this.registerPrompt({
      name: 'compliance_summary',
      description: 'Generate a compliance summary for multiple frameworks',
      arguments: [
        { name: 'workspaceId', description: 'Workspace ID', required: true },
        { name: 'frameworks', description: 'Comma-separated list of frameworks', required: true },
      ],
    });
  }

  /**
   * Register a tool
   */
  registerTool(tool: McpTool): void {
    this.tools.set(tool.name, tool);
    this.emit('toolRegistered', tool);
  }

  /**
   * Register a resource
   */
  registerResource(resource: McpResource): void {
    this.resources.set(resource.uri, resource);
    this.emit('resourceRegistered', resource);
  }

  /**
   * Register a prompt
   */
  registerPrompt(prompt: McpPrompt): void {
    this.prompts.set(prompt.name, prompt);
    this.emit('promptRegistered', prompt);
  }

  /**
   * Handle incoming message from client
   */
  async handleMessage(message: McpMessage): Promise<McpMessage | null> {
    const { method, id, params } = message;
    const messageId = id ?? `auto-${Date.now()}`;

    switch (method) {
      case 'initialize':
        this.initialized = true;
        this.emit('clientInitialized', params);
        return {
          jsonrpc: '2.0',
          id: messageId,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: this.capabilities,
            serverInfo: {
              name: 'devpulse',
              version: '1.0.0',
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: messageId,
          result: {
            tools: Array.from(this.tools.values()),
          },
        };

      case 'tools/call':
        return await this.handleToolCall(params, messageId);

      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id: messageId,
          result: {
            resources: Array.from(this.resources.values()),
          },
        };

      case 'resources/read':
        return await this.handleResourceRead(params, messageId);

      case 'prompts/list':
        return {
          jsonrpc: '2.0',
          id: messageId,
          result: {
            prompts: Array.from(this.prompts.values()),
          },
        };

      case 'prompts/get':
        return await this.handlePromptGet(params, messageId);

      default:
        return {
          jsonrpc: '2.0',
          id: messageId,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  }

  /**
   * Handle tool call
   */
  private async handleToolCall(params: any, id: string | number): Promise<McpMessage> {
    try {
      const { name, arguments: args } = params;
      const tool = this.tools.get(name);

      if (!tool) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Unknown tool: ${name}`,
          },
        };
      }

      // Execute the tool
      const result = await this.executeTool(name, args);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${message}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  /**
   * Execute a tool
   */
  private async executeTool(name: string, args: any): Promise<any> {
    // This would integrate with the actual DevPulse services
    switch (name) {
      case 'security_scan':
        return { scanId: 123, status: 'started', message: 'Security scan initiated' };
      case 'check_vulnerability':
        return { vulnerable: false, confidence: 0.95 };
      case 'get_risk_score':
        return { score: 72, tier: 'medium', trend: 'improving' };
      case 'list_vulnerabilities':
        return { count: 0, vulnerabilities: [] };
      case 'get_llm_cost':
        return { totalCost: 12.34, period: args.period || 'day' };
      case 'get_cost_breakdown':
        return { breakdown: [] };
      case 'set_cost_budget':
        return { success: true };
      case 'check_compliance':
        return { compliant: true, score: 95 };
      case 'generate_compliance_report':
        return { reportId: 'report-123', status: 'generating' };
      case 'list_agents':
        return { agents: [] };
      case 'pause_agent':
        return { success: true, agentId: args.agentId };
      case 'resume_agent':
        return { success: true, agentId: args.agentId };
      case 'detect_shadow_apis':
        return { detected: 0, endpoints: [] };
      case 'whitelist_endpoint':
        return { success: true };
      default:
        throw new Error(`Tool not implemented: ${name}`);
    }
  }

  /**
   * Handle resource read
   */
  private async handleResourceRead(params: any, id: string | number): Promise<McpMessage> {
    try {
      const { uri } = params;
      const resource = this.resources.get(uri);

      if (!resource) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Unknown resource: ${uri}`,
          },
        };
      }

      // Read the resource
      const content = await this.readResource(uri);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: resource.mimeType,
              text: JSON.stringify(content, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Resource error: ${message}`,
        },
      };
    }
  }

  /**
   * Read a resource
   */
  private async readResource(uri: string): Promise<any> {
    // Parse URI and fetch data
    const match = uri.match(/devpulse:\/\/workspace\/(\d+)\/(\w+)/);
    if (!match) {
      throw new Error('Invalid resource URI');
    }

    const [, workspaceId, resourceType] = match;

    switch (resourceType) {
      case 'overview':
        return { workspaceId, riskScore: 72, lastScan: '2024-01-15' };
      case 'vulnerabilities':
        return { count: 0, vulnerabilities: [] };
      case 'risk-history':
        return { history: [] };
      case 'llm-costs':
        return { totalCost: 0 };
      case 'agents':
        return { agents: [] };
      case 'shadow-apis':
        return { detected: 0 };
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }

  /**
   * Handle prompt get
   */
  private async handlePromptGet(params: any, id: string | number): Promise<McpMessage> {
    try {
      const { name, arguments: args } = params;
      const prompt = this.prompts.get(name);

      if (!prompt) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Unknown prompt: ${name}`,
          },
        };
      }

      // Generate prompt content
      const content = await this.generatePrompt(name, args);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: content,
              },
            },
          ],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Prompt error: ${message}`,
        },
      };
    }
  }

  /**
   * Generate prompt content
   */
  private async generatePrompt(name: string, args: any): Promise<string> {
    switch (name) {
      case 'security_review':
        return `Generate a security review for DevPulse workspace ${args.workspaceId}. Focus: ${args.focus || 'all'}.`;
      case 'cost_analysis':
        return `Analyze LLM costs for DevPulse workspace ${args.workspaceId}. Period: ${args.period || 'day'}.`;
      case 'compliance_summary':
        return `Generate compliance summary for frameworks: ${args.frameworks}.`;
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  /**
   * Register a client connection
   */
  addClient(client: McpClient): void {
    this.clients.add(client);
    client.onMessage((msg) => this.handleMessage(msg));
    client.onError((err) => this.emit('clientError', err));
    this.emit('clientConnected', client);
  }

  /**
   * Remove a client connection
   */
  removeClient(client: McpClient): void {
    this.clients.delete(client);
    client.close();
    this.emit('clientDisconnected', client);
  }

  /**
   * Broadcast message to all clients
   */
  async broadcast(message: McpMessage): Promise<void> {
    const promises = Array.from(this.clients).map(client => 
      client.send(message).catch(err => {
        console.error('[MCP] Broadcast error:', err);
        this.removeClient(client);
      })
    );
    await Promise.all(promises);
  }

  /**
   * Notify clients of tool changes
   */
  notifyToolsChanged(): void {
    this.broadcast({
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
    });
  }

  /**
   * Notify clients of resource changes
   */
  notifyResourcesChanged(): void {
    this.broadcast({
      jsonrpc: '2.0',
      method: 'notifications/resources/list_changed',
    });
  }
}

// Singleton instance
let mcpServer: DevPulseMcpServer | null = null;

export function getMcpServer(): DevPulseMcpServer {
  if (!mcpServer) {
    mcpServer = new DevPulseMcpServer();
  }
  return mcpServer;
}

export function initializeMcpServer(): DevPulseMcpServer {
  if (!mcpServer) {
    mcpServer = new DevPulseMcpServer();
  }
  return mcpServer;
}

// Export types (already exported via interface declarations above)
