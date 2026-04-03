// @ts-nocheck
import { eq, and, gte, lte, desc, sql, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  users,
  workspaces,
  workspaceMembers,
  apiKeys,
  scans,
  vulnerabilities,
  subscriptions,
  usageMetrics,
  auditLogs,
  apiProjects,
  llmCostEvents,
  budgetThresholds,
  agentguardEvents,
  llmThinkingAttributions,
  activityLog,
  complianceReports,
  httpAccessLog,
  shadowApiDetections,
  shadowApiWhitelist,
  billingCustomers,
  billingPlans,
  invoices,
  type Workspace,
  type WorkspaceMember,
  type ApiKey,
  type Scan,
  type Vulnerability,
  type Subscription,
  type UsageMetric,
  type AuditLog,
  type ApiProject,
  type LlmCostEvent,
  type BudgetThreshold,
  type AgentguardEvent,
  type LLMThinkingAttribution,
  type ActivityLog,
  type HttpAccessLog,
  type InsertHttpAccessLog,
  type ShadowApiDetection,
  type InsertShadowApiDetection,
  type ShadowApiWhitelist,
  type InsertShadowApiWhitelist,
  type BillingCustomer,
  type InsertBillingCustomer,
  type BillingPlan,
  type InsertBillingPlan,
  type Invoice,
  type InsertInvoice,
} from "./schema";

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

// Re-export schema for convenience
export { users, workspaces, workspaceMembers, apiKeys, scans, vulnerabilities, subscriptions, usageMetrics, auditLogs, apiProjects, llmCostEvents, budgetThresholds, agentguardEvents, llmThinkingAttributions, activityLog, complianceReports, httpAccessLog, shadowApiDetections, shadowApiWhitelist, billingCustomers, billingPlans, invoices };
export type { Workspace, WorkspaceMember, ApiKey, Scan, Vulnerability, Subscription, UsageMetric, AuditLog, ApiProject, LlmCostEvent, BudgetThreshold, AgentguardEvent, LLMThinkingAttribution, ActivityLog, HttpAccessLog, InsertHttpAccessLog, ShadowApiDetection, InsertShadowApiDetection, ShadowApiWhitelist, InsertShadowApiWhitelist, BillingCustomer, InsertBillingCustomer, BillingPlan, InsertBillingPlan, Invoice, InsertInvoice };

// Export eq, and, gte, etc. for convenience
export { eq, and, gte, lte, desc, sql, like, or };

// Create a proxy db object for backward compatibility
export const db = {
  select: async () => { const d = await getDb(); return d.select.bind(d); },
  insert: async (table: any) => { const d = await getDb(); return d.insert(table); },
  update: async (table: any) => { const d = await getDb(); return d.update(table); },
  delete: async () => { const d = await getDb(); return d.delete(); },
  from: async (table: any) => { const d = await getDb(); return d.from(table); },
  set: async (table: any) => { const d = await getDb(); return d.update(table); },
};

// Enhanced database connection pool with optimized settings
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 25,
        queueLimit: 200,
        waitForConnections: true,
        connectTimeout: 10000,
        acquireTimeout: 10000,
        idleTimeout: 600000,
        maxIdle: 5,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });

      _pool.on('error', (err: Error) => {
        console.error('[DB Pool] Unexpected error:', err);
      });

      _db = drizzle(_pool);
      console.log("[Database] Connected successfully with optimized pool settings");
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Get raw pool for transactions
export async function getPool() {
  if (!_pool) {
    await getDb();
  }
  return _pool;
}

// ─────────────────────────────────────────────────────────────────────────
// USER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function upsertUser(user: Partial<typeof users.$inferInsert>): Promise<typeof users.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const values: typeof users.$inferInsert = {
      openId: user.openId!,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? "user",
      lastSignedIn: new Date(),
    };

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: {
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        loginMethod: user.loginMethod ?? undefined,
        lastSignedIn: new Date(),
      },
    });

    const result = await db.select().from(users).where(eq(users.openId, user.openId!)).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0] ?? undefined;
}

// ─────────────────────────────────────────────────────────────────────────
// WORKSPACE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function createWorkspace(
  name: string,
  ownerId: number
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(workspaces)
    .values({ name, ownerId, plan: "free" });

  return { insertId: result.insertId };
}

export async function getWorkspaceById(workspaceId: number): Promise<Workspace | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return result[0] ?? null;
}

export async function getWorkspacesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaces.id, workspaceMembers.workspaceId)
    )
    .where(eq(workspaceMembers.userId, userId));
}

export async function addWorkspaceMember(
  workspaceId: number,
  userId: number,
  role: "owner" | "admin" | "member" | "viewer" = "member"
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role });

  return { insertId: result.insertId };
}

export async function getWorkspaceMembers(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function removeWorkspaceMember(
  workspaceId: number,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    );

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// API KEY OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function createApiKey(
  workspaceId: number,
  userId: number,
  name: string,
  keyHash: string
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(apiKeys)
    .values({ workspaceId, userId, name, keyHash });

  return { insertId: result.insertId };
}

export async function getApiKeysByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, workspaceId));
}

export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  return result[0] ?? null;
}

export async function revokeApiKey(keyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// SCAN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function createScan(
  workspaceId: number,
  projectId?: number,
  userId?: number,
  totalEndpoints?: number
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(scans)
    .values({
      workspaceId,
      projectId,
      userId,
      status: "pending",
      totalEndpoints: totalEndpoints ?? 0,
    });

  return { insertId: result.insertId };
}

export async function getScansByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(scans)
    .where(eq(scans.workspaceId, workspaceId))
    .orderBy(desc(scans.createdAt));
}

export async function getScanById(scanId: number): Promise<Scan | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateScanProgress(
  scanId: number,
  progress: number,
  status?: "pending" | "running" | "completed" | "failed",
  scannedEndpoints?: number,
  vulnerabilitiesFound?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const updateData: Partial<Scan> = { progress };
  if (status) updateData.status = status;
  if (scannedEndpoints !== undefined) updateData.scannedEndpoints = scannedEndpoints;
  if (vulnerabilitiesFound !== undefined) updateData.vulnerabilitiesFound = vulnerabilitiesFound;
  if (status === "running" && !updateData.startedAt) {
    updateData.startedAt = new Date();
  }
  if (status === "completed" || status === "failed") {
    updateData.completedAt = new Date();
  }

  await db.update(scans).set(updateData).where(eq(scans.id, scanId));
  return true;
}

export async function completeScan(
  scanId: number,
  status: "completed" | "failed" | "cancelled",
  errorMessage?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(scans)
    .set({
      status,
      completedAt: new Date(),
      errorMessage: errorMessage ?? null,
    })
    .where(eq(scans.id, scanId));

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// VULNERABILITY OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function createVulnerability(
  scanId: number,
  workspaceId: number,
  data: {
    endpoint: string;
    method: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    category: string;
    title?: string;
    description?: string;
    cwe?: string;
    evidence?: string;
    recommendation?: string;
  }
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(vulnerabilities)
    .values({
      scanId,
      workspaceId,
      endpoint: data.endpoint,
      method: data.method,
      severity: data.severity,
      category: data.category,
      title: data.title ?? data.category,
      description: data.description ?? null,
      cwe: data.cwe ?? null,
      evidence: data.evidence ?? null,
      recommendation: data.recommendation ?? null,
    });

  return { insertId: result.insertId };
}

export async function getVulnerabilitiesByScan(
  scanId: number,
  limit: number = 100,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(vulnerabilities)
    .where(eq(vulnerabilities.scanId, scanId))
    .orderBy(desc(vulnerabilities.id))
    .limit(limit)
    .offset(offset);
}

export async function updateVulnerabilityStatus(
  vulnerabilityId: number,
  status: "open" | "acknowledged" | "resolved" | "wontfix"
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(vulnerabilities)
    .set({ status })
    .where(eq(vulnerabilities.id, vulnerabilityId));

  return true;
}

export async function getVulnerabilitiesByWorkspace(
  workspaceId: number,
  options?: { severity?: string; limit?: number }
) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(vulnerabilities).where(
    eq(vulnerabilities.workspaceId, workspaceId)
  );

  if (options?.severity) {
    query = db.select().from(vulnerabilities).where(
      and(
        eq(vulnerabilities.workspaceId, workspaceId),
        eq(vulnerabilities.severity, options.severity)
      )
    );
  }

  const results = await query;
  return options?.limit ? results.slice(0, options.limit) : results;
}

/**
 * Get aggregated vulnerability counts by severity for a workspace
 */
export async function getVulnerabilityCountsByWorkspace(
  workspaceId: number
): Promise<{
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}> {
  try {
    const db = await getDb();
    if (!db) return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    const counts = await db
      .select({
        severity: vulnerabilities.severity,
        count: sql<number>`COUNT(*)`,
      })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.workspaceId, workspaceId))
      .groupBy(vulnerabilities.severity);

    const result = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const row of counts) {
      const sev = (row.severity || '').toLowerCase();
      const c = Number(row.count) || 0;
      result.total += c;
      if (sev === 'critical') result.critical = c;
      else if (sev === 'high') result.high = c;
      else if (sev === 'medium') result.medium = c;
      else if (sev === 'low') result.low = c;
      else if (sev === 'info') result.info = c;
    }
    return result;
  } catch (err) {
    console.error('[Vulnerability Counts] Query failed:', err);
    return { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  }
}

/**
 * Get vulnerability counts grouped by endpoint for a workspace
 */
export async function getVulnerabilityCountsByEndpoint(
  workspaceId: number,
  options?: { minSeverity?: string; limit?: number }
): Promise<
  Array<{
    endpoint: string;
    method: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    let whereClause = eq(vulnerabilities.workspaceId, workspaceId);
    if (options?.minSeverity) {
      const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      const minLevel = severityOrder[options.minSeverity.toLowerCase()] ?? 0;
      whereClause = and(
        eq(vulnerabilities.workspaceId, workspaceId),
        sql`CASE 
          WHEN ${vulnerabilities.severity} = 'critical' THEN 4
          WHEN ${vulnerabilities.severity} = 'high' THEN 3
          WHEN ${vulnerabilities.severity} = 'medium' THEN 2
          WHEN ${vulnerabilities.severity} = 'low' THEN 1
          ELSE 0
        END >= ${minLevel}`
      );
    }

    const counts = await db
      .select({
        endpoint: vulnerabilities.endpoint,
        method: vulnerabilities.method,
        severity: vulnerabilities.severity,
        count: sql<number>`COUNT(*)`,
      })
      .from(vulnerabilities)
      .where(whereClause)
      .groupBy(vulnerabilities.endpoint, vulnerabilities.method, vulnerabilities.severity);

    const byEndpoint = new Map<string, {
      endpoint: string;
      method: string;
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    }>();

    for (const row of counts) {
      const key = `${row.method}:${row.endpoint}`;
      if (!byEndpoint.has(key)) {
        byEndpoint.set(key, {
          endpoint: row.endpoint,
          method: row.method,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
      }
      const entry = byEndpoint.get(key)!;
      const c = Number(row.count) || 0;
      entry.total += c;
      const sev = (row.severity || '').toLowerCase();
      if (sev === 'critical') entry.critical = c;
      else if (sev === 'high') entry.high = c;
      else if (sev === 'medium') entry.medium = c;
      else if (sev === 'low') entry.low = c;
    }

    const result = Array.from(byEndpoint.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, options?.limit || 50);

    return result;
  } catch (err) {
    console.error('[Vulnerability Counts by Endpoint] Query failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function getSubscription(workspaceId: number): Promise<Subscription | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  return result[0] ?? null;
}

export async function createSubscription(
  workspaceId: number,
  plan: "free" | "pro" | "enterprise" = "free"
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(subscriptions)
    .values({ workspaceId, plan, status: "active" });

  return { insertId: result.insertId };
}

export async function updateSubscription(
  workspaceId: number,
  plan: "free" | "pro" | "enterprise",
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(subscriptions)
    .set({
      plan,
      stripeCustomerId: stripeCustomerId ?? null,
      stripeSubscriptionId: stripeSubscriptionId ?? null,
    })
    .where(eq(subscriptions.workspaceId, workspaceId));

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// USAGE METRICS OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function getOrCreateUsageMetrics(
  workspaceId: number,
  month: string
): Promise<UsageMetric | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(usageMetrics)
    .where(
      and(
        eq(usageMetrics.workspaceId, workspaceId),
        eq(usageMetrics.month, month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db
    .insert(usageMetrics)
    .values({
      workspaceId,
      month,
      scansUsed: 0,
      endpointsScanned: 0,
      storageUsedBytes: 0,
      teamMembers: 0,
    });

  const newRecord = await db
    .select()
    .from(usageMetrics)
    .where(eq(usageMetrics.id, result.insertId))
    .limit(1);

  return newRecord[0] ?? null;
}

export async function incrementUsageMetrics(
  workspaceId: number,
  month: string,
  scansInc: number = 0,
  endpointsInc: number = 0
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const metrics = await getOrCreateUsageMetrics(workspaceId, month);
  if (!metrics) return false;

  await db
    .update(usageMetrics)
    .set({
      scansUsed: metrics.scansUsed + scansInc,
      endpointsScanned: metrics.endpointsScanned + endpointsInc,
    })
    .where(eq(usageMetrics.id, metrics.id));

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// AUDIT LOG OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function createAuditLog(
  workspaceId: number,
  action: string,
  resource: string,
  userId?: number,
  resourceId?: number,
  changes?: Record<string, unknown>,
  ipAddress?: string
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(auditLogs)
    .values({
      workspaceId,
      userId,
      action,
      resource,
      resourceId,
      changes: changes ? JSON.stringify(changes) : null,
      ipAddress,
    });

  return { insertId: result.insertId };
}

// ─────────────────────────────────────────────────────────────────────────
// API PROJECT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function createApiProject(
  workspaceId: number,
  name: string,
  baseUrl: string,
  description?: string
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(apiProjects)
    .values({ workspaceId, name, baseUrl, description });

  return { insertId: result.insertId };
}

export async function getApiProjectsByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(apiProjects)
    .where(eq(apiProjects.workspaceId, workspaceId));
}

// ─────────────────────────────────────────────────────────────────────────
// LLM COST OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function trackLLMUsage(
  workspaceId: number,
  userId: number | undefined,
  model: string,
  inputTokens: number,
  outputTokens: number,
  feature: string,
  thinkingTokens: number = 0
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Calculate cost (simplified)
  const pricing = {
    input: 0.000003,
    output: 0.000015,
    thinking: 0.000003,
  };
  const costUsd = (
    inputTokens * pricing.input +
    outputTokens * pricing.output +
    thinkingTokens * pricing.thinking
  ).toFixed(8);

  const result = await db
    .insert(llmCostEvents)
    .values({
      workspaceId,
      userId,
      provider: model.includes("claude") ? "anthropic" : model.includes("gemini") ? "google" : "openai",
      model,
      featureName: feature,
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      eventTimestamp: Date.now(),
    });

  return parseFloat(costUsd);
}

export async function getLLMCostByWorkspace(workspaceId: number, period?: string) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now();
  let startTime = now - 30 * 24 * 60 * 60 * 1000; // Default: last 30 days

  if (period === "week") {
    startTime = now - 7 * 24 * 60 * 60 * 1000;
  } else if (period === "day") {
    startTime = now - 24 * 60 * 60 * 1000;
  }

  return db
    .select()
    .from(llmCostEvents)
    .where(
      and(
        eq(llmCostEvents.workspaceId, workspaceId),
        gte(llmCostEvents.eventTimestamp, startTime)
      )
    );
}

// ─────────────────────────────────────────────────────────────────────────
// BUDGET OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function getBudgetThreshold(
  workspaceId: number,
  userId: number
): Promise<BudgetThreshold | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(budgetThresholds)
    .where(
      and(
        eq(budgetThresholds.workspaceId, workspaceId),
        eq(budgetThresholds.userId, userId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function setBudgetThreshold(
  workspaceId: number,
  userId: number,
  monthlyLimitUsd: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const existing = await getBudgetThreshold(workspaceId, userId);

  if (existing) {
    await db
      .update(budgetThresholds)
      .set({ monthlyLimitUsd })
      .where(eq(budgetThresholds.id, existing.id));
  } else {
    await db
      .insert(budgetThresholds)
      .values({
        workspaceId,
        userId,
        monthlyLimitUsd,
        provider: "all",
        alertsEnabled: true,
        alertAtPercent: 80,
      });
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// AGENTGUARD OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function trackAgentCall(
  workspaceId: number,
  agentId: string,
  cost: number
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(agentguardEvents)
    .values({
      workspaceId,
      agentId,
      action: "call",
      costUsd: cost.toString(),
      timestamp: Date.now(),
    });

  return { insertId: result.insertId };
}

export async function getActiveAgents(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  return await db
    .select()
    .from(agentguardEvents)
    .where(
      and(
        eq(agentguardEvents.workspaceId, workspaceId),
        gte(agentguardEvents.timestamp, oneHourAgo)
      )
    );
}

export async function getInterventions(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(agentguardEvents)
    .where(
      and(
        eq(agentguardEvents.workspaceId, workspaceId),
        eq(agentguardEvents.action, "killed")
      )
    );
}

export async function getStats(workspaceId: number) {
  const db = await getDb();
  if (!db) return { totalAgents: 0, totalCost: 0, interventions: 0 };

  const agents = await getActiveAgents(workspaceId);
  const interventions = await getInterventions(workspaceId);

  return {
    totalAgents: new Set(agents.map((a: any) => a.agentId)).size,
    totalCost: agents.reduce((sum: number, a: any) => sum + parseFloat(a.costUsd as string || "0"), 0),
    interventions: interventions.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function logActivity(
  workspaceId: number,
  type: string,
  title: string,
  description?: string,
  severity?: string,
  userId?: number,
  metadata?: Record<string, unknown>
): Promise<{ insertId: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(activityLog)
    .values({
      workspaceId,
      userId,
      type,
      title,
      description,
      severity,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

  return { insertId: result.insertId };
}

export async function getRecentActivity(
  workspaceId: number,
  limit: number = 50,
  type?: string
) {
  const db = await getDb();
  if (!db) return [];

  const query = db
    .select()
    .from(activityLog)
    .where(eq(activityLog.workspaceId, workspaceId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  return await query;
}

// ─────────────────────────────────────────────────────────────────────────
// THINKING TOKEN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────

export async function getThinkingTokenSummary(workspaceId: number) {
  const db = await getDb();
  if (!db) return { totalThinkingTokens: 0, totalThinkingCost: 0 };

  const results = await db
    .select()
    .from(llmThinkingAttributions)
    .where(eq(llmThinkingAttributions.workspaceId, workspaceId));

  return {
    totalThinkingTokens: results.reduce((sum: number, r: any) => sum + r.thinkingTokens, 0),
    totalThinkingCost: results.reduce(
      (sum: number, r: any) => sum + parseFloat(r.estimatedCostUsd as string || "0"),
      0
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// SHADOW API OPERATIONS (PHASE 7)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Log HTTP access for API call tracking
 * Fire-and-forget: non-blocking insert
 */
export async function logHttpAccessEvent(
  event: InsertHttpAccessLog
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Non-blocking insert
    db.insert(httpAccessLog)
      .values(event)
      .then()
      .catch((err: Error) => {
        console.error("[HTTP Access Log] Failed to insert:", err);
        // Non-blocking: silently fail
      });
  } catch (err: unknown) {
    console.error("[HTTP Access Log] Error:", err);
    // Non-blocking: continue execution
  }
}

/**
 * Batch insert HTTP access logs for performance
 */
export async function batchLogHttpAccessEvents(
  events: InsertHttpAccessLog[]
): Promise<void> {
  try {
    const db = await getDb();
    if (!db || events.length === 0) return;

    // Non-blocking batch insert
    db.insert(httpAccessLog)
      .values(events)
      .then()
      .catch((err: Error) => {
        console.error("[HTTP Access Log Batch] Failed to insert:", err);
      });
  } catch (err: unknown) {
    console.error("[HTTP Access Log Batch] Error:", err);
  }
}

/**
 * Record a shadow API detection result
 */
export async function recordShadowApiDetection(
  detection: InsertShadowApiDetection
): Promise<ShadowApiDetection | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    // Upsert: update if exists, insert if not
    const result = await db
      .insert(shadowApiDetections)
      .values(detection)
      .onDuplicateKeyUpdate({
        set: {
          riskScore: detection.riskScore,
          riskTier: detection.riskTier,
          detectionMethods: detection.detectionMethods,
          costImpact: detection.costImpact,
          thinkingTokens: detection.thinkingTokens,
          frequency: detection.frequency,
          confidence: detection.confidence,
          details: detection.details,
          updatedAt: new Date(),
        },
      });

    // Fetch and return the record
    return await getShadowApiDetectionByPath(
      detection.workspaceId,
      detection.apiPath
    );
  } catch (err) {
    console.error("[Shadow API Detection] Failed to record:", err);
    return null;
  }
}

/**
 * Get a specific shadow API detection
 */
export async function getShadowApiDetectionByPath(
  workspaceId: number,
  apiPath: string
): Promise<ShadowApiDetection | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const results = await db
      .select()
      .from(shadowApiDetections)
      .where(
        and(
          eq(shadowApiDetections.workspaceId, workspaceId),
          eq(shadowApiDetections.apiPath, apiPath)
        )
      )
      .limit(1);

    return results[0] || null;
  } catch (err) {
    console.error("[Shadow API Detection] Query failed:", err);
    return null;
  }
}

/**
 * Get all shadow API detections for a workspace
 */
export async function getShadowApiDetectionsByWorkspace(
  workspaceId: number,
  options?: {
    onlyActive?: boolean;
    minRiskScore?: number;
    limit?: number;
  }
): Promise<ShadowApiDetection[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    let query = db
      .select()
      .from(shadowApiDetections)
      .where(eq(shadowApiDetections.workspaceId, workspaceId));

    if (options?.onlyActive) {
      query = query.where(
        eq(shadowApiDetections.isWhitelisted, false)
      ) as any;
    }

    if (options?.minRiskScore) {
      query = query.where(
        gte(shadowApiDetections.riskScore, options.minRiskScore)
      ) as any;
    }

    const results = await query
      .orderBy(desc(shadowApiDetections.riskScore))
      .limit(options?.limit || 1000);

    return results;
  } catch (err) {
    console.error("[Shadow API Detections] Query failed:", err);
    return [];
  }
}

/**
 * Whitelist a shadow API endpoint
 */
export async function whitelistShadowApi(
  workspaceId: number,
  apiPath: string,
  reason?: string,
  approvedBy?: number
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // Insert into whitelist
    await db.insert(shadowApiWhitelist).values({
      workspaceId,
      apiPath,
      approved: true,
      reason,
      approvedBy,
    });

    // Update detection to mark as whitelisted
    await db
      .update(shadowApiDetections)
      .set({
        isWhitelisted: true,
        whitelistReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shadowApiDetections.workspaceId, workspaceId),
          eq(shadowApiDetections.apiPath, apiPath)
        )
      );

    return true;
  } catch (err) {
    console.error("[Whitelist] Failed to whitelist endpoint:", err);
    return false;
  }
}

/**
 * Remove an endpoint from shadow API whitelist
 */
export async function removeFromShadowApiWhitelist(
  workspaceId: number,
  apiPath: string
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    // Delete from whitelist
    await db
      .delete(shadowApiWhitelist)
      .where(
        and(
          eq(shadowApiWhitelist.workspaceId, workspaceId),
          eq(shadowApiWhitelist.apiPath, apiPath)
        )
      );

    // Update detection to unwhitelist
    await db
      .update(shadowApiDetections)
      .set({
        isWhitelisted: false,
        whitelistReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shadowApiDetections.workspaceId, workspaceId),
          eq(shadowApiDetections.apiPath, apiPath)
        )
      );

    return true;
  } catch (err) {
    console.error("[Whitelist] Failed to remove whitelist:", err);
    return false;
  }
}

/**
 * Get whitelisted endpoints for a workspace
 */
export async function getWhitelistedEndpoints(
  workspaceId: number
): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const results = await db
      .select({ apiPath: shadowApiWhitelist.apiPath })
      .from(shadowApiWhitelist)
      .where(
        and(
          eq(shadowApiWhitelist.workspaceId, workspaceId),
          eq(shadowApiWhitelist.approved, true)
        )
      );

    return results.map((r: any) => r.apiPath);
  } catch (err) {
    console.error("[Whitelist] Query failed:", err);
    return [];
  }
}

/**
 * Get all endpoints called in a workspace (for shadow API detection)
 */
export async function getWorkspaceEndpoints(
  workspaceId: number,
  options?: {
    days?: number;
    limit?: number;
  }
): Promise<
  Array<{
    method: string;
    path: string;
    count: number;
    latencyMs: number;
    totalCost: number;
  }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const daysAgo = options?.days || 7;
    const cutoffTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

    const results = await db
      .select({
        method: httpAccessLog.method,
        path: httpAccessLog.path,
        count: sql<number>`COUNT(*) as count`,
        latencyMs: sql<number>`AVG(latencyMs) as latencyMs`,
        totalCost: sql<number>`COALESCE(SUM(c.costUsd), 0) as totalCost`,
      })
      .from(httpAccessLog)
      .leftJoin(
        llmCostEvents,
        and(
          eq(httpAccessLog.workspaceId, llmCostEvents.workspaceId),
          eq(httpAccessLog.path, llmCostEvents.apiPath)
        )
      )
      .where(
        and(
          eq(httpAccessLog.workspaceId, workspaceId),
          gte(httpAccessLog.requestTimestamp, cutoffTime)
        )
      )
      .groupBy(
        (t: any) => [t.method, t.path],
        httpAccessLog.method,
        httpAccessLog.path
      )
      .orderBy((t: any) => desc(t.count))
      .limit(options?.limit || 500);

    return results as any[];
  } catch (err) {
    console.error("[Endpoints] Query failed:", err);
    return [];
  }
}

/**
 * Get endpoint-level thinking token usage
 */
export async function getEndpointThinkingTokenUsage(
  workspaceId: number,
  apiPath?: string,
  options?: {
    days?: number;
  }
): Promise<
  Array<{
    path: string;
    feature: string;
    thinkingTokens: number;
    estimatedCost: number;
  }>
> {
  try {
    const db = await getDb();
    if (!db) return [];

    const daysAgo = options?.days || 30;
    const cutoffTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;

    let query = db
      .select({
        path: llmThinkingAttributions.apiPath,
        feature: llmThinkingAttributions.feature,
        thinkingTokens: sql<number>`SUM(thinkingTokens) as thinkingTokens`,
        estimatedCost: sql<number>`SUM(CAST(estimatedCostUsd AS DECIMAL(12,8))) as estimatedCost`,
      })
      .from(llmThinkingAttributions)
      .where(
        and(
          eq(llmThinkingAttributions.workspaceId, workspaceId),
          gte(llmThinkingAttributions.timestamp, cutoffTime)
        )
      );

    if (apiPath) {
      query = query.where(eq(llmThinkingAttributions.apiPath, apiPath)) as any;
    }

    const results = await query
      .groupBy(
        (t: any) => [t.path, t.feature],
        llmThinkingAttributions.apiPath,
        llmThinkingAttributions.feature
      )
      .orderBy((t: any) => desc(t.thinkingTokens));

    return results as any[];
  } catch (err) {
    console.error("[Endpoint Thinking Tokens] Query failed:", err);
    return [];
  }
}

// Close database connection pool
export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
