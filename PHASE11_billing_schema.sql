/**
 * SQL migration for PHASE 11: SaaS Billing
 * Creates billing-related tables for subscription management, invoicing, and metering
 */

-- Billing Plans table
CREATE TABLE IF NOT EXISTS `billing_plans` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `description` text,
  `monthlyPrice` decimal(10, 2) NOT NULL,
  `annualPrice` decimal(10, 2),
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `stripePriceId` varchar(255) UNIQUE,
  `features` json NOT NULL DEFAULT '{}',
  `quotas` json DEFAULT '{}',
  `meterPricing` json DEFAULT '{}',
  `tier` enum('free', 'starter', 'professional', 'enterprise') NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tier` (`tier`),
  KEY `idx_isActive` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customers billing info
CREATE TABLE IF NOT EXISTS `billing_customers` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL UNIQUE,
  `stripeCustomerId` varchar(255) UNIQUE,
  `email` varchar(255) NOT NULL,
  `companyName` varchar(255),
  `billingAddress` json,
  `paymentMethodId` varchar(255),
  `taxId` varchar(255),
  `preferredInvoiceSchedule` enum('monthly', 'annual') DEFAULT 'monthly',
  `autoRenewal` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_customerId` (`customerId`),
  KEY `idx_stripeCustomerId` (`stripeCustomerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscriptions
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL,
  `stripeSubscriptionId` varchar(255) UNIQUE,
  `planId` varchar(36) NOT NULL,
  `status` enum('active', 'canceled', 'past_due', 'unpaid', 'incomplete') NOT NULL DEFAULT 'incomplete',
  `currentPeriodStart` timestamp NOT NULL,
  `currentPeriodEnd` timestamp NOT NULL,
  `canceledAt` timestamp,
  `cancelReason` varchar(255),
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customerId`) REFERENCES `billing_customers` (`customerId`) ON DELETE CASCADE,
  FOREIGN KEY (`planId`) REFERENCES `billing_plans` (`id`) ON DELETE RESTRICT,
  KEY `idx_customerId` (`customerId`),
  KEY `idx_status` (`status`),
  KEY `idx_currentPeriodEnd` (`currentPeriodEnd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usage records
CREATE TABLE IF NOT EXISTS `usage_records` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL,
  `subscriptionId` varchar(36),
  `metric` varchar(100) NOT NULL,
  `value` decimal(19, 4) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customerId`) REFERENCES `billing_customers` (`customerId`) ON DELETE CASCADE,
  FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL,
  KEY `idx_customerId_metric` (`customerId`, `metric`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_metric_timestamp` (`metric`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aggregated metrics (for quick reporting)
CREATE TABLE IF NOT EXISTS `aggregated_metrics` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL,
  `metric` varchar(100) NOT NULL,
  `value` decimal(19, 4) NOT NULL DEFAULT 0,
  `lastUpdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_customer_metric` (`customerId`, `metric`),
  FOREIGN KEY (`customerId`) REFERENCES `billing_customers` (`customerId`) ON DELETE CASCADE,
  KEY `idx_customerId` (`customerId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL,
  `stripeInvoiceId` varchar(255) UNIQUE,
  `subscriptionId` varchar(36),
  `invoiceNumber` varchar(50) NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `amountPaid` decimal(10, 2) DEFAULT 0,
  `amountDue` decimal(10, 2) NOT NULL,
  `status` enum('draft', 'open', 'paid', 'uncollectible', 'void') NOT NULL DEFAULT 'draft',
  `currency` varchar(3) NOT NULL DEFAULT 'USD',
  `dueDate` timestamp,
  `issuedDate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paidDate` timestamp,
  `voidedDate` timestamp,
  `lineItems` json NOT NULL DEFAULT '[]',
  `notes` text,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customerId`) REFERENCES `billing_customers` (`customerId`) ON DELETE CASCADE,
  FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions` (`id`) ON DELETE SET NULL,
  KEY `idx_customerId` (`customerId`),
  KEY `idx_status` (`status`),
  KEY `idx_dueDate` (`dueDate`),
  UNIQUE KEY `unique_invoice_number` (`invoiceNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice history (audit trail)
CREATE TABLE IF NOT EXISTS `invoice_history` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `invoiceId` varchar(36) NOT NULL,
  `event` varchar(50) NOT NULL,
  `previousStatus` varchar(50),
  `newStatus` varchar(50),
  `amount` decimal(10, 2),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  KEY `idx_invoiceId` (`invoiceId`),
  KEY `idx_event` (`event`),
  KEY `idx_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment methods
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL,
  `stripePaymentMethodId` varchar(255) UNIQUE,
  `type` enum('credit_card', 'bank_account', 'paypal') NOT NULL,
  `lastFour` char(4),
  `expiryMonth` int,
  `expiryYear` int,
  `isDefault` boolean DEFAULT false,
  `isActive` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customerId`) REFERENCES `billing_customers` (`customerId`) ON DELETE CASCADE,
  KEY `idx_customerId` (`customerId`),
  KEY `idx_isDefault` (`isDefault`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refunds
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `invoiceId` varchar(36) NOT NULL,
  `stripeRefundId` varchar(255) UNIQUE,
  `amount` decimal(10, 2) NOT NULL,
  `reason` varchar(255),
  `status` enum('pending', 'succeeded', 'failed', 'canceled') NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  KEY `idx_invoiceId` (`invoiceId`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Promo codes
CREATE TABLE IF NOT EXISTS `promo_codes` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `code` varchar(50) NOT NULL UNIQUE,
  `type` enum('percentage', 'fixed_amount', 'free_trial') NOT NULL,
  `value` decimal(10, 2) NOT NULL,
  `maxUsage` int,
  `usageCount` int DEFAULT 0,
  `validFrom` timestamp NOT NULL,
  `validUntil` timestamp NOT NULL,
  `applicablePlans` json DEFAULT '[]',
  `isActive` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_code` (`code`),
  KEY `idx_isActive` (`isActive`),
  KEY `idx_validUntil` (`validUntil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing alerts
CREATE TABLE IF NOT EXISTS `billing_alerts` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `customerId` varchar(255) NOT NULL,
  `alertType` enum('quota_exceeded', 'payment_failed', 'invoice_due', 'subscription_ending') NOT NULL,
  `metric` varchar(100),
  `threshold` decimal(19, 4),
  `currentValue` decimal(19, 4),
  `isResolved` boolean DEFAULT false,
  `resolvedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customerId`) REFERENCES `billing_customers` (`customerId`) ON DELETE CASCADE,
  KEY `idx_customerId` (`customerId`),
  KEY `idx_alertType` (`alertType`),
  KEY `idx_isResolved` (`isResolved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for performance
CREATE INDEX idx_subscriptions_customerId_status ON `subscriptions` (`customerId`, `status`);
CREATE INDEX idx_invoices_customerId_status ON `invoices` (`customerId`, `status`);
CREATE INDEX idx_usage_records_bulk_query ON `usage_records` (`customerId`, `metric`, `timestamp`);
