# DevPulse Security Hardening Guide

## 🔒 Security Architecture Overview

This document describes the security measures implemented in DevPulse and recommended configuration for production deployment.

---

## ✅ Security Measures Implemented

### 1. Authentication & Authorization

| Feature | Implementation | Status |
|---------|---------------|--------|
| JWT Authentication | HS256 with 32+ char secrets | ✅ Implemented |
| RBAC (Role-Based Access) | Admin, Editor, Viewer roles | ✅ Implemented |
| API Key Authentication | For machine-to-machine | ✅ Implemented |
| Session Management | Redis-backed sessions | ✅ Implemented |

### 2. Data Encryption

| Feature | Implementation | Status |
|---------|---------------|--------|
| Secrets Encryption | AES-256-GCM | ✅ Implemented |
| API Key Encryption | AES-256-GCM with random IV | ✅ Implemented |
| Password Hashing | bcrypt (cost factor 12) | ✅ Implemented |
| TLS/HTTPS | Required in production | ✅ Required |

### 3. Input Validation

| Feature | Implementation | Status |
|---------|---------------|--------|
| Schema Validation | Zod schemas on all inputs | ✅ Implemented |
| SQL Injection Prevention | Drizzle ORM (parameterized) | ✅ Implemented |
| XSS Prevention | Output encoding | ✅ Implemented |
| CSRF Protection | Double-submit cookie pattern | ✅ Implemented |

### 4. Rate Limiting & Throttling

| Feature | Implementation | Status |
|---------|---------------|--------|
| Global Rate Limit | 1000 req/min | ✅ Implemented |
| Per-IP Limit | 100 req/min | ✅ Implemented |
| Per-Workspace Limit | 100 req/min | ✅ Implemented |
| Scan Deduplication | Lock-based deduplication | ✅ Implemented |

### 5. Secrets Management

| Feature | Implementation | Status |
|---------|---------------|--------|
| Environment Variables | All secrets in .env | ✅ Implemented |
| No Hardcoded Secrets | Code review complete | ✅ Verified |
| Encryption Master Key | 64 hex chars (AES-256) | ✅ Implemented |
| Redis Fallback | Graceful degradation | ✅ Implemented |

---

## 🚨 Critical Security Configurations

### 1. Production Environment Variables

**MUST** be set in production (never in code):

```env
# SECURITY CRITICAL - Generate with commands below
JWT_SECRET=<64-char-base64-string>
ENCRYPTION_MASTER_KEY=<64-char-hex-string>

# Database - Use strong password
DATABASE_URL=mysql://user:<STRONG_PASSWORD>@host:3306/devpulse

# Redis - Use AUTH password
REDIS_URL=redis://:password@host:6379

# Stripe - Production keys only
STRIPE_SECRET_KEY=REDACTED_STRIPE_SECRET_KEY
```

### 2. Generate Secure Keys

```bash
# Generate JWT_SECRET (64 characters base64)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Generate ENCRYPTION_MASTER_KEY (64 characters hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. CORS Configuration

Production CORS must whitelist specific origins:

```env
CORS_ORIGINS=https://dashboard.devpulse.in,https://app.devpulse.in
```

---

## 🔒 File Security Checklist

### ✅ No Hardcoded Secrets (Verified)

All secrets are stored in environment variables:
- ✅ `JWT_SECRET` - In .env only
- ✅ `ENCRYPTION_MASTER_KEY` - In .env only  
- ✅ `STRIPE_SECRET_KEY` - In .env only
- ✅ `AWS_ACCESS_KEY_ID` - In .env only
- ✅ `AWS_SECRET_ACCESS_KEY` - In .env only
- ✅ API Keys (OpenAI, Anthropic, etc.) - In .env only

### ✅ Source Code Protection

```bash
# .gitignore should contain:
.env
.env.production
.env.local
*.log
node_modules/
dist/
coverage/
```

### ✅ GitHub Secrets for CI/CD

When using GitHub Actions, store secrets in:
- Settings → Secrets and variables → Actions
- Never commit `.env` files

---

## 🛡️ Production Deployment Checklist

### Server Security

- [ ] Use HTTPS only (redirect HTTP to HTTPS)
- [ ] Enable TLS 1.3
- [ ] Use strong SSL certificates (Let's Encrypt or commercial)
- [ ] Configure proper HSTS headers
- [ ] Disable directory listing
- [ ] Enable request logging

### Database Security

- [ ] Use MySQL 8.0+ with SSL
- [ ] Enable binary logging
- [ ] Set strong root password
- [ ] Create dedicated application user with minimal privileges
- [ ] Enable audit logging
- [ ] Regular security updates

### Redis Security

- [ ] Use Redis 7.0+ with AUTH
- [ ] Enable TLS for Redis
- [ ] Use strong password
- [ ] Disable dangerous commands (FLUSHALL, CONFIG, etc.)
- [ ] Set max memory limits

### API Security

- [ ] Enable rate limiting (already implemented)
- [ ] Enable request validation
- [ ] Enable response compression
- [ ] Disable detailed error messages in production
- [ ] Enable request ID tracking
- [ ] Enable audit logging

---

## 🔐 Code Security Patterns

### 1. Secure Password Hashing

```typescript
// Use bcrypt with cost factor 12
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(password, hash);
```

### 2. Secure Token Generation

```typescript
// Use crypto for tokens
const token = crypto.randomBytes(32).toString('hex');
```

### 3. Secure Cookie Settings

```typescript
res.cookie('session', token, {
  httpOnly: true,    // Not accessible via JavaScript
  secure: true,      // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

### 4. Secure Headers (Helmet)

```typescript
import helmet from 'helmet';
app.use(helmet());
```

### 5. Input Sanitization

```typescript
// Always validate with Zod
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  workspaceId: z.number().int().positive()
});
```

---

## 🚨 Security Monitoring

### Implemented Monitoring

| Metric | Description |
|--------|-------------|
| Failed Login Attempts | Track and alert on failures |
| Rate Limit Hits | Monitor abuse attempts |
| API Errors | Track 4xx/5xx errors |
| Scan Failures | Monitor security scan status |
| Budget Alerts | Track LLM cost anomalies |

### Log Security Events

```typescript
// Log authentication failures
if (loginAttempts > 5) {
  console.warn('[SECURITY] Multiple failed login attempts', { ip, userId });
}

// Log rate limit violations
if (rateLimitExceeded) {
  console.warn('[SECURITY] Rate limit exceeded', { ip, endpoint });
}

// Log privilege escalation attempts
if (unauthorizedAccess) {
  console.error('[SECURITY] Unauthorized access attempt', { userId, resource });
}
```

---

## 🔒 Production Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables
- [ ] Strong passwords for all services
- [ ] TLS certificates valid and configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] No debug mode in production
- [ ] Error messages don't expose stack traces
- [ ] GitHub Actions secrets configured

### Post-Deployment

- [ ] Verify HTTPS works
- [ ] Verify rate limiting works
- [ ] Test authentication flows
- [ ] Test authorization (RBAC)
- [ ] Verify logging works
- [ ] Set up monitoring alerts
- [ ] Test backup/restore

---

## 📞 Security Response Plan

If a security incident occurs:

1. **Immediately**:
   - Rotate all secrets (JWT, API keys, etc.)
   - Disable affected accounts
   - Enable additional monitoring

2. **Within 1 hour**:
   - Assess scope of breach
   - Notify affected users
   - Document incident

3. **Within 24 hours**:
   - Identify root cause
   - Implement fix
   - Update security measures
   - Report to authorities if required

---

## 🔐 Security Summary

DevPulse implements these security measures:

| Category | Measures |
|----------|----------|
| **Authentication** | JWT, API Keys, Session Management |
| **Authorization** | RBAC, Workspace isolation |
| **Encryption** | AES-256-GCM, bcrypt, TLS |
| **Input Validation** | Zod schemas, Parameterized queries |
| **Rate Limiting** | Global, Per-IP, Per-workspace |
| **Monitoring** | Logging, Metrics, Alerts |
| **Secrets** | Environment variables only |
| **Infrastructure** | Docker, Kubernetes, TLS |

**No hardcoded secrets exist in the codebase.** All sensitive data is stored in environment variables and encrypted at rest using AES-256-GCM.

---

## ⚠️ Important Notes

1. **Never commit .env files** - They are in .gitignore
2. **Rotate secrets regularly** - Especially in production
3. **Use strong passwords** - Minimum 32 characters for keys
4. **Enable TLS** - Always use HTTPS in production
5. **Monitor logs** - Watch for suspicious activity
6. **Keep dependencies updated** - Run `npm audit` regularly
