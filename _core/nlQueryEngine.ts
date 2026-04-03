/**
 * DevPulse Natural Language Query Engine
 * 
 * Enables natural language queries for DevPulse data.
 * Converts human queries into structured database queries.
 * 
 * @module DevPulse/NLQueryEngine
 */

// Types
export interface QueryResult {
  success: boolean;
  data?: any;
  explanation?: string;
  query?: string;
  error?: string;
}

export interface ParsedQuery {
  intent: QueryIntent;
  entities: QueryEntity[];
  filters: QueryFilter[];
  sort?: SortSpec;
  limit?: number;
}

export type QueryIntent =
  | 'list_vulnerabilities'
  | 'list_scans'
  | 'list_costs'
  | 'list_agents'
  | 'list_shadow_apis'
  | 'get_risk_score'
  | 'get_cost_summary'
  | 'count'
  | 'summarize'
  | 'unknown';

export interface QueryEntity {
  type: 'severity' | 'status' | 'workspace' | 'time_range' | 'method' | 'category';
  value: string;
  original: string;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: any;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

// Intent patterns
const INTENT_PATTERNS: { intent: QueryIntent; patterns: RegExp[] }[] = [
  {
    intent: 'list_vulnerabilities',
    patterns: [
      /vulnerabilit|security\s+(issue|findings|problem)|flaw|exploit/i,
      /show\s+(me\s+)?(all\s+)?vulns?/i,
      /what\s+vulnerabilit/i,
    ],
  },
  {
    intent: 'list_scans',
    patterns: [
      /scan|result|scan\s+(history|list)/i,
      /show\s+(me\s+)?scan/i,
      /security\s+scan/i,
    ],
  },
  {
    intent: 'list_costs',
    patterns: [
      /cost|spend|expense|token|billing|llm/i,
      /how\s+much\s+(did\s+)?(we|i)/i,
      /llm\s+(cost|usage|spend)/i,
    ],
  },
  {
    intent: 'list_agents',
    patterns: [
      /agent|gpt|claude|llm|running/i,
      /which\s+agent/i,
      /active\s+(agent|llm)/i,
    ],
  },
  {
    intent: 'list_shadow_apis',
    patterns: [
      /shadow\s+api|undocumented|unauthorized|rogue\s+api/i,
      /hidden\s+endpoint/i,
      /secret\s+api/i,
    ],
  },
  {
    intent: 'get_risk_score',
    patterns: [
      /risk\s+(score|level|rating)|security\s+score/i,
      /how\s+secure/i,
      /riskier/i,
    ],
  },
  {
    intent: 'get_cost_summary',
    patterns: [
      /cost\s+summary|total\s+(cost|spend)|expense\s+report/i,
      /monthly\s+cost/i,
      /billing\s+summary/i,
    ],
  },
  {
    intent: 'count',
    patterns: [
      /how\s+many|count|number\s+of|total\s+/i,
      /get\s+me\s+the\s+count/i,
    ],
  },
  {
    intent: 'summarize',
    patterns: [
      /summarize|summary|overview|at\s+a\s+glance/i,
      /tell\s+me\s+(about|what)/i,
    ],
  },
];

// Entity extractors
const ENTITY_EXTRACTORS: { type: QueryEntity['type']; patterns: RegExp[]; transform: (match: string) => string }[] = [
  {
    type: 'severity',
    patterns: [/critical|high|medium|low|info/i],
    transform: (m) => m.toLowerCase(),
  },
  {
    type: 'status',
    patterns: [/open|fixed|ignored|resolved|patched|active/i],
    transform: (m) => m.toLowerCase(),
  },
  {
    type: 'time_range',
    patterns: [
      /today|yesterday|this\s+week|this\s+month|last\s+(week|month|year)|past\s+(\d+)\s+(day|week|month)/i,
    ],
    transform: (m) => m.toLowerCase(),
  },
  {
    type: 'method',
    patterns: [/GET|POST|PUT|DELETE|PATCH/i],
    transform: (m) => m.toUpperCase(),
  },
];

// Severity synonyms
const SEVERITY_SYNONYMS: Record<string, string> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
  warning: 'medium',
  severe: 'critical',
};

// Time range to date conversion
function getTimeRange(range: string): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start = new Date(now);

  const lower = range.toLowerCase();

  if (lower === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (lower === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
  } else if (lower.includes('this week')) {
    const day = now.getDay();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (lower.includes('this month')) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (lower.includes('last week')) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (lower.includes('last month')) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else if (lower.includes('last year')) {
    start = new Date(now.getFullYear() - 1, 0, 1);
  } else {
    // Default to last 7 days
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  }

  return { start, end };
}

/**
 * Natural Language Query Engine
 */
export class NLQueryEngine {
  /**
   * Parse natural language query into structured query
   */
  parseQuery(query: string): ParsedQuery {
    const lowerQuery = query.toLowerCase();

    // Detect intent
    let intent: QueryIntent = 'unknown';
    for (const { intent: i, patterns } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(lowerQuery)) {
          intent = i;
          break;
        }
      }
      if (intent !== 'unknown') break;
    }

    // Extract entities
    const entities: QueryEntity[] = [];
    for (const extractor of ENTITY_EXTRACTORS) {
      for (const pattern of extractor.patterns) {
        const match = lowerQuery.match(pattern);
        if (match) {
          entities.push({
            type: extractor.type,
            value: extractor.transform(match[0]),
            original: match[0],
          });
          break;
        }
      }
    }

    // Build filters from entities
    const filters: QueryFilter[] = [];

    for (const entity of entities) {
      switch (entity.type) {
        case 'severity':
          const severity = SEVERITY_SYNONYMS[entity.value] || entity.value;
          filters.push({ field: 'severity', operator: 'eq', value: severity });
          break;
        case 'status':
          filters.push({ field: 'status', operator: 'eq', value: entity.value });
          break;
        case 'time_range':
          const range = getTimeRange(entity.original);
          filters.push({ field: 'createdAt', operator: 'gte', value: range.start });
          filters.push({ field: 'createdAt', operator: 'lte', value: range.end });
          break;
        case 'method':
          filters.push({ field: 'method', operator: 'eq', value: entity.value });
          break;
      }
    }

    // Extract sort
    let sort: SortSpec | undefined;
    if (lowerQuery.includes('latest') || lowerQuery.includes('newest') || lowerQuery.includes('recent')) {
      sort = { field: 'createdAt', direction: 'desc' };
    } else if (lowerQuery.includes('oldest') || lowerQuery.includes('earliest')) {
      sort = { field: 'createdAt', direction: 'asc' };
    } else if (lowerQuery.includes('worst') || lowerQuery.includes('highest')) {
      sort = { field: 'severity', direction: 'asc' };
    } else if (lowerQuery.includes('best') || lowerQuery.includes('lowest')) {
      sort = { field: 'severity', direction: 'desc' };
    }

    // Extract limit
    let limit = 50;
    const limitMatch = lowerQuery.match(/top\s+(\d+)|first\s+(\d+)|last\s+(\d+)/i);
    if (limitMatch) {
      limit = parseInt(limitMatch[1] || limitMatch[2] || limitMatch[3]);
    }

    return { intent, entities, filters, sort, limit };
  }

  /**
   * Execute a natural language query
   * Returns query structure that can be used by the API layer
   */
  async executeQuery(query: string, workspaceId: number): Promise<QueryResult> {
    try {
      const parsed = this.parseQuery(query);
      
      // Return structured query that can be executed by the router
      return {
        success: true,
        data: {
          workspaceId,
          intent: parsed.intent,
          filters: parsed.filters,
          sort: parsed.sort,
          limit: parsed.limit || 50,
        },
        explanation: this.getExplanation(parsed),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Query parsing failed: ${message}` };
    }
  }

  /**
   * Get human-readable explanation of parsed query
   */
  private getExplanation(parsed: ParsedQuery): string {
    const parts: string[] = [];
    
    if (parsed.intent !== 'unknown') {
      const intentDescriptions: Record<QueryIntent, string> = {
        list_vulnerabilities: 'vulnerabilities',
        list_scans: 'scan results',
        list_costs: 'LLM cost events',
        list_agents: 'agent events',
        list_shadow_apis: 'shadow API detections',
        get_risk_score: 'risk score',
        get_cost_summary: 'cost summary',
        count: 'item count',
        summarize: 'summary',
        unknown: 'data',
      };
      parts.push(`Finding ${intentDescriptions[parsed.intent]}`);
    }
    
    if (parsed.entities.length > 0) {
      const severity = parsed.entities.find(e => e.type === 'severity');
      const status = parsed.entities.find(e => e.type === 'status');
      const timeRange = parsed.entities.find(e => e.type === 'time_range');
      
      if (severity) parts.push(`with ${severity.value} severity`);
      if (status) parts.push(`that are ${status.value}`);
      if (timeRange) parts.push(`from ${timeRange.original}`);
    }
    
    return parts.join(' ') || 'Query parsed';
  }

  /**
   * Build SQL-like representation of query
   */
  buildQueryRepresentation(parsed: ParsedQuery, workspaceId: number): string {
    const parts: string[] = [];
    
    // Intent determines SELECT
    switch (parsed.intent) {
      case 'list_vulnerabilities':
        parts.push('SELECT * FROM vulnerabilities');
        break;
      case 'list_scans':
        parts.push('SELECT * FROM scans');
        break;
      case 'list_costs':
        parts.push('SELECT * FROM llmCostEvents');
        break;
      case 'list_agents':
        parts.push('SELECT * FROM agentguardEvents');
        break;
      case 'list_shadow_apis':
        parts.push('SELECT * FROM shadowApiDetections');
        break;
      default:
        parts.push('SELECT * FROM vulnerabilities');
    }
    
    // WHERE clause
    const conditions: string[] = [`workspaceId = ${workspaceId}`];
    
    for (const filter of parsed.filters) {
      switch (filter.operator) {
        case 'eq':
          conditions.push(`${filter.field} = '${filter.value}'`);
          break;
        case 'gte':
          conditions.push(`${filter.field} >= '${filter.value}'`);
          break;
        case 'lte':
          conditions.push(`${filter.field} <= '${filter.value}'`);
          break;
      }
    }
    
    if (conditions.length > 0) {
      parts.push(`WHERE ${conditions.join(' AND ')}`);
    }
    
    // ORDER BY
    if (parsed.sort) {
      parts.push(`ORDER BY ${parsed.sort.field} ${parsed.sort.direction.toUpperCase()}`);
    }
    
    // LIMIT
    parts.push(`LIMIT ${parsed.limit || 50}`);
    
    return parts.join(' ');
  }
}

// Singleton instance
let queryEngine: NLQueryEngine | null = null;

export function getNLQueryEngine(): NLQueryEngine {
  if (!queryEngine) {
    queryEngine = new NLQueryEngine();
  }
  return queryEngine;
}

// Convenience function
export async function executeNLQuery(query: string, workspaceId: number): Promise<QueryResult> {
  return getNLQueryEngine().executeQuery(query, workspaceId);
}

// Query examples for UI
export const EXAMPLE_QUERIES = [
  'Show me all critical vulnerabilities',
  'What vulnerabilities did we find this week?',
  'How many high severity issues are open?',
  'Show me the latest security scan results',
  'What was our LLM cost this month?',
  'Which agents are running the most?',
  'Show me all undocumented APIs',
  'What is our current risk score?',
  'Summarize our security posture',
  'Count all SQL injection vulnerabilities',
];

export default NLQueryEngine;
