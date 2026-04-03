/**
 * Bruno Collection Parser — DevPulse
 * ===================================
 * Parse Bruno .bru files and collection directories
 * 
 * Bruno is the fastest-growing Postman alternative.
 * File format: .bru (BRU markup language)
 */

export interface BrunoRequest {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: {
    mode: 'json' | 'xml' | 'text' | 'formdata' | 'urlencoded' | 'graphql' | 'none';
    content?: string;
    formdata?: Array<{ key: string; value: string; enabled: boolean }>;
    urlencoded?: Array<{ key: string; value: string; enabled: boolean }>;
  };
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'awsv4' | 'oauth2' | 'apikey';
    basic?: { username: string; password: string };
    bearer?: { token: string };
    apikey?: { key: string; value: string; in: 'header' | 'query' };
  };
  vars?: {
    req?: Array<{ name: string; value: string; enabled: boolean }>;
    res?: Array<{ name: string; value: string; enabled: boolean }>;
  };
  script?: {
    req?: string;
    res?: string;
  };
  tests?: string;
  docs?: string;
}

export interface BrunoCollection {
  name: string;
  version: string;
  type: 'collection';
  requests: BrunoRequest[];
  environments: BrunoEnvironment[];
  folders: BrunoFolder[];
}

export interface BrunoFolder {
  name: string;
  requests: BrunoRequest[];
  folders: BrunoFolder[];
}

export interface BrunoEnvironment {
  name: string;
  variables: Array<{ name: string; value: string; enabled: boolean; secret: boolean }>;
}

export interface ParsedBrunoEndpoint {
  id: string;
  name: string;
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  auth?: BrunoRequest['auth'];
  hasBody: boolean;
  folderPath: string[];
  rawContent: string;
}

export interface ParsedBrunoCollection {
  name: string;
  endpoints: ParsedBrunoEndpoint[];
  totalEndpoints: number;
  methods: string[];
  folders: string[];
  environments: string[];
  hasSecrets: boolean;
  exposedSecrets: Array<{ type: string; location: string; severity: string }>;
}

/**
 * Parse a single .bru file content
 */
export function parseBruFile(content: string, fileName: string): BrunoRequest {
  const request: BrunoRequest = {
    name: fileName.replace('.bru', ''),
    method: 'GET',
    url: '',
    headers: {},
  };

  const lines = content.split('\n');
  let currentBlock: string | null = null;
  let blockContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Block start
    if (trimmed.match(/^(meta|get|post|put|patch|delete|options|head)\s*\{$/i)) {
      currentBlock = trimmed.replace(/\s*\{$/, '').toLowerCase();
      blockContent = [];
      continue;
    }

    // Method detection
    if (trimmed.match(/^(get|post|put|patch|delete|options|head)\s*\{$/i)) {
      request.method = trimmed.replace(/\s*\{$/, '').toUpperCase();
      currentBlock = 'request';
      blockContent = [];
      continue;
    }

    // Block end
    if (trimmed === '}') {
      if (currentBlock === 'request' || ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(currentBlock || '')) {
        // Parse URL from block content
        for (const blockLine of blockContent) {
          const urlMatch = blockLine.match(/^\s*url:\s*(.+)$/);
          if (urlMatch) {
            request.url = urlMatch[1].trim();
          }
        }
      } else if (currentBlock === 'headers') {
        for (const blockLine of blockContent) {
          const headerMatch = blockLine.match(/^\s*(.+?):\s*(.+)$/);
          if (headerMatch) {
            request.headers[headerMatch[1].trim()] = headerMatch[2].trim();
          }
        }
      } else if (currentBlock === 'body:json') {
        request.body = {
          mode: 'json',
          content: blockContent.join('\n'),
        };
      } else if (currentBlock === 'auth:basic') {
        request.auth = { type: 'basic', basic: { username: '', password: '' } };
        for (const blockLine of blockContent) {
          const usernameMatch = blockLine.match(/^\s*username:\s*(.+)$/);
          const passwordMatch = blockLine.match(/^\s*password:\s*(.+)$/);
          if (usernameMatch && request.auth.basic) {
            request.auth.basic.username = usernameMatch[1].trim();
          }
          if (passwordMatch && request.auth.basic) {
            request.auth.basic.password = passwordMatch[1].trim();
          }
        }
      } else if (currentBlock === 'auth:bearer') {
        request.auth = { type: 'bearer', bearer: { token: '' } };
        for (const blockLine of blockContent) {
          const tokenMatch = blockLine.match(/^\s*token:\s*(.+)$/);
          if (tokenMatch && request.auth.bearer) {
            request.auth.bearer.token = tokenMatch[1].trim();
          }
        }
      }
      currentBlock = null;
      blockContent = [];
      continue;
    }

    // Block header detection
    if (trimmed === 'headers {') {
      currentBlock = 'headers';
      blockContent = [];
      continue;
    }

    if (trimmed === 'body:json {') {
      currentBlock = 'body:json';
      blockContent = [];
      continue;
    }

    if (trimmed === 'auth:basic {') {
      currentBlock = 'auth:basic';
      blockContent = [];
      continue;
    }

    if (trimmed === 'auth:bearer {') {
      currentBlock = 'auth:bearer';
      blockContent = [];
      continue;
    }

    // Collect block content
    if (currentBlock) {
      blockContent.push(line);
    }
  }

  return request;
}

/**
 * Extract path from URL
 */
function extractPath(url: string): string {
  try {
    // Handle variable placeholders
    const cleanUrl = url.replace(/\{\{[^}]+\}\}/g, 'placeholder');
    const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://example.com${cleanUrl}`);
    return urlObj.pathname;
  } catch {
    // If URL parsing fails, try to extract path manually
    const pathMatch = url.match(/(?:https?:\/\/[^/]+)?(\/.*)$/);
    return pathMatch ? pathMatch[1].split('?')[0] : url;
  }
}

/**
 * Detect exposed secrets in Bruno content
 */
function detectSecrets(content: string, location: string): Array<{ type: string; location: string; severity: string }> {
  const secrets: Array<{ type: string; location: string; severity: string }> = [];
  
  const patterns = [
    { regex: /sk-[a-zA-Z0-9]{32,}/, type: 'OpenAI API Key', severity: 'critical' },
    { regex: /sk_live_[a-zA-Z0-9]{24,}/, type: 'Stripe Live Key', severity: 'critical' },
    { regex: /AKIA[A-Z0-9]{16}/, type: 'AWS Access Key', severity: 'critical' },
    { regex: /ghp_[a-zA-Z0-9]{36}/, type: 'GitHub PAT', severity: 'high' },
    { regex: /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, type: 'Slack Bot Token', severity: 'high' },
    { regex: /rzp_live_[a-zA-Z0-9]{14}/, type: 'Razorpay Live Key', severity: 'critical' },
    { regex: /Bearer\s+[a-zA-Z0-9._-]{20,}/, type: 'Bearer Token', severity: 'medium' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) {
      secrets.push({
        type: pattern.type,
        location,
        severity: pattern.severity,
      });
    }
  }

  return secrets;
}

/**
 * Parse Bruno collection from directory contents
 */
export function parseBrunoCollection(
  files: Array<{ name: string; content: string; path: string }>,
  collectionName: string = 'Bruno Collection'
): ParsedBrunoCollection {
  const endpoints: ParsedBrunoEndpoint[] = [];
  const methods = new Set<string>();
  const folders = new Set<string>();
  const environments = new Set<string>();
  const allSecrets: Array<{ type: string; location: string; severity: string }> = [];

  for (const file of files) {
    if (!file.name.endsWith('.bru')) continue;

    // Parse folder path from file path
    const pathParts = file.path.split(/[/\\]/);
    const folderPath = pathParts.slice(0, -1);
    
    if (folderPath.length > 0) {
      folders.add(folderPath.join(' > '));
    }

    // Check for environment files
    if (file.name.includes('environment') || file.path.includes('environments')) {
      environments.add(file.name.replace('.bru', ''));
      continue;
    }

    // Parse request file
    const request = parseBruFile(file.content, file.name);
    methods.add(request.method);

    // Detect secrets
    const secrets = detectSecrets(file.content, file.path);
    allSecrets.push(...secrets);

    endpoints.push({
      id: `${collectionName}-${file.path}`.replace(/[^a-zA-Z0-9]/g, '-'),
      name: request.name,
      method: request.method,
      url: request.url,
      path: extractPath(request.url),
      headers: request.headers,
      auth: request.auth,
      hasBody: !!request.body,
      folderPath,
      rawContent: file.content,
    });
  }

  return {
    name: collectionName,
    endpoints,
    totalEndpoints: endpoints.length,
    methods: Array.from(methods),
    folders: Array.from(folders),
    environments: Array.from(environments),
    hasSecrets: allSecrets.length > 0,
    exposedSecrets: allSecrets,
  };
}

/**
 * Convert Bruno collection to DevPulse scan items
 */
export function brunoToScanItems(collection: ParsedBrunoCollection): Array<{
  endpoint: string;
  method: string;
  headers: Record<string, string>;
}> {
  return collection.endpoints.map(ep => ({
    endpoint: ep.url || ep.path,
    method: ep.method,
    headers: ep.headers,
  }));
}

/**
 * BrunoParser class for static method access
 */
export class BrunoParser {
  static parseFile(content: string, fileName: string): BrunoRequest {
    return parseBruFile(content, fileName);
  }

  static parseCollection(
    files: Array<{ name: string; content: string; path: string }>,
    collectionName?: string
  ): ParsedBrunoCollection {
    return parseBrunoCollection(files, collectionName);
  }

  static toScanItems(collection: ParsedBrunoCollection) {
    return brunoToScanItems(collection);
  }

  /**
   * Quick parse for validation without full analysis
   */
  static quickParse(files: Array<{ name: string; content: string; path: string }>): {
    valid: boolean;
    endpointCount: number;
    methods: string[];
    error?: string;
  } {
    try {
      const collection = parseBrunoCollection(files);
      return {
        valid: true,
        endpointCount: collection.totalEndpoints,
        methods: collection.methods,
      };
    } catch (err: any) {
      return {
        valid: false,
        endpointCount: 0,
        methods: [],
        error: err.message,
      };
    }
  }
}
