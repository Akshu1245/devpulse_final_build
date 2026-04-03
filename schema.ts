import {
  serial,
  int,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  bigint,
  boolean,
  mysqlTable,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

const integer = int;

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  openIdIdx: uniqueIndex("openId_idx").on(table.openId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Workspaces for multi-tenant support
 */
export const workspaces = mysqlTable("workspaces", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: integer("ownerId").notNull(),
  description: text("description"),
  plan: varchar("plan", { length: 32 }).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  ownerIdIdx: index("ownerId_idx").on(table.ownerId),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

/**
 * Workspace members and their roles
 */
export const workspaceMembers = mysqlTable("workspaceMembers", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId").notNull(),
  role: varchar("role", { length: 32 }).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceUserIdx: index("workspace_user_idx").on(table.workspaceId, table.userId),
}));

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = typeof workspaceMembers.$inferInsert;

/**
 * API Projects within workspaces
 */
export const apiProjects = mysqlTable("apiProjects", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("project_workspace_idx").on(table.workspaceId),
}));

export type ApiProject = typeof apiProjects.$inferSelect;
export type InsertApiProject = typeof apiProjects.$inferInsert;

/**
 * Security scans
 */
export const scans = mysqlTable("scans", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  projectId: integer("projectId"),
  userId: integer("userId"),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  progress: integer("progress").default(0).notNull(),
  totalEndpoints: integer("totalEndpoints").default(0).notNull(),
  scannedEndpoints: integer("scannedEndpoints").default(0).notNull(),
  vulnerabilitiesFound: integer("vulnerabilitiesFound").default(0).notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("scan_workspace_idx").on(table.workspaceId),
  statusIdx: index("scan_status_idx").on(table.status),
}));

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;

/**
 * Vulnerabilities found in scans
 */
export const vulnerabilities = mysqlTable("vulnerabilities", {
  id: serial("id").primaryKey(),
  scanId: integer("scanId").notNull(),
  workspaceId: integer("workspaceId").notNull(),
  endpoint: varchar("endpoint", { length: 512 }).notNull(),
  method: varchar("method", { length: 16 }).notNull(),
  severity: varchar("severity", { length: 32 }).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }),
  description: text("description"),
  cwe: varchar("cwe", { length: 32 }),
  cvss: varchar("cvss", { length: 16 }),
  evidence: text("evidence"),
  recommendation: text("recommendation"),
  status: varchar("status", { length: 32 }).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  scanIdIdx: index("vuln_scan_idx").on(table.scanId),
  severityIdx: index("vuln_severity_idx").on(table.severity),
  workspaceIdIdx: index("vuln_workspace_idx").on(table.workspaceId),
  workspaceSeverityIdx: index("vuln_workspace_severity_idx").on(table.workspaceId, table.severity),
}));

export type Vulnerability = typeof vulnerabilities.$inferSelect;
export type InsertVulnerability = typeof vulnerabilities.$inferInsert;

/**
 * LLM cost tracking events
 */
export const llmCostEvents = mysqlTable("llmCostEvents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId"),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  featureName: varchar("featureName", { length: 128 }),
  apiPath: varchar("apiPath", { length: 512 }), // PHASE 7: Track which endpoint triggered this LLM call
  promptTokens: integer("promptTokens").default(0).notNull(),
  completionTokens: integer("completionTokens").default(0).notNull(),
  totalTokens: integer("totalTokens").default(0).notNull(),
  costUsd: decimal("costUsd", { precision: 12, scale: 8 }).notNull(),
  statusCode: integer("statusCode"),
  latencyMs: integer("latencyMs"),
  metadata: json("metadata"),
  eventTimestamp: bigint("eventTimestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceUserIdx: index("llm_workspace_user_idx").on(table.workspaceId, table.userId),
  eventTimestampIdx: index("llm_event_timestamp_idx").on(table.eventTimestamp),
  providerIdx: index("llm_provider_idx").on(table.provider),
  apiPathIdx: index("llm_api_path_idx").on(table.apiPath),
  // PERFORMANCE: Composite index for time-series cost queries
  workspaceTimestampIdx: index("llm_workspace_timestamp_idx").on(table.workspaceId, table.eventTimestamp),
  // PERFORMANCE: Composite index for cost aggregation by provider
  workspaceProviderIdx: index("llm_workspace_provider_idx").on(table.workspaceId, table.provider),
}));

export type LlmCostEvent = typeof llmCostEvents.$inferSelect;
export type InsertLlmCostEvent = typeof llmCostEvents.$inferInsert;

/**
 * Budget thresholds for cost alerts
 */
export const budgetThresholds = mysqlTable("budgetThresholds", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId").notNull(),
  provider: varchar("provider", { length: 64 }).default("all").notNull(),
  dailyLimitUsd: decimal("dailyLimitUsd", { precision: 10, scale: 2 }),
  weeklyLimitUsd: decimal("weeklyLimitUsd", { precision: 10, scale: 2 }),
  monthlyLimitUsd: decimal("monthlyLimitUsd", { precision: 10, scale: 2 }),
  alertsEnabled: boolean("alertsEnabled").default(true).notNull(),
  alertAtPercent: integer("alertAtPercent").default(80).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("budget_user_idx").on(table.userId),
}));

export type BudgetThreshold = typeof budgetThresholds.$inferSelect;
export type InsertBudgetThreshold = typeof budgetThresholds.$inferInsert;

/**
 * AgentGuard events for rogue agent detection
 */
export const agentguardEvents = mysqlTable("agentguardEvents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: varchar("agentId", { length: 128 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  reason: varchar("reason", { length: 256 }),
  costUsd: decimal("costUsd", { precision: 12, scale: 6 }),
  details: text("details"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("agentguard_workspace_idx").on(table.workspaceId),
  agentIdIdx: index("agentguard_agent_idx").on(table.agentId),
}));

export type AgentguardEvent = typeof agentguardEvents.$inferSelect;
export type InsertAgentguardEvent = typeof agentguardEvents.$inferInsert;

/**
 * Subscriptions and billing
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  plan: varchar("plan", { length: 32 }).default("free").notNull(),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: uniqueIndex("subscription_workspace_idx").on(table.workspaceId),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Usage metrics for billing
 */
export const usageMetrics = mysqlTable("usageMetrics", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  month: varchar("month", { length: 7 }).notNull(), // Format: YYYY-MM
  scansUsed: integer("scansUsed").default(0).notNull(),
  endpointsScanned: integer("endpointsScanned").default(0).notNull(),
  storageUsedBytes: bigint("storageUsedBytes", { mode: "number" }).default(0).notNull(),
  teamMembers: integer("teamMembers").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workspaceMonthIdx: uniqueIndex("usage_workspace_month_idx").on(table.workspaceId, table.month),
}));

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = typeof usageMetrics.$inferInsert;

/**
 * API Keys Vault
 */
export const apiKeys = mysqlTable("apiKeys", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  keyHashIdx: uniqueIndex("api_key_hash_idx").on(table.keyHash),
  workspaceIdIdx: index("api_key_workspace_idx").on(table.workspaceId),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * LLM Thinking Token Attributions
 */
export const llmThinkingAttributions = mysqlTable("llmThinkingAttributions", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  eventId: integer("eventId").notNull(),
  feature: varchar("feature", { length: 128 }).notNull(),
  apiPath: varchar("apiPath", { length: 512 }), // PHASE 7: Track which endpoint used thinking tokens
  thinkingTokens: integer("thinkingTokens").default(0).notNull(),
  estimatedCostUsd: decimal("estimatedCostUsd", { precision: 12, scale: 8 }).notNull(),
  detectionMethod: varchar("detectionMethod", { length: 32 }).notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("thinking_workspace_idx").on(table.workspaceId),
  eventIdIdx: index("thinking_event_idx").on(table.eventId),
  apiPathIdx: index("thinking_api_path_idx").on(table.apiPath), // PHASE 7: Query by endpoint
}));

export type LLMThinkingAttribution = typeof llmThinkingAttributions.$inferSelect;
export type InsertLLMThinkingAttribution = typeof llmThinkingAttributions.$inferInsert;

/**
 * Activity Log for all events
 */
export const activityLog = mysqlTable("activityLog", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId"),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 32 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("activity_workspace_idx").on(table.workspaceId),
  typeIdx: index("activity_type_idx").on(table.type),
  createdAtIdx: index("activity_created_idx").on(table.createdAt),
}));

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

/**
 * Audit Logs for compliance
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  userId: integer("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  resource: varchar("resource", { length: 64 }).notNull(),
  resourceId: integer("resourceId"),
  changes: text("changes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("audit_workspace_idx").on(table.workspaceId),
  actionIdx: index("audit_action_idx").on(table.action),
  createdAtIdx: index("audit_created_idx").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Compliance Reports
 */
export const complianceReports = mysqlTable("complianceReports", {
  id: serial("id").primaryKey(),
  scanId: integer("scanId").notNull(),
  workspaceId: integer("workspaceId").notNull(),
  overallScore: integer("overallScore").notNull(),
  passedRequirements: integer("passedRequirements").notNull(),
  failedRequirements: integer("failedRequirements").notNull(),
  findings: json("findings"),
  gdprArticles: json("gdprArticles"),
  recommendation: text("recommendation"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
}, (table) => ({
  scanIdIdx: index("compliance_scan_idx").on(table.scanId),
}));

export type ComplianceReport = typeof complianceReports.$inferSelect;
export type InsertComplianceReport = typeof complianceReports.$inferInsert;

/**
 * HTTP Access Log (PHASE 7)
 * Persists all API calls to database for shadow API detection
 */
export const httpAccessLog = mysqlTable("httpAccessLog", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId"),
  userId: integer("userId"),
  method: varchar("method", { length: 16 }).notNull(), // GET, POST, PUT, DELETE, etc.
  path: varchar("path", { length: 512 }).notNull(), // /api/scan/:id, /api/vulnerabilities, etc.
  statusCode: integer("statusCode").notNull(),
  latencyMs: integer("latencyMs").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  queryParams: json("queryParams"),
  requestTimestamp: bigint("requestTimestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspacePathIdx: index("http_workspace_path_idx").on(table.workspaceId, table.path),
  methodPathIdx: index("http_method_path_idx").on(table.method, table.path),
  timestampIdx: index("http_timestamp_idx").on(table.requestTimestamp),
  statusCodeIdx: index("http_status_idx").on(table.statusCode),
}));

export type HttpAccessLog = typeof httpAccessLog.$inferSelect;
export type InsertHttpAccessLog = typeof httpAccessLog.$inferInsert;

/**
 * Shadow API Detections (PHASE 7)
 * Results from shadow API detection engine
 */
export const shadowApiDetections = mysqlTable("shadowApiDetections", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  apiPath: varchar("apiPath", { length: 512 }).notNull(), // e.g., /api/scan/internal_analyze
  riskScore: integer("riskScore").default(0).notNull(), // 0-100
  riskTier: varchar("riskTier", { length: 16 }).default("LOW").notNull(), // CRITICAL, HIGH, MEDIUM, LOW
  detectionMethods: json("detectionMethods").notNull(), // Array of detection reasons
  costImpact: decimal("costImpact", { precision: 12, scale: 8 }).notNull(), // Total cost from this endpoint
  thinkingTokens: integer("thinkingTokens").default(0).notNull(), // Total thinking tokens
  frequency: integer("frequency").default(0).notNull(), // Number of calls
  confidence: varchar("confidence", { length: 16 }).notNull(), // HIGH, MEDIUM, LOW
  details: json("details"), // Additional metadata
  isWhitelisted: boolean("isWhitelisted").default(false).notNull(),
  whitelistReason: text("whitelistReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("shadow_workspace_idx").on(table.workspaceId),
  apiPathIdx: index("shadow_api_path_idx").on(table.apiPath),
  riskScoreIdx: index("shadow_risk_score_idx").on(table.riskScore),
  createdAtIdx: index("shadow_created_idx").on(table.createdAt),
}));

export type ShadowApiDetection = typeof shadowApiDetections.$inferSelect;
export type InsertShadowApiDetection = typeof shadowApiDetections.$inferInsert;

/**
 * Shadow API Whitelist (PHASE 7)
 * Approved shadow APIs (suppressed false positives)
 */
export const shadowApiWhitelist = mysqlTable("shadowApiWhitelist", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  apiPath: varchar("apiPath", { length: 512 }).notNull(), // Normalized path
  approved: boolean("approved").default(true).notNull(),
  reason: text("reason"),
  approvedBy: integer("approvedBy"), // User ID who approved
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  workspacePathIdx: index("whitelist_workspace_path_idx").on(table.workspaceId, table.apiPath),
  workspaceIdx: index("whitelist_workspace_idx").on(table.workspaceId),
}));

export type ShadowApiWhitelist = typeof shadowApiWhitelist.$inferSelect;
export type InsertShadowApiWhitelist = typeof shadowApiWhitelist.$inferInsert;

/**
 * Risk Score History (Phase 8)
 * Daily snapshots of unified risk score for trend analysis.
 */
export const riskScoreHistory = mysqlTable("riskScoreHistory", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  unifiedScore: decimal("unifiedScore", { precision: 5, scale: 2 }).default("0").notNull(),
  securityScore: decimal("securityScore", { precision: 5, scale: 2 }).default("0").notNull(),
  costScore: decimal("costScore", { precision: 5, scale: 2 }).default("0").notNull(),
  riskTier: varchar("riskTier", { length: 16 }).default("HEALTHY").notNull(),
  vulnerabilityCount: integer("vulnerabilityCount").default(0).notNull(),
  criticalVulnCount: integer("criticalVulnCount").default(0).notNull(),
  highVulnCount: integer("highVulnCount").default(0).notNull(),
  costUsd: decimal("costUsd", { precision: 12, scale: 4 }).default("0").notNull(),
  budgetPercent: decimal("budgetPercent", { precision: 5, scale: 2 }).default("0").notNull(),
  agentInterventions: integer("agentInterventions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceDateIdx: index("rsh_workspace_date_idx").on(table.workspaceId, table.date),
}));

export type RiskScoreHistory = typeof riskScoreHistory.$inferSelect;
export type InsertRiskScoreHistory = typeof riskScoreHistory.$inferInsert;

/**
 * BILLING SCHEMA (PHASE 11)
 * Subscription management, invoicing, and usage metering
 */

/**
 * Billing Customers - Links internal customers to Stripe
 */
export const billingCustomers = mysqlTable("billingCustomers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  organizationId: varchar("organizationId", { length: 64 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  paymentMethodId: varchar("paymentMethodId", { length: 64 }),
  defaultPaymentMethod: varchar("defaultPaymentMethod", { length: 64 }),
  taxId: varchar("taxId", { length: 64 }),
  billingAddress: json("billingAddress"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: uniqueIndex("billing_customer_id_idx").on(table.customerId),
  stripeIdIdx: index("billing_stripe_id_idx").on(table.stripeCustomerId),
}));

export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type InsertBillingCustomer = typeof billingCustomers.$inferInsert;

/**
 * Billing Plans - Subscription tiers
 */
export const billingPlans = mysqlTable("billingPlans", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  tier: varchar("tier", { length: 32 }).notNull(), // free, starter, pro, enterprise
  monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).notNull(),
  annualPrice: decimal("annualPrice", { precision: 10, scale: 2 }),
  stripePriceIdMonthly: varchar("stripePriceIdMonthly", { length: 64 }),
  stripePriceIdAnnual: varchar("stripePriceIdAnnual", { length: 64 }),
  features: json("features"),
  quotas: json("quotas"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  tierIdx: index("billing_plan_tier_idx").on(table.tier),
  activeIdx: index("billing_plan_active_idx").on(table.isActive),
}));

export type BillingPlan = typeof billingPlans.$inferSelect;
export type InsertBillingPlan = typeof billingPlans.$inferInsert;

/**
 * Invoices - Customer billing records
 */
export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  customerId: varchar("customerId", { length: 64 }).notNull(),
  subscriptionId: varchar("subscriptionId", { length: 64 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 64 }),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("usd").notNull(),
  status: varchar("status", { length: 32 }).notNull(), // draft, open, paid, void, uncollectible
  dueDate: timestamp("dueDate"),
  issuedDate: timestamp("issuedDate"),
  paidDate: timestamp("paidDate"),
  lineItems: json("lineItems"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  customerIdx: index("invoice_customer_idx").on(table.customerId),
  stripeIdx: index("invoice_stripe_idx").on(table.stripeInvoiceId),
  statusIdx: index("invoice_status_idx").on(table.status),
}));

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
