/**
 * AgentGuard Request Blocking Middleware
 * =====================================
 * This middleware blocks requests from agents that have been killed by AgentGuard.
 * When an agent is killed, its agentId is registered here and subsequent requests
 * are blocked with a 429 response.
 */

import type { Request, Response, NextFunction } from 'express';

interface KilledAgent {
  killedAt: number;
  reason: string;
  costAtIntervention: number;
  projectedOverrun: number;
}

// In-memory store of killed agents
const killedAgents = new Map<string, KilledAgent>();

/**
 * Register a killed agent - called by AgentGuard when an agent is killed
 */
export function registerKilledAgent(agentId: string, data: KilledAgent): void {
  killedAgents.set(agentId, data);
  console.log(`[AgentGuard] Registered killed agent: ${agentId}`);
}

/**
 * Clear a killed agent registration - allows the agent to be resumed
 */
export function clearKilledAgent(agentId: string): void {
  killedAgents.delete(agentId);
  console.log(`[AgentGuard] Cleared killed agent: ${agentId}`);
}

/**
 * Check if an agent is killed
 */
export function isAgentKilled(agentId: string): KilledAgent | undefined {
  return killedAgents.get(agentId);
}

/**
 * Get all killed agents
 */
export function getAllKilledAgents(): Map<string, KilledAgent> {
  return killedAgents;
}

/**
 * Express middleware to block killed agents
 */
export function agentGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const agentId = req.headers['x-agent-id'] as string;
  
  if (!agentId) {
    // No agent ID header, allow the request
    return next();
  }
  
  const killed = killedAgents.get(agentId);
  
  if (killed) {
    console.warn(`[AgentGuard] Blocked request from killed agent: ${agentId}`);
    
    res.status(429).json({
      error: 'AGENT_PAUSED_BY_DEVPULSE',
      message: 'This agent has been paused by DevPulse AgentGuard due to excessive usage.',
      killedAt: new Date(killed.killedAt).toISOString(),
      reason: killed.reason,
      costAtIntervention: `$${killed.costAtIntervention.toFixed(4)}`,
      projectedOverrun: `$${killed.projectedOverrun.toFixed(2)}`,
      action: 'Review your agent configuration and visit the DevPulse dashboard to resume.',
      dashboardUrl: 'https://dashboard.devpulse.in/agent-guard',
    });
    return;
  }
  
  next();
}

// Clean up killed agents after 24 hours
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [agentId, data] of killedAgents.entries()) {
    if (now - data.killedAt > maxAge) {
      killedAgents.delete(agentId);
      console.log(`[AgentGuard] Auto-cleared expired killed agent: ${agentId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour
