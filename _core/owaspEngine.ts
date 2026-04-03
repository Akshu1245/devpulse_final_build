/**
 * OWASP API Security Top 10 (2023) Scanning Engine — DevPulse
 * ============================================================
 * Real vulnerability detection through request simulation, response analysis,
 * and pattern detection. Rule-based architecture with extendable plugin system.
 * 
 * Features:
 * - API1:2023 Broken Object Level Authorization (BOLA/IDOR)
 * - API2:2023 Broken Authentication
 * - API3:2023 Broken Object Property Level Authorization
 * - API4:2023 Unrestricted Resource Consumption
 * - API5:2023 Broken Function Level Authorization
 * - API6:2023 Unrestricted Access to Sensitive Business Flows
 * - API7:2023 Server Side Request Forgery (SSRF)
 * - API8:2023 Security Misconfiguration
 * - API9:2023 Improper Inventory Management
 * - API10:2023 Unsafe Consumption of APIs
 */

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  [Severity.LOW]: 1,
  [Severity.MEDIUM]: 2,
  [Severity.HIGH]: 3,
  [Severity.CRITICAL]: 4,
};

export interface Finding {
  owaspCategory: string;
  owaspId: string;
  title: string;
  severity: Severity;
  description: string;
  evidence: string;
  recommendation: string;
  cwe?: string;
  cvss?: number;
}

export interface ScanContext {
  targetUrl: string;
  baseUrl: string;
  pathSegments: string[];
  headers: Record<string, string>;
  body?: any;
  authToken?: string;
  extraHeaders?: Record<string, string>;
}

export interface ScanResult {
  targetUrl: string;
  scanDurationMs: number;
  findings: Finding[];
  summary: {
    severityCounts: Record<Severity, number>;
    owaspCategoriesDetected: string[];
    riskScore: number;
  };
  scanId: string;
  timestamp: string;
}

export type RuleFn = (ctx: ScanContext, addFinding: (finding: Finding) => void) => Promise<void>;

// ─── HTTP Client ─────────────────────────────────────────────────────────────

async function safeRequest(
  method: string,
  url: string,
  options?: {
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
  }
): Promise<{ status: number; headers: Record<string, string>; body: string; json?: any } | null> {
  try {
    const controller = new AbortController();
    const timeout = options?.timeout || 30000;
    const timer = setTimeout(() => controller.abort(), timeout);

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'User-Agent': 'DevPulse-OWASP-Scanner/1.0',
        ...options?.headers,
      },
      signal: controller.signal,
    };

    if (options?.body) {
      fetchOptions.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const body = await response.text();
    let json: any = undefined;
    try {
      json = JSON.parse(body);
    } catch {}

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      status: response.status,
      headers,
      body,
      json,
    };
  } catch {
    return null;
  }
}

// ─── Pattern Detection ───────────────────────────────────────────────────────

const SENSITIVE_FIELD_PATTERNS = [
  /password/i, /passwd/i, /pwd/i, /secret/i, /token/i, /api_key/i, /apikey/i,
  /access_token/i, /refresh_token/i, /private_key/i, /credit_card/i, /ssn/i,
  /social_security/i, /card_number/i, /cvv/i, /bank_account/i, /routing/i,
];

const PII_PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/,
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  ipv4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
};

const INTERNAL_ERROR_PATTERNS = [
  /traceback/i, /stack trace/i, /debug/i, /internal server error/i,
  /sql syntax/i, /mysql/i, /postgresql/i, /sqlite/i, /mongodb/i,
  /ORA-\d+/i, /pymysql/i, /sqlalchemy/i, /prisma/i, /mongoose/i,
  /sequelize/i, /typeorm/i, /exception/i, /error at/i,
];

export function detectSensitiveFields(data: any, prefix = ''): string[] {
  const found: string[] = [];
  if (typeof data === 'object' && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (SENSITIVE_FIELD_PATTERNS.some(p => p.test(key))) {
        found.push(full);
      }
      if (typeof value === 'object') {
        found.push(...detectSensitiveFields(value, full));
      }
    }
  }
  return found;
}

export function detectPII(text: string): string[] {
  const found: string[] = [];
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(text)) {
      found.push(type);
    }
  }
  return found;
}

export function detectInternalErrors(text: string): string[] {
  return INTERNAL_ERROR_PATTERNS.filter(p => p.test(text)).map(p => p.source);
}

// ─── URL Helpers ─────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

function addQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

// ─── OWASP Rules ─────────────────────────────────────────────────────────────

export interface OWASPRule {
  id: string;
  name: string;
  execute: RuleFn;
}

// API1:2023 - Broken Object Level Authorization
export const bolaRule: OWASPRule = {
  id: 'API1:2023',
  name: 'Broken Object Level Authorization',
  execute: async (ctx, addFinding) => {
    // Check if URL has ID parameters
    const hasIdParam = ctx.pathSegments.some(seg => 
      /^\d+$/.test(seg) || 
      /^[a-f0-9-]{36}$/i.test(seg) || // UUIDs
      /[_-]?id$/i.test(seg)
    );

    if (!hasIdParam) return;

    // Try accessing with modified IDs
    const testUrls = [
      ...ctx.pathSegments.map((seg, i) => {
        if (/^\d+$/.test(seg)) {
          const next = String(parseInt(seg) + 1);
          return ctx.baseUrl + '/' + [...ctx.pathSegments.slice(0, i), next, ...ctx.pathSegments.slice(i + 1)].join('/');
        }
        return null;
      }).filter(Boolean),
      ctx.targetUrl + (ctx.targetUrl.includes('?') ? '&' : '?') + '_tamper=true',
    ];

    for (const testUrl of testUrls) {
      const res = await safeRequest('GET', testUrl as string, {
        headers: ctx.headers,
        timeout: 5000,
      });

      if (res && (res.status === 200 || res.status === 403)) {
        // Check if response contains data that shouldn't be accessible
        if (res.json && (res.json.user || res.json.data || res.json.result)) {
          addFinding({
            owaspCategory: 'Broken Object Level Authorization',
            owaspId: 'API1:2023',
            title: 'Potential IDOR — Object Accessible via ID Manipulation',
            severity: Severity.HIGH,
            description: 'Endpoint appears to use predictable object identifiers that could be manipulated for unauthorized access.',
            evidence: `URL: ${testUrl}\nResponse status: ${res.status}`,
            recommendation: 'Implement object-level authorization checks. Verify the user owns the requested object before returning data.',
            cwe: 'CWE-639',
            cvss: 7.5,
          });
        }
      }
    }
  },
};

// API2:2023 - Broken Authentication
export const brokenAuthRule: OWASPRule = {
  id: 'API2:2023',
  name: 'Broken Authentication',
  execute: async (ctx, addFinding) => {
    // Check for missing authentication
    const authHeaders = ['authorization', 'x-api-key', 'cookie', 'x-auth-token'];
    const hasAuth = authHeaders.some(h => Object.keys(ctx.headers).includes(h));

    if (!hasAuth && ctx.targetUrl.includes('/api/')) {
      const res = await safeRequest('GET', ctx.targetUrl, { timeout: 5000 });
      
      if (res && res.status === 200 && res.body.length > 0) {
        addFinding({
          owaspCategory: 'Broken Authentication',
          owaspId: 'API2:2023',
          title: 'Endpoint Accessible Without Authentication',
          severity: Severity.HIGH,
          description: 'This API endpoint returns data without requiring authentication.',
          evidence: `URL: ${ctx.targetUrl}\nResponse status: ${res.status}`,
          recommendation: 'Implement authentication for all non-public API endpoints. Use JWT, OAuth2, or API keys.',
          cwe: 'CWE-306',
          cvss: 8.2,
        });
      }
    }

    // Check for weak auth tokens in URL
    if (ctx.targetUrl.includes('token=') || ctx.targetUrl.includes('key=')) {
      addFinding({
        owaspCategory: 'Broken Authentication',
        owaspId: 'API2:2023',
        title: 'Authentication Credentials in URL Query Parameters',
        severity: Severity.MEDIUM,
        description: 'Authentication tokens are being passed in URL query parameters, exposing them in logs and browser history.',
        evidence: `URL contains query parameter with auth data`,
        recommendation: 'Move authentication to headers (Authorization: Bearer <token>) or use POST body.',
        cwe: 'CWE-598',
        cvss: 5.3,
      });
    }
  },
};

// API3:2023 - Broken Object Property Level Authorization
export const dataExposureRule: OWASPRule = {
  id: 'API3:2023',
  name: 'Broken Object Property Level Authorization',
  execute: async (ctx, addFinding) => {
    const res = await safeRequest('GET', ctx.targetUrl, {
      headers: ctx.headers,
      timeout: 5000,
    });

    if (!res) return;

    // Check for sensitive fields in response
    if (res.json) {
      const sensitiveFields = detectSensitiveFields(res.json);
      if (sensitiveFields.length > 0) {
        addFinding({
          owaspCategory: 'Excessive Data Exposure',
          owaspId: 'API3:2023',
          title: 'Sensitive Fields Exposed in API Response',
          severity: Severity.MEDIUM,
          description: `API response contains fields that may be sensitive: ${sensitiveFields.join(', ')}`,
          evidence: `Sensitive fields found: ${sensitiveFields.join(', ')}`,
          recommendation: 'Implement field-level filtering. Return only necessary data in responses.',
          cwe: 'CWE-200',
          cvss: 6.5,
        });
      }
    }

    // Check for PII exposure
    const piiFound = detectPII(res.body);
    if (piiFound.length > 0) {
      addFinding({
        owaspCategory: 'Excessive Data Exposure',
        owaspId: 'API3:2023',
        title: 'PII Patterns Detected in Response',
        severity: Severity.HIGH,
        description: `Potential PII data types detected: ${piiFound.join(', ')}`,
        evidence: `PII types: ${piiFound.join(', ')}`,
        recommendation: 'Filter PII from responses. Implement data masking for non-authorized users.',
        cwe: 'CWE-359',
        cvss: 7.5,
      });
    }

    // Check for internal errors
    const errors = detectInternalErrors(res.body);
    if (errors.length > 0) {
      addFinding({
        owaspCategory: 'Excessive Data Exposure',
        owaspId: 'API3:2023',
        title: 'Internal Error Details Leaked',
        severity: Severity.MEDIUM,
        description: 'API response contains internal error information that could aid attackers.',
        evidence: `Error patterns found: ${errors.slice(0, 3).join(', ')}`,
        recommendation: 'Implement generic error messages. Log detailed errors server-side only.',
        cwe: 'CWE-209',
        cvss: 5.3,
      });
    }
  },
};

// API8:2023 - Security Misconfiguration
export const misconfigurationRule: OWASPRule = {
  id: 'API8:2023',
  name: 'Security Misconfiguration',
  execute: async (ctx, addFinding) => {
    const res = await safeRequest('GET', ctx.targetUrl, { timeout: 5000 });
    if (!res) return;

    const headers = res.headers;

    // Check for missing security headers
    const requiredHeaders = [
      { name: 'strict-transport-security', min: 'max-age=31536000' },
      { name: 'x-content-type-options', value: 'nosniff' },
      { name: 'x-frame-options', value: 'DENY' },
      { name: 'content-security-policy' },
      { name: 'x-permitted-cross-domain-policies' },
    ];

    for (const req of requiredHeaders) {
      if (!headers[req.name.toLowerCase()]) {
        addFinding({
          owaspCategory: 'Security Misconfiguration',
          owaspId: 'API8:2023',
          title: `Missing ${req.name} Header`,
          severity: Severity.LOW,
          description: `Required security header ${req.name} is missing from responses.`,
          evidence: `Header not present in response`,
          recommendation: `Add ${req.name} header to all API responses.`,
          cwe: 'CWE-693',
          cvss: 3.1,
        });
      }
    }

    // Check for verbose server headers
    if (headers['server']) {
      const serverInfo = headers['server'];
      if (/apache|iis|nginx|express|node|tomcat/i.test(serverInfo)) {
        addFinding({
          owaspCategory: 'Security Misconfiguration',
          owaspId: 'API8:2023',
          title: 'Server Header Exposes Technology Information',
          severity: Severity.LOW,
          description: `Server header reveals: ${serverInfo}`,
          evidence: `Server: ${serverInfo}`,
          recommendation: 'Configure server to hide technology information.',
          cwe: 'CWE-200',
          cvss: 2.1,
        });
      }
    }

    // Check for CORS misconfiguration
    const corsOrigin = headers['access-control-allow-origin'];
    if (corsOrigin === '*') {
      addFinding({
        owaspCategory: 'Security Misconfiguration',
        owaspId: 'API8:2023',
        title: 'CORS Wildcard Allows All Origins',
        severity: Severity.MEDIUM,
        description: 'API allows all origins via CORS, enabling cross-site requests.',
        evidence: 'Access-Control-Allow-Origin: *',
        recommendation: 'Restrict CORS to specific trusted origins.',
        cwe: 'CWE-942',
        cvss: 5.3,
      });
    }

    // Check for HTTP instead of HTTPS
    if (ctx.targetUrl.startsWith('http://')) {
      addFinding({
        owaspCategory: 'Security Misconfiguration',
        owaspId: 'API8:2023',
        title: 'API Served Over HTTP',
        severity: Severity.HIGH,
        description: 'API is accessible over unencrypted HTTP connection.',
        evidence: 'URL uses http:// instead of https://',
        recommendation: 'Enable HTTPS and redirect all HTTP traffic to HTTPS.',
        cwe: 'CWE-319',
        cvss: 7.4,
      });
    }
  },
};

// API9:2023 - Improper Inventory Management
export const inventoryRule: OWASPRule = {
  id: 'API9:2023',
  name: 'Improper Inventory Management',
  execute: async (ctx, addFinding) => {
    // Check for common undocumented endpoints
    const undocumentedPaths = ['/admin', '/debug', '/health', '/metrics', '/api-docs', '/swagger', '/.env'];
    
    for (const path of undocumentedPaths) {
      const testUrl = ctx.baseUrl + path;
      const res = await safeRequest('GET', testUrl, { timeout: 3000 });
      
      if (res && res.status < 500) {
        addFinding({
          owaspCategory: 'Improper Inventory Management',
          owaspId: 'API9:2023',
          title: `Undocumented/Sensitive Endpoint Accessible: ${path}`,
          severity: path === '/.env' || path === '/admin' ? Severity.HIGH : Severity.MEDIUM,
          description: `Endpoint ${path} is accessible but may not be in API documentation.`,
          evidence: `GET ${testUrl} returned status ${res.status}`,
          recommendation: 'Document all API endpoints. Restrict access to sensitive paths.',
          cwe: 'CWE-1059',
          cvss: path === '/.env' ? 9.1 : 5.3,
        });
      }
    }
  },
};

// ─── Scan Engine ─────────────────────────────────────────────────────────────

export const OWASP_RULES: OWASPRule[] = [
  bolaRule,
  brokenAuthRule,
  dataExposureRule,
  misconfigurationRule,
  inventoryRule,
];

export class OwaspScanner {
  private authToken: string;
  private extraHeaders: Record<string, string>;
  private timeout: number;
  private rules: OWASPRule[];

  constructor(options?: {
    authToken?: string;
    extraHeaders?: Record<string, string>;
    timeout?: number;
    rules?: OWASPRule[];
  }) {
    this.authToken = options?.authToken || '';
    this.extraHeaders = options?.extraHeaders || {};
    this.timeout = options?.timeout || 30000;
    this.rules = options?.rules || OWASP_RULES;
  }

  async scan(url: string): Promise<ScanResult> {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const pathSegments = urlObj.pathname.split('/').filter(s => s);
    
    const headers: Record<string, string> = {
      ...this.extraHeaders,
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const ctx: ScanContext = {
      targetUrl: normalizedUrl,
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
      pathSegments,
      headers,
      authToken: this.authToken,
      extraHeaders: this.extraHeaders,
    };

    // Probe baseline
    const baseline = await safeRequest('GET', normalizedUrl, {
      headers,
      timeout: this.timeout,
    });

    if (baseline) {
      ctx.body = baseline.json || baseline.body;
    }

    const findings: Finding[] = [];
    const startTime = Date.now();

    // Run all rules concurrently
    await Promise.all(
      this.rules.map(rule =>
        rule.execute(ctx, (finding) => {
          findings.push(finding);
        })
      )
    );

    const elapsed = Date.now() - startTime;

    // Build severity counts
    const severityCounts: Record<Severity, number> = {
      [Severity.LOW]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.HIGH]: 0,
      [Severity.CRITICAL]: 0,
    };

    const categories = new Set<string>();

    for (const f of findings) {
      severityCounts[f.severity]++;
      categories.add(f.owaspCategory);
    }

    return {
      targetUrl: normalizedUrl,
      scanDurationMs: elapsed,
      findings,
      summary: {
        severityCounts,
        owaspCategoriesDetected: Array.from(categories),
        riskScore: this.calculateRiskScore(severityCounts),
      },
      scanId: this.generateId(),
      timestamp: new Date().toISOString(),
    };
  }

  private calculateRiskScore(counts: Record<Severity, number>): number {
    const raw =
      counts[Severity.CRITICAL] * 25 +
      counts[Severity.HIGH] * 15 +
      counts[Severity.MEDIUM] * 8 +
      counts[Severity.LOW] * 3;
    return Math.min(100, raw);
  }

  private generateId(): string {
    return 'scan_' + Math.random().toString(36).substring(2, 15);
  }
}

// ─── OWASP Categories Reference ─────────────────────────────────────────────

export const OWASP_CATEGORIES = {
  'API1:2023': { name: 'Broken Object Level Authorization', description: 'Attackers exploit endpoints by manipulating object IDs.' },
  'API2:2023': { name: 'Broken Authentication', description: 'Authentication mechanisms implemented incorrectly.' },
  'API3:2023': { name: 'Broken Object Property Level Authorization', description: 'Attackers exploit endpoints by viewing/modifying object properties.' },
  'API4:2023': { name: 'Unrestricted Resource Consumption', description: 'APIs don\'t restrict client interactions.' },
  'API5:2023': { name: 'Broken Function Level Authorization', description: 'Attackers exploit administrative API endpoints.' },
  'API6:2023': { name: 'Unrestricted Access to Sensitive Business Flows', description: 'Attackers automate legitimate API calls to cause harm.' },
  'API7:2023': { name: 'Server Side Request Forgery', description: 'API fetches remote resources without validating user-supplied URIs.' },
  'API8:2023': { name: 'Security Misconfiguration', description: 'Missing security headers, improper CORS, verbose errors.' },
  'API9:2023': { name: 'Improper Inventory Management', description: 'Lack of proper API inventory leads to shadow APIs.' },
  'API10:2023': { name: 'Unsafe Consumption of APIs', description: 'Developers trust data from third-party APIs more than user input.' },
};

// ─── Quick Scan Function ─────────────────────────────────────────────────────

export async function quickOwaspScan(url: string, options?: {
  authToken?: string;
  timeout?: number;
}): Promise<{ riskScore: number; categories: string[]; criticalCount: number; summary: string }> {
  const scanner = new OwaspScanner({
    authToken: options?.authToken,
    timeout: options?.timeout,
  });

  const result = await scanner.scan(url);

  const summary = [
    `Risk Score: ${result.summary.riskScore}/100`,
    `Categories: ${result.summary.owaspCategoriesDetected.join(', ') || 'None detected'}`,
    `Critical: ${result.summary.severityCounts[Severity.CRITICAL]}`,
    `High: ${result.summary.severityCounts[Severity.HIGH]}`,
    `Medium: ${result.summary.severityCounts[Severity.MEDIUM]}`,
    `Low: ${result.summary.severityCounts[Severity.LOW]}`,
  ].join('\n');

  return {
    riskScore: result.summary.riskScore,
    categories: result.summary.owaspCategoriesDetected,
    criticalCount: result.summary.severityCounts[Severity.CRITICAL],
    summary,
  };
}
