/**
 * DevPulse Distributed Tracing System
 * 
 * Provides end-to-end request tracing across all DevPulse services.
 * Supports OpenTelemetry-compatible trace format for integration
 * with Jaeger, Zipkin, and other tracing backends.
 * 
 * Features:
 * - Automatic trace context propagation
 * - Span creation and management
 * - Performance profiling
 * - Error tracking
 * - Service dependency mapping
 * 
 * @module DevPulse/DistributedTracing
 */

import crypto from 'crypto';

// Types
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  service: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  logs: SpanLog[];
  kind: SpanKind;
}

export type SpanStatus = 'ok' | 'error' | 'unauthenticated' | 'deadline_exceeded' | 'cancelled';

export type SpanKind = 
  | 'internal'
  | 'server'
  | 'client'
  | 'producer'
  | 'consumer';

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface SpanLog {
  timestamp: number;
  fields: Record<string, string | number | boolean>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  startTime: number;
  endTime: number;
  duration: number;
  serviceName: string;
  status: TraceStatus;
}

export type TraceStatus = 'success' | 'failure' | 'partial';

export interface TracingConfig {
  serviceName: string;
  exporterEndpoint?: string;
  sampleRate: number;
  maxSpansPerTrace: number;
  maxSpanDuration: number;
  enabled: boolean;
}

// Default configuration
const DEFAULT_CONFIG: TracingConfig = {
  serviceName: 'devpulse',
  sampleRate: 0.1, // 10% sampling
  maxSpansPerTrace: 1000,
  maxSpanDuration: 30000, // 30 seconds
  enabled: true,
};

// In-memory trace storage
const traces: Map<string, Trace> = new Map();
const activeSpans: Map<string, Span> = new Map();

// Tracing singleton
class DistributedTracing {
  private config: TracingConfig;
  private serviceName: string;
  private exporterEndpoint?: string;
  private sampleRate: number;

  constructor(config: Partial<TracingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.serviceName = this.config.serviceName;
    this.exporterEndpoint = this.config.exporterEndpoint;
    this.sampleRate = this.config.sampleRate;
  }

  /**
   * Generate a new trace ID
   */
  generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a new span ID
   */
  generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Should this request be sampled?
   */
  shouldSample(): boolean {
    return Math.random() < this.sampleRate;
  }

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string | undefined>): TraceContext | null {
    const traceId = headers['x-trace-id'];
    const spanId = headers['x-span-id'];
    const parentSpanId = headers['x-parent-span-id'];
    const sampled = headers['x-sampled'] !== '0';
    const baggageHeader = headers['x-baggage'];

    if (!traceId || !spanId) {
      return null;
    }

    let baggage: Record<string, string> | undefined;
    if (baggageHeader) {
      try {
        baggage = JSON.parse(Buffer.from(baggageHeader, 'base64').toString());
      } catch {
        baggage = {};
      }
    }

    return {
      traceId,
      spanId,
      parentSpanId,
      sampled,
      baggage,
    };
  }

  /**
   * Inject trace context into headers
   */
  injectContext(headers: Record<string, string>, context: TraceContext): Record<string, string> {
    return {
      ...headers,
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId,
      'x-sampled': context.sampled ? '1' : '0',
      'x-baggage': context.baggage 
        ? Buffer.from(JSON.stringify(context.baggage)).toString('base64')
        : '',
    };
  }

  /**
   * Start a new trace
   */
  startTrace(options?: { traceId?: string; sampled?: boolean; baggage?: Record<string, string> }): TraceContext {
    const traceId = options?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const sampled = options?.sampled !== undefined ? options.sampled : this.shouldSample();

    return {
      traceId,
      spanId,
      sampled,
      baggage: options?.baggage,
    };
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    context: TraceContext,
    options?: {
      parentId?: string;
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      startTime?: number;
    }
  ): Span {
    const spanId = this.generateSpanId();
    const span: Span = {
      id: spanId,
      traceId: context.traceId,
      parentId: options?.parentId || context.parentSpanId,
      name,
      service: this.serviceName,
      startTime: options?.startTime || Date.now(),
      status: 'ok',
      attributes: {
        'service.name': this.serviceName,
        'span.kind': options?.kind || 'internal',
        ...options?.attributes,
      },
      events: [],
      logs: [],
      kind: options?.kind || 'internal',
    };

    activeSpans.set(`${context.traceId}:${spanId}`, span);

    return span;
  }

  /**
   * Update span attributes
   */
  setSpanAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    span.attributes = { ...span.attributes, ...attributes };
  }

  /**
   * Add a span event
   */
  addSpanEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  /**
   * Record an error on a span
   */
  recordError(span: Span, error: Error, options?: { message?: string; code?: string }): void {
    span.status = 'error';
    span.attributes['error'] = true;
    span.attributes['error.message'] = options?.message || error.message;
    span.attributes['error.type'] = error.name;
    span.attributes['error.stack'] = error.stack || '';
    if (options?.code) {
      span.attributes['error.code'] = options.code;
    }
  }

  /**
   * Add a log entry to a span
   */
  logSpan(span: Span, fields: Record<string, string | number | boolean>, timestamp?: number): void {
    span.logs.push({
      timestamp: timestamp || Date.now(),
      fields,
    });
  }

  /**
   * End a span
   */
  endSpan(span: Span, status: SpanStatus = 'ok'): Span {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    // Remove from active spans
    activeSpans.delete(`${span.traceId}:${span.id}`);

    // Add to trace
    let trace = traces.get(span.traceId);
    if (!trace) {
      trace = {
        traceId: span.traceId,
        spans: [],
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
        serviceName: this.serviceName,
        status: 'success',
      };
      traces.set(span.traceId, trace);
    }

    trace.spans.push(span);
    trace.endTime = Math.max(trace.endTime, span.endTime);
    trace.duration = trace.endTime - trace.startTime;

    if (status === 'error') {
      trace.status = 'failure';
    }

    // Export trace if configured
    if (this.exporterEndpoint && span.endTime - span.startTime > 100) {
      this.exportSpan(span).catch(err => {
        console.error('[Tracing] Failed to export span:', err);
      });
    }

    return span;
  }

  /**
   * Get a trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return traces.get(traceId);
  }

  /**
   * Get all traces for a time range
   */
  getTraces(options?: {
    startTime?: Date;
    endTime?: Date;
    serviceName?: string;
    status?: TraceStatus;
    limit?: number;
  }): Trace[] {
    const tracesArray = Array.from(traces.values());
    
    return tracesArray
      .filter(trace => {
        if (options?.startTime && trace.startTime < options.startTime.getTime()) return false;
        if (options?.endTime && trace.endTime > options.endTime.getTime()) return false;
        if (options?.serviceName && trace.serviceName !== options.serviceName) return false;
        if (options?.status && trace.status !== options.status) return false;
        return true;
      })
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, options?.limit || 100);
  }

  /**
   * Export a span to the configured endpoint
   */
  private async exportSpan(span: Span): Promise<void> {
    if (!this.exporterEndpoint) return;

    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.serviceName } },
          ],
        },
        scopeSpans: [{
          spans: [this.spanToOTelFormat(span)],
        }],
      }],
    };

    await fetch(this.exporterEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Convert span to OpenTelemetry format
   */
  private spanToOTelFormat(span: Span): any {
    return {
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentId,
      name: span.name,
      kind: this.kindToOTelKind(span.kind),
      startTimeUnixNano: span.startTime * 1_000_000,
      endTimeUnixNano: (span.endTime || Date.now()) * 1_000_000,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: { stringValue: String(value) },
      })),
      status: { code: this.statusToOTelCode(span.status) },
      events: span.events.map(event => ({
        name: event.name,
        timestamp: event.timestamp * 1_000_000,
        attributes: event.attributes ? Object.entries(event.attributes).map(([key, value]) => ({
          key,
          value: { stringValue: String(value) },
        })) : [],
      })),
    };
  }

  /**
   * Convert span kind to OpenTelemetry format
   */
  private kindToOTelKind(kind: SpanKind): number {
    const mapping: Record<SpanKind, number> = {
      internal: 0,
      server: 1,
      client: 2,
      producer: 3,
      consumer: 4,
    };
    return mapping[kind];
  }

  /**
   * Convert status to OpenTelemetry format
   */
  private statusToOTelCode(status: SpanStatus): number {
    const mapping: Record<SpanStatus, number> = {
      ok: 1,
      error: 2,
      unauthenticated: 16,
      deadline_exceeded: 4,
      cancelled: 1,
    };
    return mapping[status];
  }

  /**
   * Clear old traces
   */
  clearOldTraces(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge;
    let removed = 0;

    for (const [traceId, trace] of traces) {
      if (trace.endTime < cutoff) {
        traces.delete(traceId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get trace statistics
   */
  getStatistics(): {
    totalTraces: number;
    activeSpans: number;
    avgDuration: number;
    errorRate: number;
    tracesByStatus: Record<TraceStatus, number>;
    tracesByService: Record<string, number>;
  } {
    const tracesArray = Array.from(traces.values());
    
    const tracesByStatus: Record<TraceStatus, number> = {
      success: 0,
      failure: 0,
      partial: 0,
    };
    const tracesByService: Record<string, number> = {};
    
    let totalDuration = 0;
    let errorCount = 0;

    for (const trace of tracesArray) {
      tracesByStatus[trace.status]++;
      tracesByService[trace.serviceName] = (tracesByService[trace.serviceName] || 0) + 1;
      totalDuration += trace.duration;
      if (trace.status === 'failure') errorCount++;
    }

    return {
      totalTraces: tracesArray.length,
      activeSpans: activeSpans.size,
      avgDuration: tracesArray.length > 0 ? totalDuration / tracesArray.length : 0,
      errorRate: tracesArray.length > 0 ? errorCount / tracesArray.length : 0,
      tracesByStatus,
      tracesByService,
    };
  }
}

// Singleton instance
let tracing: DistributedTracing | null = null;

export function initTracing(config?: Partial<TracingConfig>): DistributedTracing {
  tracing = new DistributedTracing(config);
  return tracing;
}

export function getTracing(): DistributedTracing {
  if (!tracing) {
    tracing = new DistributedTracing();
  }
  return tracing;
}

// Express middleware for automatic tracing
export function tracingMiddleware(req: any, res: any, next: any): void {
  const tracer = getTracing();
  
  // Extract or create context
  let context = tracer.extractContext(req.headers);
  
  if (!context) {
    context = tracer.startTrace({
      sampled: tracer.shouldSample(),
    });
  }

  // Store context on request
  req.traceContext = context;
  req.traceId = context.traceId;

  // Add trace ID to response headers
  res.setHeader('x-trace-id', context.traceId);

  // Start root span for this request
  const span = tracer.startSpan(`${req.method} ${req.path}`, context, {
    kind: 'server',
    attributes: {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.target': req.path,
      'http.host': req.hostname,
      'http.scheme': req.protocol,
      'http.user_agent': req.get('user-agent'),
    },
  });

  // Capture user ID if authenticated
  if (req.user?.id) {
    tracer.setSpanAttributes(span, { 'user.id': req.user.id });
  }

  // Capture workspace ID
  if (req.user?.workspaceId) {
    tracer.setSpanAttributes(span, { 'workspace.id': req.user.workspaceId });
  }

  // Track response
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    tracer.setSpanAttributes(span, {
      'http.status_code': res.statusCode,
      'http.response_time': duration,
    });

    if (res.statusCode >= 400) {
      tracer.setSpanAttributes(span, { 'error': true });
    }

    const status: SpanStatus = 
      res.statusCode >= 500 ? 'error' :
      res.statusCode >= 400 ? 'error' :
      'ok';

    tracer.endSpan(span, status);
  });

  next();
}

// Wrapper for tracing async functions
export async function withSpan<T>(
  name: string,
  context: TraceContext,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const tracer = getTracing();
  const span = tracer.startSpan(name, context, {
    kind: options?.kind,
    attributes: options?.attributes,
  });

  try {
    const result = await fn(span);
    tracer.endSpan(span, 'ok');
    return result;
  } catch (error) {
    tracer.recordError(span, error instanceof Error ? error : new Error(String(error)));
    tracer.endSpan(span, 'error');
    throw error;
  }
}

// Example usage for external API calls
export async function traceClientCall<T>(
  url: string,
  context: TraceContext,
  fn: () => Promise<T>,
  options?: {
    serviceName?: string;
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const tracer = getTracing();
  const span = tracer.startSpan(`HTTP ${url}`, context, {
    kind: 'client',
    attributes: {
      'http.url': url,
      'http.method': 'GET',
      'peer.service': options?.serviceName || '',
      ...options?.attributes,
    },
  });

  // Inject context into outgoing headers
  const headers: Record<string, string> = {};
  tracer.injectContext(headers, context);

  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    tracer.setSpanAttributes(span, {
      'http.response_time': duration,
      'http.status_code': 200,
    });
    
    tracer.endSpan(span, 'ok');
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    tracer.setSpanAttributes(span, {
      'http.response_time': duration,
      'error': true,
    });
    
    tracer.recordError(span, error instanceof Error ? error : new Error(String(error)));
    tracer.endSpan(span, 'error');
    throw error;
  }
}
