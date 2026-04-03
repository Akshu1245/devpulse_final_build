/**
 * Incident Response Service (PHASE 6: Enhanced with unified risk)
 * ==========================
 * Handles rogue agent detection and automated response with risk scoring
 */

import { trackAgentCall, killAgent, getActiveAgents, getAgentStats } from '../_core/agentGuard';
import { UnifiedRiskEngine } from '../_core/unifiedRiskEngine';
import { enqueueNotification } from '../_services/notifications';

export interface IncidentResponse {
  id: string;
  agentId: string;
  severity: 'warning' | 'critical';
  action: 'alert' | 'quarantine' | 'kill';
  reason: string;
  riskScore?: number;  // PHASE 6: Risk-based decision making
  timestamp: Date;
}

/**
 * Detect and respond to rogue agents
 * PHASE 6: Integrated with unified risk scoring
 */
export async function handleAgentIncident(
  workspaceId: number,
  agentId: string
): Promise<IncidentResponse> {
  console.log(`[IncidentResponse] Handling incident for agent ${agentId} in workspace ${workspaceId}`);

  try {
    const stats = await getAgentStats(workspaceId);

    // Check if stats found
    if (!stats) {
      throw new Error('Agent stats not found');
    }

    let severity: 'warning' | 'critical' = 'warning';
    let action: 'alert' | 'quarantine' | 'kill' = 'alert';
    let reason = '';
    let riskScore = stats.riskScore || 0;

    // PHASE 6: Use unified risk tier for decisions
    if (stats.riskTier === 'CRITICAL') {
      severity = 'critical';
      action = 'kill';
      reason = `Critical risk score (${stats.riskScore}): Cost overrun or multiple violations`;
    } else if (stats.riskTier === 'HIGH') {
      severity = 'critical';
      action = 'quarantine';
      reason = `High risk score (${stats.riskScore}): Agent approaching thresholds`;
    } else if (stats.riskTier === 'MEDIUM') {
      severity = 'warning';
      action = 'alert';
      reason = `Medium risk score (${stats.riskScore}): Monitor closely`;
    } else if (stats.riskTier === 'LOW') {
      severity = 'warning';
      action = 'alert';
      reason = `Low risk score (${stats.riskScore}): Continuing normal monitoring`;
    }

    // Execute action
    if (action === 'kill') {
      await killAgent(workspaceId, agentId, reason);
    }

    console.log(
      `[IncidentResponse] ${severity.toUpperCase()}: Agent ${agentId} - ${reason}`
    );

    const response: IncidentResponse = {
      id: `incident_${Date.now()}`,
      agentId,
      severity,
      action,
      reason,
      riskScore,
      timestamp: new Date(),
    };

    return response;
  } catch (error) {
    console.error(`[IncidentResponse] Error handling incident:`, error);
    throw error;
  }
}

/**
 * Monitor all active agents in a workspace
 */
export async function monitorAllAgents(workspaceId: number) {
  try {
    const agents = getActiveAgents(workspaceId);

    for (const agent of agents) {
      const stats = await getAgentStats(workspaceId);

      if (stats) {
        // Check if any threshold is exceeded
        if (
          stats.totalCost > stats.budgetLimit ||
          (stats.riskScore || 0) > 70
        ) {
          await handleAgentIncident(workspaceId, agent.agentId);
        }
      }
    }
  } catch (error) {
    console.error('[IncidentResponse] Error monitoring agents:', error);
  }
}

// Start monitoring in background (called during server initialization)
export function startIncidentMonitoring(workspaceId: number, intervalMs = 60000) {
  console.log(`[IncidentResponse] Starting incident monitoring for workspace ${workspaceId}`);
  setInterval(() => monitorAllAgents(workspaceId), intervalMs);
}
