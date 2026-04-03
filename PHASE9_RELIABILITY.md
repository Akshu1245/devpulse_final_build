# PHASE 9: High-Availability & Reliability Architecture

**Status**: 🔨 IN PROGRESS - 9A Complete, 9B-9D Coming

**Objective**: Transform DevPulse into a 99.9% uptime (sub-200ms latency) production system with automatic failover, disaster recovery, and comprehensive monitoring.

---

## 📊 Architecture Overview

### PHASE 9 Scope

```
PHASE 9A - Database Replication ✅ COMPLETE
├── PostgreSQL Primary + Replica (streaming replication)
├── Connection pooling with replica read routing
├── Automatic replication lag monitoring
└── Backup strategy

PHASE 9B - Redis High Availability ✅ COMPLETE
├── Redis Master + 2 Replicas
├── Redis Sentinel cluster (3 sentinels for majority quorum)
├── Automatic master failover (<5 seconds)
├── Sentinel monitoring and metrics
└── Connection recovery

PHASE 9C - Application Scaling ✅ COMPLETE
├── 3x Node.js app instances behind Nginx
├── Load balancing (session hash for WebSocket stickiness)
├── Health checks (15s interval, 3 retries max)
├── Graceful shutdown & connection draining
└── Circuit breaker patterns

PHASE 9D - Monitoring & Observability (NEXT)
├── Prometheus metrics for all services
├── Grafana dashboards (HA Health, Performance, Costs)
├── Alert rules for SLO violations
├── Log aggregation & centralized debugging
└── Distributed tracing preparation
```

---

## 🏗️ Detailed Architecture

### Database Layer: Primary + Replica Replication

```
PostgreSQL Primary (Read/Write)
    ↓ Streaming Replication (WAL)
PostgreSQL Replica (Read-Only)
    ↓
Application Routing:
    • Writes → Primary (100%)
    • Reads → Replica by default
    • Fallback to Primary if Replica down
```

**Key Features**:
- **Replication Type**: Streaming WAL (Write-Ahead Log) replication
- **Replication Lag Target**: <1 second (monitored in alerts)
- **Failover**: Manual promotion of replica (automated in PHASE 9F production setup)
- **Backup**: Primary databases exports daily + replica hot standby
- **Connection Pooling**: 
  - Primary: 20 max connections (5 min)
  - Replica: 10 max connections (3 min)

**File**: [docker-compose.prod.yml](#docker-composeprodyml) - lines 31-85

---

### Cache Layer: Redis Sentinel Cluster

```
Redis Master (Write operations)
    ↓
├─ Redis Replica 1 (Read replicas)
└─ Redis Replica 2

Above monitored by:
├─ Sentinel 1 (Port 26379) — Quorum member 1/3
├─ Sentinel 2 (Port 26380) — Quorum member 2/3
└─ Sentinel 3 (Port 26381) — Quorum member 3/3

Failover Trigger Logic (2/3 sentinel majority):
1. Master health check fails (5s timeout)
2. Sentinels initiate voting (2/3 quorum needed)
3. Replica promoted to master (<1 second)
4. Other replicas reconnect to new master
5. Client automatically connects to new master
```

**Features**:
- **Failover Time**: <1 second for master failure detection & promotion
- **Replication Lag**: Monitored via metrics
- **Connection Recovery**: Client auto-reconnects with exponential backoff
- **Password Protection**: All Redis instances require auth
- **Persistence**: AOF (Append-Only File) for durability

**Files**:
- Config: [configs/redis/sentinel-*.conf](#configsredissentinelconf)
- Client: [_core/redisSentinel.ts](#_coreredisentinelts)

---

### Application Layer: Load-Balanced Instances

```
Requests
    ↓
Nginx Reverse Proxy (Load Balancer)
    ├─ App Instance 1 (Port 3001)
    ├─ App Instance 2 (Port 3002)
    └─ App Instance 3 (Port 3003)
    
Load Balancing Strategy:
    • Algorithm: Consistent Hash (session-based)
    • Sticky Sessions: IP-based affinity for WebSocket
    • Health Check: Every 15s (3 retries, 30s fail timeout)
    • Timeout: 60s read/write, 3600s for WebSocket
    • Connection Pooling: Keep-alive with 32 concurrent
```

**Features**:
- **Horizontal Scalability**: Add more app instances by adding services to docker-compose
- **Zero-Downtime Deployment**: Drain connections, update image, restart one at a time
- **Session Persistence**: Redis-backed sessions for stickiness
- **Rate Limiting**:
  - API: 100 req/s (Nginx zone: api_real)
  - Auth: 10 req/s (Nginx zone: auth)

**File**: [configs/nginx/nginx-ha.conf](#configsnginxnginx-haconf) - 200+ lines

---

### Worker Layer: Horizontal Scaling

```
Background Jobs (BullMQ)
    ↓
├─ Worker Instance 1 (Concurrency: 5 jobs parallel)
└─ Worker Instance 2 (Concurrency: 5 jobs parallel)
    ↓
Redis Queue (Sentinel-managed)
    ↓
Database (Primary for writes)
```

**Features**:
- **Concurrency Control**: 5 jobs per worker (tunable via `WORKER_CONCURRENCY`)
- **Job Reliability**: AOF persistence + Redis Sentinel backup
- **Monitoring**: Prometheus metrics for queue depth, failures, latency
- **Retry Logic**: Dead-letter queue for failed jobs

**Configuration**: [docker-compose.prod.yml](#docker-composeprodyml) - workers section

---

### Load Balancing & Reverse Proxy

**Nginx Configuration Details**:
```nginx
upstream app_backend {
    hash $remote_addr consistent;  # Session persistence
    server app-1:3000 weight=1;
    server app-2:3000 weight=1;
    server app-3:3000 weight=1;
    keepalive 32;  # Connection pooling
}

location /api/ {
    limit_req zone=api_real burst=20;  # Rate limiting
    proxy_pass http://app_backend;
    proxy_connect_timeout 30s;
    proxy_read_timeout 60s;
}

location /ws {
    proxy_pass http://app_backend;
    proxy_read_timeout 3600s;  # WebSocket: no timeout
    proxy_buffering off;  # Stream data immediately
}
```

**Security Headers**:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- CSP: Strict content security policy
- HSTS: Strict transport security (production)

---

## 🔧 Core Modules

### PHASE 9A Files

#### `_core/redisSentinel.ts` (600+ lines)

**Singleton wrapper** around ioredis Sentinel client.

**Key Methods**:
```typescript
// Connect to Sentinel cluster
await initializeRedisSentinel(config: SentinelConfig)

// Get clients
redisClient.getMasterClient()      // For writes
redisClient.getReplicaClient()     // For reads
redisClient.getClient(readOnly)    // Smart routing

// Monitoring
await redisClient.healthCheck()    // Returns health status
redisClient.getFailoverHistory()   // Track failovers
redisClient.on('master-switched', ...)  // Listen to events
```

**Failover Detection**:
- Listens to `+switch-master` events from Sentinel
- Auto-reconnects on master change
- Message queue for events during connection loss
- Emits events for application handling

**Health Monitoring**:
- Checks master, replica, and sentinel connectivity
- Tracks replication lag
- Records failover history

---

#### `_core/databaseManager.ts` (550+ lines)

**Connection pool manager** with replica support.

**Key Methods**:
```typescript
// Initialize with primary and replica
await initializeDatabaseManager(config: DatabaseConfig)

// Routing
await dbManager.getWriteClient()   // Always primary
await dbManager.getReadClient()    // Prefer replica
await dbManager.query(sql, values, readOnly)  // Smart routing

// Monitoring
await dbManager.healthCheck()      // Primary, replica, lag status
dbManager.getPoolStats()           // Connection pool metrics
```

**Features**:
- **Read Scaling**: Distributes reads to replica
- **Automatic Failback**: Uses primary if replica unavailable
- **Connection Pooling**: Separate pools for primary (20) and replica (10)
- **Replication Lag Monitoring**: Tracks lag in seconds
- **Pool Statistics**: Idle, total, waiting connections

---

#### `_core/healthCheck.ts` (400+ lines)

**Comprehensive health monitoring** endpoint.

**Endpoints**:
```http
GET /health          # Full health report (primary)
GET /ready           # Readiness probe (for K8s)
GET /live            # Liveness probe (for K8s)
```

**Health Status Includes**:
```json
{
  "status": "healthy|degraded|unhealthy",
  "checks": {
    "database": { "primary": true, "replica": true, "lag": 0.5 },
    "redis": { "master": true, "replica": true, "sentinel": true },
    "cache": { "hitRate": 92.3, "size": "256MB" },
    "application": { "uptime": 86400, "memory": { "used": 512, "total": 2048 } },
    "queue": { "pending": 5, "active": 2, "failed": 0 }
  },
  "slo": { "availability": 99.95 }
}
```

**SLO Calculation**:
- Database: 40% weight
- Redis: 30% weight
- Application: 20% weight
- Cache: 10% weight

---

## 📊 Monitoring & Observability

### Prometheus Configuration

**File**: [configs/prometheus/prometheus-ha.yml](#configsprometheusprometheus-hayml)

**Scrape Jobs**:
- PostgreSQL Primary/Replica (9187:postgres-exporter)
- Redis Master/Replicas/Sentinels (9121:redis-exporter)
- App Instances 1-3 (3000:/metrics)
- Workers 1-2 (3000:/metrics)
- Nginx (80:/nginx-status)

**Scrape Intervals**:
- Database: 10s
- Redis: 10s
- App/Workers: 15s
- Nginx: 30s

### Alert Rules

**File**: [configs/prometheus/alerts.yml](#configsprometheusalertsyml)

**Critical Alerts**:
- PostgreSQL Primary down (1 min)
- Redis Master down (30 sec)
- At least 1 app instance down
- Redis Sentinel quorum lost (<3 active)
- 99.9% availability SLO violation

**Warning Alerts**:
- Replication lag >5 seconds (2 min)
- Connection pool >80% utilization
- Memory usage >80%
- Disk usage >80%
- Error rate >5%
- Response time P95 >1s

---

### Grafana Dashboards

**File**: [configs/grafana/dashboards/](#configsgrafanadashboards)

**Dashboards**:
1. **HA System Health**
   - Database replication status
   - Redis master/replica/sentinel status
   - App instance availability
   - SLO compliance visualization

2. **Performance Metrics**
   - Request latency (P50, P95, P99)
   - Throughput (requests/sec)
   - Error rates by endpoint
   - Cache hit rate

3. **Resource Utilization**
   - CPU, memory, disk usage
   - Connection pool usage
   - Network I/O
   - Queue depth

4. **Business Metrics** (integrated from PHASE 8C WebSocket)
   - LLM cost trending
   - API security incidents
   - Shadow API detections
   - Risk scores

---

## 🚀 Deployment

### Prerequisites

1. **Docker & Docker Compose**: >= 3.9
2. **Minimum Resources**:
   - CPU: 4 cores
   - Memory: 8GB
   - Disk: 50GB (for databases)
3. **Network**: 
   - Ports 80, 443 for external access
   - Internal network for service communication

### Setup Steps

```bash
1. Create .env file from .env.example.prod
   cp .env.example.prod .env
   # Edit .env with your secrets, passwords, API keys

2. Create config directories
   mkdir -p configs/{postgres,redis,nginx,prometheus,grafana}/{datasources,dashboards}

3. Copy configuration files
   # They are already created by docker-compose.prod.yml setup

4. Start HA infrastructure
   docker-compose -f docker-compose.prod.yml up -d

5. Verify services
   # Check all containers running
   docker-compose -f docker-compose.prod.yml ps

   # Check application health
   curl http://localhost/health

6. Access monitoring
   Prometheus: http://localhost:9090
   Grafana: http://localhost:3001 (admin/admin or custom password)
```

### Scaling

**Add more app instances**:
```yaml
# In docker-compose.prod.yml, after app-3 section, add:
app-4:
  build: ...
  environment:
    INSTANCE_ID: app-4
    PORT: 3000
  ports:
    - "3004:3000"
  # ... rest of config ...

# Update Nginx upstream:
upstream app_backend {
    server app-1:3000;
    server app-2:3000;
    server app-3:3000;
    server app-4:3000;  # NEW
}
```

**Restart with new config**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔄 Failover Procedures

### Database Failover (Manual)

**When**: Primary PostgreSQL crashes, replica needs promotion

```bash
# 1. Verify replica is healthy
docker exec devpulse-postgres-replica psql -U postgres -c "SELECT pg_is_in_recovery();"

# 2. Promote replica to master (in docker-compose.prod.yml):
#    - Change database connection string to postgres-replica:5432
#    - Reconnect replicas to new master
#    - Rebuild replica from new master

# 3. Application automatic recovery:
#    - getPrimaryClient() will connect to promoted replica
#    - getReplicaClient() will try to connect (fails) and uses primary
#    - Automatic retry with exponential backoff
```

### Redis Failover (Automatic)

**When**: Redis Master crashes

**Sentinel automatically**:
1. Detects master down (5s timeout)
2. Initiates failover with 2/3 quorum vote
3. Promotes replica 1 to new master
4. Updates all connected clients

**Application handling**:
```typescript
redisClient.on('master-switched', () => {
  console.log('Redis master changed, reconnecting...');
  // Application automatically uses new master via RedisSentinelClient
});
```

### Application Instance Failover (Load Balancer)

**When**: App instance crashes

**Nginx automatically**:
1. Detects unhealthy instance (health check failed)
2. Stops sending traffic to failed instance
3. Routes all traffic to healthy instances (app-1, app-2)
4. Instance auto-restarts via `restart: unless-stopped`
5. Instance rejoins load balancer once healthy

---

## 📈 Performance Targets (PHASE 9)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% (8.64 hr downtime/month) | Uptime % from Prometheus |
| **Response Time** | <200ms P99 | Nginx request_time |
| **Database Replication Lag** | <1 second | pg_replication_lag metric |
| **Cache Hit Rate** | >90% | Redis hit/miss ratio |
| **Queue Processing** | <5s median | BullMQ job latency |
| **Failover Time** | <5 seconds total | Manual test + alerts |

---

## 🧪 Testing HA Setup

### Test Database Failover
```bash
# 1. In one terminal, monitor replication
docker exec devpulse-postgres-primary psql -U postgres -c "SELECT slot_name, active FROM pg_replication_slots;"

# 2. In another terminal, crash primary
docker stop devpulse-postgres-primary

# 3. Verify app:
curl http://localhost/health
# Should show primary: false, replica: true in degraded state

# 4. Restart primary
docker start devpulse-postgres-primary
```

### Test Redis Failover
```bash
# 1. Kill Redis master
docker stop devpulse-redis-master

# 2. Check Sentinel status (should show master switch in logs)
docker logs devpulse-redis-sentinel-1

# 3. Verify app can still access cache
curl -X POST http://localhost/api/test-cache

# 4. Restart master
docker start devpulse-redis-master
```

### Test App Instance Failure
```bash
# 1. Stop one instance
docker stop devpulse-app-2

# 2. Monitor load distribution (check Nginx logs)
docker logs devpulse-nginx | tail -50

# 3. Verify requests still work
for i in {1..10}; do curl http://localhost/api/health; sleep 0.5; done

# 4. Restart instance
docker start devpulse-app-2
```

---

## 📋 Checklist for Production Deployment

- [ ] All services in docker-compose.prod.yml configured
- [ ] `.env` file created with all secrets
- [ ] SSL/TLS certificates generated (nginx.conf section)
- [ ] Database backups scheduled
- [ ] Monitoring dashboards accessible
- [ ] Alert rules tested (trigger test alerts)
- [ ] Failover procedures documented and tested
- [ ] On-call runbooks created
- [ ] Logging aggregation configured (ELK/Splunk)
- [ ] Disaster recovery plan (DRP) documented

---

## 📚 Files Created in PHASE 9A

1. **docker-compose.prod.yml** (400+ lines)
   - PostgreSQL primary + replica
   - Redis master + 2 replicas + 3 sentinels
   - App instances 1-3
   - Workers 1-2
   - Nginx, Prometheus, Grafana

2. **configs/postgres/primary/01-init-replication.sql**
   - Replication user setup

3. **configs/redis/sentinel-{1,2,3}.conf**
   - Sentinel configurations (majority quorum logic)

4. **configs/nginx/nginx-ha.conf** (250+ lines)
   - Load balancing configuration
   - Health checks
   - Rate limiting
   - Security headers
   - WebSocket support

5. **configs/prometheus/prometheus-ha.yml** (150+ lines)
   - Scrape configurations for all services
   - Job definitions

6. **configs/prometheus/alerts.yml** (300+ lines)
   - Alert rules (50+ alerts)
   - SLO violation detection

7. **configs/grafana/datasources/prometheus.yml**
   - Prometheus datasource for Grafana

8. **_core/redisSentinel.ts** (600+ lines)
   - Redis Sentinel client wrapper
   - Auto-failover handling
   - Health monitoring

9. **_core/databaseManager.ts** (550+ lines)
   - Database connection manager
   - Replica read routing
   - Connection pooling

10. **_core/healthCheck.ts** (400+ lines)
    - Health check endpoints (/health, /ready, /live)
    - SLO calculation
    - Monitoring metrics

11. **.env.example.prod**
    - Environment variable template

---

## 🔗 Next Steps (PHASE 9B onwards)

**PHASE 9B**: Advanced Monitoring & Alerting
- Custom Prometheus metrics instrumentation
- Jaeger distributed tracing integration
- Real-time alert notifications (Slack, PagerDuty)
- Automated incident response

**PHASE 9C**: Disaster Recovery
- Automated database backups to S3
- Point-in-time recovery procedures
- Backup testing and validation
- RTO/RPO documentation

**PHASE 9D**: Performance Tuning
- Database query optimization
- Connection pool tuning
- Cache warming strategies
- CDN integration for static assets

**PHASE 10**: Kubernetes Migration (future)
- Helm charts for deployment
- StatefulSets for databases
- Service mesh (Istio) for advanced routing
- Auto-scaling policies

---

## 📞 Support & Debugging

### Check Service Status
```bash
# All containers
docker-compose -f docker-compose.prod.yml ps

# Individual service logs
docker logs devpulse-app-1 -f
docker logs devpulse-postgres-primary -f
docker logs devpulse-redis-master -f
docker logs devpulse-nginx -f
```

### Common Issues

**Issue**: App can't connect to database
```bash
# Check primary is running
docker exec devpulse-postgres-primary pg_isready

# Check replication
docker exec devpulse-postgres-primary psql -U postgres -c "SELECT client_addr, state FROM pg_stat_replication;"
```

**Issue**: Redis Sentinel not detecting failures
```bash
# Check Sentinel is monitoring
docker exec devpulse-redis-sentinel-1 redis-cli -p 26379 SENTINEL masters

# Check sentinel logs
docker logs devpulse-redis-sentinel-1
```

**Issue**: High latency to API
```bash
# Check app instance health
curl http://localhost/health

# Check Nginx upstream status
docker exec devpulse-nginx nginx -T | grep upstream

# Monitor queue depth
curl http://localhost/api/queue-status
```

---

## 📖 References

- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [Redis Sentinel Monitoring](https://redis.io/docs/management/sentinel/)
- [Nginx Load Balancing](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)
- [Docker Compose Guide](https://docs.docker.com/compose/)

---

**Last Updated**: 2026-03-28  
**Author**: DevPulse Engineering  
**Status**: 🟡 PHASE 9A Complete, 9B-9D In Progress
