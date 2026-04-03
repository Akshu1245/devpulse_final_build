-- PHASE 11: Billing Plan Fixtures
-- Populate initial pricing tiers and promo codes

USE devpulse_billing;

-- ===================================================
-- TIER 1: FREE PLAN
-- ===================================================
INSERT INTO billing_plans (
  id,
  name,
  description,
  monthlyPrice,
  annualPrice,
  currency,
  stripePriceId,
  features,
  quotas,
  meterPricing,
  tier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'plan_free',
  'Free',
  'Get started with DevPulse - perfect for individuals and side projects',
  0.00,
  0.00,
  'USD',
  'price_free_monthly',
  JSON_OBJECT(
    'displayName', 'Free Tier',
    'api_calls', true,
    'team_members', 1,
    'security_scans', true,
    'support', 'community-only',
    'webhook_integrations', false,
    'custom_alerts', false,
    'advanced_analytics', false,
    'api_rate_limiting', false,
    'sso', false,
    'custom_branding', false,
    'data_export', false,
    'dedicated_support', false,
    'sla_guarantee', false
  ),
  JSON_OBJECT(
    'api_calls', 1000,
    'storage_gb', 1,
    'team_size', 1,
    'scans_per_day', 5,
    'parallel_scans', 1,
    'webhook_count', 0,
    'custom_alerts', 0,
    'data_retention_days', 7
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.001,
    'storage_gb', 0.50,
    'team_member', 5.00,
    'additional_scan', 0.10
  ),
  'free',
  true,
  NOW(),
  NOW()
);

-- ===================================================
-- TIER 2: STARTER PLAN
-- ===================================================
INSERT INTO billing_plans (
  id,
  name,
  description,
  monthlyPrice,
  annualPrice,
  currency,
  stripePriceId,
  features,
  quotas,
  meterPricing,
  tier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'plan_starter',
  'Starter',
  'For small teams scaling their API security and compliance',
  29.00,
  290.00,
  'USD',
  'price_starter_monthly',
  JSON_OBJECT(
    'displayName', 'Starter Tier',
    'api_calls', true,
    'team_members', 5,
    'security_scans', true,
    'support', 'email-support',
    'webhook_integrations', true,
    'custom_alerts', true,
    'advanced_analytics', false,
    'api_rate_limiting', true,
    'sso', false,
    'custom_branding', false,
    'data_export', true,
    'dedicated_support', false,
    'sla_guarantee', false,
    'email_alerts', true,
    'slack_integration', false,
    'datadog_integration', false
  ),
  JSON_OBJECT(
    'api_calls', 50000,
    'storage_gb', 50,
    'team_size', 5,
    'scans_per_day', 20,
    'parallel_scans', 2,
    'webhook_count', 10,
    'custom_alerts', 25,
    'data_retention_days', 60,
    'monthly_reports', 1
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.001,
    'storage_gb', 0.50,
    'team_member', 10.00,
    'additional_scan', 0.10,
    'additional_webhook', 0.50
  ),
  'starter',
  true,
  NOW(),
  NOW()
);

-- ===================================================
-- TIER 3: PROFESSIONAL PLAN
-- ===================================================
INSERT INTO billing_plans (
  id,
  name,
  description,
  monthlyPrice,
  annualPrice,
  currency,
  stripePriceId,
  features,
  quotas,
  meterPricing,
  tier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'plan_professional',
  'Professional',
  'For growing companies with dedicated security operations',
  99.00,
  990.00,
  'USD',
  'price_pro_monthly',
  JSON_OBJECT(
    'displayName', 'Professional Tier',
    'api_calls', true,
    'team_members', 25,
    'security_scans', true,
    'support', 'priority-email-support',
    'webhook_integrations', true,
    'custom_alerts', true,
    'advanced_analytics', true,
    'api_rate_limiting', true,
    'sso', false,
    'custom_branding', false,
    'data_export', true,
    'dedicated_support', false,
    'sla_guarantee', false,
    'email_alerts', true,
    'slack_integration', true,
    'datadog_integration', true,
    'pagerduty_integration', true,
    'splunk_integration', false,
    'advanced_reporting', true,
    'cost_analytics', true,
    'rbac', true
  ),
  JSON_OBJECT(
    'api_calls', 500000,
    'storage_gb', 500,
    'team_size', 25,
    'scans_per_day', 100,
    'parallel_scans', 5,
    'webhook_count', 50,
    'custom_alerts', 100,
    'data_retention_days', 365,
    'monthly_reports', 4,
    'api_keys', 50,
    'service_accounts', 10
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.0005,
    'storage_gb', 0.50,
    'team_member', 20.00,
    'additional_scan', 0.05,
    'additional_webhook', 0.25,
    'additional_report', 25.00
  ),
  'professional',
  true,
  NOW(),
  NOW()
);

-- ===================================================
-- TIER 4: ENTERPRISE PLAN
-- ===================================================
INSERT INTO billing_plans (
  id,
  name,
  description,
  monthlyPrice,
  annualPrice,
  currency,
  stripePriceId,
  features,
  quotas,
  meterPricing,
  tier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'plan_enterprise',
  'Enterprise',
  'Complete security and compliance platform for large organizations',
  NULL,
  NULL,
  'USD',
  'price_enterprise_quote',
  JSON_OBJECT(
    'displayName', 'Enterprise Tier',
    'api_calls', true,
    'team_members', 999,
    'security_scans', true,
    'support', 'dedicated-support-24-7',
    'webhook_integrations', true,
    'custom_alerts', true,
    'advanced_analytics', true,
    'api_rate_limiting', true,
    'sso', true,
    'custom_branding', true,
    'data_export', true,
    'dedicated_support', true,
    'sla_guarantee', true,
    'email_alerts', true,
    'slack_integration', true,
    'datadog_integration', true,
    'pagerduty_integration', true,
    'splunk_integration', true,
    'custom_integrations', true,
    'advanced_reporting', true,
    'cost_analytics', true,
    'rbac', true,
    'audit_logging', true,
    'compliance_reporting', true,
    'geo_redundancy', true,
    'dedicated_instance', true,
    'custom_sla', true,
    'volume_discounts', true
  ),
  JSON_OBJECT(
    'api_calls', NULL,
    'storage_gb', NULL,
    'team_size', NULL,
    'scans_per_day', NULL,
    'parallel_scans', NULL,
    'webhook_count', NULL,
    'custom_alerts', NULL,
    'data_retention_days', NULL,
    'monthly_reports', NULL,
    'api_keys', NULL,
    'service_accounts', NULL,
    'custom_environments', NULL
  ),
  JSON_OBJECT(
    'api_calls_overage', 0.00001,
    'storage_gb', 0.25,
    'team_member', 50.00,
    'additional_scan', 0.01,
    'custom_integration', 'contact-sales'
  ),
  'enterprise',
  true,
  NOW(),
  NOW()
);

-- ===================================================
-- PROMOTIONAL CODES
-- ===================================================

-- Launch promotion: 50% off for first month
INSERT INTO promo_codes (
  id,
  code,
  displayName,
  type,
  value,
  valueType,
  maxUsage,
  usageCount,
  validFrom,
  validUntil,
  applicablePlans,
  minimumPlanTier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'promo_launch_50',
  'LAUNCH50',
  'Launch Special - 50% Off',
  'percentage',
  50.00,
  'PERCENT',
  100,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  JSON_ARRAY('plan_starter', 'plan_professional'),
  'starter',
  true,
  NOW(),
  NOW()
);

-- Free trial for new customers
INSERT INTO promo_codes (
  id,
  code,
  displayName,
  type,
  value,
  valueType,
  maxUsage,
  usageCount,
  validFrom,
  validUntil,
  applicablePlans,
  minimumPlanTier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'promo_freetrial_14',
  'FREETRIAL14',
  'Two Week Free Trial',
  'free_trial',
  14,
  'DAYS',
  500,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 90 DAY),
  JSON_ARRAY('plan_starter', 'plan_professional', 'plan_enterprise'),
  'starter',
  true,
  NOW(),
  NOW()
);

-- Partner discount
INSERT INTO promo_codes (
  id,
  code,
  displayName,
  type,
  value,
  valueType,
  maxUsage,
  usageCount,
  validFrom,
  validUntil,
  applicablePlans,
  minimumPlanTier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'promo_partner_discount',
  'PARTNERSHIP25',
  'Partner Program - 25% Discount',
  'percentage',
  25.00,
  'PERCENT',
  50,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 365 DAY),
  JSON_ARRAY('plan_professional', 'plan_enterprise'),
  'professional',
  true,
  NOW(),
  NOW()
);

-- Non-profit discount
INSERT INTO promo_codes (
  id,
  code,
  displayName,
  type,
  value,
  valueType,
  maxUsage,
  usageCount,
  validFrom,
  validUntil,
  applicablePlans,
  minimumPlanTier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'promo_nonprofit',
  'NONPROFIT40',
  'Non-Profit Organization - 40% Off',
  'percentage',
  40.00,
  'PERCENT',
  NULL,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 365 DAY),
  JSON_ARRAY('plan_starter', 'plan_professional'),
  'starter',
  true,
  NOW(),
  NOW()
);

-- Student discount
INSERT INTO promo_codes (
  id,
  code,
  displayName,
  type,
  value,
  valueType,
  maxUsage,
  usageCount,
  validFrom,
  validUntil,
  applicablePlans,
  minimumPlanTier,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'promo_student',
  'STUDENT50',
  'Student Program - Free Professional Tier',
  'fixed_amount',
  99.00,
  'DOLLARS',
  200,
  0,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 365 DAY),
  JSON_ARRAY('plan_professional'),
  'professional',
  true,
  NOW(),
  NOW()
);

-- ===================================================
-- VERIFY DATA
-- ===================================================

-- Count inserted records
SELECT '=== BILLING PLANS ===' AS category;
SELECT 
  COUNT(*) as total_plans,
  SUM(CASE WHEN tier = 'free' THEN 1 ELSE 0 END) as free_plans,
  SUM(CASE WHEN tier = 'starter' THEN 1 ELSE 0 END) as starter_plans,
  SUM(CASE WHEN tier = 'professional' THEN 1 ELSE 0 END) as pro_plans,
  SUM(CASE WHEN tier = 'enterprise' THEN 1 ELSE 0 END) as enterprise_plans
FROM billing_plans;

SELECT id, name, tier, monthlyPrice, isActive FROM billing_plans ORDER BY monthlyPrice;

SELECT '=== PROMO CODES ===' AS category;
SELECT 
  COUNT(*) as total_promos,
  SUM(CASE WHEN type = 'percentage' THEN 1 ELSE 0 END) as percentage_promos,
  SUM(CASE WHEN type = 'free_trial' THEN 1 ELSE 0 END) as trial_promos,
  SUM(CASE WHEN isActive THEN 1 ELSE 0 END) as active_promos
FROM promo_codes;

SELECT code, displayName, type, value, valueType, isActive FROM promo_codes ORDER BY createdAt DESC;

-- Display fixture summary
SELECT '=== FIXTURE SUMMARY ===' AS section;
SELECT 
  'Billing Plans' as item, 
  COUNT(*) as count,
  'Ready for subscriptions' as status
FROM billing_plans
UNION ALL
SELECT 
  'Promo Codes' as item,
  COUNT(*) as count,
  'Ready for customers' as status
FROM promo_codes;

-- ===================================================
-- VERIFY SCHEMA STRUCTURE
-- ===================================================

SELECT '=== SCHEMA VERIFICATION ===' AS section;
SELECT 
  COUNT(*) as table_count,
  'Tables created' as status
FROM information_schema.tables 
WHERE table_schema = 'devpulse_billing';

SELECT 
  COUNT(*) as index_count,
  'Indexes available' as status
FROM information_schema.statistics 
WHERE table_schema = 'devpulse_billing' 
AND index_name != 'PRIMARY';
