# DevPulse Credentials Setup Guide

## ⚠️ Required: Copy .env.example to .env

```bash
cp .env.example .env
```

---

## 📋 Complete List of Credentials You Need

### 1. 🔴 Required (Must Have for Production)

| Variable | How to Generate/Get | Example |
|----------|-------------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:password@localhost:3306/devpulse` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Generate with command below | `abc123...` (min 32 chars) |
| `ENCRYPTION_MASTER_KEY` | Generate with command below | 64 hex characters |

#### Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

#### Generate ENCRYPTION_MASTER_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 2. 🟡 LLM Provider API Keys (Optional but Recommended)

| Variable | Provider | Where to Get |
|----------|----------|--------------|
| `OPENAI_API_KEY` | OpenAI (GPT-4) | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | https://console.anthropic.com/settings/keys |
| `GOOGLE_AI_API_KEY` | Google AI | https://makersuite.google.com/app/apikeys |
| `MISTRAL_API_KEY` | Mistral AI | https://console.mistral.ai/ |
| `COHERE_API_KEY` | Cohere | https://dashboard.cohere.ai/api-keys |

---

### 3. 🟡 Communication Services (Optional)

| Variable | Service | Where to Get |
|----------|---------|--------------|
| `SLACK_WEBHOOK_URL` | Slack Budget Alerts | https://api.slack.com/messaging/webhooks |
| `SMTP_HOST` | Email Server | Your email provider |
| `SMTP_USER` | Email | Your email |
| `SMTP_PASS` | Email Password | Your email app password |
| `TWILIO_ACCOUNT_SID` | SMS Notifications | https://console.twilio.com/ |
| `TWILIO_AUTH_TOKEN` | SMS | From Twilio Console |
| `TWILIO_FROM_NUMBER` | SMS | From Twilio Console |

---

### 4. 🟡 Payment Processing (Optional)

| Variable | Service | Where to Get |
|----------|---------|--------------|
| `STRIPE_SECRET_KEY` | Stripe Billing | https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhooks | https://dashboard.stripe.com/webhooks |
| `STRIPE_PRICE_ID_PRO` | Stripe Product | Create in Stripe Dashboard |
| `STRIPE_PRICE_ID_ENTERPRISE` | Stripe Product | Create in Stripe Dashboard |

---

### 5. 🔵 AWS Services (Optional)

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `AWS_ACCESS_KEY_ID` | S3 Storage | AWS IAM Console |
| `AWS_SECRET_ACCESS_KEY` | S3 Storage | AWS IAM Console |
| `AWS_REGION` | S3 Region | e.g., `us-east-1` |
| `AWS_S3_BUCKET` | S3 Bucket Name | Create in S3 Console |

---

### 6. 🔵 Frontend Config (Optional)

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `VITE_SUPABASE_URL` | Supabase Auth | https://supabase.com/dashboard |
| `VITE_SUPABASE_ANON_KEY` | Supabase Auth | https://supabase.com/dashboard |

---

## 🚀 Quick Start Setup

### Minimal .env for Local Development:

```env
# Database (Required)
DATABASE_URL=postgresql://devpulse:devpulse123@localhost:5432/devpulse

# Redis (Required)
REDIS_URL=redis://localhost:6379

# Security Keys (Generate these!)
JWT_SECRET=generate_with_node_command_below_32chars_minimum
ENCRYPTION_MASTER_KEY=generate_with_node_command_below_64hexchars

# LLM Provider (Pick one to start)
OPENAI_API_KEY=sk-your-openai-key-here

# Environment
NODE_ENV=development
PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000
```

### Generate Keys:
```bash
# JWT_SECRET (48 bytes base64 = ~64 characters)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# ENCRYPTION_MASTER_KEY (32 bytes hex = 64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📊 Full .env Example with All Options

```env
# ======================
# REQUIRED
# ======================

# Database
DATABASE_URL=mysql://user:password@localhost:3306/devpulse

# Redis
REDIS_URL=redis://localhost:6379

# Security (MUST GENERATE)
JWT_SECRET=YOUR_GENERATED_64_CHAR_SECRET_HERE
ENCRYPTION_MASTER_KEY=YOUR_GENERATED_64_HEX_KEY_HERE

# ======================
# LLM PROVIDERS
# ======================

# OpenAI (GPT-4, GPT-3.5)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Anthropic (Claude 3, Claude 2)
ANTHROPIC_API_KEY=REDACTED_ANTHROPIC_API_KEY

# Google (Gemini Pro)
GOOGLE_AI_API_KEY=REDACTED_GOOGLE_AI_API_KEY

# Mistral AI
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cohere
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ======================
# SLACK (Budget Alerts)
# ======================

SLACK_WEBHOOK_URL=REDACTED_SLACK_WEBHOOK_URL

# ======================
# EMAIL (Notifications)
# ======================

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# ======================
# TWILIO (SMS)
# ======================

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=REDACTED_TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER=+1234567890

# ======================
# STRIPE (Billing)
# ======================

STRIPE_SECRET_KEY=REDACTED_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=REDACTED_STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_PRO=price_REPLACE_WITH_REAL_VALUE
STRIPE_PRICE_ID_ENTERPRISE=price_REPLACE_WITH_REAL_VALUE

# ======================
# AWS (File Storage)
# ======================

AWS_ACCESS_KEY_ID=REDACTED_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=REDACTED_AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=devpulse-reports

# ======================
# FRONTEND
# ======================

VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=REDACTED_SUPABASE_ANON_KEY

# ======================
# SERVER CONFIG
# ======================

NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:5173,https://dashboard.devpulse.in
LOG_LEVEL=info

# ======================
# DEVPULSE CONFIG
# ======================

DEVPULSE_ENV=production
DEVPULSE_API_URL=https://api.devpulse.in
DEVPULSE_API_RATE_LIMIT=1000
DEVPULSE_SCAN_TIMEOUT=300000
DEVPULSE_MAX_ENDPOINTS_PER_SCAN=1000
```

---

## 🔒 Security Checklist

Before going to production:

- [ ] Generate new JWT_SECRET (don't use example)
- [ ] Generate new ENCRYPTION_MASTER_KEY (don't use example)
- [ ] Use strong MySQL password
- [ ] Use strong Redis password
- [ ] Configure proper CORS_ORIGINS
- [ ] Enable Stripe in production
- [ ] Set up AWS credentials securely
- [ ] Enable SSL/TLS
- [ ] Set up proper firewall rules

---

## 🚨 Common Issues

### Issue: "JWT_SECRET must be at least 32 characters"
**Fix:** Generate a new secret with the command above.

### Issue: "ENCRYPTION_MASTER_KEY must be exactly 64 hex characters"
**Fix:** Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Issue: "DATABASE_URL is required"
**Fix:** Set DATABASE_URL in your .env file to your MySQL connection string.

### Issue: "Redis connection failed"
**Fix:** Make sure Redis is running locally or update REDIS_URL to point to your Redis server.
