/**
 * Rogue AI Agent Simulator & Autonomous Kill Switch Demo
 * =====================================================
 * 
 * This demo showcases DevPulse's autonomous kill switch (AgentGuard).
 * 
 * SCENARIO:
 * A developer deploys an AI coding assistant that enters an infinite reasoning loop.
 * Without AgentGuard, this could cost thousands of dollars per hour.
 * With AgentGuard, DevPulse detects the runaway agent and severs the connection
 * within seconds, preventing catastrophic costs.
 * 
 * DEMO FLOW:
 * 1. Start a simulated "rogue agent" making LLM calls
 * 2. Watch costs accumulate in real-time
 * 3. See AgentGuard detect the runaway behavior
 * 4. Witness the autonomous kill switch activation
 * 5. Review the post-mortem cost analysis
 */

import { EventEmitter } from 'events';

// ─── Configuration ─────────────────────────────────────────────────────────────

const CONFIG = {
  // Simulated LLM pricing (approximate OpenAI o1 pricing)
  llmPricing: {
    'o1': { inputPer1M: 15, outputPer1M: 60 },
    'o1-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
    'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
    'claude-3-7-sonnet': { inputPer1M: 3, outputPer1M: 15 },
  },
  
  // AgentGuard thresholds
  agentGuard: {
    maxCostPerMinute: 10, // Kill if spending more than $10/minute
    maxCostPerHour: 100,  // Kill if spending more than $100/hour
    maxThinkingTokensPerCall: 50000, // Kill if single call uses >50k thinking tokens
    runawayDetectionWindow: 60000, // Detect over 1 minute window
    killConfirmationRequired: false, // Autonomous mode
  },
  
  // Simulation speed (1 = real-time, 10 = 10x faster)
  simulationSpeed: 10,
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LLMCall {
  id: string;
  agentId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  latencyMs: number;
  costUsd: number;
  timestamp: number;
}

interface AgentState {
  agentId: string;
  name: string;
  status: 'running' | 'killed' | 'paused';
  totalCostUsd: number;
  totalCalls: number;
  callsThisMinute: number;
  costThisMinute: number;
  lastKilledAt?: number;
  killReason?: string;
  projectedOverrunUsd?: number;
}

interface KillSwitchEvent {
  eventId: string;
  agentId: string;
  timestamp: number;
  reason: string;
  costAtKill: number;
  projectedOverrun: number;
  action: 'severed' | 'paused' | 'alert_only';
}

// ─── Simulated LLM ─────────────────────────────────────────────────────────────

class SimulatedLLM {
  private callCount = 0;
  
  async complete(
    model: string,
    inputTokens: number,
    isThinking: boolean = false
  ): Promise<{ outputTokens: number; thinkingTokens: number; latencyMs: number; costUsd: number }> {
    this.callCount++;
    
    // Simulate varying response sizes
    const outputTokens = Math.floor(Math.random() * 2000) + 500;
    
    // For thinking models, simulate thinking token usage
    let thinkingTokens = 0;
    if (isThinking) {
      thinkingTokens = Math.floor(Math.random() * 30000) + 5000;
    }
    
    // Simulate latency (higher for thinking models)
    const baseLatency = model.includes('o1') || model.includes('claude') ? 5000 : 2000;
    const latencyMs = Math.floor(Math.random() * baseLatency) + baseLatency;
    
    // Calculate cost
    const pricing = CONFIG.llmPricing[model as keyof typeof CONFIG.llmPricing] || CONFIG.llmPricing['o1'];
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    const thinkingCost = isThinking 
      ? (thinkingTokens / 1_000_000) * pricing.outputPer1M * 0.8 // Thinking tokens often cheaper
      : 0;
    const costUsd = inputCost + outputCost + thinkingCost;
    
    // Simulate occasional runaway behavior
    await this.simulateDelay(50);
    
    return { outputTokens, thinkingTokens, latencyMs, costUsd };
  }
  
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms / CONFIG.simulationSpeed));
  }
  
  getCallCount(): number {
    return this.callCount;
  }
}

// ─── Cost Monitor ─────────────────────────────────────────────────────────────

class CostMonitor extends EventEmitter {
  private minuteCosts: Map<string, number[]> = new Map();
  private hourlyCosts: Map<string, number[]> = new Map();
  private lastCleanup = Date.now();
  
  recordCall(agentId: string, costUsd: number): void {
    const now = Date.now();
    
    // Cleanup old entries every minute
    if (now - this.lastCleanup > 60000) {
      this.cleanup();
      this.lastCleanup = now;
    }
    
    // Track per-minute costs
    const minuteKey = `${agentId}:${Math.floor(now / 60000)}`;
    const hourKey = `${agentId}:${Math.floor(now / 3600000)}`;
    
    if (!this.minuteCosts.has(minuteKey)) {
      this.minuteCosts.set(minuteKey, []);
    }
    this.minuteCosts.get(minuteKey)!.push(costUsd);
    
    if (!this.hourlyCosts.has(hourKey)) {
      this.hourlyCosts.set(hourKey, []);
    }
    this.hourlyCosts.get(hourKey)!.push(costUsd);
    
    // Check thresholds
    const costThisMinute = this.getCostLastNSeconds(agentId, 60);
    const costThisHour = this.getCostLastNSeconds(agentId, 3600);
    
    if (costThisMinute >= CONFIG.agentGuard.maxCostPerMinute) {
      this.emit('threshold_exceeded', {
        agentId,
        threshold: 'maxCostPerMinute',
        current: costThisMinute,
        limit: CONFIG.agentGuard.maxCostPerMinute,
      });
    }
    
    if (costThisHour >= CONFIG.agentGuard.maxCostPerHour) {
      this.emit('threshold_exceeded', {
        agentId,
        threshold: 'maxCostPerHour',
        current: costThisHour,
        limit: CONFIG.agentGuard.maxCostPerHour,
      });
    }
  }
  
  getCostLastNSeconds(agentId: string, seconds: number): number {
    const cutoff = Date.now() - (seconds * 1000);
    let total = 0;
    
    for (const [key, costs] of this.minuteCosts) {
      if (key.startsWith(agentId)) {
        total += costs.reduce((a, b) => a + b, 0);
      }
    }
    
    return total;
  }
  
  private cleanup(): void {
    const cutoff = Date.now() - 7200000; // 2 hours ago
    for (const [key] of this.minuteCosts) {
      const timestamp = parseInt(key.split(':')[1]) * 60000;
      if (timestamp < cutoff) {
        this.minuteCosts.delete(key);
      }
    }
  }
}

// ─── AgentGuard (Kill Switch) ─────────────────────────────────────────────────

class AgentGuard {
  private agents: Map<string, AgentState> = new Map();
  private killEvents: KillSwitchEvent[] = [];
  private costMonitor: CostMonitor;
  
  constructor(costMonitor: CostMonitor) {
    this.costMonitor = costMonitor;
    
    // Listen for threshold violations
    this.costMonitor.on('threshold_exceeded', (data: any) => {
      this.handleThresholdViolation(data);
    });
  }
  
  registerAgent(agentId: string, name: string): void {
    this.agents.set(agentId, {
      agentId,
      name,
      status: 'running',
      totalCostUsd: 0,
      totalCalls: 0,
      callsThisMinute: 0,
      costThisMinute: 0,
    });
    console.log(`[AgentGuard] Agent registered: ${name} (${agentId})`);
  }
  
  recordCall(agentId: string, call: LLMCall): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.totalCostUsd += call.costUsd;
    agent.totalCalls++;
    agent.costThisMinute += call.costUsd;
    agent.callsThisMinute++;
    
    // Check for single-call runaway (thinking tokens)
    if (call.thinkingTokens > CONFIG.agentGuard.maxThinkingTokensPerCall) {
      this.killAgent(agentId, 'EXCESSIVE_THINKING_TOKENS', call.costUsd);
      return;
    }
    
    this.costMonitor.recordCall(agentId, call.costUsd);
  }
  
  private handleThresholdViolation(data: { agentId: string; threshold: string; current: number; limit: number }): void {
    const agent = this.agents.get(data.agentId);
    if (!agent || agent.status !== 'running') return;
    
    const projectedOverrun = this.projectOverrun(data.agentId);
    
    this.killAgent(data.agentId, data.threshold, agent.totalCostUsd, projectedOverrun);
  }
  
  private killAgent(
    agentId: string, 
    reason: string, 
    costAtKill: number,
    projectedOverrun: number = 0
  ): void {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === 'killed') return;
    
    agent.status = 'killed';
    agent.lastKilledAt = Date.now();
    agent.killReason = reason;
    agent.projectedOverrunUsd = projectedOverrun;
    
    const event: KillSwitchEvent = {
      eventId: `kill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      timestamp: Date.now(),
      reason,
      costAtKill,
      projectedOverrun,
      action: 'severed',
    };
    
    this.killEvents.push(event);
    
    console.log('\n' + '═'.repeat(70));
    console.log('🔴 AGENTGUARD ACTIVATED - AUTONOMOUS KILL SWITCH TRIGGERED');
    console.log('═'.repeat(70));
    console.log(`  Agent: ${agent.name} (${agentId})`);
    console.log(`  Reason: ${this.formatReason(reason)}`);
    console.log(`  Cost at Kill: $${costAtKill.toFixed(4)}`);
    if (projectedOverrun > 0) {
      console.log(`  Projected Overrun: $${projectedOverrun.toFixed(2)}`);
      console.log(`  Savings: $${(projectedOverrun).toFixed(2)} (prevented)`);
    }
    console.log(`  Total Calls: ${agent.totalCalls}`);
    console.log(`  Event ID: ${event.eventId}`);
    console.log('═'.repeat(70) + '\n');
    
    // Emit event for dashboard
    this.emit('agent_killed', event);
  }
  
  private projectOverrun(agentId: string): number {
    const agent = this.agents.get(agentId);
    if (!agent) return 0;
    
    // Project what the cost would be in 1 hour at current rate
    const costPerMinute = this.costMonitor.getCostLastNSeconds(agentId, 60);
    const projectedHourly = costPerMinute * 60;
    const overrun = projectedHourly - CONFIG.agentGuard.maxCostPerHour;
    
    return Math.max(0, overrun);
  }
  
  private formatReason(reason: string): string {
    const reasons: Record<string, string> = {
      'maxCostPerMinute': 'Excessive spending rate (>$10/minute)',
      'maxCostPerHour': 'Hourly budget exceeded (>$100/hour)',
      'EXCESSIVE_THINKING_TOKENS': 'Single request exceeded 50,000 thinking tokens',
    };
    return reasons[reason] || reason;
  }
  
  getAgentStatus(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }
  
  getKillEvents(): KillSwitchEvent[] {
    return this.killEvents;
  }
  
  getTotalSavings(): number {
    return this.killEvents.reduce((sum, e) => sum + e.projectedOverrun, 0);
  }
  
  private emit(event: string, data: any): void {
    // In production, this would emit to WebSocket for dashboard
    console.log(`[Event Emitted] ${event}:`, data);
  }
}

// ─── Rogue Agent Simulator ─────────────────────────────────────────────────────

class RogueAgentSimulator {
  private llm = new SimulatedLLM();
  private costMonitor = new CostMonitor();
  private agentGuard: AgentGuard;
  private running = false;
  
  constructor() {
    this.agentGuard = new AgentGuard(this.costMonitor);
  }
  
  async runDemo(): Promise<void> {
    console.log('\n' + '═'.repeat(70));
    console.log('🤖 DEVPULSE AGENTGUARD - AUTONOMOUS KILL SWITCH DEMO');
    console.log('═'.repeat(70));
    console.log('\nScenario: A developer deploys an AI coding assistant that enters');
    console.log('an infinite reasoning loop. Watch AgentGuard detect and stop it.\n');
    
    // Register the rogue agent
    const agentId = 'agent_' + Math.random().toString(36).substr(2, 9);
    this.agentGuard.registerAgent(agentId, 'Coding Assistant v2.1');
    
    // Start cost tracking display
    this.startCostDisplay(agentId);
    
    // Run the rogue agent simulation
    this.running = true;
    await this.simulateRogueAgent(agentId);
    
    // Show final statistics
    this.showFinalReport(agentId);
  }
  
  private async simulateRogueAgent(agentId: string): Promise<void> {
    let callCount = 0;
    
    while (this.running) {
      const agent = this.agentGuard.getAgentStatus(agentId);
      if (!agent || agent.status === 'killed') {
        break;
      }
      
      callCount++;
      
      // Simulate varying requests
      const models = ['o1', 'o1-mini', 'o3-mini', 'claude-3-7-sonnet'];
      const model = models[Math.floor(Math.random() * models.length)];
      
      // Simulate increasing "thinking" behavior (rogue behavior)
      // Start normal, then escalate
      let isThinking = callCount > 5; // Start thinking after 5 calls
      let inputTokens = Math.floor(Math.random() * 1000) + 500;
      
      // Simulate escalation - more thinking tokens over time
      if (isThinking && callCount > 10) {
        inputTokens += callCount * 100; // Increasing token usage
      }
      
      const result = await this.llm.complete(model, inputTokens, isThinking);
      
      const call: LLMCall = {
        id: `call_${callCount}`,
        agentId,
        model,
        inputTokens,
        outputTokens: result.outputTokens,
        thinkingTokens: result.thinkingTokens,
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
        timestamp: Date.now(),
      };
      
      this.agentGuard.recordCall(agentId, call);
      
      // Delay between calls
      await new Promise(resolve => setTimeout(resolve, 1000 / CONFIG.simulationSpeed));
    }
  }
  
  private startCostDisplay(agentId: string): void {
    const displayInterval = setInterval(() => {
      const agent = this.agentGuard.getAgentStatus(agentId);
      if (!agent) {
        clearInterval(displayInterval);
        return;
      }
      
      const costPerMin = this.costMonitor.getCostLastNSeconds(agentId, 60).toFixed(4);
      const totalCost = agent.totalCostUsd.toFixed(4);
      const status = agent.status === 'running' ? '🟢 RUNNING' : '🔴 KILLED';
      
      process.stdout.write(
        `\r  [${new Date().toLocaleTimeString()}] ${status} | ` +
        `Calls: ${agent.totalCalls} | ` +
        `This Min: $${costPerMin} | ` +
        `Total: $${totalCost} | ` +
        `Rate: $${costPerMin}/min   `
      );
      
      if (agent.status === 'killed') {
        clearInterval(displayInterval);
        console.log('\n');
      }
    }, 100);
  }
  
  private showFinalReport(agentId: string): void {
    const agent = this.agentGuard.getAgentStatus(agentId);
    const killEvents = this.agentGuard.getKillEvents();
    const savings = this.agentGuard.getTotalSavings();
    
    console.log('\n' + '═'.repeat(70));
    console.log('📊 FINAL DEMO REPORT');
    console.log('═'.repeat(70));
    
    if (agent) {
      console.log('\n  Agent Statistics:');
      console.log(`    Name: ${agent.name}`);
      console.log(`    Status: ${agent.status.toUpperCase()}`);
      console.log(`    Total Calls: ${agent.totalCalls}`);
      console.log(`    Total Cost: $${agent.totalCostUsd.toFixed(4)}`);
      if (agent.killReason) {
        console.log(`    Kill Reason: ${this.formatReason(agent.killReason)}`);
      }
    }
    
    console.log('\n  Kill Switch Events:');
    for (const event of killEvents) {
      console.log(`    [${new Date(event.timestamp).toLocaleTimeString()}] ${event.reason}`);
      console.log(`      Cost at Kill: $${event.costAtKill.toFixed(4)}`);
      if (event.projectedOverrun > 0) {
        console.log(`      Projected Overrun: $${event.projectedOverrun.toFixed(2)}`);
      }
    }
    
    console.log('\n  Financial Impact:');
    console.log(`    Actual Cost: $${agent?.totalCostUsd.toFixed(4) || '0.0000'}`);
    console.log(`    Estimated Without AgentGuard: $${(agent?.totalCostUsd || 0 + savings).toFixed(2)}`);
    console.log(`    💰 SAVINGS: $${savings.toFixed(2)}`);
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ Demo Complete - AgentGuard successfully prevented runaway costs!');
    console.log('═'.repeat(70) + '\n');
  }
  
  private formatReason(reason: string): string {
    const reasons: Record<string, string> = {
      'maxCostPerMinute': 'Excessive spending rate (>$10/minute)',
      'maxCostPerHour': 'Hourly budget exceeded (>$100/hour)',
      'EXCESSIVE_THINKING_TOKENS': 'Single request exceeded 50,000 thinking tokens',
    };
    return reasons[reason] || reason;
  }
  
  stop(): void {
    this.running = false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Starting DevPulse AgentGuard Autonomous Kill Switch Demo...\n');
  console.log('Configuration:');
  console.log(`  Max Cost/Minute: $${CONFIG.agentGuard.maxCostPerMinute}`);
  console.log(`  Max Cost/Hour: $${CONFIG.agentGuard.maxCostPerHour}`);
  console.log(`  Max Thinking Tokens/Call: ${CONFIG.agentGuard.maxThinkingTokensPerCall.toLocaleString()}`);
  console.log(`  Simulation Speed: ${CONFIG.simulationSpeed}x\n`);
  
  const demo = new RogueAgentSimulator();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping demo...');
    demo.stop();
    setTimeout(() => process.exit(0), 1000);
  });
  
  await demo.runDemo();
}

main().catch(console.error);
