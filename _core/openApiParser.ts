/**
 * OpenAPI/Swagger Parser — DevPulse
 * ==================================
 * Parse OpenAPI 3.0/3.1 and Swagger 2.0 specifications
 * 
 * Supports:
 * - OpenAPI 3.0.x
 * - OpenAPI 3.1.x
 * - Swagger 2.0 (with automatic conversion)
 */

export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    description?: string;
    version: string;
    contact?: { name?: string; email?: string; url?: string };
    license?: { name: string; url?: string };
  };
  servers?: Array<{ url: string; description?: string }>;
  host?: string; // Swagger 2.0
  basePath?: string; // Swagger 2.0
  schemes?: string[]; // Swagger 2.0
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, SecurityScheme>;
    parameters?: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description?: string }>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  trace?: Operation;
  parameters?: Parameter[];
  summary?: string;
  description?: string;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: any;
  type?: string; // Swagger 2.0
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: any; example?: any }>;
}

export interface Response {
  description: string;
  content?: Record<string, { schema: any }>;
  headers?: Record<string, any>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'basic'; // basic is Swagger 2.0
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface ParsedOpenApiEndpoint {
  id: string;
  operationId?: string;
  method: string;
  path: string;
  url: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: Parameter[];
  hasRequestBody: boolean;
  security: string[];
  deprecated: boolean;
  responses: string[];
}

export interface ParsedOpenApiSpec {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  endpoints: ParsedOpenApiEndpoint[];
  totalEndpoints: number;
  methods: string[];
  tags: string[];
  securitySchemes: string[];
  hasAuthentication: boolean;
  isSwagger2: boolean;
  exposedSecrets: Array<{ type: string; location: string; severity: string }>;
}

/**
 * Detect secrets in OpenAPI spec
 */
function detectSecrets(spec: any): Array<{ type: string; location: string; severity: string }> {
  const secrets: Array<{ type: string; location: string; severity: string }> = [];
  const specString = JSON.stringify(spec);

  const patterns = [
    { regex: /sk-[a-zA-Z0-9]{32,}/, type: 'OpenAI API Key', severity: 'critical' },
    { regex: /sk_live_[a-zA-Z0-9]{24,}/, type: 'Stripe Live Key', severity: 'critical' },
    { regex: /AKIA[A-Z0-9]{16}/, type: 'AWS Access Key', severity: 'critical' },
    { regex: /ghp_[a-zA-Z0-9]{36}/, type: 'GitHub PAT', severity: 'high' },
    { regex: /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, type: 'Slack Bot Token', severity: 'high' },
    { regex: /Bearer\s+[a-zA-Z0-9._-]{40,}/, type: 'Hardcoded Bearer Token', severity: 'high' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(specString)) {
      secrets.push({
        type: pattern.type,
        location: 'OpenAPI Specification',
        severity: pattern.severity,
      });
    }
  }

  return secrets;
}

/**
 * Get base URL from spec
 */
function getBaseUrl(spec: OpenApiSpec): string {
  // OpenAPI 3.x
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url;
  }

  // Swagger 2.0
  if (spec.host) {
    const scheme = spec.schemes?.[0] || 'https';
    const basePath = spec.basePath || '';
    return `${scheme}://${spec.host}${basePath}`;
  }

  return 'https://api.example.com';
}

/**
 * Get security scheme names from operation or global
 */
function getSecuritySchemes(operation: Operation | undefined, globalSecurity: Array<Record<string, string[]>> | undefined): string[] {
  const security = operation?.security || globalSecurity || [];
  const schemes: string[] = [];
  
  for (const secReq of security) {
    schemes.push(...Object.keys(secReq));
  }
  
  return [...new Set(schemes)];
}

/**
 * Parse OpenAPI specification
 */
export function parseOpenApiSpec(spec: OpenApiSpec): ParsedOpenApiSpec {
  const isSwagger2 = !!spec.swagger;
  const baseUrl = getBaseUrl(spec);
  const endpoints: ParsedOpenApiEndpoint[] = [];
  const methods = new Set<string>();
  const tags = new Set<string>();
  const securitySchemeNames = new Set<string>();

  // Collect security scheme names
  const securitySchemes = spec.components?.securitySchemes || 
    (spec as any).securityDefinitions || // Swagger 2.0
    {};
  
  for (const name of Object.keys(securitySchemes)) {
    securitySchemeNames.add(name);
  }

  // Parse paths
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

    for (const method of httpMethods) {
      const operation = pathItem[method];
      if (!operation) continue;

      methods.add(method.toUpperCase());

      // Collect tags
      for (const tag of operation.tags || []) {
        tags.add(tag);
      }

      // Merge path-level and operation-level parameters
      const allParameters = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
      ];

      // Get security schemes
      const opSecurity = getSecuritySchemes(operation, spec.security);
      for (const scheme of opSecurity) {
        securitySchemeNames.add(scheme);
      }

      const endpoint: ParsedOpenApiEndpoint = {
        id: `${method}-${path}`.replace(/[^a-zA-Z0-9]/g, '-'),
        operationId: operation.operationId,
        method: method.toUpperCase(),
        path,
        url: `${baseUrl}${path}`,
        summary: operation.summary,
        description: operation.description,
        tags: operation.tags || [],
        parameters: allParameters,
        hasRequestBody: !!operation.requestBody || 
          allParameters.some(p => (p as any).in === 'body'), // Swagger 2.0
        security: opSecurity,
        deprecated: operation.deprecated || false,
        responses: Object.keys(operation.responses || {}),
      };

      endpoints.push(endpoint);
    }
  }

  // Collect all tags from spec.tags
  for (const tag of spec.tags || []) {
    tags.add(tag.name);
  }

  return {
    title: spec.info.title,
    version: spec.info.version,
    description: spec.info.description,
    baseUrl,
    endpoints,
    totalEndpoints: endpoints.length,
    methods: Array.from(methods),
    tags: Array.from(tags),
    securitySchemes: Array.from(securitySchemeNames),
    hasAuthentication: securitySchemeNames.size > 0,
    isSwagger2,
    exposedSecrets: detectSecrets(spec),
  };
}

/**
 * Convert OpenAPI spec to DevPulse scan items
 */
export function openApiToScanItems(parsed: ParsedOpenApiSpec): Array<{
  endpoint: string;
  method: string;
  headers: Record<string, string>;
}> {
  return parsed.endpoints.map(ep => ({
    endpoint: ep.url,
    method: ep.method,
    headers: ep.parameters
      .filter(p => p.in === 'header' && p.required)
      .reduce((acc, p) => ({ ...acc, [p.name]: `{{${p.name}}}` }), {}),
  }));
}

/**
 * Parse JSON or YAML OpenAPI spec
 */
export function parseOpenApiString(content: string): OpenApiSpec {
  // Try JSON first
  try {
    return JSON.parse(content);
  } catch {
    // Try YAML (basic parsing for common YAML structures)
    // For production, use a proper YAML parser like js-yaml
    throw new Error('YAML parsing not implemented. Please provide JSON format or install js-yaml.');
  }
}

/**
 * OpenApiParser class for static method access
 */
export class OpenApiParser {
  static parse(spec: OpenApiSpec): ParsedOpenApiSpec {
    return parseOpenApiSpec(spec);
  }

  static parseString(content: string): ParsedOpenApiSpec {
    const spec = parseOpenApiString(content);
    return parseOpenApiSpec(spec);
  }

  static toScanItems(parsed: ParsedOpenApiSpec) {
    return openApiToScanItems(parsed);
  }

  /**
   * Quick validation without full analysis
   */
  static quickParse(content: string): {
    valid: boolean;
    title?: string;
    version?: string;
    endpointCount: number;
    isSwagger2: boolean;
    error?: string;
  } {
    try {
      const spec = parseOpenApiString(content);
      const parsed = parseOpenApiSpec(spec);
      return {
        valid: true,
        title: parsed.title,
        version: parsed.version,
        endpointCount: parsed.totalEndpoints,
        isSwagger2: parsed.isSwagger2,
      };
    } catch (err: any) {
      return {
        valid: false,
        endpointCount: 0,
        isSwagger2: false,
        error: err.message,
      };
    }
  }

  /**
   * Detect OpenAPI version
   */
  static detectVersion(spec: any): '3.1' | '3.0' | '2.0' | 'unknown' {
    if (spec.openapi?.startsWith('3.1')) return '3.1';
    if (spec.openapi?.startsWith('3.0')) return '3.0';
    if (spec.swagger === '2.0') return '2.0';
    return 'unknown';
  }

  /**
   * Extract all security requirements
   */
  static extractSecurityRequirements(spec: OpenApiSpec): Array<{
    name: string;
    type: string;
    in?: string;
    scheme?: string;
  }> {
    const schemes = spec.components?.securitySchemes || 
      (spec as any).securityDefinitions || {};
    
    return Object.entries(schemes).map(([name, scheme]: [string, any]) => ({
      name,
      type: scheme.type,
      in: scheme.in,
      scheme: scheme.scheme,
    }));
  }
}
