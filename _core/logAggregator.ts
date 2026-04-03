/**
 * DevPulse Log Aggregator
 * 
 * Centralized log aggregation service that collects logs from multiple sources,
 * normalizes them, and provides querying capabilities.
 * 
 * Features:
 * - Multi-source log collection (API gateway, services, agents)
 * - Log normalization and enrichment
 * - Full-text search and filtering
 * - Real-time log streaming
 * - Log retention management
 * - Export capabilities (JSON, NDJSON)
 * 
 * @module DevPulse/LogAggregator
 */

import crypto from 'crypto';
import { createWriteStream, statSync } from 'fs';
import { Writable } from 'stream';

// Types
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: LogSource;
  service: string;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  userId?: string;
  workspaceId?: number;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  tags?: string[];
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogSource = 
  | 'api_gateway'
  | 'auth_service'
  | 'scan_service'
  | 'llm_proxy'
  | 'agent_guard'
  | 'webhook_service'
  | 'billing_service'
  | 'worker'
  | 'frontend'
  | 'vscode_extension'
  | 'custom';

export interface LogQuery {
  workspaceId?: number;
  level?: LogLevel | LogLevel[];
  source?: LogSource | LogSource[];
  service?: string | string[];
  message?: string;
  startTime?: Date;
  endTime?: Date;
  traceId?: string;
  userId?: string;
  requestId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
}

export interface LogAggregation {
  count: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<string, number>;
  byService: Record<string, number>;
  errorRate: number;
  avgDuration?: number;
  p50Duration?: number;
  p95Duration?: number;
  p99Duration?: number;
}

export interface LogExportOptions {
  format: 'json' | 'ndjson';
  includeMetadata?: boolean;
}

// In-memory log storage
const logStore: Map<string, LogEntry> = new Map();
const logsByWorkspace: Map<number, Set<string>> = new Map();
const logsByTimestamp: Map<number, Set<string>> = new Map();

// Configuration
const MAX_LOGS_IN_MEMORY = 100000;
const LOG_RETENTION_DAYS = 30;

class LogAggregator {
  private listeners: Map<string, Set<(entry: LogEntry) => void>> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the log aggregator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Start retention cleanup
    this.startRetentionCleanup();
    
    this.initialized = true;
    console.log('[LogAggregator] Initialized with in-memory store');
  }

  /**
   * Ingest a log entry
   */
  async ingest(entry: Omit<LogEntry, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    
    const logEntry: LogEntry = {
      ...entry,
      id,
      timestamp: entry.timestamp || new Date(),
      level: entry.level || 'info',
      source: entry.source || 'custom',
    };

    // Store in memory
    logStore.set(id, logEntry);

    // Index by workspace
    if (logEntry.workspaceId) {
      if (!logsByWorkspace.has(logEntry.workspaceId)) {
        logsByWorkspace.set(logEntry.workspaceId, new Set());
      }
      logsByWorkspace.get(logEntry.workspaceId)!.add(id);
    }

    // Index by timestamp (minute granularity)
    const timestampKey = Math.floor(logEntry.timestamp.getTime() / 60000);
    if (!logsByTimestamp.has(timestampKey)) {
      logsByTimestamp.set(timestampKey, new Set());
    }
    logsByTimestamp.get(timestampKey)!.add(id);

    // Enforce memory limit
    this.enforceMemoryLimit();

    // Notify listeners
    this.notifyListeners(logEntry);

    return id;
  }

  /**
   * Ingest logs from a batch
   */
  async ingestBatch(entries: Omit<LogEntry, 'id'>[]): Promise<string[]> {
    return Promise.all(entries.map(e => this.ingest(e)));
  }

  /**
   * Query logs
   */
  async query(query: LogQuery): Promise<LogEntry[]> {
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Get candidate IDs
    let candidateIds: Set<string>;

    if (query.workspaceId && logsByWorkspace.has(query.workspaceId)) {
      candidateIds = new Set(logsByWorkspace.get(query.workspaceId)!);
    } else if (!query.workspaceId) {
      candidateIds = new Set(logStore.keys());
    } else {
      return [];
    }

    // Filter by time range
    if (query.startTime || query.endTime) {
      const startKey = query.startTime 
        ? Math.floor(query.startTime.getTime() / 60000) 
        : 0;
      const endKey = query.endTime 
        ? Math.floor(query.endTime.getTime() / 60000) 
        : Math.floor(Date.now() / 60000);

      const timeIds = new Set<string>();
      for (let key = startKey; key <= endKey; key++) {
        const ids = logsByTimestamp.get(key);
        if (ids) {
          ids.forEach(id => timeIds.add(id));
        }
      }
      candidateIds = new Set([...candidateIds].filter(id => timeIds.has(id)));
    }

    // Fetch entries and apply filters
    const matchingEntries: LogEntry[] = [];
    
    for (const id of candidateIds) {
      const entry = logStore.get(id);
      if (!entry) continue;

      // Filter by level
      if (query.level) {
        const levels = Array.isArray(query.level) ? query.level : [query.level];
        if (!levels.includes(entry.level)) continue;
      }

      // Filter by source
      if (query.source) {
        const sources = Array.isArray(query.source) ? query.source : [query.source];
        if (!sources.includes(entry.source)) continue;
      }

      // Filter by service
      if (query.service) {
        const services = Array.isArray(query.service) ? query.service : [query.service];
        if (!services.includes(entry.service)) continue;
      }

      // Filter by message (substring match)
      if (query.message) {
        if (!entry.message.toLowerCase().includes(query.message.toLowerCase())) {
          continue;
        }
      }

      // Filter by trace ID
      if (query.traceId && entry.traceId !== query.traceId) continue;

      // Filter by user ID
      if (query.userId && entry.userId !== query.userId) continue;

      // Filter by request ID
      if (query.requestId && entry.requestId !== query.requestId) continue;

      // Filter by tags
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every(tag => entry.tags?.includes(tag));
        if (!hasAllTags) continue;
      }

      matchingEntries.push(entry);
    }

    // Sort
    matchingEntries.sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return query.sort === 'asc' ? diff : -diff;
    });

    // Apply pagination
    return matchingEntries.slice(offset, offset + limit);
  }

  /**
   * Get aggregated statistics
   */
  async aggregate(query: Omit<LogQuery, 'limit' | 'offset' | 'sort'>): Promise<LogAggregation> {
    const entries = await this.query({
      ...query,
      limit: 10000,
      sort: 'desc',
    });

    const byLevel: Record<LogLevel, number> = {
      trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0,
    };
    const bySource: Record<string, number> = {};
    const byService: Record<string, number> = {};
    
    let errorCount = 0;
    const durations: number[] = [];

    for (const entry of entries) {
      byLevel[entry.level]++;
      bySource[entry.source] = (bySource[entry.source] || 0) + 1;
      byService[entry.service] = (byService[entry.service] || 0) + 1;

      if (entry.level === 'error' || entry.level === 'fatal') {
        errorCount++;
      }

      if (entry.duration !== undefined) {
        durations.push(entry.duration);
      }
    }

    // Calculate percentiles
    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : undefined;

    return {
      count: entries.length,
      byLevel,
      bySource,
      byService,
      errorRate: entries.length > 0 ? errorCount / entries.length : 0,
      avgDuration,
      p50Duration: p50,
      p95Duration: p95,
      p99Duration: p99,
    };
  }

  /**
   * Stream logs in real-time
   */
  subscribe(
    callback: (entry: LogEntry) => void,
    filter?: LogQuery
  ): () => void {
    const subscriptionId = crypto.randomUUID();
    
    if (!this.listeners.has(subscriptionId)) {
      this.listeners.set(subscriptionId, new Set());
    }
    
    const wrappedCallback = (entry: LogEntry) => {
      // Apply filter if provided
      if (filter) {
        if (filter.workspaceId && entry.workspaceId !== filter.workspaceId) return;
        if (filter.level && !Array.isArray(filter.level) && entry.level !== filter.level) return;
        if (filter.source && !Array.isArray(filter.source) && entry.source !== filter.source) return;
        if (filter.service && !Array.isArray(filter.service) && entry.service !== filter.service) return;
      }
      callback(entry);
    };

    this.listeners.get(subscriptionId)!.add(wrappedCallback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(subscriptionId);
      if (listeners) {
        listeners.delete(wrappedCallback);
        if (listeners.size === 0) {
          this.listeners.delete(subscriptionId);
        }
      }
    };
  }

  /**
   * Export logs to a stream
   */
  async exportLogs(
    query: LogQuery,
    outputStream: Writable,
    options: LogExportOptions
  ): Promise<number> {
    const logs = await this.query({ ...query, limit: 50000 });
    
    let count = 0;

    if (options.format === 'ndjson') {
      for (const log of logs) {
        outputStream.write(JSON.stringify(log) + '\n');
        count++;
      }
      outputStream.end();
    } else {
      // JSON array
      outputStream.write('[\n');
      for (let i = 0; i < logs.length; i++) {
        outputStream.write(JSON.stringify(logs[i], null, 2));
        if (i < logs.length - 1) outputStream.write(',');
        outputStream.write('\n');
        count++;
      }
      outputStream.write(']\n');
    }

    return count;
  }

  /**
   * Export logs to a file
   */
  async exportToFile(
    query: LogQuery,
    filePath: string,
    options: LogExportOptions
  ): Promise<{ path: string; count: number; size: number }> {
    const writeStream = createWriteStream(filePath);
    const count = await this.exportLogs(query, writeStream, options);
    await new Promise(resolve => writeStream.on('finish', resolve));
    
    const stats = statSync(filePath);
    return { path: filePath, count, size: stats.size };
  }

  /**
   * Get log count
   */
  getLogCount(): number {
    return logStore.size;
  }

  /**
   * Get log by ID
   */
  getLogById(id: string): LogEntry | undefined {
    return logStore.get(id);
  }

  /**
   * Clear all logs (use with caution)
   */
  clear(workspaceId?: number): void {
    if (workspaceId) {
      const ids = logsByWorkspace.get(workspaceId);
      if (ids) {
        ids.forEach(id => logStore.delete(id));
        logsByWorkspace.delete(workspaceId);
      }
    } else {
      logStore.clear();
      logsByWorkspace.clear();
      logsByTimestamp.clear();
    }
  }

  /**
   * Notify listeners of new log entries
   */
  private notifyListeners(entry: LogEntry): void {
    for (const [, listeners] of this.listeners) {
      for (const listener of listeners) {
        try {
          listener(entry);
        } catch (error) {
          console.error('[LogAggregator] Listener error:', error);
        }
      }
    }
  }

  /**
   * Enforce memory limit by removing oldest logs
   */
  private enforceMemoryLimit(): void {
    if (logStore.size <= MAX_LOGS_IN_MEMORY) return;

    const toRemove = logStore.size - MAX_LOGS_IN_MEMORY;
    const entries = Array.from(logStore.entries())
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

    for (let i = 0; i < toRemove; i++) {
      const [id, entry] = entries[i];
      logStore.delete(id);
      
      // Remove from workspace index
      if (entry.workspaceId) {
        logsByWorkspace.get(entry.workspaceId)?.delete(id);
      }
      
      // Remove from timestamp index
      const timestampKey = Math.floor(entry.timestamp.getTime() / 60000);
      logsByTimestamp.get(timestampKey)?.delete(id);
    }

    console.log(`[LogAggregator] Removed ${toRemove} oldest logs to enforce memory limit`);
  }

  /**
   * Start retention cleanup job
   */
  private startRetentionCleanup(): void {
    const cleanupInterval = 60 * 60 * 1000; // Run every hour
    
    setInterval(() => {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - LOG_RETENTION_DAYS);
      const cutoffKey = Math.floor(cutoffTime.getTime() / 60000);

      let removed = 0;
      for (const [key, ids] of logsByTimestamp) {
        if (key < cutoffKey) {
          for (const id of ids) {
            const entry = logStore.get(id);
            if (entry) {
              logStore.delete(id);
              if (entry.workspaceId) {
                logsByWorkspace.get(entry.workspaceId)?.delete(id);
              }
              removed++;
            }
          }
          logsByTimestamp.delete(key);
        }
      }

      if (removed > 0) {
        console.log(`[LogAggregator] Retention cleanup removed ${removed} logs older than ${LOG_RETENTION_DAYS} days`);
      }
    }, cleanupInterval);
  }
}

// Singleton instance
let logAggregator: LogAggregator | null = null;

export function getLogAggregator(): LogAggregator {
  if (!logAggregator) {
    logAggregator = new LogAggregator();
  }
  return logAggregator;
}

// Convenience functions
export async function ingestLog(entry: Omit<LogEntry, 'id'>): Promise<string> {
  return getLogAggregator().ingest(entry);
}

export async function queryLogs(query: LogQuery): Promise<LogEntry[]> {
  return getLogAggregator().query(query);
}

export async function aggregateLogs(query: Omit<LogQuery, 'limit' | 'offset' | 'sort'>): Promise<LogAggregation> {
  return getLogAggregator().aggregate(query);
}

export function subscribeToLogs(
  callback: (entry: LogEntry) => void,
  filter?: LogQuery
): () => void {
  return getLogAggregator().subscribe(callback, filter);
}

// Express middleware for automatic request logging
export function requestLoggingMiddleware(req: any, res: any, next: any): void {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;

  // Generate trace ID for distributed tracing
  const traceId = req.headers['x-trace-id'] || requestId;
  req.traceId = traceId;

  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    const logEntry: Omit<LogEntry, 'id'> = {
      timestamp: new Date(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      source: 'api_gateway',
      service: 'devpulse-api',
      message: `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        query: req.query,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      },
      traceId,
      spanId: req.headers['x-span-id'],
      userId: req.user?.id,
      workspaceId: req.user?.workspaceId,
      requestId,
      duration,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    try {
      await ingestLog(logEntry);
    } catch (error) {
      console.error('[LogAggregator] Failed to log request:', error);
    }
  });

  next();
}

// Example: Log levels helper
export const LogLevels = {
  TRACE: 'trace' as LogLevel,
  DEBUG: 'debug' as LogLevel,
  INFO: 'info' as LogLevel,
  WARN: 'warn' as LogLevel,
  ERROR: 'error' as LogLevel,
  FATAL: 'fatal' as LogLevel,
};

// Example: Log sources
export const LogSources = {
  API_GATEWAY: 'api_gateway' as LogSource,
  AUTH_SERVICE: 'auth_service' as LogSource,
  SCAN_SERVICE: 'scan_service' as LogSource,
  LLM_PROXY: 'llm_proxy' as LogSource,
  AGENT_GUARD: 'agent_guard' as LogSource,
  WEBHOOK_SERVICE: 'webhook_service' as LogSource,
  BILLING_SERVICE: 'billing_service' as LogSource,
  WORKER: 'worker' as LogSource,
  FRONTEND: 'frontend' as LogSource,
  VSCODE_EXTENSION: 'vscode_extension' as LogSource,
  CUSTOM: 'custom' as LogSource,
};

export default LogAggregator;
