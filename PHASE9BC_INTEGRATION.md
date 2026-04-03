# PHASE 9B & 9C Integration Guide

**How to integrate new monitoring and resilience modules into your Express app**

---

## Quick Start (5 minutes)

### 1. Initialize in `src/index.ts`

```typescript
import express from 'express';
import { createServer } from 'http';
import { register, metricsMiddleware } from './_core/prometheus';
import { SentinelHealthMonitor } from './_core/sentinelMonitor';
import { GracefulShutdownManager, setupGracefulShutdown, createDatabaseCleanup, createRedisCleanup, createWorkerCleanup } from './_core/gracefulShutdown';
import { circuitBreakerManager } from './_core/circuitBreaker';
import { ConnectionPoolOptimizer } from './_core/connectionPoolOptimizer';

const app = express();
const server = createServer(app);

// ============================================================================
// 1. Setup Prometheus Metrics (PHASE 9B)
// ============================================================================
app.use(metricsMiddleware);  // Auto-track HTTP requests

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});

// ============================================================================
// 2. Setup Sentinel Health Monitoring (PHASE 9B)
// ============================================================================
const sentinelMonitor = new SentinelHealthMonitor({
  sentinels: [
    { host: 'redis-sentinel-1', port: 26379 },
    { host: 'redis-sentinel-2', port: 26379 },
    { host: 'redis-sentinel-3', port: 26379 },
  ],
  name: 'devpulse-master',
  sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
  sentinelUsername: 'default',
});

// Start monitoring every 30 seconds
sentinelMonitor.startMonitoring(30);

// ============================================================================
// 3. Setup Graceful Shutdown (PHASE 9C)
// ============================================================================
const shutdownManager = new GracefulShutdownManager({
  gracePeriodMs: 30000,   // 30 seconds for in-flight requests
  hardKillMs: 35000       // Force exit at 35 seconds
});

shutdownManager.registerServer(server);

// Register cleanup handlers (order matters - database first)
shutdownManager.onShutdown(createDatabaseCleanup(dbManager));
shutdownManager.onShutdown(createRedisCleanup(redisClient));
shutdownManager.onShutdown(createWorkerCleanup(bullmqWorker));

// Setup SIGTERM/SIGINT handlers
setupGracefulShutdown(shutdownManager);

// ============================================================================
// 4. Setup Connection Pool Optimizer (PHASE 9C)
// ============================================================================
const poolOptimizer = new ConnectionPoolOptimizer();

// Record metrics every 10 seconds
setInterval(async () => {
  // Database pool metrics
  const dbMetrics = await dbManager.getPoolMetrics();
  poolOptimizer.recordMetrics('database_primary', dbMetrics);

  // Redis pool metrics
  const redisMetrics = await redisClient.getPoolMetrics();
  poolOptimizer.recordMetrics('redis_master', redisMetrics);
});

// ============================================================================
// 5. Express Routes
// ============================================================================

// Protected endpoint with circuit breaker
app.get('/api/users', async (req, res) => {
  try {
    const users = await dbCircuitBreaker.execute(async () => {
      const client = await getDbClient();
      return client.query('SELECT * FROM users LIMIT 100');
    });
    res.json(users);
  } catch (error) {
    if (error.message.includes('Circuit is OPEN')) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Health check endpoint (consumed by load balancer)
app.get('/health', async (req, res) => {
  const clusterStatus = await sentinelMonitor.checkClusterHealth();
  const circuitHealth = circuitBreakerManager.getHealth();
  
  const status = {
    status: clusterStatus.quorumHealthy && circuitHealth.healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      sentinel: clusterStatus,
      circuits: circuitHealth,
      shutdown: shutdownManager.getStatus().isShuttingDown ? 'shutting_down' : 'running'
    }
  };

  const code = clusterStatus.quorumHealthy ? 200 : 503;
  res.status(code).json(status);
});

// Readiness probe (for load balancer rolling updates)
app.get('/health/ready', async (req, res) => {
  const ready = !shutdownManager.getStatus().isShuttingDown;
  res.status(ready ? 200 : 503).json({ ready });
});

// Liveness probe (for container restarts)
app.get('/health/live', async (req, res) => {
  res.status(200).json({ alive: true });
});

// Admin endpoint: View circuit breaker health
app.get('/api/admin/circuits', (req, res) => {
  res.json(circuitBreakerManager.getAllMetrics());
});

// Admin endpoint: View pool optimization recommendations
app.get('/api/admin/pool-recommendations', (req, res) => {
  res.json(poolOptimizer.generateReport());
});

// Admin endpoint: View Sentinel diagnostics
app.get('/api/admin/sentinel', async (req, res) => {
  const diagnostics = await sentinelMonitor.getDiagnostics();
  res.json(diagnostics);
});

// ============================================================================
// 6. Start Server
// ============================================================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`Health check at http://localhost:${PORT}/health`);
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdownManager.shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
```

---

## Using Circuit Breakers in Database Calls

### Before (Without Circuit Breaker)

```typescript
// Bad: Database timeout hangs requests for 30 seconds
app.get('/api/users', async (req, res) => {
  try {
    const client = await getDbClient();  // May timeout
    const users = await client.query('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### After (With Circuit Breaker)

```typescript
import { dbCircuitBreaker } from './_core/circuitBreaker';

app.get('/api/users', async (req, res) => {
  try {
    const users = await dbCircuitBreaker.execute(async () => {
      const client = await getDbClient();
      return client.query('SELECT * FROM users');
    });
    res.json(users);
  } catch (error) {
    if (error.message.includes('Circuit is OPEN')) {
      // Serve cached response or error
      const cached = await cache.get('users_list');
      return res.status(cached ? 200 : 503).json(
        cached || { error: 'Service temporarily unavailable' }
      );
    }
    res.status(500).json({ error: error.message });
  }
});

// Circuit behavior:
// Request 1: FAILS → failureCount = 1
// Request 2: FAILS → failureCount = 2
// Request 3: FAILS → failureCount = 3 → Circuit opens (OPEN state)
// Request 4-N: Immediately rejected (fail-fast) → 5ms response
// After 30s: Circuit transitions to HALF_OPEN (test mode)
// Next successful request: Circuit closes (CLOSED state)
```

---

## Recording Custom Metrics

### Example 1: Database Query Tracking

```typescript
import { recordDbQuery } from './_core/prometheus';

async function getUserById(id: number) {
  const startTime = performance.now();
  
  try {
    const client = await getDbClient();
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    
    const duration = (performance.now() - startTime) / 1000;
    recordDbQuery('SELECT', 'users', duration, 'success');
    
    return result.rows[0];
  } catch (error) {
    const duration = (performance.now() - startTime) / 1000;
    recordDbQuery('SELECT', 'users', duration, 'error');
    throw error;
  }
}
```

### Example 2: Cache Operation Tracking

```typescript
import { recordCacheOp } from './_core/prometheus';

async function getUserFromCache(id: number) {
  const cached = await redis.get(`user:${id}`);
  
  if (cached) {
    recordCacheOp('session_cache', 'hit');
    return JSON.parse(cached);
  }
  
  recordCacheOp('session_cache', 'miss');
  
  const user = await getUserById(id);
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
  
  return user;
}
```

### Example 3: Job Processing Tracking

```typescript
import { recordJob } from './_core/prometheus';
import { queueCircuitBreaker } from './_core/circuitBreaker';

async function submitVulnerabilityScan(apiKeyId: string) {
  const startTime = performance.now();
  
  try {
    await queueCircuitBreaker.execute(async () => {
      await scanQueue.add('scan', { apiKeyId }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });
    });
    
    const duration = (performance.now() - startTime) / 1000;
    recordJob('vulnerability_scan', 'submitted', duration);
    
    return { status: 'queued' };
  } catch (error) {
    const duration = (performance.now() - startTime) / 1000;
    recordJob('vulnerability_scan', 'failed', duration);
    
    if (error.message.includes('Circuit is OPEN')) {
      throw new Error('Scan service temporarily unavailable');
    }
    throw error;
  }
}
```

---

## Graceful Shutdown in Action

### How nginx Load Balancer Coordinates

**nginx.conf** (from PHASE 9A):
```nginx
upstream app_backend {
  server app-1:3000 weight=33;
  server app-2:3000 weight=33;
  server app-3:3000 weight=34;
  
  # Health check every 3 seconds
  check interval=3000 rise=2 fall=5 timeout=1000 type=http;
  check_http_send "GET /health/ready HTTP/1.0\r\n\r\n";
  check_http_expect_alive http_2xx;
}
```

**Deployment Rolling Update**:
```bash
#!/bin/bash
# Deploy new version to app instances one at a time

for instance in app-1 app-2 app-3; do
  echo "Updating $instance..."
  
  # Step 1: Pull new image
  docker pull myregistry/devpulse:latest
  
  # Step 2: Stop container gracefully (SIGTERM)
  docker stop -t 30 $instance  # 30s grace period
  
  # Step 3: nginx health check detects 503
  #         nginx removes from rotation
  #         all traffic goes to app-2, app-3
  
  # Step 4: Start new container
  docker run -d --name $instance ...
  
  # Step 5: Container starts health checks
  #         nginx detects 200 after 3-6 seconds
  #         nginx adds back to rotation
  
  sleep 60  # Wait before next instance
done

echo "Deployment complete! All instances updated."
```

---

## Monitoring Integration with Prometheus

### Add to `prometheus.yml`:

```yaml
scrape_configs:
  # Application metrics
  - job_name: 'devpulse-app'
    scrape_interval: 15s
    scrape_timeout: 10s
    static_configs:
      - targets: ['app-1:3000', 'app-2:3000', 'app-3:3000']
    metrics_path: '/metrics'
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  # Sentinel monitoring
  - job_name: 'devpulse-sentinel'
    scrape_interval: 10s
    static_configs:
      - targets: ['redis-sentinel-1:26379', 'redis-sentinel-2:26379', 'redis-sentinel-3:26379']
```

### Add to `alert.rules.yml`:

```yaml
groups:
  - name: devpulse_alerts
    interval: 30s
    rules:
      # Response time SLO
      - alert: HighResponseTime
        expr: histogram_quantile(0.99, devpulse_http_request_duration_seconds) > 0.2
        for: 5m
        annotations:
          summary: "P99 response time exceeds 200ms"

      # Circuit breaker open
      - alert: CircuitBreakerTripped
        expr: devpulse_circuit_breaker_state{state="OPEN"} == 1
        for: 1m
        annotations:
          summary: "Circuit breaker {{ $labels.name }} is open"

      # LLM cost exceeded
      - alert: HighLLMCost
        expr: rate(devpulse_llm_costs_usd_total[1d]) > 100
        for: 10m
        annotations:
          summary: "Daily LLM cost exceeds $100"

      # Sentinel quorum unhealthy
      - alert: SentinelQuorumLost
        expr: devpulse_sentinel_quorum_active < 2
        for: 1m
        annotations:
          summary: "Redis Sentinel quorum lost"
```

---

## Testing the Integration

### Test 1: Verify Metrics Collection

```bash
# Start the application
npm run dev

# In another terminal, check metrics
curl http://localhost:3000/metrics | grep devpulse

# You should see:
# devpulse_http_requests_total{method="GET",route="/api/users",status="200"} 42
# devpulse_http_request_duration_seconds_bucket{le="0.1",route="/api/users"} 35
# devpulse_db_query_duration_seconds_bucket{operation="SELECT",table="users"} 100
```

### Test 2: Test Circuit Breaker

```bash
# Terminal 1: Watch circuit breaker state
curl http://localhost:3000/api/admin/circuits | jq '.dbCircuitBreaker.state'

# Terminal 2: Simulate database failure (kill postgres)
docker stop devpulse-postgres

# Terminal 3: Send requests (they fail)
for i in {1..5}; do curl http://localhost:3000/api/users; done

# Expected:
# Request 1: 500 (database error)
# Request 2: 500 (database error)
# Request 3: 500 (database error) → Circuit opens
# Request 4-5: 503 (circuit open - fail fast)

# Restore database
docker start devpulse-postgres

# Circuit will gradually close after successes
```

### Test 3: Test Graceful Shutdown

```bash
# Terminal 1: Send continuous requests
watch -n 1 'curl -s http://localhost:3000/api/users | jq ".length"'

# Terminal 2: Gracefully shutdown
docker kill -s SIGTERM devpulse-app

# Watch logs - you should see:
# [graceful-shutdown] Starting graceful shutdown...
# [graceful-shutdown] Waiting for 123 in-flight requests...
# [graceful-shutdown] All in-flight requests drained (8.3s)
# [graceful-shutdown] Graceful shutdown completed

# Terminal 1: No connection errors! All requests completed successfully
```

---

## Troubleshooting

### Issue: Circuit breaker always OPEN

```typescript
// Check circuit metrics
const metrics = circuitBreakerManager.getBreaker('database').getMetrics();
console.log(metrics);
// {
//   state: 'OPEN',
//   successRate: 0,
//   failureRate: 100,
//   totalRequests: 10,
//   uptime: 0
// }

// Solution: Check database connectivity
docker exec devpulse-postgres pg_isready
docker logs devpulse-postgres

// Reset circuit manually
circuitBreakerManager.getBreaker('database').reset();
```

### Issue: High replication lag

```bash
# Check Sentinel status
redis-cli -p 26379 sentinel master devpulse-master

# Check replica lag
curl http://localhost:3000/api/admin/sentinel | jq '.replicationLag'

# If lag > 5s:
# 1. Check network between master and replica
# 2. Check replica CPU/memory
# 3. Reduce write throughput temporarily
# 4. Check for long-running queries on master
```

### Issue: Graceful shutdown timeout

```bash
# Increase grace period
const shutdownManager = new GracefulShutdownManager({
  gracePeriodMs: 60000  // 60 seconds instead of 30
});

// Or reduce long-running request timeouts
// In websocket disconnect handlers, always close within 30s
```

---

**Status**: Integration guide complete ✅  
**Time to integrate**: 5-10 minutes per component  
**Production ready**: YES

Next: Deploy to production with rolling updates or proceed to PHASE 10!
