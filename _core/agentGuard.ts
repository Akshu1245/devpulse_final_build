/**
 * AgentGuard Service
 * ==================
 * Autonomous agent monitoring and rogue agent kill switch.
 */

import { getDb, logActivity, trackLLMUsage } from "../db";
import { agentguardEvents, type AgentguardEvent } from "../schema";

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export interface AgentCall {
  agentId: string;
  workspaceId: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  thinkingTokens?: number;
  costUsd: number;
  latencyMs: number;
  timestamp: number;
}

export interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalCalls: number;
  totalCost: number;
  interventions: number;
  avgCostPerCall: number;
  // PHASE 6: Enhanced fields for unified risk integration
  budgetLimit: number;
  maxTokens: number;
  callsPerMinute: number;
  rateLimit: number;
  workspaceId: number;
  userId?: number;
  userEmail?: string;
  // Risk scoring
  riskScore?: number;
  riskTier?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'HEALTHY';
}

export interface KillSwitchResult {
  success: boolean;
  agentId: string;
  reason: string;
  costSaved: number;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────
// IN-MEMORY TRACKING (for real-time monitoring)
// ─────────────────────────────────────────────────────────────────────────

export interface AgentState {
  agentId: string;
  workspaceId: number;
  totalCost: number;
  totalCalls: number;
  firstSeen: number;
  lastSeen: number;
  isKilled: boolean;
  killedAt?: number;
  killReason?: string;
}

// In-memory agent tracking (resets on restart - for production use Redis)
const agentStates = new Map<string, AgentState>();

// Budget thresholds per workspace (can be configured per workspace)
const workspaceBudgets = new Map<number, { dailyLimit: number; monthlyLimit: number; alertAt: number }>();

// Active WebSocket connections for real-time notifications
const wsConnections = new Map<string, (data: unknown) => void>();

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Set budget thresholds for a workspace.
 */
export function setWorkspaceBudget(
  workspaceId: number,
  config: { dailyLimit?: number; monthlyLimit?: number; alertAt?: number }
) {
  const existing = workspaceBudgets.get(workspaceId) || { dailyLimit: 10, monthlyLimit: 100, alertAt: 80 };
  workspaceBudgets.set(workspaceId, { ...existing, ...config });
}

/**
 * Get budget configuration for a workspace.
 */
export function getWorkspaceBudget(workspaceId: number) {
  return workspaceBudgets.get(workspaceId) || { dailyLimit: 10, monthlyLimit: 100, alertAt: 80 };
}

// ─────────────────────────────────────────────────────────────────────────
// TRACKING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Track an agent call and check for budget violations.
 */
export async function trackAgentCall(
  call: AgentCall
): Promise<{ tracked: boolean; alert?: { type: string; message: string } }> {
  const { agentId, workspaceId, costUsd } = call;

  // Get or create agent state
  let state = agentStates.get(`${workspaceId}:${agentId}`);
  if (!state) {
    state = {
      agentId,
      workspaceId,
      totalCost: 0,
      totalCalls: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      isKilled: false,
    };
    agentStates.set(`${workspaceId}:${agentId}`, state);
  }

  // Update state
  state.totalCost += costUsd;
  state.totalCalls += 1;
  state.lastSeen = Date.now();

  // Persist to database
  const db = await getDb();
  if (db) {
    db.insert(agentguardEvents)
      .values({
        workspaceId,
        agentId,
        action: "call",
        costUsd: costUsd.toString(),
        timestamp: call.timestamp || Date.now(),
      })
      .catch((err) => console.error("[AgentGuard] Failed to track call:", err));
  }

  // Check for budget violations
  const budget = getWorkspaceBudget(workspaceId);
  const alertThreshold = budget.dailyLimit * (budget.alertAt / 100);

  if (state.totalCost >= budget.dailyLimit) {
    // Kill the agent!
    const result = await killAgent(workspaceId, agentId, "Daily budget threshold exceeded");
    return { tracked: true, alert: { type: "killed", message: result.reason } };
  }

  if (state.totalCost >= alertThreshold) {
    // Send warning
    const warning = `Agent ${agentId} has spent ${state.totalCost.toFixed(2)} (${budget.alertAt}% of daily limit)`;
    broadcastAlert(workspaceId, { type: "warning", message: warning });
    return { tracked: true, alert: { type: "warning", message: warning } };
  }

  return { tracked: true };
}

/**
 * Kill a rogue agent.
 */
export async function killAgent(
  workspaceId: number,
  agentId: string,
  reason: string
): Promise<KillSwitchResult> {
  const state = agentStates.get(`${workspaceId}:${agentId}`);
  if (!state) {
    return {
      success: false,
      agentId,
      reason: "Agent not found",
      costSaved: 0,
      timestamp: Date.now(),
    };
  }

  // Mark as killed
  state.isKilled = true;
  state.killedAt = Date.now();
  state.killReason = reason;

  // Persist to database
  const db = await getDb();
  if (db) {
    db.insert(agentguardEvents)
      .values({
        workspaceId,
        agentId,
        action: "killed",
        reason,
        costUsd: state.totalCost.toString(),
        details: JSON.stringify({
          totalCalls: state.totalCalls,
          duration: state.lastSeen - state.firstSeen,
        }),
        timestamp: Date.now(),
      })
      .catch((err) => console.error("[AgentGuard] Failed to log kill:", err));

    // Log activity
    logActivity(
      workspaceId,
      "agent_killed",
      "Rogue Agent Killed",
      `Agent ${agentId} was terminated. Reason: ${reason}. Total cost: $${state.totalCost.toFixed(2)}`,
      "critical"
    ).catch((err) => console.error("[AgentGuard] Failed to log activity:", err));
  }

  // Broadcast kill notification
  broadcastAlert(workspaceId, {
    type: "killed",
    message: `Agent ${agentId} has been killed. Reason: ${reason}`,
    agentId,
    costSaved: state.totalCost,
  });

  console.log(`[AgentGuard] 🔪 Agent ${agentId} killed. Reason: ${reason}. Total cost: $${state.totalCost.toFixed(2)}`);

  return {
    success: true,
    agentId,
    reason,
    costSaved: state.totalCost,
    timestamp: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// MONITORING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get all active agents for a workspace.
 */
export function getActiveAgents(workspaceId: number): AgentState[] {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  return Array.from(agentStates.values())
    .filter((state) => state.workspaceId === workspaceId && state.lastSeen > oneHourAgo && !state.isKilled);
}

/**
 * Get agent statistics for a workspace.
 * PHASE 6: Enhanced with risk scoring and unified risk integration
 */
export async function getAgentStats(workspaceId: number): Promise<AgentStats> {
  const db = await getDb();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  let totalCalls = 0;
  let totalCost = 0;
  let interventions = 0;

  if (db) {
    const events = await db
      .select()
      .from(agentguardEvents)
      .where(eq(agentguardEvents.workspaceId, workspaceId));

    for (const event of events) {
      if (event.timestamp > oneDayAgo) {
        totalCalls++;
        totalCost += parseFloat(event.costUsd as string || "0");
      }
      if (event.action === "killed") {
        interventions++;
      }
    }
  }

  // Get active agents from memory
  const activeAgents = getActiveAgents(workspaceId);
  const budget = getWorkspaceBudget(workspaceId);
  
  // PHASE 6: Calculate calls per minute
  const callsPerMinute = totalCalls > 0 ? totalCalls / 24 / 60 : 0; // Approximate from daily total

  // PHASE 6: Calculate risk score based on cost and interventions
  let riskScore = 0;
  let riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'HEALTHY' = 'HEALTHY';
  
  // Cost-based risk
  const costPercentage = (totalCost / budget.dailyLimit) * 100;
  if (costPercentage >= 100) {
    riskScore = Math.min(100, 90 + (costPercentage - 100) * 0.1);
    riskTier = 'CRITICAL';
  } else if (costPercentage >= 80) {
    riskScore = Math.min(90, 70 + (costPercentage - 80) * 0.5);
    riskTier = 'HIGH';
  } else if (costPercentage >= 50) {
    riskScore = Math.min(70, 50 + (costPercentage - 50) * 0.4);
    riskTier = 'MEDIUM';
  } else if (costPercentage >= 30) {
    riskScore = Math.min(50, 30 + (costPercentage - 30) * 0.33);
    riskTier = 'LOW';
  }

  // Intervention penalty
  if (interventions > 0) {
    riskScore = Math.min(100, riskScore + interventions * 5);
    if (riskScore >= 90) riskTier = 'CRITICAL';
    else if (riskScore >= 70) riskTier = 'HIGH';
  }

  return {
    totalAgents: new Set(
      Array.from(agentStates.values())
        .filter((s) => s.workspaceId === workspaceId)
        .map((s) => s.agentId)
    ).size,
    activeAgents: activeAgents.length,
    totalCalls,
    totalCost: parseFloat(totalCost.toFixed(8)),
    interventions,
    avgCostPerCall: totalCalls > 0 ? parseFloat((totalCost / totalCalls).toFixed(8)) : 0,
    // PHASE 6: Enhanced fields
    budgetLimit: budget.dailyLimit,
    maxTokens: 1_000_000, // Configurable per workspace
    callsPerMinute: Math.round(callsPerMinute * 100) / 100,
    rateLimit: 100, // Configurable per workspace
    workspaceId,
    // Risk scoring
    riskScore: Math.round(riskScore * 100) / 100,
    riskTier,
  };
}

/**
 * Get recent incidents/alerts (PHASE 6: renamed from getRecentInterventions to include all events)
 */
export async function getAlertHistory(
  workspaceId: number,
  limit: number = 50,
  offset: number = 0
): Promise<AgentguardEvent[]> {
  const db = await getDb();
  if (!db) return [];

  const events = await db
    .select()
    .from(agentguardEvents)
    .where(eq(agentguardEvents.workspaceId, workspaceId));

  // Sort by timestamp descending (most recent first)
  return events
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(offset, offset + limit);
}

/**
 * Get recent interventions for a workspace (legacy method for compatibility).
 */
export async function getRecentInterventions(workspaceId: number, limit: number = 50): Promise<AgentguardEvent[]> {
  return getAlertHistory(workspaceId, limit, 0);
}

/**
 * Clean up stale agent states (called periodically).
 */
export function cleanupStaleAgents(maxAgeMs: number = 24 * 60 * 60 * 1000) {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, state] of agentStates.entries()) {
    if (now - state.lastSeen > maxAgeMs) {
      agentStates.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[AgentGuard] Cleaned up ${cleaned} stale agent states`);
  }

  return cleaned;
}

// ─────────────────────────────────────────────────────────────────────────
// WEBSOCKET NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Register a WebSocket connection for real-time alerts.
 */
export function registerConnection(connectionId: string, sendFn: (data: unknown) => void) {
  wsConnections.set(connectionId, sendFn);
}

/**
 * Unregister a WebSocket connection.
 */
export function unregisterConnection(connectionId: string) {
  wsConnections.delete(connectionId);
}

/**
 * Broadcast alert to all connections for a workspace.
 */
function broadcastAlert(workspaceId: number, alert: unknown) {
  for (const sendFn of wsConnections.values()) {
    try {
      sendFn({ workspaceId, alert, timestamp: Date.now() });
    } catch (err) {
      console.error("[AgentGuard] Failed to broadcast alert:", err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Reset all agent states (use with caution).
 */
export function resetAllAgents() {
  agentStates.clear();
  console.log("[AgentGuard] All agent states reset");
}

/**
 * Reset a specific agent.
 */
export function resetAgent(workspaceId: number, agentId: string) {
  agentStates.delete(`${workspaceId}:${agentId}`);
  console.log(`[AgentGuard] Agent ${agentId} in workspace ${workspaceId} reset`);
}

/**
 * Get memory usage stats.
 */
export function getMemoryStats() {
  return {
    trackedAgents: agentStates.size,
    activeConnections: wsConnections.size,
    workspaceBudgets: workspaceBudgets.size,
  };
}

/**
 * PHASE 6: Invalidate caches related to agent stats
 * (called after kill or significant state change)
 */
export async function invalidateAgentGuardCaches(workspaceId: number) {
  // Try to clear Redis caches if using cache layer
  try {
    const cacheKey = `agentguard:stats:${workspaceId}`;
    const dashboardCacheKey = `agentguard:dashboard:${workspaceId}`;
    const historyKey = `agentguard:history:${workspaceId}`;
    
    // Check if Redis/cache is available
    if ((global as any).redisClient) {
      // This would normally call invalidateAgentGuardCaches from cache layer
      console.log(`[AgentGuard] Cache invalidation requested for workspace ${workspaceId}`);
    }
  } catch (error) {
    console.error('[AgentGuard] Cache invalidation error:', error);
  }
}

// Import eq from drizzle-orm for the query
import { eq } from "drizzle-orm";
