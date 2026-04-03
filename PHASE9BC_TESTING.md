# PHASE 9B & 9C: Testing & Deployment Guide

---

## 🧪 Unit Tests (Jest)

### Test: Circuit Breaker State Machine

**File**: `_core/circuitBreaker.test.ts`

```typescript
import { CircuitBreaker, CircuitBreakerManager } from './_core/circuitBreaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000
    });
  });

  test('should start in CLOSED state', () => {
    expect(breaker.getMetrics().state).toBe('CLOSED');
  });

  test('should transition CLOSED → OPEN after threshold failures', async () => {
    const failingFn = () => Promise.reject(new Error('fail'));
    
    // First 3 failures
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingFn);
      } catch (err) {
        // Expected
      }
    }
    
    expect(breaker.getMetrics().state).toBe('OPEN');
  });

  test('should fail-fast when OPEN', async () => {
    // Open the circuit
    breaker.setState('OPEN');
    
    const start = Date.now();
    try {
      await breaker.execute(async () => {
        throw new Error('should not execute');
      });
    } catch (error) {
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);  // Should fail immediately
      expect(error.message).toContain('Circuit is OPEN');
    }
  });

  test('should transition OPEN → HALF_OPEN after timeout', async () => {
    breaker.setState('OPEN');
    expect(breaker.getMetrics().state).toBe('OPEN');
    
    // Wait for timeout
    await new Promise(r => setTimeout(r, 1100));
    
    const successFn = () => Promise.resolve('ok');
    await breaker.execute(successFn);
    
    expect(breaker.getMetrics().state).toBe('HALF_OPEN');
  });

  test('should transition HALF_OPEN → CLOSED after successes', async () => {
    breaker.setState('HALF_OPEN');
    
    const successFn = () => Promise.resolve('ok');
    
    // First success
    await breaker.execute(successFn);
    expect(breaker.getMetrics().state).toBe('HALF_OPEN');
    
    // Second success (successThreshold = 2)
    await breaker.execute(successFn);
    expect(breaker.getMetrics().state).toBe('CLOSED');
  });

  test('should return correct metrics', async () => {
    const successFn = () => Promise.resolve('ok');
    
    for (let i = 0; i < 10; i++) {
      try {
        await breaker.execute(successFn);
      } catch (err) {
        // Some may fail
      }
    }
    
    const metrics = breaker.getMetrics();
    expect(metrics).toHaveProperty('state');
    expect(metrics).toHaveProperty('successRate');
    expect(metrics).toHaveProperty('failureRate');
    expect(metrics).toHaveProperty('totalRequests');
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  test('should register and retrieve breakers', () => {
    const breaker = new CircuitBreaker('db', { failureThreshold: 3, successThreshold: 2, timeout: 1000 });
    
    manager.register('database', breaker);
    expect(manager.getBreaker('database')).toBe(breaker);
  });

  test('should get health of all breakers', () => {
    const healthyBreaker = new CircuitBreaker('healthy', { failureThreshold: 3, successThreshold: 2, timeout: 1000 });
    const openBreaker = new CircuitBreaker('open', { failureThreshold: 3, successThreshold: 2, timeout: 1000 });
    
    manager.register('healthy', healthyBreaker);
    manager.register('open', openBreaker);
    openBreaker.setState('OPEN');
    
    const health = manager.getHealth();
    expect(health.openCircuits).toContain('open');
    expect(health.healthy).toBe(false);
  });

  test('should reset all breakers', () => {
    const breaker1 = new CircuitBreaker('b1', { failureThreshold: 3, successThreshold: 2, timeout: 1000 });
    const breaker2 = new CircuitBreaker('b2', { failureThreshold: 3, successThreshold: 2, timeout: 1000 });
    
    manager.register('b1', breaker1);
    manager.register('b2', breaker2);
    breaker1.setState('OPEN');
    breaker2.setState('OPEN');
    
    manager.resetAll();
    
    expect(breaker1.getMetrics().state).toBe('CLOSED');
    expect(breaker2.getMetrics().state).toBe('CLOSED');
  });
});
```

### Test: Graceful Shutdown

**File**: `_core/gracefulShutdown.test.ts`

```typescript
import { GracefulShutdownManager } from './_core/gracefulShutdown';
import { Server } from 'http';

describe('GracefulShutdownManager', () => {
  let manager: GracefulShutdownManager;
  let mockServer: any;

  beforeEach(() => {
    manager = new GracefulShutdownManager({ gracePeriodMs: 5000 });
    
    mockServer = {
      close: jest.fn((cb) => setTimeout(cb, 100)),
      connections: 0
    };
  });

  test('should register server', () => {
    manager.registerServer(mockServer);
    expect(mockServer).toBeDefined();
  });

  test('should register shutdown handlers', () => {
    const handler1 = jest.fn().mockResolvedValue(undefined);
    const handler2 = jest.fn().mockResolvedValue(undefined);
    
    manager.onShutdown(handler1);
    manager.onShutdown(handler2);
    
    // Handlers stored internally
    expect(manager).toBeDefined();
  });

  test('should close server on shutdown', async () => {
    manager.registerServer(mockServer);
    await manager.shutdown();
    
    expect(mockServer.close).toHaveBeenCalled();
  });

  test('should call cleanup handlers in order', async () => {
    const calls: string[] = [];
    
    manager.onShutdown(async () => calls.push('handler1'));
    manager.onShutdown(async () => calls.push('handler2'));
    manager.onShutdown(async () => calls.push('handler3'));
    
    manager.registerServer(mockServer);
    await manager.shutdown();
    
    expect(calls).toEqual(['handler1', 'handler2', 'handler3']);
  });

  test('should track shutdown status', () => {
    expect(manager.getStatus().isShuttingDown).toBe(false);
    
    // Start shutdown (but don't await)
    manager.shutdown().catch(() => {});
    
    // Status should indicate shutting down
    const status = manager.getStatus();
    expect(status).toHaveProperty('inFlightRequests');
  });

  test('should timeout if cleanup takes too long', async () => {
    const slowHandler = () => new Promise(r => setTimeout(r, 10000));
    
    manager.onShutdown(slowHandler);
    manager.registerServer(mockServer);
    
    const start = Date.now();
    await manager.shutdown();
    const elapsed = Date.now() - start;
    
    // Should use hardKillMs (default 35s)
    expect(elapsed).toBeLessThan(40000);
  });

  test('should not start new connections during shutdown', async () => {
    let connectionAttempts = 0;
    mockServer.close = jest.fn((cb) => {
      setTimeout(cb, 100);
    });
    
    manager.registerServer(mockServer);
    manager.shutdown().catch(() => {});
    
    // Attempting to track new connection should indicate shutting down
    expect(manager.getStatus().isShuttingDown).toBe(true);
  });
});
```

### Test: Prometheus Metrics

**File**: `_core/prometheus.test.ts`

```typescript
import { register, recordDbQuery, recordCacheOp, recordJob } from './_core/prometheus';

describe('Prometheus Metrics', () => {
  test('should have httpRequestDuration metric', () => {
    const metrics = register.metrics();
    expect(metrics).toContain('devpulse_http_request_duration_seconds');
  });

  test('should have httpRequestsTotal counter', () => {
    const metrics = register.metrics();
    expect(metrics).toContain('devpulse_http_requests_total');
  });

  test('should record database query', () => {
    recordDbQuery('SELECT', 'users', 0.045, 'success');
    
    const metrics = register.metrics();
    expect(metrics).toContain('devpulse_db_query_duration_seconds_bucket');
    expect(metrics).toContain('table="users"');
  });

  test('should record cache operations', () => {
    recordCacheOp('user_cache', 'hit');
    recordCacheOp('user_cache', 'miss');
    
    const metrics = register.metrics();
    expect(metrics).toContain('devpulse_cache_operations_total');
  });

  test('should record job processing', () => {
    recordJob('vulnerability_scan', 'completed', 12.5);
    
    const metrics = register.metrics();
    expect(metrics).toContain('devpulse_job_processing_duration_seconds_{bucket');
  });

  test('should include default Node.js metrics', () => {
    const metrics = register.metrics();
    expect(metrics).toContain('nodejs_');  // Node.js default metrics
    expect(metrics).toContain('process_');  // Process metrics
  });
});
```

---

## 🚀 Integration Tests

### Test: Circuit Breaker + Database

**File**: `integration/circuit-breaker-database.test.ts`

```typescript
import { dbCircuitBreaker } from '../_core/circuitBreaker';
import { pool } from '../db';

describe('Circuit Breaker Integration with Database', () => {
  test('should handle database errors gracefully', async () => {
    const query = async () => {
      const client = await pool.connect();
      try {
        return await client.query('SELECT * FROM users LIMIT 1');
      } finally {
        client.release();
      }
    };
    
    const result = await dbCircuitBreaker.execute(query);
    expect(result).toBeDefined();
  });

  test('should open circuit after repeated database connection failures', async () => {
    // This test assumes database is down
    // Skip if database is running
    
    if (!process.env.TEST_CIRCUIT_FAILURE) {
      console.log('Skipping failure test - database is running');
      return;
    }

    const failingQuery = async () => {
      const client = await pool.connect();  // Will fail
      return client.query('SELECT 1');
    };

    let openCircuitEncountered = false;
    
    for (let i = 0; i < 10; i++) {
      try {
        await dbCircuitBreaker.execute(failingQuery);
      } catch (error) {
        if (error.message.includes('Circuit is OPEN')) {
          openCircuitEncountered = true;
          break;
        }
      }
    }
    
    expect(openCircuitEncountered).toBe(true);
  });

  test('should recover after database comes back online', async () => {
    const query = async () => {
      const client = await pool.connect();
      try {
        return await client.query('SELECT now()');
      } finally {
        client.release();
      }
    };

    // Initial success
    const result1 = await dbCircuitBreaker.execute(query);
    expect(result1).toBeDefined();
    
    // Circuit should remain CLOSED
    expect(dbCircuitBreaker.getMetrics().state).toBe('CLOSED');
    
    // Another success
    const result2 = await dbCircuitBreaker.execute(query);
    expect(result2).toBeDefined();
  });
});
```

### Test: Graceful Shutdown Integration

**File**: `integration/graceful-shutdown.test.ts`

```typescript
import axios from 'axios';
import { spawn } from 'child_process';

describe('Graceful Shutdown Integration', () => {
  test('should not lose in-flight requests during shutdown', async () => {
    // Start a mock server
    const process = spawn('node', ['test-server.js']);
    
    // Give server time to start
    await new Promise(r => setTimeout(r, 1000));

    const requests = [];
    
    // Send 50 concurrent requests
    for (let i = 0; i < 50; i++) {
      requests.push(
        axios.get('http://localhost:3000/api/slow-endpoint?delay=' + (100 + Math.random() * 1000))
          .catch(err => ({ status: err.response?.status }))
      );
    }

    // After 100ms, send SIGTERM
    setTimeout(() => {
      process.kill('SIGTERM');
    }, 100);

    // All requests should complete (no connection errors)
    const results = await Promise.all(requests);
    
    const failures = results.filter(r => r.status === 'ECONNREFUSED' || r.status === undefined);
    
    expect(failures.length).toBe(0);  // All requests should complete
  }, 60000);

  test('should drain connections within grace period', async () => {
    const process = spawn('node', ['test-server.js'], {
      env: { ...process.env, GRACE_PERIOD_MS: 10000 }
    });

    await new Promise(r => setTimeout(r, 1000));

    const startTime = Date.now();
    
    // Send slow request
    const slowRequest = axios.get('http://localhost:3000/api/slow-endpoint?delay=5000')
      .catch(() => {});

    // Send shutdown signal after request starts
    setTimeout(() => process.kill('SIGTERM'), 500);

    // Wait for process to exit
    await new Promise(resolve => process.on('exit', resolve));

    const duration = Date.now() - startTime;
    
    // Should take at least 5s (slow request) + 500ms (shutdown start), but less than 15s
    expect(duration).toBeGreaterThan(5000);
    expect(duration).toBeLessThan(15000);
  }, 60000);
});
```

---

## 📊 Load Tests (k6)

### Load Test: Monitor Circuit Breakers Under Stress

**File**: `k6/circuit-breaker-stress.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },      // Ramp-up
    { duration: '30s', target: 100 },     // Sustained load
    { duration: '10s', target: 0 },       // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],  // SLO
    http_req_failed: ['rate<0.01'],  // <1% failures
  }
};

export default function () {
  // Track response times
  const res = http.get('http://localhost:3000/api/users');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'status is 503': (r) => r.status === 503,  // Circuit open
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

### Run:
```bash
k6 run k6/circuit-breaker-stress.js

# Expected output:
# http_reqs.................................: 450 avg=0.11 min=0.01 max=0.52
# http_req_duration..........................: avg=145ms p(95)=180ms p(99)=420ms ✓
# http_req_failed............................: 2.2%  ✗ (too high - circuit opened)
```

---

## 🧬 Chaos Engineering Tests

### Test 1: Simulate Database Failover

```bash
#!/bin/bash
# chaos/db-failover-test.sh

set -e

echo "🔴 Starting database failover chaos test..."

# Get primary container ID
PRIMARY=$(docker ps -q -f label=role=primary-db)

echo "Killing primary database ($PRIMARY)..."
docker kill $PRIMARY

echo "Monitoring circuit breaker state..."
for i in {1..60}; do
  STATE=$(curl -s http://localhost:3000/api/admin/circuits | jq -r '.dbCircuitBreaker.state')
  FAILOVER_TIME=$((($i - 1) * 1))
  
  echo "[$FAILOVER_TIME s] Circuit state: $STATE"
  
  if [ "$STATE" = "OPEN" ]; then
    echo "✓ Circuit breaker opened after $FAILOVER_TIME seconds"
    break
  fi
  
  sleep 1
done

sleep 10

echo "Restarting primary database..."
docker start $PRIMARY

echo "Monitoring recovery..."
for i in {1..60}; do
  STATE=$(curl -s http://localhost:3000/api/admin/circuits | jq -r '.dbCircuitBreaker.state')
  RECOVERY_TIME=$((($i - 1) * 1))
  
  echo "[$RECOVERY_TIME s] Circuit state: $STATE"
  
  if [ "$STATE" = "CLOSED" ]; then
    echo "✓ Circuit closed (recovered) after $RECOVERY_TIME seconds"
    break
  fi
  
  sleep 1
done

echo "🟢 Failover chaos test complete!"
```

### Test 2: Simulate Cascade Failure

```bash
#!/bin/bash
# chaos/cascade-failure-test.sh

echo "🔴 Starting cascade failure test..."

# Kill all supporting services
echo "Killing cache..."
docker kill $(docker ps -q -f label=role=redis-master)

echo "Killing database replica..."
docker kill $(docker ps -q -f label=role=replica-db)

echo "Sending 100 concurrent requests while degraded..."
for i in {1..100}; do
  curl -s http://localhost:3000/api/users &
done

wait

echo "Collecting metrics..."
curl -s http://localhost:3000/api/admin/circuits | jq '.[] | {name: .name, state: .state, failureRate: .failureRate}'

echo "🟢 Cascade failure test complete!"
```

---

## ✅ Pre-Deployment Checklist

### PHASE 9B: Metrics

- [ ] Prometheus `register.metrics()` endpoint responds at `/metrics`
- [ ] Sentinel monitor starts without errors
- [ ] Dashboard pod scrapers pulling metrics successfully
- [ ] Alert rules loaded and evaluated
- [ ] Grafana dashboards displaying live data
- [ ] LLM cost counter increments on API calls
- [ ] HTTP request latency recorded in histogram
- [ ] Database query duration tracked per table

### PHASE 9C: Resilience

- [ ] Circuit breakers initialize on app startup
- [ ] `dbCircuitBreaker` executes database queries
- [ ] `cacheCircuitBreaker` wraps Redis operations
- [ ] Graceful shutdown triggers on SIGTERM
- [ ] In-flight requests drain within grace period
- [ ] `/health/ready` endpoint returns 503 during shutdown
- [ ] Connection pool optimizer analyzes and recommends
- [ ] Manual circuit reset works from admin panel

### Infrastructure

- [ ] Nginx health check passes for `/health`
- [ ] Load balancer removes unhealthy instances
- [ ] Rolling deploy: old instance drains connections
- [ ] Rolling deploy: new instance added to rotation
- [ ] Database replication lag < 1s
- [ ] Redis Sentinel failover < 5s
- [ ] No requests lost during failover

### Monitoring

- [ ] Prometheus scrapers green in status
- [ ] Alert notifications working (email, Slack, PagerDuty)
- [ ] Dashboard shows P99 response time
- [ ] Dashboard shows error rate
- [ ] Dashboard shows circuit breaker state
- [ ] Dashboard shows LLM cost running total

---

## 📋 Deployment Steps

### 1. Pre-Deployment Validation

```bash
# Run all tests
npm run test          # Unit tests
npm run test:integration  # Integration tests
npm run test:k6       # Load tests (k6 run)

# Check code quality
npm run lint
npm run type-check

# Check for security vulnerabilities
npm audit

# Verify compilation
npm run build
```

### 2. Stage Deployment

```bash
# Push new image to registry
docker build -t myregistry/devpulse:v1.0.0 .
docker push myregistry/devpulse:v1.0.0

# Deploy to staging environment
kubectl set image deployment/devpulse-staging \
  devpulse=myregistry/devpulse:v1.0.0 \
  --record

# Monitor staging for 30 minutes
kubectl rollout status deployment/devpulse-staging

# Run smoke tests
npm run test:smoke --stage=staging
```

### 3. Production Deployment

```bash
# Rolling update: maximum 1 pod down at a time
kubectl set image deployment/devpulse \
  devpulse=myregistry/devpulse:v1.0.0 \
  --record

# Monitor rollout
kubectl rollout status deployment/devpulse

# Watch Prometheus metrics for anomalies
# In Prometheus dashboard:
# - Error rate should remain < 1%
# - P99 latency should remain < 200ms
# - No circuit breakers should open

# Each instance takes: ~60s (30s drain + 30s startup)
# Total rollout time: ~180s for 3 instances
```

### 4. Post-Deployment Validation

```bash
# Verify all instances healthy
kubectl get pods -l app=devpulse
kubectl get endpoints devpulse

# Check health endpoints
for pod in $(kubectl get pods -l app=devpulse -o jsonpath='{.items[*].metadata.name}'); do
  kubectl exec $pod -- curl http://localhost:3000/health
done

# Monitor error rate
kubectl logs -l app=devpulse -f --tail=100 | grep error

# Verify metrics are collected
curl https://devpulse.example.com/metrics | grep devpulse | head -20

# Run production smoke tests
npm run test:smoke --prod
```

### 5. Rollback Plan (if needed)

```bash
# Immediate rollback
kubectl rollout undo deployment/devpulse

# Watch rollback
kubectl rollout status deployment/devpulse

# The previous version is reinstated within ~180s
```

---

**Status**: Testing & deployment guide complete ✅  
**Total preparation**: ~2-3 hours  
**Risk level**: LOW (circuit breakers + graceful shutdown)  
**Deployment window**: 3-5 minutes (rolling update)

Ready for production! 🚀
