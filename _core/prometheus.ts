// @ts-nocheck
/**
 * PHASE 9B: Custom Prometheus Metrics & Instrumentation
 * 
 * Provides application-level metrics for:
 * - Request latency (P50, P95, P99)
 * - Error rates per endpoint
 * - Business metrics (API calls, scans, costs)
 * - Cache performance
 * - Queue health
 * - Database performance
 */

import pino from 'pino';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Initialize default metrics (CPU, memory, Node.js internals)
collectDefaultMetrics({ register, prefix: 'devpulse_' });

// ==================== REQUEST METRICS ====================

/**
 * HTTP Request latency (in seconds)
 * Labels: method, endpoint, status
 */
export const httpRequestDuration = new Histogram({
  name: 'devpulse_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Up to 10s
});

/**
 * HTTP Request count
 * Labels: method, endpoint, status
 */
export const httpRequestsTotal = new Counter({
  name: 'devpulse_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

/**
 * HTTP request body size in bytes
 * Labels: method, endpoint
 */
export const httpRequestSize = new Histogram({
  name: 'devpulse_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1024, 10240, 102400, 1048576], // 100B, 1KB, 10KB, 100KB, 1MB
});

/**
 * HTTP response body size in bytes
 * Labels: method, endpoint, status
 */
export const httpResponseSize = new Histogram({
  name: 'devpulse_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 1024, 10240, 102400, 1048576],
});

// ==================== ERROR METRICS ====================

/**
 * Errors by type and endpoint
 * Labels: type, endpoint, isClient (true/false)
 */
export const errorsTotal = new Counter({
  name: 'devpulse_errors_total',
  help: 'Total errors by type',
  labelNames: ['type', 'route', 'is_client'],
});

/**
 * Current error rate (errors in last 60 seconds)
 */
export const currentErrorRate = new Gauge({
  name: 'devpulse_current_error_rate',
  help: 'Current error rate (errors/sec)',
});

// ==================== DATABASE METRICS ====================

/**
 * Database query duration
 * Labels: operation (SELECT, INSERT, UPDATE, DELETE), table
 */
export const dbQueryDuration = new Histogram({
  name: 'devpulse_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

/**
 * Database queries total
 * Labels: operation, table, status (success/error)
 */
export const dbQueriesTotal = new Counter({
  name: 'devpulse_db_queries_total',
  help: 'Total database queries',
  labelNames: ['operation', 'table', 'status'],
});

/**
 * Replication lag in seconds
 */
export const replicationLag = new Gauge({
  name: 'devpulse_replication_lag_seconds',
  help: 'PostgreSQL replication lag in seconds',
});

/**
 * Database connection pool status
 * Labels: pool_type (primary, replica), status (idle, active, waitingCount)
 */
export const dbConnectionPool = new Gauge({
  name: 'devpulse_db_connections',
  help: 'Database connection pool status',
  labelNames: ['pool_type', 'status'],
});

// ==================== CACHE METRICS ====================

/**
 * Cache hit/miss ratio
 * Labels: cache_name, action (hit, miss, evict)
 */
export const cacheOperations = new Counter({
  name: 'devpulse_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['cache_name', 'action'],
});

/**
 * Cache hit rate percentage (calculated from above)
 */
export const cacheHitRate = new Gauge({
  name: 'devpulse_cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_name'],
});

/**
 * Redis memory usage
 */
export const redisMemoryUsage = new Gauge({
  name: 'devpulse_redis_memory_bytes',
  help: 'Redis memory usage in bytes',
  labelNames: ['instance'],
});

// ==================== QUEUE METRICS ====================

/**
 * BullMQ queue size (pending jobs)
 * Labels: queue_name
 */
export const queueSize = new Gauge({
  name: 'devpulse_queue_size',
  help: 'Number of pending jobs in queue',
  labelNames: ['queue_name'],
});

/**
 * Jobs processed (including failures)
 * Labels: queue_name, status (completed, failed, delayed)
 */
export const jobsProcessed = new Counter({
  name: 'devpulse_jobs_processed_total',
  help: 'Total jobs processed',
  labelNames: ['queue_name', 'status'],
});

/**
 * Job processing duration
 * Labels: queue_name
 */
export const jobProcessingDuration = new Histogram({
  name: 'devpulse_job_processing_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue_name'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
});

/**
 * Queue processing latency (time from queue to start)
 * Labels: queue_name
 */
export const queueLatency = new Histogram({
  name: 'devpulse_queue_latency_seconds',
  help: 'Queue processing latency (time waiting in queue)',
  labelNames: ['queue_name'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
});

// ==================== BUSINESS METRICS ====================

/**
 * API key usage
 * Labels: workspace_id, method
 */
export const apiKeyUsage = new Counter({
  name: 'devpulse_api_key_usage_total',
  help: 'API key usage by workspace',
  labelNames: ['workspace_id', 'method'],
});

/**
 * LLM API calls (tracked for costs)
 * Labels: provider (openai, anthropic, etc.)
 */
export const llmApiCalls = new Counter({
  name: 'devpulse_llm_api_calls_total',
  help: 'LLM API calls by provider',
  labelNames: ['provider', 'model'],
});

/**
 * LLM tokens consumed (input + output)
 * Labels: provider, token_type (input, output)
 */
export const llmTokensConsumed = new Counter({
  name: 'devpulse_llm_tokens_consumed_total',
  help: 'LLM tokens consumed',
  labelNames: ['provider', 'model', 'token_type'],
});

/**
 * LLM costs (in USD)
 * Labels: provider
 */
export const llmCostsUsd = new Counter({
  name: 'devpulse_llm_costs_usd_total',
  help: 'Total LLM costs in USD',
  labelNames: ['provider'],
});

/**
 * Security scans performed
 * Labels: scan_type (owasp, shadow_api, agent_guard)
 */
export const securityScansTotal = new Counter({
  name: 'devpulse_security_scans_total',
  help: 'Security scans performed',
  labelNames: ['scan_type', 'status'],
});

/**
 * Vulnerabilities detected
 * Labels: severity (critical, high, medium, low)
 */
export const vulnerabilitiesDetected = new Counter({
  name: 'devpulse_vulnerabilities_detected_total',
  help: 'Vulnerabilities detected',
  labelNames: ['severity', 'scanner'],
});

/**
 * Shadow APIs detected
 * Labels: num_endpoints
 */
export const shadowApisDetected = new Counter({
  name: 'devpulse_shadow_apis_detected_total',
  help: 'Shadow APIs detected',
});

/**
 * Rogue agents detected by AgentGuard
 */
export const rogueAgentsDetected = new Counter({
  name: 'devpulse_rogue_agents_detected_total',
  help: 'Rogue agents detected by AgentGuard',
  labelNames: ['incident_type'],
});

// ==================== SENTINEL METRICS ====================

/**
 * Sentinel master instance failures detected
 * Labels: sentinel_id
 */
export const sentinelFailoversTotal = new Counter({
  name: 'devpulse_sentinel_failovers_total',
  help: 'Sentinel failovers initiated',
  labelNames: ['sentinel_id'],
});

/**
 * Redis master election time (seconds)
 */
export const masterElectionDuration = new Histogram({
  name: 'devpulse_master_election_duration_seconds',
  help: 'Time to elect new Redis master',
  buckets: [0.5, 1, 2, 5, 10],
});

/**
 * Sentinel quorum status (number of active sentinels)
 */
export const sentinelQuorum = new Gauge({
  name: 'devpulse_sentinel_quorum_active',
  help: 'Number of active sentinels (3 = healthy)',
});

/**
 * Time since last successful health check per service
 */
export const lastHealthCheckTime = new Gauge({
  name: 'devpulse_last_health_check_seconds',
  help: 'Seconds since last health check',
  labelNames: ['service'],
});

// ==================== AVAILABILITY METRICS ====================

/**
 * Service availability (1 = up, 0 = down)
 * Labels: service_name
 */
export const serviceAvailability = new Gauge({
  name: 'devpulse_service_available',
  help: 'Service availability (1=up, 0=down)',
  labelNames: ['service'],
});

/**
 * SLO compliance: availability percentage for timeframe
 */
export const sloAvailability = new Gauge({
  name: 'devpulse_slo_availability_percent',
  help: 'SLO availability percentage',
});

/**
 * SLO compliance: response time P99 (milliseconds)
 */
export const sloResponseTimeP99 = new Gauge({
  name: 'devpulse_slo_response_time_p99_ms',
  help: 'P99 response time for SLO',
});

/**
 * SLO compliance: error rate percentage
 */
export const sloErrorRate = new Gauge({
  name: 'devpulse_slo_error_rate_percent',
  help: 'Error rate percentage for SLO',
});

// ==================== MIDDLEWARE: HTTP REQUEST TRACKING ====================

/**
 * Express middleware to track HTTP metrics
 */
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  const method = req.method;
  const route = req.route?.path || req.path || 'unknown';

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const status = res.statusCode;

    // Track request duration
    httpRequestDuration.labels(method, route, status).observe(duration);

    // Track request count
    httpRequestsTotal.labels(method, route, status).inc();

    // Track sizes if available
    if (req.headers['content-length']) {
      const reqSize = parseInt(req.headers['content-length'], 10);
      httpRequestSize.labels(method, route).observe(reqSize);
    }

    if (res.getHeader('content-length')) {
      const resSize = parseInt(res.getHeader('content-length'), 10);
      httpResponseSize.labels(method, route, status).observe(resSize);
    }

    // Track errors
    if (status >= 400) {
      const isClientError = status < 500;
      errorsTotal.labels('http_error', route, String(isClientError)).inc();
    }
  });

  next();
}

// ==================== HELPERS ====================

/**
 * Record database query metrics
 */
export function recordDbQuery(
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  duration: number,
  status: 'success' | 'error' = 'success'
) {
  dbQueryDuration.labels(operation, table).observe(duration / 1000); // Convert ms to seconds
  dbQueriesTotal.labels(operation, table, status).inc();
}

/**
 * Record cache operation
 */
export function recordCacheOp(
  cacheName: string,
  action: 'hit' | 'miss' | 'evict'
) {
  cacheOperations.labels(cacheName, action).inc();
}

/**
 * Record job completion
 */
export function recordJob(
  queueName: string,
  status: 'completed' | 'failed' | 'delayed',
  duration: number
) {
  jobsProcessed.labels(queueName, status).inc();
  jobProcessingDuration.labels(queueName).observe(duration / 1000);
}

/**
 * Update calculated metrics (cache hit rate, error rate, etc.)
 */
export function updateCalculatedMetrics() {
  // These would be called periodically (every 60 seconds)
  // to calculate and update gauge metrics
}

export { register };
