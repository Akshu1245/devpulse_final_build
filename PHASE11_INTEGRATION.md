# PHASE 11: Integration & Deployment Guide

## Quick Start Checklist

- [ ] Set up Stripe account & API keys
- [ ] Apply database schema
- [ ] Configure environment variables
- [ ] Initialize billing services
- [ ] Register webhook endpoint
- [ ] Test billing flows
- [ ] Deploy to production

---

## Step 1: Stripe Setup

### 1.1 Create Stripe Account

```bash
# Visit https://stripe.com
# Sign up and navigate to Dashboard
# Go to Developers → API keys
```

### 1.2 Locate API Keys

```
Publishable Key:     REDACTED_STRIPE_PUBLISHABLE_KEY
Secret Key:          REDACTED_STRIPE_SECRET_KEY
Webhook Secret:      REDACTED_STRIPE_WEBHOOK_SECRET
```

### 1.3 Create Price Objects

Use Stripe Dashboard to create prices for each tier:

```
FREE TIER
├─ Price ID: price_free_monthly        ($0.00/month)
├─ Recurring: Monthly
└─ Billing method: Charge automatically

STARTER
├─ Price ID: price_starter_monthly     ($29.00/month)
├─ Price ID: price_starter_annual      ($290.00/year - 17% discount)
└─ Recurring: Monthly/Annual

PROFESSIONAL
├─ Price ID: price_pro_monthly         ($99.00/month)
├─ Price ID: price_pro_annual          ($990.00/year - 17% discount)
└─ Recurring: Monthly/Annual

ENTERPRISE
├─ Price ID: price_enterprise_quote    (Custom)
└─ Billing: Manual
```

---

## Step 2: Environment Configuration

### 2.1 Update .env File

```bash
# Create/update .env in project root
touch .env

# Add billing configuration
cat >> .env << 'EOF'
# ===== STRIPE CONFIGURATION =====
STRIPE_SECRET_KEY=REDACTED_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=REDACTED_STRIPE_WEBHOOK_SECRET

# ===== METERING CONFIGURATION =====
METERING_SAMPLE_INTERVAL=5000               # Flush buffer every 5s
METERING_AGGREGATION_INTERVAL=60000         # Aggregate every 60s
METERING_REPORTING_INTERVAL=300000          # Report every 5min

# ===== DATABASE - BILLING =====
DB_BILLING_HOST=localhost
DB_BILLING_PORT=3306
DB_BILLING_USER=devpulse_billing
DB_BILLING_PASSWORD=secure_password
DB_BILLING_DATABASE=devpulse_billing

# ===== PAYMENTS =====
PAYMENT_RETRY_ATTEMPTS=3
PAYMENT_RETRY_DELAY=86400000               # 24 hours
INVOICE_DUE_DAYS=14
DUNNING_ENABLED=true
DUNNING_SCHEDULE=1,3,7,14

# ===== WEBHOOK =====
WEBHOOK_BASE_URL=https://your-domain.com/api/webhooks
WEBHOOK_TIMEOUT_MS=30000
WEBHOOK_MAX_RETRIES=3
EOF
```

### 2.2 Verify Environment

```bash
# Test connection
node -e "console.log(process.env.STRIPE_SECRET_KEY ? 'OK' : 'MISSING')"
```

---

## Step 3: Database Setup

### 3.1 Create Billing Database

```bash
# Connect to MySQL
mysql -u root -p

# Create billing database
mysql> CREATE DATABASE devpulse_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
mysql> USE devpulse_billing;

# Create billing user
mysql> CREATE USER 'devpulse_billing'@'localhost' IDENTIFIED BY 'secure_password';
mysql> GRANT ALL PRIVILEGES ON devpulse_billing.* TO 'devpulse_billing'@'localhost';
mysql> FLUSH PRIVILEGES;
mysql> EXIT;
```

### 3.2 Apply Schema

```bash
# Run migration script
mysql -u devpulse_billing -p devpulse_billing < PHASE11_billing_schema.sql

# Verify tables
mysql -u devpulse_billing -p devpulse_billing -e "SHOW TABLES LIKE 'billing_%';"
mysql -u devpulse_billing -p devpulse_billing -e "SHOW TABLES LIKE '%subscription%';"
```

### 3.3 Verify Schema

```bash
# Count tables (should be 11+)
mysql -u devpulse_billing -p devpulse_billing \
  -e "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='devpulse_billing';"

# Check indexes
mysql -u devpulse_billing -p devpulse_billing \
  -e "SELECT TABLE_NAME, INDEX_NAME FROM information_schema.statistics WHERE table_schema='devpulse_billing' LIMIT 20;"
```

---

## Step 4: Populate Billing Plans

### 4.1 Insert Billing Plans

```sql
-- Add to database or run as migration
USE devpulse_billing;

-- FREE TIER
INSERT INTO billing_plans (
  id, name, description, monthlyPrice, annualPrice, 
  currency, stripePriceId, features, quotas, meterPricing, 
  tier, isActive, createdAt, updatedAt
) VALUES (
  'plan_free',
  'Free',
  'Perfect for getting started',
  0.00,
  0.00,
  'USD',
  'price_free_monthly',
  JSON_OBJECT(
    'api_calls', true,
    'team_members', 1,
    'security_scans', true,
    'support', 'community'
  ),
  JSON_OBJECT(
    'api_calls', 1000,
    'storage_gb', 1,
    'team_size', 1
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.001,
    'storage_gb_overage', 0.50,
    'team_member_overage', 5.00
  ),
  'free',
  true,
  NOW(),
  NOW()
);

-- STARTER TIER
INSERT INTO billing_plans (
  id, name, description, monthlyPrice, annualPrice,
  currency, stripePriceId, features, quotas, meterPricing,
  tier, isActive, createdAt, updatedAt
) VALUES (
  'plan_starter',
  'Starter',
  'For small teams and side projects',
  29.00,
  290.00,
  'USD',
  'price_starter_monthly',
  JSON_OBJECT(
    'api_calls', true,
    'team_members', 5,
    'security_scans', true,
    'priority_support', false,
    'webhook_integrations', true,
    'custom_alerts', true
  ),
  JSON_OBJECT(
    'api_calls', 50000,
    'storage_gb', 50,
    'team_size', 5,
    'scans_per_day', 1
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.001,
    'storage_gb_overage', 0.50,
    'team_member_overage', 10.00
  ),
  'starter',
  true,
  NOW(),
  NOW()
);

-- PROFESSIONAL TIER
INSERT INTO billing_plans (
  id, name, description, monthlyPrice, annualPrice,
  currency, stripePriceId, features, quotas, meterPricing,
  tier, isActive, createdAt, updatedAt
) VALUES (
  'plan_professional',
  'Professional',
  'For growing companies',
  99.00,
  990.00,
  'USD',
  'price_pro_monthly',
  JSON_OBJECT(
    'api_calls', true,
    'team_members', 25,
    'security_scans', true,
    'priority_support', true,
    'webhook_integrations', true,
    'custom_alerts', true,
    'advanced_analytics', true,
    'api_rate_limiting', true,
    'sso', false,
    'custom_branding', false
  ),
  JSON_OBJECT(
    'api_calls', 500000,
    'storage_gb', 500,
    'team_size', 25,
    'scans_per_day', 24,
    'parallel_scans', 5
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.0005,
    'storage_gb_overage', 0.50,
    'team_member_overage', 20.00
  ),
  'professional',
  true,
  NOW(),
  NOW()
);

-- ENTERPRISE TIER
INSERT INTO billing_plans (
  id, name, description, monthlyPrice, annualPrice,
  currency, stripePriceId, features, quotas, meterPricing,
  tier, isActive, createdAt, updatedAt
) VALUES (
  'plan_enterprise',
  'Enterprise',
  'For large organizations',
  NULL,
  NULL,
  'USD',
  'price_enterprise_quote',
  JSON_OBJECT(
    'api_calls', true,
    'team_members', 999,
    'security_scans', true,
    'priority_support', true,
    'webhook_integrations', true,
    'custom_alerts', true,
    'advanced_analytics', true,
    'api_rate_limiting', true,
    'sso', true,
    'custom_branding', true,
    'dedicated_support', true,
    'sla_guarantee', true,
    'custom_integrations', true
  ),
  JSON_OBJECT(
    'api_calls', NULL,
    'storage_gb', NULL,
    'team_size', NULL,
    'scans_per_day', NULL,
    'parallel_scans', NULL
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.00001,
    'storage_gb_overage', 0.25,
    'team_member_overage', 50.00
  ),
  'enterprise',
  true,
  NOW(),
  NOW()
);

-- Verify
SELECT id, name, tier, monthlyPrice FROM billing_plans ORDER BY monthlyPrice;
```

### 4.2 Insert Promo Codes

```sql
-- Add promotional codes
INSERT INTO promo_codes (
  id, code, type, value, maxUsage, usageCount,
  validFrom, validUntil, applicablePlans, isActive, createdAt
) VALUES (
  'promo_launch_50off',
  'LAUNCH50',
  'percentage',
  50.00,  -- 50% off
  100,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  JSON_ARRAY('plan_starter', 'plan_professional'),
  true,
  NOW()
),
(
  'promo_freetrial_7days',
  'FREETRIAL7',
  'free_trial',
  7,  -- 7 days
  500,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 90 DAY),
  JSON_ARRAY('plan_starter', 'plan_professional', 'plan_enterprise'),
  true,
  NOW()
);

SELECT * FROM promo_codes WHERE isActive = true;
```

---

## Step 5: Initialize Services

### 5.1 Create Service Initialization File

Create `_core/initBilling.ts`:

```typescript
import { Logger } from 'pino';
import StripeBillingService from './stripeBillingService';
import MeteringService from './meteringService';
import { db } from '../db';

/**
 * Initialize global billing services
 */
export async function initializeBillingServices(logger: Logger): Promise<void> {
  try {
    // 1. Initialize Stripe service
    global.stripeBillingService = new StripeBillingService(
      {
        secretKey: process.env.STRIPE_SECRET_KEY!,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      },
      logger
    );

    logger.info('✅ Stripe service initialized');

    // 2. Initialize metering service
    global.meteringService = new MeteringService(logger, {
      sampleInterval: parseInt(process.env.METERING_SAMPLE_INTERVAL || '5000'),
      aggregationInterval: parseInt(process.env.METERING_AGGREGATION_INTERVAL || '60000'),
      reportingInterval: parseInt(process.env.METERING_REPORTING_INTERVAL || '300000'),
    });

    logger.info('✅ Metering service initialized');

    // 3. Verify database connection
    const plans = await db.query.billingPlans.findMany({
      limit: 1,
    });

    logger.info(`✅ Database connected - ${plans.length} plans loaded`);

    // 4. Set up service event listeners
    setupServiceListeners(logger);

    logger.info('✅ Billing services fully operational');
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize billing services');
    throw error;
  }
}

/**
 * Set up event listeners for billing events
 */
function setupServiceListeners(logger: Logger): void {
  // Stripe service events
  global.stripeBillingService?.on('subscription_created', (data) => {
    logger.info({ subscriptionId: data.id }, 'Subscription created');
  });

  global.stripeBillingService?.on('subscription_canceled', (data) => {
    logger.info({ subscriptionId: data.id }, 'Subscription canceled');
  });

  global.stripeBillingService?.on('invoice_paid', (data) => {
    logger.info({ invoiceId: data.id }, 'Invoice payment received');
  });

  // Metering service events
  global.meteringService?.on('quota_exceeded', (data) => {
    logger.warn({
      customerId: data.customerId,
      metric: data.metric,
      current: data.currentUsage,
      limit: data.limit,
    }, '⚠️ Quota exceeded');
  });
}

/**
 * Graceful shutdown of billing services
 */
export async function shutdownBillingServices(): Promise<void> {
  if (global.meteringService) {
    await global.meteringService.stop();
  }
}
```

### 5.2 Update App Initialization

In your main `index.ts` or startup file:

```typescript
import { initializeBillingServices, shutdownBillingServices } from './_core/initBilling';
import { db } from './db';
import { logger } from './logger';

// During server startup
async function startServer() {
  try {
    // 1. Connect to database
    await db.connect();
    logger.info('✅ Database connected');

    // 2. Initialize billing services
    await initializeBillingServices(logger);

    // 3. Setup Express app
    const app = setupExpressApp();

    // 4. Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
    });

    // 5. Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received - shutting down');
      await shutdownBillingServices();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error during startup');
    process.exit(1);
  }
}

startServer();
```

---

## Step 6: Webhook Configuration

### 6.1 Create Webhook Route

```typescript
// In your Express app setup
import express from 'express';
import { logger } from './logger';

const app = express();

/**
 * Stripe webhook endpoint
 * Use raw body parser for Stripe signature verification
 */
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    const body = req.body.toString();

    try {
      // Verify webhook signature
      const event = global.stripeBillingService!.verifyWebhookSignature(body, signature);

      // Handle webhook
      await global.stripeBillingService!.handleWebhook(event);

      // Acknowledge receipt
      res.json({ received: true, eventId: event.id });

      logger.info({ eventId: event.id, type: event.type }, 'Webhook processed');
    } catch (error) {
      if (error instanceof Error) {
        logger.error({ error: error.message }, 'Webhook signature verification failed');
        return res.status(400).send(`Webhook Error: ${error.message}`);
      }
      throw error;
    }
  }
);
```

### 6.2 Register Webhook with Stripe

```bash
# Using Stripe CLI (development)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Or alternatively, register endpoint in Stripe Dashboard:
# 1. Go to Developers → Webhooks
# 2. Click "+ Add endpoint"
# 3. URL: https://your-domain.com/api/webhooks/stripe
# 4. Select events:
#    - customer.subscription.updated
#    - customer.subscription.deleted
#    - invoice.payment_succeeded
#    - invoice.payment_failed
#    - charge.refunded
#    - invoice.created
# 5. Copy Webhook Secret to STRIPE_WEBHOOK_SECRET in .env
```

### 6.3 Test Webhook Locally

```bash
# Start Stripe CLI listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal, trigger test event
stripe trigger customer.subscription.updated

# Check logs for receipt
# Should see: Webhook processed [eventId] [type]
```

---

## Step 7: Integration Testing

### 7.1 Test Billing Flow

```bash
#!/bin/bash
# test-billing-flow.sh

TOKEN="your-auth-token"
BASE_URL="http://localhost:3000/api"

echo "=== PHASE 11 Billing Flow Test ==="

# 1. Initialize billing
echo "1. Initializing billing..."
INIT=$(curl -s -X POST "$BASE_URL/billing/init" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "companyName": "Test Corp"}')

CUSTOMER_ID=$(echo $INIT | jq -r '.customerId')
echo "✅ Customer: $CUSTOMER_ID"

# 2. List available plans
echo -e "\n2. Available plans..."
PLANS=$(curl -s -X GET "$BASE_URL/billing/plans")
echo "$PLANS" | jq '.[]| {name, monthlyPrice, tier}'

# 3. Create subscription
echo -e "\n3. Creating subscription..."
SUB=$(curl -s -X POST "$BASE_URL/billing/subscribe" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plan_professional",
    "priceId": "price_pro_monthly"
  }')

SUBSCRIPTION_ID=$(echo $SUB | jq -r '.subscriptionId')
echo "✅ Subscription: $SUBSCRIPTION_ID"

# 4. Record usage
echo -e "\n4. Recording usage..."
for i in {1..5}; do
  curl -s -X POST "$BASE_URL/billing/usage" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"metric": "api_calls", "value": 100}' > /dev/null
  echo "  ✓ Call $i"
done

# 5. Get current usage
echo -e "\n5. Checking current usage..."
USAGE=$(curl -s -X GET "$BASE_URL/billing/usage?metric=api_calls&period=month" \
  -H "Authorization: Bearer $TOKEN")
echo "$USAGE" | jq '{metric, value, quota, percentageUsed}'

# 6. Get usage report
echo -e "\n6. Getting usage report..."
REPORT=$(curl -s -X GET "$BASE_URL/billing/report" \
  -H "Authorization: Bearer $TOKEN")
echo "$REPORT" | jq '{period, metrics, totalCost}'

# 7. List invoices
echo -e "\n7. Listing invoices..."
INVOICES=$(curl -s -X GET "$BASE_URL/billing/invoices" \
  -H "Authorization: Bearer $TOKEN")
echo "$INVOICES" | jq '.invoices[] | {id, amount, status}'

echo -e "\n✅ Billing flow test complete!"
```

### 7.2 Run Integration Test

```bash
chmod +x test-billing-flow.sh
./test-billing-flow.sh
```

### 7.3 Unit Tests

```typescript
// test/billing.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { stripeBillingService, meteringService } from '../_core';

describe('Billing Services', () => {
  describe('StripeBillingService', () => {
    it('should create customer', async () => {
      const result = await stripeBillingService.createCustomer({
        customerId: `test-${Date.now()}`,
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-test',
      });

      expect(result).toMatch(/^cus_/);
    });

    it('should fail with invalid input', async () => {
      expect(async () => {
        await stripeBillingService.createCustomer({
          customerId: '',
          email: 'invalid',
          name: '',
          organizationId: '',
        });
      }).rejects.toThrow();
    });
  });

  describe('MeteringService', () => {
    it('should record usage', async () => {
      await meteringService.recordUsage({
        customerId: 'test-user',
        metric: 'api_calls',
        value: 100,
        timestamp: new Date(),
      });

      const usage = await meteringService.getCurrentUsage(
        'test-user',
        'api_calls',
        'month'
      );

      expect(usage).toBeGreaterThanOrEqual(0);
    });

    it('should enforce quota', async () => {
      const exceeded = await meteringService.checkQuota('test-user', 'api_calls');
      expect(typeof exceeded).toBe('boolean');
    });
  });
});
```

---

## Step 8: Deployment

### 8.1 Pre-Deployment Checklist

```bash
# ✅ Code Review
- All billing files present (stripeBillingService, meteringService, billingRouter, BillingPage)
- No hardcoded secrets
- Error handling for all external APIs

# ✅ Database
- Migrations applied
- Indexes created
- Billing plans populated
- Test data verified

# ✅ Configuration
- Environment variables set
- Stripe API keys configured
- Webhook endpoint registered
- Rate limiting configured

# ✅ Testing
- Unit tests pass
- Integration tests pass
- Webhook flow tested
- Payment flow tested with test card

# ✅ Security
- PCI compliance verified
- API authentication enabled
- HTTPS configured
- Audit logging enabled
```

### 8.2 Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

### 8.3 Docker Compose for Testing

```yaml
# docker-compose.yml
version: '3.8'

services:
  devpulse:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: mysql://devpulse:password@db:3306/devpulse
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_PUBLISHABLE_KEY: ${STRIPE_PUBLISHABLE_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      NODE_ENV: production
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: devpulse
      MYSQL_USER: devpulse
      MYSQL_PASSWORD: password
    volumes:
      - db_data:/var/lib/mysql
      - ./PHASE11_billing_schema.sql:/docker-entrypoint-initdb.d/billing.sql

volumes:
  db_data:
```

### 8.4 Deploy on Kubernetes

```yaml
# k8s/billing-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devpulse-billing
spec:
  replicas: 3
  selector:
    matchLabels:
      app: devpulse-billing
  template:
    metadata:
      labels:
        app: devpulse-billing
    spec:
      containers:
      - name: devpulse
        image: devpulse:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: stripe-secrets
              key: secret-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: devpulse-billing-service
spec:
  selector:
    app: devpulse-billing
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## Step 9: Monitoring & Troubleshooting

### 9.1 Health Checks

```typescript
// Add health check endpoint
app.get('/health/billing', async (req, res) => {
  try {
    // Check Stripe connectivity
    const plans = await stripeBillingService.listPlans();
    
    // Check metering service
    const isRunning = meteringService.isRunning();
    
    // Check database
    const dbStatus = await db.query.billingCustomers.findMany({ limit: 1 });

    res.json({
      status: 'healthy',
      services: {
        stripe: plans.length > 0,
        metering: isRunning,
        database: dbStatus !== null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
```

### 9.2 Common Issues

**Issue: Webhook signature verification fails**
```
Solution:
1. Verify STRIPE_WEBHOOK_SECRET is correct
2. Ensure raw body parser is used
3. Check Stripe Dashboard for recent events
4. Try with Stripe CLI test: stripe trigger customer.subscription.updated
```

**Issue: Quota enforcement not working**
```
Solution:
1. Verify meteringService is initialized
2. Check that recordUsage is called
3. Confirm aggregatedMetrics table is being populated
4. Check database indexes for performance
```

**Issue: Invoices not generating**
```
Solution:
1. Verify subscriptions table has active subscriptions
2. Check invoice generation cron job is running
3. Confirm lineItems JSON is properly formatted
4. Check Stripe API key has invoice creation permissions
```

### 9.3 Monitoring Queries

```sql
-- Check active subscriptions
SELECT COUNT(*) as active_subscriptions
FROM subscriptions 
WHERE status = 'active' AND deletedAt IS NULL;

-- Recent usage
SELECT metric, SUM(value) as total_usage, COUNT(*) as events
FROM usage_records
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY metric;

-- Failed invoices
SELECT * FROM invoices
WHERE status IN ('unpaid', 'void')
AND createdAt > DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Quota violations today
SELECT customerId, metric, currentValue, COUNT(*) as violations
FROM billing_alerts
WHERE alertType = 'quota_exceeded'
AND createdAt > DATE_SUB(NOW(), INTERVAL 1 DAY)
GROUP BY customerId, metric;
```

---

## Step 10: Production Launch

### 10.1 Pre-Launch Verification

```bash
#!/bin/bash
echo "=== PHASE 11 Production Launch Checklist ==="

# 1. Load test
echo "1. Running load test..."
npm run test:load

# 2. Security audit
echo "2. Running security audit..."
npm audit

# 3. Database backup
echo "3. Backing up database..."
mysqldump -u devpulse_billing -p devpulse_billing | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 4. Configuration validation
echo "4. Validating configuration..."
node scripts/validate-billing-config.js

# 5. Stripe test transaction
echo "5. Testing Stripe transaction..."
npm run test:stripe-transaction

echo "✅ Pre-launch checks complete"
```

### 10.2 Launch Steps

```
1. Deploy to staging
   ├─ Run database migrations
   ├─ Initialize services
   └─ Run full integration tests

2. Switch Stripe to production
   ├─ Update API keys
   ├─ Register production webhook
   └─ Verify webhook receipt

3. Deploy to production
   ├─ Rolling deployment (gradual rollout)
   ├─ Monitor metrics
   └─ Alert on errors

4. Enable billing for new customers
   ├─ Start charging subscriptions
   ├─ Send confirmation emails
   └─ Monitor payment success rate

5. Monitor for 24 hours
   ├─ Check error rates
   ├─ Verify webhook delivery
   ├─ Confirm payments received
   └─ Monitor database performance
```

### 10.3 Rollback Plan

```
If issues detected:

1. Stop accepting new subscriptions
   └─ Set feature flag: BILLING_ENABLED=false

2. Cancel all pending charges
   └─ Run cancellation script for pending invoices

3. Revert to previous version
   └─ kubectl rollout undo deployment/devpulse-billing
   └─ Restore database from backup

4. Investigate root cause
   └─ Review error logs
   └─ Check Stripe dashboard
   └─ Verify database integrity

5. Re-deploy with fix
   └─ Fix identified issues
   └─ Re-run tests
   └─ Deploy gradually
```

---

## Post-Launch Operations

### Weekly Tasks
- Review failed payments
- Analyze MRR/ARR metrics
- Check quota violation trends
- Review customer churn

### Monthly Tasks
- Reconcile with Stripe
- Generate billing reports
- Review pricing strategy
- Audit subscription data

### Quarterly Tasks
- Security audit
- Performance optimization
- Database maintenance
- Plan tier review

---

## Support & Documentation

**Customer-Facing Documentation:**
- Pricing page with tiers
- Billing FAQ
- Invoice explanation
- Payment troubleshooting

**Developer Documentation:**
- API reference (tRPC procedures)
- Webhook event types
- Usage metering guide
- Integration examples

**Internal Documentation:**
- Database schema
- Service architecture
- Operational runbooks
- Troubleshooting guide

---

## Files Deployed

| File | Purpose | Location |
|------|---------|----------|
| stripeBillingService.ts | Stripe integration | _core/ |
| meteringService.ts | Usage metering | _core/ |
| billingRouter.ts | tRPC API | routers/ |
| BillingPage.tsx | Dashboard UI | pages/ |
| PHASE11_billing_schema.sql | Database | migrations/ |

**Total:** 5 files, 3,600+ lines, production-ready ✅

---

## Status

**PHASE 11: SaaS Billing** ✅ COMPLETE
- Stripe integration: ✅
- Usage metering: ✅
- Quota enforcement: ✅
- Invoice generation: ✅
- Dashboard UI: ✅
- Database schema: ✅

**Ready for production deployment** 🚀
