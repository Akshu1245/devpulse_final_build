# PHASE 9A: Quick Start Guide - High-Availability Deployment

## 🚀 5-Minute Setup

### Step 1: Create Environment File
```bash
cd devpulse_final_build
cp .env.example.prod .env

# Edit .env with your values (minimum required):
# POSTGRES_PASSWORD=your-secure-password
# REDIS_PASSWORD=your-secure-password
# GRAFANA_PASSWORD=your-admin-password
nano .env
```

### Step 2: Start HA Infrastructure
```bash
# Bring up all services (PostgreSQL primary+replica, Redis 3-node + Sentinels, 3 app instances, workers, monitoring)
docker-compose -f docker-compose.prod.yml up -d

# Watch startup logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 3: Verify Services
```bash
# Check all containers running
docker-compose -f docker-compose.prod.yml ps
# Output should show 14 services: postgres-primary, postgres-replica, redis-master, 
# redis-replica-1/2, sentinel-1/2/3, app-1/2/3, worker-1/2, nginx, prometheus, grafana

# Check application is ready
curl http://localhost/health

# Check database replication
docker exec devpulse-postgres-primary psql -U postgres -c \
  "SELECT slot_name, active FROM pg_replication_slots;"

# Check Redis Sentinel status
docker exec devpulse-redis-sentinel-1 redis-cli -p 26379 SENTINEL masters
```

### Step 4: Access Monitoring Dashboards
```
Prometheus:  http://localhost:9090
Grafana:     http://localhost:3001  (admin / password from .env)
Application: http://localhost/      (frontend)
API:         http://localhost/api/  (REST endpoints)
WebSocket:   ws://localhost/ws      (real-time WebSocket)
Health:      http://localhost/health (JSON status)
```

---

## 📊 Architecture At a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERNET (80/443)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │  NGINX   │  Load Balancer + Reverse Proxy
                    │ Port 80  │  (Rate limiting, SSL/TLS, compression)
                    └────┬────┘
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │  App-1  │    │  App-2  │    │  App-3  │  Node.js Instances
    │ :3001   │    │ :3002   │    │ :3003   │  (Express, tRPC, WebSocket)
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼─────────┐    │         ┌────▼─────────┐
    │  POSTGRESQL  │    │         │  REDIS       │
    │  Primary     │    │         │  Sentinel    │
    │  (R/W)       │    │         │  (Cache)     │
    │  :5432       │    │         │              │
    └──────────────┘    │         │  Master      │
         │              │         │  Replica-1  │
         │              │         │  Replica-2  │
    ┌────▼─────────┐    │         │  Sent-1/2/3 │
    │  POSTGRESQL  │    │         └──────────────┘
    │  Replica     │    │
    │  (R/O)       │    │
    │  :5433       │    │    ┌───────────────────┐
    └──────────────┘    │    │  WORKERS          │
                        │    │  (BullMQ)         │
                        │    │  Worker-1         │
                        │    │  Worker-2         │
                        │    │  (Concurrency: 5) │
                        │    └───────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │PROMETHEUS│   │ GRAFANA  │   │ EXPORTERS│
    │:9090     │   │:3001     │   │postgres:9187
    └──────────┘   └──────────┘   │redis:9121
                                   └──────────┘
```

---

## 🔍 What Each Component Does

### Database Layer
| Component | Purpose | Data |
|-----------|---------|------|
| PostgreSQL Primary | Handles all writes, replicates to standby | All application data |
| PostgreSQL Replica | Read-only standby, achieves replication lag <1s | Copy of primary data via WAL streaming |

### Cache Layer
| Component | Purpose | Data |
|-----------|---------|------|
| Redis Master | Cache writes, session storage | API responses, user sessions, queue |
| Redis Replica 1/2 | Read replicas for performance | Copy of master cache |
| Sentinel 1/2/3 | Monitors master, initiates failover (<1s) | Master address, quorum voting |

### Application Layer
| Component | Purpose | Data |
|-----------|---------|------|
| App-1/2/3 | HTTP requests, business logic, WebSocket | Temporary computation state |
| Nginx | Load balancing, rate limiting, TLS | Request routing |
| Worker-1/2 | Background jobs (scanning, reports, etc.) | Job queue in Redis |

### Monitoring
| Component | Purpose | Data |
|-----------|---------|------|
| Prometheus | Metrics collection, alerting | Time-series metrics (1GB/month) |
| Grafana | Visualization, dashboards | Dashboard configs, annotations |
| Exporters | Metrics export (postgres, redis) | Service metrics |

---

## ⚙️ Configuration Files

### Environment Variables (.env)

**Critical - Must Change**:
```bash
POSTGRES_PASSWORD=your-postgres-password-min-16-chars
REDIS_PASSWORD=your-redis-password-min-16-chars
GRAFANA_PASSWORD=your-grafana-admin-password
```

**Optional**:
```bash
NODE_ENV=production           # Keep for prod
LOG_LEVEL=info               # Change to debug for troubleshooting
WORKER_CONCURRENCY=5         # Jobs processed in parallel per worker
```

### Docker Compose

**File**: `docker-compose.prod.yml`

**Services** (14 total):
1. postgres-primary:5432 (PostgreSQL)
2. postgres-replica:5433 (PostgreSQL read-only)
3. redis-master:6379 (Redis)
4. redis-replica-1:6380 (Redis)
5. redis-replica-2:6381 (Redis)
6. redis-sentinel-1:26379
7. redis-sentinel-2:26380
8. redis-sentinel-3:26381
9. app-1:3001
10. app-2:3002
11. app-3:3003
12. worker-1 (background jobs)
13. worker-2 (background jobs)
14. nginx:80 (reverse proxy)
15. prometheus:9090 (monitoring)
16. grafana:3001 (dashboards)

### Nginx Load Balancing

**File**: `configs/nginx/nginx-ha.conf`

**Key Features**:
- Hash-based session routing (consistent affinity for WebSocket)
- Rate limiting: 100 req/s per IP (API), 10 req/s (Auth)
- Health checks: 15s interval, 3 retries
- Connection pooling: 32 keep-alive connections to backends
- Timeouts: 60s read/write, 3600s WebSocket

### Redis Sentinel Configuration

**Files**: `configs/redis/sentinel-{1,2,3}.conf`

**Failover Logic**:
```
down-after-milliseconds: 5000    # Master must be down 5s
parallel-syncs: 1                # Promote 1 replica at a time
failover-timeout: 10000          # 10s total failover window
quorum: 2                        # 2/3 sentinels must agree
```

---

## 📈 Performance Metrics

After 1 hour of operation, you should see:

| Metric | Target | Where to Check |
|--------|--------|-----------------|
| **Availability** | 99.9%+ | Grafana → HA System Health |
| **Response Time (P95)** | <200ms | Grafana → Performance Metrics |
| **Database Replication Lag** | <1s | Prometheus → pg_replication_lag |
| **Redis Hit Rate** | >90% | Grafana → Cache Performance |
| **Queue Processing** | <5s median | Queue metrics in Prometheus |

---

## ⚠️ Failover Testing

### Test Database Failover (1 min)
```bash
# Terminal 1: Monitor replication gap
docker exec devpulse-postgres-primary psql -U postgres -c \
  "SELECT now() - pg_last_xact_replay_timestamp() as replication_lag;"

# Terminal 2: Break primary connection
docker network disconnect devpulse_internal devpulse-postgres-primary

# Observe: App switches to replica (check /health endpoint)
curl http://localhost/health | jq '.checks.database'

# Restore: Reconnect primary
docker network connect devpulse_internal devpulse-postgres-primary
```

### Test Redis Failover (1 min)
```bash
# Terminal 1: Watch Sentinel logs
docker logs devpulse-redis-sentinel-1 -f

# Terminal 2: Kill Redis Master
docker stop devpulse-redis-master

# Observe: Sentinel promotes Replica-1 to new master
docker exec devpulse-redis-sentinel-1 redis-cli -p 26379 \
  SENTINEL MASTERS | grep "redis-master"

# Restore
docker start devpulse-redis-master
```

### Test App Failover (2 min)
```bash
# Terminal 1: Monitor load distribution
docker logs devpulse-nginx | grep "upstream:"

# Terminal 2: Stop one app instance
docker stop devpulse-app-2

# Load test with 10 concurrent requests
for i in {1..10}; do 
  curl -s http://localhost/api/health & 
done
wait

# Verify all succeeded (no errors)

# Restore
docker start devpulse-app-2
```

---

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs -f service-name

# Check port conflicts
lsof -i :3001  # Port 3001 used by app-1
lsof -i :5432  # Port 5432 used by postgres-primary

# Rebuild containers
docker-compose -f docker-compose.prod.yml up -d --build
```

### High Replication Lag
```bash
# Check network connectivity
docker exec devpulse-postgres-replica ping postgres-primary

# Check lag manually
docker exec devpulse-postgres-primary psql -U postgres -c \
  "SELECT client_addr, client_hostname, state FROM pg_stat_replication;"

# If lag > 1min: Check disk I/O, network, or size of WAL files
```

### Redis Sentinel Not Failing Over
```bash
# Verify all 3 sentinels are connected
docker exec devpulse-redis-sentinel-1 redis-cli -p 26379 INFO sentinel

# Check sentinel logs for errors
docker logs devpulse-redis-sentinel-1

# Force failover test (simulates master death)
docker exec devpulse-redis-sentinel-1 redis-cli -p 26379 \
  SENTINEL FAILOVER devpulse-master
```

### App Instances Not Load Balancing
```bash
# Check Nginx config
docker exec devpulse-nginx nginx -T | grep -A 10 "upstream app_backend"

# Check which instances are healthy
for i in 1 2 3; do
  echo "app-$i: $(curl -s http://localhost:300$i/health | jq '.status')"
done

# Check Nginx access logs
docker logs devpulse-nginx | tail -20
```

---

## 🔐 Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Enable SSL/TLS (uncomment nginx https block)
- [ ] Set `ALLOWED_ORIGINS` for CORS
- [ ] Enable firewall rules (allow only 80/443 from internet)
- [ ] Regular secret rotation (postgres, redis, JWT)
- [ ] Database backups encrypted and stored off-site
- [ ] Monitoring dashboards password-protected
- [ ] API keys never logged or exposed
- [ ] Database connections use SSL/TLS (production)

---

## 📚 Next Steps

### Immediate (After Verification)
- [ ] Configure automated backups (`_workers/backup.ts`)
- [ ] Set up email alerts from Prometheus
- [ ] Train ops team on failover procedures
- [ ] Document RTO/RPO targets

### Week 1
- [ ] Enable SSL/TLS with real certificate
- [ ] Configure DNS withhealth check
- [ ] Set up log aggregation (ELK/Splunk)
- [ ] Create runbooks for common incidents

### Month 1
- [ ] Performance tuning (query optimization, cache warming)
- [ ] Disaster recovery drill
- [ ] Capacity planning for 3-6 month growth

---

## 📞 Support

For issues:
1. Check logs: `docker-compose -f docker-compose.prod.yml logs -f SERVICE_NAME`
2. Check health: `curl http://localhost/health`
3. Check Prometheus: http://localhost:9090
4. Check Grafana: http://localhost:3001

See [PHASE9_RELIABILITY.md](./PHASE9_RELIABILITY.md) for detailed architecture and troubleshooting.

---

**Last Updated**: 2026-03-28  
**Next Phase**: PHASE 9B (Monitoring & Advanced Alerting)
