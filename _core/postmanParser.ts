/**
 * Postman Collection Parser — DevPulse
 * =====================================
 * Comprehensive Postman collection analysis for security scanning
 * 
 * Features:
 * - Recursive collection/folder parsing
 * - Environment variable resolution ({{variable}} handling)
 * - Auth type detection (Bearer, Basic, API Key, OAuth2, etc.)
 * - Endpoint extraction with full metadata
 * - Secret/credential detection (AWS, Stripe, GitHub, OpenAI, etc.)
 * - Query parameter and header extraction
 * - Request body analysis (raw, formdata, urlencoded, graphql)
 * - Static security analysis (HTTP/HTTPS, auth, sensitive paths)
 * - API documentation generation
 * - Quick parse mode for fast import
 */

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema?: string;
  };
  item?: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

export interface PostmanItem {
  name: string;
  description?: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
  response?: any[];
  event?: any[];
}

export interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl | string;
  description?: string;
  auth?: PostmanAuth;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode?: 'formdata' | 'raw' | 'urlencoded' | 'file' | 'graphql';
  raw?: string;
  formdata?: Array<{ key: string; value: string; disabled?: boolean }>;
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
  graphql?: { query: string; variables?: Record<string, any> };
  file?: { src: string };
}

export interface PostmanAuth {
  type: string;
  basic?: Array<{ key: string; value: string }>;
  bearer?: Array<{ key: string; value: string }>;
  apikey?: Array<{ key: string; value: string; in: string }>;
  oauth2?: Array<{ key: string; value: string }>;
  digest?: Array<{ key: string; value: string }>;
  ntlm?: Array<{ key: string; value: string }>;
}

export interface PostmanVariable {
  key: string;
  value?: any;
  type?: string;
}

export interface PostmanQueryParam {
  key: string;
  value?: string;
  disabled?: boolean;
  description?: string;
}

export interface ParsedEndpoint {
  id: string;
  name: string;
  method: string;
  url: string;
  baseUrl: string;
  path: string;
  description?: string;
  
  // Security
  auth?: {
    type: string;
    location?: string;
    hasCredentials: boolean;
  };
  
  // Headers
  headers: Record<string, string>;
  sensitiveHeaders: string[];
  
  // Body
  hasBody: boolean;
  bodyType?: string;
  bodyPreview?: string;
  
  // Query
  queryParams: Array<{ name: string; value?: string }>;
  
  // Path variables
  pathVariables: Array<{ key: string; value?: string }>;
  
  // Metadata
  folder?: string;
  folderPath?: string[];
  deprecated?: boolean;
  tags?: string[];
  
  // Detected secrets
  exposedSecrets: Array<{ type: string; location: string; value?: string; severity: string }>;
  
  // Static analysis
  securityIssues: Array<{
    issue: string;
    riskLevel: string;
    recommendation: string;
    source: string;
  }>;
  
  // Scannable flag
  isScannable: boolean;
  unresolvedVariables: string[];
}

export interface ParsedCollection {
  name: string;
  description?: string;
  url?: string;
  schema?: string;
  endpoints: ParsedEndpoint[];
  totalEndpoints: number;
  exposedSecrets: Array<{ type: string; count: number; locations: string[] }>;
  authTypes: string[];
  methods: string[];
  folders: string[];
  variables: PostmanVariable[];
  secretsExposedCount: number;
  endpointsWithSecrets: number;
  scannableUrls: string[];
  summary: {
    criticalSecrets: number;
    highSecrets: number;
    mediumSecrets: number;
    lowSecrets: number;
    totalScannableUrls: number;
    methodsDistribution: Record<string, number>;
  };
}

export interface QuickParseResult {
  valid: boolean;
  name: string;
  totalEndpoints: number;
  error?: string;
}

// ─── Variable Resolution ─────────────────────────────────────────────────────

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Extract variables defined at the collection level
 */
export function extractCollectionVariables(collectionJson: PostmanCollection): Record<string, string> {
  const variables: Record<string, string> = {};
  
  const rawVars = collectionJson.variable;
  if (Array.isArray(rawVars)) {
    for (const v of rawVars) {
      const key = v.key || '';
      const value = v.value !== undefined ? String(v.value) : '';
      if (key) {
        variables[key] = value;
      }
    }
  } else if (rawVars && typeof rawVars === 'object') {
    for (const [key, value] of Object.entries(rawVars as Record<string, any>)) {
      variables[key] = String(value);
    }
  }
  
  return variables;
}

/**
 * Replace {{variable}} placeholders with known values
 * Returns the resolved string and a list of unresolved variable names
 */
export function resolveVariables(
  text: string,
  variables: Record<string, string>
): { resolved: string; unresolved: string[] } {
  if (!text || !text.includes('{{')) {
    return { resolved: text, unresolved: [] };
  }
  
  const unresolved: string[] = [];
  
  const resolved = text.replace(VARIABLE_PATTERN, (match, varName) => {
    const key = varName.trim();
    if (variables[key] !== undefined) {
      return variables[key];
    }
    unresolved.push(key);
    return match; // Keep original {{varName}}
  });
  
  return { resolved, unresolved };
}

/**
 * Extract and resolve a URL from a Postman URL object or string
 */
export function resolveUrl(
  urlObj: PostmanUrl | string,
  variables: Record<string, string>
): { resolved: string; unresolved: string[] } {
  if (typeof urlObj === 'string') {
    return resolveVariables(urlObj, variables);
  }
  
  if (urlObj.raw) {
    return resolveVariables(urlObj.raw, variables);
  }
  
  // Reconstruct from parts
  const protocol = urlObj.protocol || 'https';
  const hostParts = urlObj.host || [];
  const host = Array.isArray(hostParts) ? hostParts.join('.') : String(hostParts);
  const pathParts = urlObj.path || [];
  const path = Array.isArray(pathParts) ? pathParts.join('/') : String(pathParts);
  
  // Query parameters
  const queryParts: string[] = [];
  for (const q of urlObj.query || []) {
    if (!q.disabled) {
      const { resolved: kResolved, unresolved: kUnres } = resolveVariables(q.key || '', variables);
      const { resolved: vResolved, unresolved: vUnres } = resolveVariables(q.value || '', variables);
      if (kResolved) {
        queryParts.push(`${kResolved}=${vResolved}`);
      }
    }
  }
  const queryStr = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
  
  const reconstructed = `${protocol}://${host}/${path}${queryStr}`;
  return resolveVariables(reconstructed, variables);
}

/**
 * Resolve variables in header key-value pairs
 */
export function resolveHeaders(
  headers: PostmanHeader[],
  variables: Record<string, string>
): { resolved: PostmanHeader[]; unresolved: string[] } {
  const resolved: PostmanHeader[] = [];
  const allUnresolved: string[] = [];
  
  for (const h of headers) {
    const { resolved: kResolved, unresolved: kUnres } = resolveVariables(h.key || '', variables);
    const { resolved: vResolved, unresolved: vUnres } = resolveVariables(h.value || '', variables);
    allUnresolved.push(...kUnres, ...vUnres);
    resolved.push({
      key: kResolved,
      value: vResolved,
      disabled: h.disabled,
    });
  }
  
  return { resolved, unresolved: allUnresolved };
}

/**
 * Resolve variables in request body
 */
export function resolveBody(
  body: PostmanBody | undefined,
  variables: Record<string, string>
): { resolved: PostmanBody | undefined; unresolved: string[] } {
  if (!body) {
    return { resolved: body, unresolved: [] };
  }
  
  const allUnresolved: string[] = [];
  const resolved: PostmanBody = { ...body };
  
  const mode = body.mode || '';
  
  if (mode === 'raw' && body.raw) {
    const { resolved: r, unresolved: u } = resolveVariables(body.raw, variables);
    resolved.raw = r;
    allUnresolved.push(...u);
  } else if (mode === 'urlencoded' && body.urlencoded) {
    resolved.urlencoded = body.urlencoded.map(param => {
      const { resolved: kR, unresolved: kU } = resolveVariables(param.key || '', variables);
      const { resolved: vR, unresolved: vU } = resolveVariables(param.value || '', variables);
      allUnresolved.push(...kU, ...vU);
      return { ...param, key: kR, value: vR };
    });
  } else if (mode === 'formdata' && body.formdata) {
    resolved.formdata = body.formdata.map(param => {
      const { resolved: kR, unresolved: kU } = resolveVariables(param.key || '', variables);
      const { resolved: vR, unresolved: vU } = resolveVariables(param.value || '', variables);
      allUnresolved.push(...kU, ...vU);
      return { ...param, key: kR, value: vR };
    });
  } else if (mode === 'graphql' && body.graphql) {
    const { resolved: q, unresolved: qU } = resolveVariables(body.graphql.query || '', variables);
    const { resolved: v, unresolved: vU } = resolveVariables(JSON.stringify(body.graphql.variables || {}), variables);
    allUnresolved.push(...qU, ...vU);
    resolved.graphql = { 
      query: q, 
      variables: v ? JSON.parse(v) : {} 
    };
  }
  
  return { resolved, unresolved: allUnresolved };
}

// ─── Secret Detection Patterns ─────────────────────────────────────────────

interface SecretPattern {
  type: string;
  regex: RegExp;
  severity: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  { type: 'AWS_ACCESS_KEY_ID', regex: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
  { type: 'AWS_SECRET_ACCESS_KEY', regex: /(?:aws_secret_access_key|aws_secret)\s*[:=]\s*[A-Za-z0-9\/+=]{40}/, severity: 'critical' },
  { type: 'AWS_SESSION_TOKEN', regex: /ASIA[0-9A-Z]{16}[A-Za-z0-9\/+=]{100,}/, severity: 'critical' },
  
  // Stripe
  { type: 'STRIPE_SECRET_KEY', regex: /sk_live_[0-9a-zA-Z]{24,}/, severity: 'critical' },
  { type: 'STRIPE_RESTRICTED_KEY', regex: /rk_live_[0-9a-zA-Z]{24,}/, severity: 'critical' },
  { type: 'STRIPE_PUBLISHABLE_KEY', regex: /pk_live_[0-9a-zA-Z]{24,}/, severity: 'low' },
  
  // OpenAI
  { type: 'OPENAI_API_KEY', regex: /sk-[a-zA-Z0-9]{32,}/, severity: 'critical' },
  { type: 'OPENAI_ORG_KEY', regex: /org-[a-zA-Z0-9]{24,}/, severity: 'high' },
  
  // GitHub
  { type: 'GITHUB_TOKEN', regex: /ghp_[a-zA-Z0-9]{36,}/, severity: 'critical' },
  { type: 'GITHUB_PAT', regex: /github_pat_[a-zA-Z0-9]{22,}/, severity: 'critical' },
  { type: 'GITHUB_OAUTH', regex: /gho_[a-zA-Z0-9]{36,}/, severity: 'critical' },
  { type: 'GITHUB_IMM', regex: /gim_[a-zA-Z0-9]{36,}/, severity: 'high' },
  
  // GitLab
  { type: 'GITLAB_TOKEN', regex: /glpat-[a-zA-Z0-9-]{20,}/, severity: 'critical' },
  { type: 'GITLAB_CI_TOKEN', regex: /CI_JOB_TOKEN/, severity: 'high' },
  
  // Slack
  { type: 'SLACK_TOKEN', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9_-]{26,}/, severity: 'critical' },
  { type: 'SLACK_WEBHOOK', regex: /https:\/\/hooks\.slack\.com\/services\/[a-zA-Z0-9\/]{30,}/, severity: 'critical' },
  
  // Google
  { type: 'GOOGLE_API_KEY', regex: /AIza[0-9a-zA-Z\-_]{35}/, severity: 'critical' },
  { type: 'GOOGLE_OAUTH', regex: /[0-9]+-[a-zA-Z0-9_]{32}\.apps\.googleusercontent\.com/, severity: 'high' },
  
  // Firebase
  { type: 'FIREBASE_KEY', regex: /AIza[0-9a-zA-Z\-_]{35}/, severity: 'critical' },
  
  // Twilio
  { type: 'TWILIO_ACCOUNT_SID', regex: /AC[a-zA-Z0-9]{32}/, severity: 'high' },
  { type: 'TWILIO_AUTH_TOKEN', regex: /[a-zA-Z0-9]{32}/, severity: 'high' },
  
  // SendGrid
  { type: 'SENDGRID_API_KEY', regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, severity: 'critical' },
  
  // Mailgun
  { type: 'MAILGUN_API_KEY', regex: /key-[a-zA-Z0-9]{32}/, severity: 'critical' },
  
  // JWT Tokens
  { type: 'JWT_TOKEN', regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/, severity: 'high' },
  
  // Private Keys
  { type: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, severity: 'critical' },
  
  // Generic Secrets
  { type: 'BEARER_TOKEN', regex: /(?:bearer|authorization)\s*[:=]\s*([a-zA-Z0-9_\-\.]+)/i, severity: 'high' },
  { type: 'BASIC_AUTH', regex: /basic\s+([a-zA-Z0-9+\/]+=*)/i, severity: 'high' },
  { type: 'API_KEY_LITERAL', regex: /(?:api[_-]?key|apikey|api_secret)\s*[:=]\s*[^\s,}"\n]{8,}/i, severity: 'high' },
  { type: 'PASSWORD_LITERAL', regex: /(?:password|passwd|pwd|secret)\s*[:=]\s*[^\s,}"\n]{4,}/i, severity: 'high' },
];

/**
 * Detect secrets in a string
 */
export function detectSecretsInString(
  text: string,
  location: string
): Array<{ type: string; location: string; value?: string; severity: string }> {
  const secrets: Array<{ type: string; location: string; value?: string; severity: string }> = [];
  
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(text)) {
      // For high/critical patterns, don't include the actual value
      const value = ['high', 'critical'].includes(pattern.severity) ? '[REDACTED]' : undefined;
      secrets.push({
        type: pattern.type,
        location,
        value,
        severity: pattern.severity,
      });
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0;
    }
  }
  
  return secrets;
}

/**
 * Detect secrets in headers
 */
export function detectSecretsInHeaders(
  headers: PostmanHeader[],
  location: string
): Array<{ type: string; location: string; value?: string; severity: string }> {
  const secrets: Array<{ type: string; location: string; value?: string; severity: string }> = [];
  
  for (const h of headers) {
    if (h.disabled) continue;
    const headerStr = `${h.key}: ${h.value}`;
    const found = detectSecretsInString(headerStr, `${location} > header '${h.key}'`);
    secrets.push(...found);
  }
  
  return secrets;
}

/**
 * Detect secrets in body
 */
export function detectSecretsInBody(
  body: PostmanBody | undefined,
  location: string
): Array<{ type: string; location: string; value?: string; severity: string }> {
  if (!body) return [];
  const secrets: Array<{ type: string; location: string; value?: string; severity: string }> = [];
  
  if (body.raw) {
    secrets.push(...detectSecretsInString(body.raw, `${location} > body`));
  }
  
  if (body.urlencoded) {
    for (const p of body.urlencoded) {
      secrets.push(...detectSecretsInString(`${p.key}=${p.value}`, `${location} > urlencoded`));
    }
  }
  
  if (body.formdata) {
    for (const p of body.formdata) {
      secrets.push(...detectSecretsInString(`${p.key}=${p.value}`, `${location} > formdata`));
    }
  }
  
  if (body.graphql) {
    const gqlStr = JSON.stringify(body.graphql);
    secrets.push(...detectSecretsInString(gqlStr, `${location} > graphql`));
  }
  
  return secrets;
}

/**
 * Detect secrets in auth
 */
export function detectSecretsInAuth(
  auth: PostmanAuth | undefined,
  location: string
): Array<{ type: string; location: string; value?: string; severity: string }> {
  if (!auth) return [];
  const secrets: Array<{ type: string; location: string; value?: string; severity: string }> = [];
  
  if (auth.basic) {
    for (const b of auth.basic) {
      secrets.push(...detectSecretsInString(`${b.key}=${b.value}`, `${location} > basic auth`));
    }
  }
  
  if (auth.bearer) {
    for (const b of auth.bearer) {
      secrets.push(...detectSecretsInString(`${b.key}=${b.value}`, `${location} > bearer auth`));
    }
  }
  
  if (auth.apikey) {
    for (const a of auth.apikey) {
      secrets.push(...detectSecretsInString(`${a.key}=${a.value}`, `${location} > apikey auth`));
    }
  }
  
  if (auth.oauth2) {
    for (const o of auth.oauth2) {
      secrets.push(...detectSecretsInString(`${o.key}=${o.value}`, `${location} > oauth2`));
    }
  }
  
  return secrets;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function deduplicateFindings(
  findings: Array<{ type: string; location: string; value?: string; severity: string }>
): Array<{ type: string; location: string; value?: string; severity: string }> {
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.type}:${f.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Static Security Analysis ────────────────────────────────────────────────

const SENSITIVE_PATH_PATTERNS = [
  '/admin', '/internal', '/debug', '/config', '/secret', '/password',
  '/token', '/auth', '/login', '/signup', '/register', '/api/v1/admin',
  '/.env', '/.git', '/swagger', '/api-docs', '/health', '/metrics',
];

/**
 * Perform static (non-HTTP) security checks on an endpoint
 */
export function buildSecurityIssues(endpoint: {
  url: string;
  auth?: { type: string; hasCredentials: boolean };
  hasSecrets: boolean;
  unresolvedVariables: string[];
}): Array<{ issue: string; riskLevel: string; recommendation: string; source: string }> {
  const issues: Array<{ issue: string; riskLevel: string; recommendation: string; source: string }> = [];
  
  // Check for HTTP instead of HTTPS
  if (endpoint.url.startsWith('http://')) {
    issues.push({
      issue: 'Endpoint URL uses HTTP instead of HTTPS',
      riskLevel: 'critical',
      recommendation: 'Use HTTPS to encrypt traffic in transit and prevent man-in-the-middle attacks.',
      source: 'static_analysis',
    });
  }
  
  // Check for missing auth on API endpoints
  if (!endpoint.auth) {
    const urlLower = endpoint.url.toLowerCase();
    if (urlLower.includes('/api/') || urlLower.includes('/v1/') || 
        urlLower.includes('/v2/') || urlLower.includes('/graphql')) {
      issues.push({
        issue: 'No authentication configured for API endpoint',
        riskLevel: 'high',
        recommendation: 'Add authentication (Bearer, API Key, OAuth) to protect this endpoint.',
        source: 'static_analysis',
      });
    }
  }
  
  // Check for hardcoded secrets
  if (endpoint.hasSecrets) {
    issues.push({
      issue: 'Hardcoded secrets detected in endpoint configuration',
      riskLevel: 'critical',
      recommendation: 'Remove hardcoded secrets. Use environment variables or a secrets vault.',
      source: 'static_analysis',
    });
  }
  
  // Check for unresolved variables
  if (endpoint.unresolvedVariables.length > 0) {
    issues.push({
      issue: `Unresolved variables: ${endpoint.unresolvedVariables.join(', ')}`,
      riskLevel: 'low',
      recommendation: 'Ensure all collection variables are defined or provided at runtime.',
      source: 'static_analysis',
    });
  }
  
  // Check for sensitive paths
  const urlLower = endpoint.url.toLowerCase();
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    if (urlLower.includes(pattern)) {
      issues.push({
        issue: `URL contains sensitive path segment '${pattern}'`,
        riskLevel: 'medium',
        recommendation: 'Ensure sensitive paths are protected with proper authorization and not exposed publicly.',
        source: 'static_analysis',
      });
      break;
    }
  }
  
  return issues;
}

/**
 * Check if a URL is scannable (has http/https and no unresolved variables in host)
 */
export function isUrlScannable(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  
  try {
    const withoutProtocol = url.split('://')[1];
    const host = withoutProtocol.split('/')[0].split('?')[0];
    if (host.includes('{{')) return false;
  } catch {
    return false;
  }
  
  return true;
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export class PostmanParser {
  /**
   * Quick parse for fast import validation
   * Returns basic info without full analysis
   */
  static quickParse(json: string): QuickParseResult {
    try {
      const parsed = JSON.parse(json);
      
      // Detect Postman collection format
      const isV21 = parsed?.info?.schema?.includes('v2.1');
      const isV20 = parsed?.info?.schema?.includes('v2.0');
      const isV1 = Array.isArray(parsed?.requests);
      
      if (!isV21 && !isV20 && !isV1) {
        return { 
          valid: false, 
          name: '', 
          totalEndpoints: 0, 
          error: 'Not a valid Postman collection format' 
        };
      }
      
      const countEndpoints = (items: any[]): number => {
        if (!Array.isArray(items)) return 0;
        return items.reduce((count, item) => {
          if (item.request) return count + 1;
          if (item.item) return count + countEndpoints(item.item);
          return count;
        }, 0);
      };
      
      const name = parsed?.info?.name || 'Untitled Collection';
      const totalEndpoints = isV1
        ? (parsed.requests?.length || 0)
        : countEndpoints(parsed.item || []);
      
      return { valid: true, name, totalEndpoints };
    } catch {
      return { valid: false, name: '', totalEndpoints: 0, error: 'Invalid JSON' };
    }
  }

  /**
   * Parse Postman collection and extract endpoints with full analysis
   */
  static parse(collection: PostmanCollection): ParsedCollection {
    const endpoints: ParsedEndpoint[] = [];
    const secretsMap = new Map<string, Set<string>>();
    const authTypes = new Set<string>();
    const methods = new Set<string>();
    const folders = new Set<string>();
    const variablesMap = extractCollectionVariables(collection);
    const variables: PostmanVariable[] = collection.variable || Object.entries(variablesMap).map(([key, value]) => ({ key, value }));
    const scannableUrls: string[] = [];
    
    const parseItems = (
      items: PostmanItem[], 
      folderPath: string[] = []
    ): void => {
      for (const item of items) {
        if (item.item) {
          // Folder/group - recurse
          const newFolderPath = [...folderPath, item.name];
          folders.add(newFolderPath.join(' > '));
          parseItems(item.item, newFolderPath);
        } else if (item.request) {
          // Endpoint
          const endpoint = this.parseEndpoint(item, folderPath, variablesMap, collection.auth);
          endpoints.push(endpoint);
          methods.add(endpoint.method);
          
          if (endpoint.auth?.type) {
            authTypes.add(endpoint.auth.type);
          }
          
          if (endpoint.isScannable) {
            scannableUrls.push(endpoint.url);
          }
          
          // Collect secrets
          for (const secret of endpoint.exposedSecrets) {
            const key = secret.type;
            if (!secretsMap.has(key)) {
              secretsMap.set(key, new Set());
            }
            secretsMap.get(key)!.add(secret.location);
          }
        }
      }
    };
    
    if (collection.item) {
      parseItems(collection.item);
    }
    
    // Build secrets summary with severity counts
    const exposedSecrets = Array.from(secretsMap.entries()).map(([type, locations]) => ({
      type,
      count: locations.size,
      locations: Array.from(locations),
    }));
    
    // Count secrets by severity
    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    for (const ep of endpoints) {
      for (const s of ep.exposedSecrets) {
        switch (s.severity) {
          case 'critical': criticalCount++; break;
          case 'high': highCount++; break;
          case 'medium': mediumCount++; break;
          default: lowCount++; break;
        }
      }
    }
    
    // Methods distribution
    const methodsDistribution: Record<string, number> = {};
    for (const ep of endpoints) {
      methodsDistribution[ep.method] = (methodsDistribution[ep.method] || 0) + 1;
    }
    
    return {
      name: collection.info.name,
      description: collection.info.description,
      schema: collection.info.schema,
      endpoints,
      totalEndpoints: endpoints.length,
      exposedSecrets,
      authTypes: Array.from(authTypes),
      methods: Array.from(methods),
      folders: Array.from(folders),
      variables,
      secretsExposedCount: exposedSecrets.reduce((sum, s) => sum + s.count, 0),
      endpointsWithSecrets: endpoints.filter(e => e.exposedSecrets.length > 0).length,
      scannableUrls,
      summary: {
        criticalSecrets: criticalCount,
        highSecrets: highCount,
        mediumSecrets: mediumCount,
        lowSecrets: lowCount,
        totalScannableUrls: scannableUrls.length,
        methodsDistribution,
      },
    };
  }

  /**
   * Parse individual endpoint with variable resolution and secret detection
   */
  private static parseEndpoint(
    item: PostmanItem,
    folderPath: string[],
    variables: Record<string, string>,
    collectionAuth?: PostmanAuth
  ): ParsedEndpoint {
    const request = item.request!;
    const method = (request.method || 'GET').toUpperCase();
    
    // Resolve URL
    const { resolved: rawUrl, unresolved: urlUnresolved } = resolveUrl(request.url, variables);
    
    // Parse URL components
    const urlInfo = this.parseUrl(request.url);
    const baseUrl = this.buildBaseUrl(urlInfo, variables);
    const path = this.buildPath(urlInfo, variables);
    
    // Parse headers
    const headersRaw = request.header || [];
    const { resolved: headersResolved, unresolved: headerUnresolved } = resolveHeaders(headersRaw, variables);
    const headers: Record<string, string> = {};
    const sensitiveHeaders: string[] = [];
    for (const h of headersResolved) {
      if (!h.disabled) {
        headers[h.key] = h.value;
        if (this.isSensitiveHeader(h.key)) {
          sensitiveHeaders.push(h.key);
        }
      }
    }
    
    // Resolve body
    const { resolved: bodyResolved, unresolved: bodyUnresolved } = resolveBody(request.body, variables);
    
    // Parse query params
    const queryParams: Array<{ name: string; value?: string }> = [];
    const pathVariables: Array<{ key: string; value?: string }> = [];
    
    if (typeof request.url !== 'string' && request.url) {
      // Query params from URL object
      for (const q of request.url.query || []) {
        if (!q.disabled) {
          const { resolved: k } = resolveVariables(q.key || '', variables);
          const { resolved: v } = resolveVariables(q.value || '', variables);
          queryParams.push({ name: k, value: v });
        }
      }
      
      // Path variables
      for (const v of request.url.variable || []) {
        const { resolved: k } = resolveVariables(v.key || '', variables);
        const { resolved: val } = resolveVariables(v.value || '', variables);
        pathVariables.push({ key: k, value: val });
      }
    }
    
    // Parse auth
    const auth = this.parseAuth(request.auth || collectionAuth);
    
    // Parse body info
    const bodyInfo = this.parseBody(bodyResolved);
    
    // Detect secrets in all locations
    const location = `request '${item.name}'`;
    let allSecrets: Array<{ type: string; location: string; value?: string; severity: string }> = [];
    
    // URL secrets
    allSecrets.push(...detectSecretsInString(rawUrl, `${location} > URL`));
    
    // Header secrets
    allSecrets.push(...detectSecretsInHeaders(headersResolved, location));
    
    // Body secrets
    allSecrets.push(...detectSecretsInBody(bodyResolved, location));
    
    // Auth secrets
    allSecrets.push(...detectSecretsInAuth(request.auth || collectionAuth, location));
    
    // Query param secrets
    for (const qp of queryParams) {
      const val = `${qp.name}=${qp.value || ''}`;
      allSecrets.push(...detectSecretsInString(val, `${location} > query param '${qp.name}'`));
    }
    
    // Path variable secrets
    for (const pv of pathVariables) {
      const val = `${pv.key}=${pv.value || ''}`;
      allSecrets.push(...detectSecretsInString(val, `${location} > path variable '${pv.key}'`));
    }
    
    // Deduplicate
    allSecrets = deduplicateFindings(allSecrets);
    
    // Static security analysis
    const unresolvedVariables = [...new Set([...urlUnresolved, ...headerUnresolved, ...bodyUnresolved])];
    const securityIssues = buildSecurityIssues({
      url: rawUrl,
      auth,
      hasSecrets: allSecrets.length > 0,
      unresolvedVariables,
    });
    
    // Check if scannable
    const isScannable = isUrlScannable(rawUrl) && !urlUnresolved.some(v => rawUrl.includes(`{{${v}}}`));
    
    const endpoint: ParsedEndpoint = {
      id: `${method}:${baseUrl}${path}`.replace(/[^a-zA-Z0-9]/g, '_'),
      name: item.name,
      method,
      url: rawUrl,
      baseUrl,
      path,
      description: request.description || item.description,
      auth: auth ? {
        type: auth.type,
        location: auth.location,
        hasCredentials: auth.hasCredentials,
      } : undefined,
      headers,
      sensitiveHeaders,
      hasBody: bodyInfo.hasBody,
      bodyType: bodyInfo.type,
      bodyPreview: bodyInfo.preview,
      queryParams,
      pathVariables,
      folder: folderPath[folderPath.length - 1],
      folderPath: folderPath.length > 0 ? folderPath : undefined,
      exposedSecrets: allSecrets,
      securityIssues,
      isScannable,
      unresolvedVariables,
    };
    
    return endpoint;
  }

  private static parseUrl(url: PostmanUrl | string): PostmanUrl {
    if (typeof url === 'string') {
      return {
        raw: url,
        host: ['example.com'],
        path: ['/'],
      };
    }
    return url;
  }

  private static buildBaseUrl(url: PostmanUrl, variables: Record<string, string>): string {
    if (!url.host || url.host.length === 0) {
      return 'https://api.example.com';
    }
    
    const protocol = url.protocol || 'https';
    const hostParts = url.host || [];
    const host = Array.isArray(hostParts) ? hostParts.join('.') : hostParts;
    const port = url.port ? `:${url.port}` : '';
    
    return `${protocol}://${host}${port}`;
  }

  private static buildPath(url: PostmanUrl, _variables: Record<string, string>): string {
    if (!url.path || url.path.length === 0) {
      return '/';
    }
    
    const path = Array.isArray(url.path) ? url.path.join('/') : url.path;
    return path.startsWith('/') ? path : `/${path}`;
  }

  private static parseAuth(
    auth?: PostmanAuth
  ): { type: string; location?: string; hasCredentials: boolean } | undefined {
    if (!auth || !auth.type) return undefined;
    
    const type = auth.type;
    let hasCredentials = false;
    
    if (auth.basic?.some(b => b.value)) hasCredentials = true;
    else if (auth.bearer?.some(b => b.value)) hasCredentials = true;
    else if (auth.apikey?.some(a => a.value)) hasCredentials = true;
    else if (auth.oauth2?.some(o => o.value)) hasCredentials = true;
    
    return {
      type: type.toUpperCase(),
      location: auth.apikey?.[0]?.in,
      hasCredentials,
    };
  }

  private static parseBody(body?: PostmanBody): { hasBody: boolean; type?: string; preview?: string } {
    if (!body) {
      return { hasBody: false };
    }
    
    const type = body.mode || 'raw';
    let preview = '';
    
    if (body.raw) {
      preview = body.raw.substring(0, 100);
    } else if (body.formdata && body.formdata.length > 0) {
      preview = `${body.formdata.length} form fields`;
    } else if (body.graphql) {
      preview = body.graphql.query.substring(0, 50);
    }
    
    return {
      hasBody: true,
      type,
      preview,
    };
  }

  private static isSensitiveHeader(headerName: string): boolean {
    const sensitive = [
      'authorization',
      'x-api-key',
      'x-auth-token',
      'api-key',
      'token',
      'bearer',
      'password',
      'secret',
      'x-token',
      'x-secret',
      'x-password',
    ];
    
    return sensitive.includes(headerName.toLowerCase());
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Convert parsed endpoints to scan items
 */
export function endpointsToScanItems(endpoints: ParsedEndpoint[]): Array<{
  path: string;
  method: string;
  authType?: string;
}> {
  return endpoints.map(ep => ({
    path: ep.path,
    method: ep.method,
    authType: ep.auth?.type?.toLowerCase(),
  }));
}

/**
 * Generate security recommendations
 */
export function generateSecurityRecommendations(parsed: ParsedCollection): string[] {
  const recommendations: string[] = [];
  
  if (parsed.exposedSecrets.length > 0) {
    recommendations.push(
      `🔴 CRITICAL: ${parsed.secretsExposedCount} exposed secrets found in collection. Remove all credentials before sharing.`
    );
  }
  
  const noAuthEndpoints = parsed.endpoints.filter(ep => !ep.auth).length;
  if (noAuthEndpoints > parsed.totalEndpoints * 0.3) {
    recommendations.push(
      `🟠 HIGH: ${noAuthEndpoints} endpoints (${Math.round((noAuthEndpoints / parsed.totalEndpoints) * 100)}%) lack authentication. Verify these are public APIs.`
    );
  }
  
  if (parsed.endpoints.some(ep => ep.sensitiveHeaders.length > 0)) {
    recommendations.push('🟡 MEDIUM: Sensitive headers detected. Ensure these are configured per-environment.');
  }
  
  const httpEndpoints = parsed.endpoints.filter(ep => ep.url.startsWith('http://')).length;
  if (httpEndpoints > 0) {
    recommendations.push(
      `🔴 CRITICAL: ${httpEndpoints} endpoints use HTTP instead of HTTPS. Migrate to HTTPS immediately.`
    );
  }
  
  const queryParamEndpoints = parsed.endpoints.filter(ep => ep.queryParams.length > 0).length;
  if (queryParamEndpoints > 0) {
    recommendations.push(
      `ℹ️ INFO: ${queryParamEndpoints} endpoints use query parameters. Ensure input validation is in place.`
    );
  }
  
  return recommendations;
}

/**
 * Calculate security score for an endpoint based on issues and secrets
 */
export function calculateSecurityScore(issues: Array<{ riskLevel: string }>): number {
  let score = 100;
  
  for (const issue of issues) {
    switch (issue.riskLevel) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  }
  
  return Math.max(0, score);
}
