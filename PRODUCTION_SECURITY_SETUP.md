# Production Database & Redis Security Configuration
# =================================================

This guide provides step-by-step instructions for hardening MySQL and Redis for production deployment.

---

## Part 1: MySQL SSL/TLS Configuration

### Prerequisites
- MySQL 8.0+ installed
- Root access to MySQL server
- SSL certificates (Let's Encrypt or self-signed)

### Step 1: Enable SSL on MySQL Server

#### 1.1 Generate SSL Certificates (if not using Let's Encrypt)

```bash
# Create directory for MySQL certs
sudo mkdir -p /var/lib/mysql/ssl
cd /var/lib/mysql/ssl

# Generate CA key and certificate
sudo openssl genrsa 2048 > ca-key.pem
sudo openssl req -new -x509 -nodes -days 3650 -key ca-key.pem -out ca-cert.pem

# Generate server key and certificate
sudo openssl req -newkey rsa:2048 -days 3650 -nodes -keyout server-key.pem -out server-req.pem
sudo openssl rsa -in server-key.pem -out server-key.pem
sudo openssl x509 -req -in server-req.pem -days 3650 -CA ca-cert.pem -CAkey ca-key.pem -set_serial 01 -out server-cert.pem

# Generate client key and certificate
sudo openssl req -newkey rsa:2048 -days 3650 -nodes -keyout client-key.pem -out client-req.pem
sudo openssl rsa -in client-key.pem -out client-key.pem
sudo openssl x509 -req -in client-req.pem -days 3650 -CA ca-cert.pem -CAkey ca-key.pem -set_serial 02 -out client-cert.pem

# Set correct permissions
sudo chown mysql:mysql /var/lib/mysql/ssl/*
sudo chmod 600 /var/lib/mysql/ssl/*-key.pem
sudo chmod 644 /var/lib/mysql/ssl/*-cert.pem
```

#### 1.2 Configure MySQL to Use SSL

Edit `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
[mysqld]
# SSL Configuration
ssl-ca=/var/lib/mysql/ssl/ca-cert.pem
ssl-cert=/var/lib/mysql/ssl/server-cert.pem
ssl-key=/var/lib/mysql/ssl/server-key.pem

# Require SSL for all connections (recommended for production)
require_secure_transport=ON
```

#### 1.3 Restart MySQL

```bash
sudo systemctl restart mysql
sudo systemctl status mysql
```

#### 1.4 Verify SSL is Enabled

```bash
mysql -u root -p -e "SHOW VARIABLES LIKE '%ssl%';"
```

Expected output should show:
- `have_ssl` = `YES`
- `ssl_ca` = `/var/lib/mysql/ssl/ca-cert.pem`

### Step 2: Create Production Database User with SSL Requirement

```sql
-- Connect as root
mysql -u root -p

-- Create database
CREATE DATABASE devpulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user with strong password (use generated password from SECRETS_GENERATION_GUIDE.md)
CREATE USER 'devpulse'@'%' IDENTIFIED BY '<STRONG_GENERATED_PASSWORD>';

-- Grant privileges
GRANT ALL PRIVILEGES ON devpulse.* TO 'devpulse'@'%';

-- REQUIRE SSL for production security
ALTER USER 'devpulse'@'%' REQUIRE SSL;

-- Flush privileges
FLUSH PRIVILEGES;

-- Verify SSL requirement
SHOW CREATE USER 'devpulse'@'%';
```

Expected output should include: `REQUIRE SSL`

### Step 3: Update Application Connection String

In `.env.production`:

```env
DATABASE_URL=mysql://devpulse:<PASSWORD>@<DB_HOST>:3306/devpulse?ssl={"rejectUnauthorized":true}
```

### Step 4: Test Connection from Application

```javascript
// Test script: test-db-ssl.js
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    // Verify SSL is active
    const [rows] = await connection.query("SHOW STATUS LIKE 'Ssl_cipher'");
    console.log('✅ SSL Connection successful!');
    console.log('SSL Cipher:', rows[0].Value);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

Run test:
```bash
node test-db-ssl.js
```

---

## Part 2: Redis AUTH & TLS Configuration

### Prerequisites
- Redis 7.0+ installed
- SSL certificates
- Root access to Redis server

### Step 1: Configure Redis Authentication

#### 1.1 Generate Strong Password

```bash
# Use the Redis password from SECRETS_GENERATION_GUIDE.md
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 1.2 Edit Redis Configuration

Edit `/etc/redis/redis.conf`:

```conf
# ========================
# AUTHENTICATION
# ========================
requirepass <GENERATED_REDIS_PASSWORD>

# Bind to all interfaces (with AUTH enabled)
bind 0.0.0.0

# Protected mode (requires password)
protected-mode yes

# ========================
# PERFORMANCE & MEMORY
# ========================
# Maximum memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec

# ========================
# TLS/SSL (PRODUCTION)
# ========================
port 0
tls-port 6380

# TLS certificates (use same as MySQL or dedicated Redis certs)
tls-cert-file /etc/redis/ssl/redis.crt
tls-key-file /etc/redis/ssl/redis.key
tls-ca-cert-file /etc/redis/ssl/ca.crt

# Client certificate authentication (optional, high security)
# tls-auth-clients yes

# TLS protocols
tls-protocols "TLSv1.2 TLSv1.3"

# TLS ciphers (strong ciphers only)
tls-ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
```

### Step 2: Generate TLS Certificates for Redis

#### Option A: Use Let's Encrypt Certificates

```bash
# If using same domain as API
sudo ln -s /etc/letsencrypt/live/api.devpulse.in/fullchain.pem /etc/redis/ssl/redis.crt
sudo ln -s /etc/letsencrypt/live/api.devpulse.in/privkey.pem /etc/redis/ssl/redis.key
sudo ln -s /etc/letsencrypt/live/api.devpulse.in/chain.pem /etc/redis/ssl/ca.crt

sudo chown redis:redis /etc/redis/ssl/*
sudo chmod 640 /etc/redis/ssl/redis.key
```

#### Option B: Generate Self-Signed Certificates

```bash
sudo mkdir -p /etc/redis/ssl
cd /etc/redis/ssl

# Generate CA
sudo openssl genrsa -out ca.key 4096
sudo openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/CN=Redis CA"

# Generate server certificate
sudo openssl genrsa -out redis.key 4096
sudo openssl req -new -key redis.key -out redis.csr -subj "/CN=redis.devpulse.in"
sudo openssl x509 -req -days 3650 -in redis.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out redis.crt

# Set permissions
sudo chown redis:redis /etc/redis/ssl/*
sudo chmod 640 /etc/redis/ssl/*.key
sudo chmod 644 /etc/redis/ssl/*.crt
```

### Step 3: Restart Redis

```bash
sudo systemctl restart redis-server
sudo systemctl status redis-server
```

### Step 4: Test Redis AUTH & TLS

#### Test AUTH (without TLS first)

Edit `/etc/redis/redis.conf` temporarily:
```conf
port 6379
tls-port 0
```

Restart and test:
```bash
sudo systemctl restart redis-server

# Test without password (should fail)
redis-cli ping
# Expected: (error) NOAUTH Authentication required.

# Test with password (should succeed)
redis-cli -a <REDIS_PASSWORD> ping
# Expected: PONG
```

#### Test TLS

Re-enable TLS in config:
```conf
port 0
tls-port 6380
```

Restart and test:
```bash
sudo systemctl restart redis-server

# Test TLS connection
redis-cli --tls \
  --cert /etc/redis/ssl/redis.crt \
  --key /etc/redis/ssl/redis.key \
  --cacert /etc/redis/ssl/ca.crt \
  -a <REDIS_PASSWORD> \
  ping

# Expected: PONG
```

### Step 5: Update Application Connection String

In `.env.production`:

```env
# With TLS (recommended)
REDIS_URL=rediss://:<REDIS_PASSWORD>@<REDIS_HOST>:6380

# Without TLS (not recommended for production)
# REDIS_URL=redis://:<REDIS_PASSWORD>@<REDIS_HOST>:6379
```

Note: `rediss://` (with 's') enables TLS/SSL

### Step 6: Test Application Connection

```javascript
// Test script: test-redis-auth.js
const Redis = require('ioredis');

async function testRedis() {
  const redis = new Redis(process.env.REDIS_URL, {
    tls: {
      rejectUnauthorized: true
    }
  });

  try {
    const pong = await redis.ping();
    console.log('✅ Redis connection successful!');
    console.log('Response:', pong);
    
    // Test write/read
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log('✅ Write/Read test:', value === 'test-value' ? 'PASSED' : 'FAILED');
    
    await redis.del('test-key');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    process.exit(1);
  } finally {
    await redis.quit();
  }
}

testRedis();
```

Run test:
```bash
node test-redis-auth.js
```

---

## Security Checklist

### MySQL
- [ ] SSL/TLS enabled on server
- [ ] Production user created with strong password
- [ ] `REQUIRE SSL` enforced for devpulse user
- [ ] `require_secure_transport=ON` in config (optional, but recommended)
- [ ] Firewall allows port 3306 only from application servers
- [ ] Root user password rotated
- [ ] Test connection from application succeeds
- [ ] Verify SSL cipher in use

### Redis
- [ ] `requirepass` configured with strong password
- [ ] TLS enabled on port 6380
- [ ] Port 6379 disabled (or bound to localhost only)
- [ ] TLS certificates installed and valid
- [ ] Firewall allows port 6380 only from application servers
- [ ] `protected-mode yes` enabled
- [ ] Test connection from application succeeds
- [ ] Verify AUTH required

### General
- [ ] All passwords stored in secure vault
- [ ] Passwords NOT in version control
- [ ] .env.production in .gitignore
- [ ] Connection strings use ssl/tls parameters
- [ ] Certificates have expiry monitoring
- [ ] Certificate auto-renewal configured (if using Let's Encrypt)

---

## Troubleshooting

### MySQL: "ERROR 2026 (HY000): SSL connection error"
- Verify SSL certificates exist and have correct permissions
- Check `ssl-ca`, `ssl-cert`, `ssl-key` paths in `mysqld.cnf`
- Ensure `have_ssl = YES` when running `SHOW VARIABLES LIKE '%ssl%';`

### MySQL: "ERROR 1045 (28000): Access denied"
- Verify password is correct
- Check user has `REQUIRE SSL` if connecting without SSL

### Redis: "NOAUTH Authentication required"
- Verify password in REDIS_URL matches redis.conf
- Check password doesn't have special chars that need URL encoding

### Redis: "Error: read ECONNREFUSED"
- Verify Redis is listening on correct port (6379 or 6380)
- Check firewall allows connection
- Ensure `bind 0.0.0.0` in redis.conf (or specific IP)

### Redis: "Error: self signed certificate"
- Set `rejectUnauthorized: false` for self-signed certs (development only!)
- Or add self-signed CA to system trust store

---

**Last Updated:** 2026-04-03  
**Maintainer:** DevPulse Security Team
