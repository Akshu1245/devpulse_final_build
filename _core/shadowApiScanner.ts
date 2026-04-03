/**
 * Shadow API Workspace Scanner — DevPulse
 * ========================================
 * Scans workspace files for API route definitions
 * 
 * Supports:
 * - Express.js (JavaScript/TypeScript)
 * - FastAPI (Python)
 * - Django REST Framework (Python)
 * - Spring Boot (Java)
 * - Laravel (PHP)
 * - Next.js API Routes
 * - NestJS Controllers
 */

export interface DetectedRoute {
  method: string;
  path: string;
  file: string;
  line: number;
  framework: string;
  handler?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  totalFiles: number;
  scannedFiles: number;
  detectedRoutes: DetectedRoute[];
  frameworks: string[];
  summary: {
    express: number;
    fastapi: number;
    django: number;
    spring: number;
    laravel: number;
    nextjs: number;
    nestjs: number;
    other: number;
  };
}

// Route patterns for different frameworks
const ROUTE_PATTERNS = {
  // Express.js patterns
  express: [
    // app.get('/path', handler)
    /(?:app|router)\.(get|post|put|patch|delete|all|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    // router.route('/path').get().post()
    /\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi,
  ],

  // FastAPI patterns  
  fastapi: [
    // @app.get("/path")
    /@(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']/gi,
    // @router.api_route("/path", methods=["GET"])
    /@(?:app|router)\.api_route\s*\(\s*["']([^"']+)["']/gi,
  ],

  // Django REST Framework patterns
  django: [
    // path('api/', views.handler)
    /path\s*\(\s*['"]([^'"]+)['"]/gi,
    // url(r'^api/', views.handler)
    /url\s*\(\s*r?['"]([^'"]+)['"]/gi,
    // @api_view(['GET'])
    /@api_view\s*\(\s*\[([^\]]+)\]/gi,
    // @action(detail=True, methods=['get'])
    /@action\s*\([^)]*methods\s*=\s*\[([^\]]+)\]/gi,
  ],

  // Spring Boot patterns
  spring: [
    // @GetMapping("/path")
    /@(Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi,
    // @RequestMapping(value = "/path", method = RequestMethod.GET)
    /@RequestMapping\s*\([^)]*value\s*=\s*["']([^"']+)["']/gi,
  ],

  // Laravel patterns
  laravel: [
    // Route::get('/path', [Controller::class, 'method'])
    /Route::(get|post|put|patch|delete|any|match)\s*\(\s*['"]([^'"]+)['"]/gi,
    // Route::resource('/path', Controller::class)
    /Route::resource\s*\(\s*['"]([^'"]+)['"]/gi,
    // Route::apiResource('/path', Controller::class)
    /Route::apiResource\s*\(\s*['"]([^'"]+)['"]/gi,
  ],

  // Next.js API Routes (file-based)
  nextjs: [
    // export default function handler
    /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/gi,
    // export const GET = async
    /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/gi,
    // export async function GET
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/gi,
  ],

  // NestJS patterns
  nestjs: [
    // @Get('/path')
    /@(Get|Post|Put|Patch|Delete|All|Options|Head)\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/gi,
    // @Controller('/path')
    /@Controller\s*\(\s*['"]([^'"]+)['"]\s*\)/gi,
  ],
};

/**
 * Detect framework from file content
 */
function detectFramework(content: string, filePath: string): string {
  const lower = content.toLowerCase();
  const ext = filePath.split('.').pop()?.toLowerCase();

  // Python files
  if (ext === 'py') {
    if (lower.includes('fastapi') || lower.includes('@app.get') || lower.includes('@router.')) {
      return 'fastapi';
    }
    if (lower.includes('rest_framework') || lower.includes('api_view') || lower.includes('viewset')) {
      return 'django';
    }
  }

  // Java files
  if (ext === 'java') {
    if (lower.includes('@getmapping') || lower.includes('@postmapping') || lower.includes('@requestmapping')) {
      return 'spring';
    }
  }

  // PHP files
  if (ext === 'php') {
    if (lower.includes('route::') || lower.includes('illuminate\\routing')) {
      return 'laravel';
    }
  }

  // TypeScript/JavaScript files
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
    // Check for Next.js API routes
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      if (lower.includes('nextapiresponse') || lower.includes('nextrequest') || 
          /export\s+(const|async\s+function)\s+(GET|POST|PUT|DELETE|PATCH)/i.test(content)) {
        return 'nextjs';
      }
    }
    
    // Check for NestJS
    if (lower.includes('@controller') || lower.includes('@nestjs')) {
      return 'nestjs';
    }

    // Check for Express
    if (lower.includes('express') || /(?:app|router)\.(get|post|put|patch|delete)\s*\(/i.test(content)) {
      return 'express';
    }
  }

  return 'unknown';
}

/**
 * Extract routes from file content
 */
function extractRoutes(content: string, filePath: string, framework: string): DetectedRoute[] {
  const routes: DetectedRoute[] = [];
  const lines = content.split('\n');

  // Get patterns for detected framework
  const patterns = ROUTE_PATTERNS[framework as keyof typeof ROUTE_PATTERNS] || [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      const lineNumber = content.substring(0, matchIndex).split('\n').length;
      
      let method = 'GET';
      let path = '';

      // Extract method and path based on framework
      if (framework === 'express' || framework === 'nestjs') {
        method = (match[1] || 'GET').toUpperCase();
        path = match[2] || match[1] || '';
      } else if (framework === 'fastapi') {
        method = (match[1] || 'GET').toUpperCase();
        path = match[2] || '';
      } else if (framework === 'django') {
        path = match[1] || '';
        // Django patterns often don't include method in path definition
        method = 'GET'; // Default, would need context analysis for accurate method
      } else if (framework === 'spring') {
        const mappingType = match[1] || 'Request';
        method = mappingType.replace('Mapping', '').toUpperCase();
        if (method === 'REQUEST') method = 'GET';
        path = match[2] || '';
      } else if (framework === 'laravel') {
        method = (match[1] || 'get').toUpperCase();
        path = match[2] || '';
      } else if (framework === 'nextjs') {
        method = (match[1] || 'GET').toUpperCase();
        // Path derived from file path for Next.js
        path = filePath.replace(/.*[/\\]app[/\\]/, '/').replace(/[/\\]route\.(ts|js)$/, '').replace(/\\/g, '/');
      }

      // Normalize path
      if (path && !path.startsWith('/')) {
        path = '/' + path;
      }

      // Skip empty or invalid paths
      if (!path || path === '/') continue;

      routes.push({
        method,
        path,
        file: filePath,
        line: lineNumber,
        framework,
        handler: match[0].substring(0, 50),
        confidence: framework === 'unknown' ? 'low' : 'high',
      });
    }
  }

  return routes;
}

/**
 * Scan a single file for API routes
 */
export function scanFile(content: string, filePath: string): DetectedRoute[] {
  const framework = detectFramework(content, filePath);
  if (framework === 'unknown') {
    // Try all patterns if framework not detected
    const allRoutes: DetectedRoute[] = [];
    for (const fw of Object.keys(ROUTE_PATTERNS)) {
      const routes = extractRoutes(content, filePath, fw);
      allRoutes.push(...routes.map(r => ({ ...r, confidence: 'low' as const })));
    }
    return allRoutes;
  }
  return extractRoutes(content, filePath, framework);
}

/**
 * Scan multiple files
 */
export function scanFiles(files: Array<{ path: string; content: string }>): ScanResult {
  const detectedRoutes: DetectedRoute[] = [];
  const frameworksFound = new Set<string>();
  const summary = {
    express: 0,
    fastapi: 0,
    django: 0,
    spring: 0,
    laravel: 0,
    nextjs: 0,
    nestjs: 0,
    other: 0,
  };

  for (const file of files) {
    const routes = scanFile(file.content, file.path);
    
    for (const route of routes) {
      detectedRoutes.push(route);
      frameworksFound.add(route.framework);
      
      const key = route.framework as keyof typeof summary;
      if (key in summary) {
        summary[key]++;
      } else {
        summary.other++;
      }
    }
  }

  return {
    totalFiles: files.length,
    scannedFiles: files.length,
    detectedRoutes,
    frameworks: Array.from(frameworksFound),
    summary,
  };
}

/**
 * Compare detected routes against known inventory
 */
export function findShadowApis(
  detected: DetectedRoute[],
  knownEndpoints: Array<{ method: string; path: string }>
): DetectedRoute[] {
  const knownSet = new Set(
    knownEndpoints.map(e => `${e.method.toUpperCase()}:${normalizePath(e.path)}`)
  );

  return detected.filter(route => {
    const key = `${route.method.toUpperCase()}:${normalizePath(route.path)}`;
    return !knownSet.has(key);
  });
}

/**
 * Normalize path for comparison
 */
function normalizePath(path: string): string {
  return path
    .replace(/\{[^}]+\}/g, ':param') // {id} → :param
    .replace(/:[^/]+/g, ':param')    // :id → :param
    .replace(/\/+/g, '/')            // Multiple slashes → single
    .replace(/\/$/, '')              // Remove trailing slash
    .toLowerCase();
}

/**
 * ShadowApiScanner class for VS Code extension
 */
export class ShadowApiScanner {
  static scanFile = scanFile;
  static scanFiles = scanFiles;
  static findShadowApis = findShadowApis;
  
  /**
   * Get file extensions to scan
   */
  static getTargetExtensions(): string[] {
    return ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'php'];
  }

  /**
   * Get file patterns to scan
   */
  static getGlobPatterns(): string[] {
    return [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.py',
      '**/*.java',
      '**/*.php',
    ];
  }

  /**
   * Get exclusion patterns
   */
  static getExcludePatterns(): string[] {
    return [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/vendor/**',
      '**/venv/**',
      '**/__pycache__/**',
      '**/target/**',
    ];
  }

  /**
   * Generate shadow API report
   */
  static generateReport(shadowApis: DetectedRoute[]): string {
    if (shadowApis.length === 0) {
      return '✅ No shadow APIs detected. All endpoints are documented.';
    }

    let report = `⚠️ **${shadowApis.length} Shadow APIs Detected**\n\n`;
    report += 'These endpoints exist in code but are not in your API inventory:\n\n';

    const grouped = new Map<string, DetectedRoute[]>();
    for (const api of shadowApis) {
      const key = api.framework;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(api);
    }

    for (const [framework, routes] of grouped) {
      report += `### ${framework.charAt(0).toUpperCase() + framework.slice(1)}\n\n`;
      for (const route of routes) {
        report += `- \`${route.method} ${route.path}\`\n`;
        report += `  - File: \`${route.file}:${route.line}\`\n`;
      }
      report += '\n';
    }

    return report;
  }
}
