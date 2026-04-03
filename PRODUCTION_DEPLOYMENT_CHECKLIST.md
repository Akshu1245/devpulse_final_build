# DevPulse Production Deployment Complete Guide

**Version:** 1.0.0  
**Date:** April 2026  
**Author:** DevPulse Engineering Team  

---

## 🚀 Pre-Deployment Checklist

### 1. Code Quality Gates

- [ ] Run `npm run build` - Must compile with zero errors
- [ ] Run `npm test` - All tests pass
- [ ] Run `npm run lint` - No linting errors
- [ ] Run `npm audit` - Fix all high/critical vulnerabilities

```bash
# Run all quality checks
npm run build && npm test && npm run lint && npm audit
```

### 2. Environment Configuration

#### Generate All Required Secrets

```bash
# 1. JWT_SECRET (64 characters base64)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 2. ENCRYPTION_MASTER_KEY (64 characters hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Database Password (strong MySQL password)
openssl rand -base64 32

# 4. Redis Password (strong password)
openssl rand -base64 32
```

#### Create .env.production

```env
# ========================
# REQUIRED - PRODUCTION
# ========================

NODE_ENV=production
PORT=3000

# Database (MySQL 8.0+)
DATABASE_URL=mysql://devpulse:<GENERATED_PASSWORD>@<DB_HOST>:3306/devpulse?ssl={"rejectUnauthorized":true}

# Redis (with AUTH)
REDIS_URL=redis://:<REDIS_PASSWORD>@<REDIS_HOST>:6379

# Security Keys (MUST GENERATE)
JWT_SECRET=<GENERATED_64_CHAR_SECRET>
ENCRYPTION_MASTER_KEY=<GENERATED_64_HEX_KEY>

# CORS (Production domains only)
CORS_ORIGINS=https://dashboard.devpulse.in,https://app.devpulse.in

# ========================
# LLM PROVIDERS (Pick needed)
# ========================
OPENAI_API_KEY=REDACTED_OPENAI_API_KEY
ANTHROPIC_API_KEY=REDACTED_ANTHROPIC_API_KEY
GOOGLE_AI_API_KEY=REDACTED_GOOGLE_AI_API_KEY

# ========================
# SLACK (Budget Alerts)
# ========================
SLACK_WEBHOOK_URL=REDACTED_SLACK_WEBHOOK_URL

# ========================
# EMAIL (SMTP)
# ========================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@devpulse.in
SMTP_PASS=<APP_PASSWORD>

# ========================
# STRIPE (Billing)
# ========================
STRIPE_SECRET_KEY=REDACTED_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=REDACTED_STRIPE_WEBHOOK_SECRET
ENABLE_STRIPE_BILLING=true

# ========================
# AWS (S3)
# ========================
AWS_ACCESS_KEY_ID=REDACTED_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=REDACTED_AWS_SECRET_ACCESS_KEY
AWS_REGION=ap-south-1
AWS_S3_BUCKET=devpulse-reports-prod

# ========================
# DEVPULSE CONFIG
# ========================
DEVPULSE_ENV=production
DEVPULSE_API_URL=https://api.devpulse.in
DEVPULSE_API_RATE_LIMIT=1000
DEVPULSE_SCAN_TIMEOUT=300000
DEVPULSE_MAX_ENDPOINTS_PER_SCAN=5000

# ========================
# FEATURE FLAGS
# ========================
ENABLE_THINKING_TOKEN_TRACKING=true
ENABLE_AGENTGUARD=true
ENABLE_COMPLIANCE_REPORTS=true
ENABLE_STRIPE_BILLING=true
```

---

## 🗄️ Database Setup (MySQL 8.0+)

### 1. Create Database and User

```sql
-- Connect as root
mysql -u root -p

-- Create database
CREATE DATABASE devpulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user with strong password
CREATE USER 'devpulse'@'%' IDENTIFIED BY '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON devpulse.* TO 'devpulse'@'%';

-- Enable SSL requirement (production)
ALTER USER 'devpulse'@'%' REQUIRE SSL;

FLUSH PRIVILEGES;
```

### 2. Run Migrations

```bash
# Run all migrations
npm run db:migrate

# Verify migrations ran
npm run db:status
```

### 3. Create Performance Indexes

```bash
# The index migration is already created at:
# database/migrations/0011_performance_indexes.sql
```

---

## 🏪 Redis Setup

### 1. Install and Configure Redis 7.0+

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
```

### 2. Redis Configuration

```conf
# Security
requirepass <REDIS_PASSWORD>
bind 0.0.0.0
port 6379

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec

# TLS (recommended for production)
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
tls-ca-cert-file /path/to/ca.crt
```

### 3. Start Redis

```bash
sudo systemctl restart redis-server
sudo systemctl status redis-server
```

---

## 🌐 Domain & SSL Setup

### 1. DNS Configuration

| Domain | Type | Value |
|--------|------|-------|
| api.devpulse.in | A | `<SERVER_IP>` |
| dashboard.devpulse.in | A | `<SERVER_IP>` |
| www.devpulse.in | CNAME | dashboard.devpulse.in |

### 2. SSL Certificates (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d api.devpulse.in -d dashboard.devpulse.in

# Auto-renewal
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

---

## 🐳 Docker Deployment

### 1. Create docker-compose.prod.yml

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    depends_on:
      - mysql
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: <ROOT_PASSWORD>
      MYSQL_DATABASE: devpulse
      MYSQL_USER: devpulse
      MYSQL_PASSWORD: <DEVPLUSE_PASSWORD>
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    restart: unless-stopped
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass <REDIS_PASSWORD>
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

### 2. Build and Deploy

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 🔒 Nginx Configuration

### nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Performance
    worker_processes auto;
    multi_accept on;
    use epoll;
    
    # Limits
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    # Buffer size
    client_body_buffer_size 16k;
    client_header_buffer_size 1k;
    client_max_body_size 8m;
    large_client_header_buffers 4 8k;

    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req zone=api burst=20 nodelay;
    limit_conn addr 10;

    # Upstream
    upstream api {
        server api:3000;
        keepalive 32;
    }

    server {
        listen 80;
        server_name api.devpulse.in dashboard.devpulse.in;
        
        # Redirect to HTTPS
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.devpulse.in;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/api.devpulse.in/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.devpulse.in/privkey.pem;
        ssl_trusted_certificate /etc/letsencrypt/live/api.devpulse.in/chain.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_session_tickets off;

        # API Proxy
        location / {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check (no rate limit)
        location /health {
            proxy_pass http://api;
            access_log off;
        }

        # Metrics (protected)
        location /metrics {
            proxy_pass http://api;
            auth_basic "Metrics";
            auth_basic_user_file /etc/nginx/.htpasswd;
        }
    }

    server {
        listen 443 ssl http2;
        server_name dashboard.devpulse.in;

        # SSL Configuration
        ssl_certificate /etc/letsencrypt/live/dashboard.devpulse.in/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/dashboard.devpulse.in/privkey.pem;

        # Static files (build from frontend)
        root /var/www/devpulse;
        index index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

---

## 📊 Monitoring Setup

### 1. Prometheus Metrics Endpoint

Metrics available at: `https://api.devpulse.in/metrics`

### 2. Health Check

```bash
# Check API health
curl https://api.devpulse.in/health

# Check database connection
curl https://api.devpulse.in/health/db

# Check Redis connection
curl https://api.devpulse.in/health/redis
```

### 3. Set Up Monitoring Alerts

```yaml
# prometheus-alerts.yml
groups:
  - name: devpulse
    rules:
      - alert: DevPulseDown
        expr: up{job="devpulse-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "DevPulse API is down"
          
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
```

---

## 🔄 Deployment Steps

### 1. Pre-Deployment

```bash
# SSH into server
ssh root@<SERVER_IP>

# Navigate to app directory
cd /opt/devpulse

# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Run quality checks
npm run build
npm test
npm audit
```

### 2. Database Migration

```bash
# Run pending migrations
npm run db:migrate

# Verify
npm run db:status
```

### 3. Restart Services

```bash
# Restart API
docker-compose -f docker-compose.prod.yml restart api

# Or if not using Docker
pm2 restart devpulse
pm2 save
```

### 4. Post-Deployment Verification

```bash
# 1. Check health
curl https://api.devpulse.in/health

# 2. Check logs
docker-compose logs -f api

# 3. Test key endpoints
curl -X POST https://api.devpulse.in/trpc/scan.start \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": 1}'

# 4. Check metrics
curl https://api.devpulse.in/metrics | grep devpulse
```

---

## ✅ Post-Deployment Verification Checklist

### API Endpoints

- [ ] GET /health - Returns 200
- [ ] GET /health/db - Database connected
- [ ] GET /health/redis - Redis connected
- [ ] POST /trpc/auth.login - Login works
- [ ] POST /trpc/scan.start - Scan starts
- [ ] GET /trpc/vulnerability.list - Returns data
- [ ] GET /metrics - Prometheus metrics

### Security

- [ ] HTTPS working (SSL certificate valid)
- [ ] Rate limiting active
- [ ] CORS configured correctly
- [ ] No debug mode enabled
- [ ] Secrets not in logs

### Performance

- [ ] Response time < 200ms (dashboard)
- [ ] Response time < 2s (scans)
- [ ] Memory usage stable
- [ ] No memory leaks

### Monitoring

- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards working
- [ ] Alert rules configured
- [ ] Log aggregation working

---

## 🚨 Rollback Procedure

If something goes wrong:

```bash
# 1. Identify the issue
docker-compose logs -f api

# 2. Rollback to previous version
git revert HEAD
git push
npm run build
docker-compose -f docker-compose.prod.yml restart api

# 3. Or restore from backup
docker-compose -f docker-compose.prod.yml down
docker volume rm devpulse_mysql_data
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📞 Support Contacts

- **Technical Issues:** tech@devpulse.in
- **Security Issues:** security@devpulse.in
- **Business Inquiries:** hello@devpulse.in

---

## 🎉 Go Live!

After completing all checklists:

1. Announce on social media
2. Email beta users
3. Update status page
4. Enable analytics
5. Start monitoring dashboards
6. Celebrate! 🎉
