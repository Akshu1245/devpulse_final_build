/**
 * 3-Minute Disaster Demo — End-to-End Flow
 * =========================================
 * Complete demo script for YC Hackathon presentation
 * 
 * Demo Timeline:
 * 0:00-0:30 — Problem setup (show rogue agent scenario)
 * 0:30-1:30 — Detection in action (VS Code sidebar updates)
 * 1:30-2:30 — Kill switch fires (Slack alert arrives)
 * 2:30-3:00 — Dashboard shows intervention (cost saved)
 */

import { WebSocket } from 'ws';

// ============ Demo Configuration ============

export interface DemoConfig {
  apiUrl: string;
  wsUrl: string;
  slackWebhook: string;
  agentId: string;
  budgetLimit: number;
  costPerRequest: number;
  requestsPerSecond: number;
  workspaceId: number;
}

const DEFAULT_CONFIG: DemoConfig = {
  apiUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3001/ws/realtime',
  slackWebhook: process.env.SLACK_WEBHOOK_URL || '',
  agentId: 'demo-rogue-agent',
  budgetLimit: 10.00, // $10 demo budget
  costPerRequest: 0.05, // $0.05 per request
  requestsPerSecond: 5,
  workspaceId: 1,
};

// ============ Demo State ============

interface DemoState {
  phase: 'idle' | 'running' | 'detected' | 'killed' | 'complete';
  totalRequests: number;
  totalCost: number;
  startTime: number | null;
  killTime: number | null;
  slackAlertSent: boolean;
  projectedOverrun: number;
}

let state: DemoState = {
  phase: 'idle',
  totalRequests: 0,
  totalCost: 0,
  startTime: null,
  killTime: null,
  slackAlertSent: false,
  projectedOverrun: 0,
};

// ============ Demo Script ============

export class DisasterDemo {
  private config: DemoConfig;
  private ws: WebSocket | null = null;
  private requestInterval: NodeJS.Timeout | null = null;
  private onStateChange: ((state: DemoState) => void) | null = null;

  constructor(config: Partial<DemoConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to state changes
   */
  onUpdate(callback: (state: DemoState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Get current state
   */
  getState(): DemoState {
    return { ...state };
  }

  /**
   * Reset demo state
   */
  reset(): void {
    state = {
      phase: 'idle',
      totalRequests: 0,
      totalCost: 0,
      startTime: null,
      killTime: null,
      slackAlertSent: false,
      projectedOverrun: 0,
    };
    this.notifyStateChange();
  }

  /**
   * Start the disaster demo
   */
  async start(): Promise<void> {
    console.log('🚀 Starting 3-Minute Disaster Demo...\n');
    console.log('Demo Config:');
    console.log(`  Agent ID: ${this.config.agentId}`);
    console.log(`  Budget Limit: $${this.config.budgetLimit}`);
    console.log(`  Cost per Request: $${this.config.costPerRequest}`);
    console.log(`  Requests per Second: ${this.config.requestsPerSecond}\n`);

    // Phase 1: Connect to WebSocket
    await this.connectWebSocket();

    // Phase 2: Start rogue agent
    state.phase = 'running';
    state.startTime = Date.now();
    this.notifyStateChange();
    console.log('⚠️  PHASE 1: Rogue agent started making rapid API calls...\n');

    // Simulate rapid API requests
    this.startRogueAgent();
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.config.wsUrl}?workspaceId=${this.config.workspaceId}&userId=demo`;
      
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          console.log('📡 Connected to WebSocket\n');
          resolve();
        });

        this.ws.on('message', (data: string) => {
          this.handleWebSocketMessage(JSON.parse(data));
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('📡 WebSocket disconnected');
        });
      } catch (err) {
        // If WebSocket fails, continue demo without real-time updates
        console.log('⚠️  WebSocket unavailable, continuing demo...\n');
        resolve();
      }
    });
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    console.log(`📨 WebSocket: ${message.type}`);

    switch (message.type) {
      case 'costUpdate':
        console.log(`   Cost update: $${message.data.currentSpend.toFixed(2)}`);
        break;

      case 'budgetWarning':
        console.log(`   ⚠️  Budget warning: ${message.data.percentUsed}% used`);
        state.phase = 'detected';
        this.notifyStateChange();
        break;

      case 'killSwitchAlert':
        console.log(`\n🚨 KILL SWITCH ACTIVATED!`);
        console.log(`   Agent: ${message.data.agentId}`);
        console.log(`   Reason: ${message.data.reason}`);
        console.log(`   Cost at intervention: $${message.data.costAtIntervention.toFixed(2)}`);
        console.log(`   Projected overrun prevented: $${message.data.projectedOverrun.toFixed(2)}\n`);
        
        state.phase = 'killed';
        state.killTime = Date.now();
        state.projectedOverrun = message.data.projectedOverrun;
        this.stopRogueAgent();
        this.notifyStateChange();
        break;
    }
  }

  /**
   * Start simulating rogue agent requests
   */
  private startRogueAgent(): void {
    this.requestInterval = setInterval(async () => {
      // Simulate API request
      state.totalRequests++;
      state.totalCost += this.config.costPerRequest;
      
      // Log every 10 requests
      if (state.totalRequests % 10 === 0) {
        console.log(`   Request #${state.totalRequests} — Total cost: $${state.totalCost.toFixed(2)}`);
      }

      // Send to backend
      try {
        await fetch(`${this.config.apiUrl}/api/agentguard/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: this.config.agentId,
            workspaceId: this.config.workspaceId,
            cost: this.config.costPerRequest,
            requestCount: 1,
          }),
        });
      } catch {
        // Ignore network errors in demo
      }

      // Check if we've hit the budget (fallback if WebSocket doesn't fire)
      if (state.totalCost >= this.config.budgetLimit && state.phase === 'running') {
        console.log('\n⚠️  Budget limit reached!');
        state.phase = 'detected';
        this.notifyStateChange();
        
        // Simulate kill switch after detection
        setTimeout(() => this.simulateKillSwitch(), 500);
      }
    }, 1000 / this.config.requestsPerSecond);
  }

  /**
   * Stop the rogue agent
   */
  private stopRogueAgent(): void {
    if (this.requestInterval) {
      clearInterval(this.requestInterval);
      this.requestInterval = null;
    }
  }

  /**
   * Simulate kill switch when backend doesn't respond
   */
  private async simulateKillSwitch(): Promise<void> {
    console.log('\n🚨 KILL SWITCH ACTIVATED (simulated)!');
    console.log(`   Agent: ${this.config.agentId}`);
    console.log(`   Reason: Budget limit exceeded`);
    console.log(`   Cost at intervention: $${state.totalCost.toFixed(2)}`);

    // Calculate projected overrun
    const elapsedSeconds = (Date.now() - (state.startTime || Date.now())) / 1000;
    const costPerSecond = state.totalCost / elapsedSeconds;
    const projectedHourlyCost = costPerSecond * 3600;
    state.projectedOverrun = projectedHourlyCost;

    console.log(`   Projected hourly cost: $${projectedHourlyCost.toFixed(2)}`);
    console.log(`   Intervention saved: $${(projectedHourlyCost - state.totalCost).toFixed(2)}\n`);

    state.phase = 'killed';
    state.killTime = Date.now();
    this.stopRogueAgent();
    this.notifyStateChange();

    // Send Slack alert
    await this.sendSlackAlert();

    // Complete demo
    setTimeout(() => {
      state.phase = 'complete';
      this.notifyStateChange();
      this.printSummary();
    }, 1000);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(): Promise<void> {
    if (!this.config.slackWebhook) {
      console.log('📱 Slack alert (not configured, would send):\n');
      this.printSlackMessage();
      return;
    }

    try {
      const message = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 AgentGuard Kill Switch Activated',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Agent:*\n${this.config.agentId}` },
              { type: 'mrkdwn', text: `*Status:*\n🔴 Terminated` },
              { type: 'mrkdwn', text: `*Cost at Intervention:*\n$${state.totalCost.toFixed(2)}` },
              { type: 'mrkdwn', text: `*Projected Overrun:*\n$${state.projectedOverrun.toFixed(2)}/hr` },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Reason:* Agent exceeded budget limit of $${this.config.budgetLimit} by making ${state.totalRequests} rapid API calls.`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View in Dashboard', emoji: true },
                url: `${this.config.apiUrl}/agentguard`,
              },
            ],
          },
        ],
      };

      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      state.slackAlertSent = true;
      console.log('📱 Slack alert sent!\n');
    } catch (err) {
      console.log('📱 Slack alert failed:', err);
    }
  }

  /**
   * Print Slack message preview
   */
  private printSlackMessage(): void {
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│ 🚨 AgentGuard Kill Switch Activated        │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│ Agent: ${this.config.agentId.padEnd(35)}│`);
    console.log(`│ Status: 🔴 Terminated                       │`);
    console.log(`│ Cost at Intervention: $${state.totalCost.toFixed(2).padEnd(20)}│`);
    console.log(`│ Projected Overrun: $${state.projectedOverrun.toFixed(2).padEnd(20)}/hr │`);
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ Reason: Budget limit exceeded               │');
    console.log('└─────────────────────────────────────────────┘\n');
  }

  /**
   * Print final summary
   */
  private printSummary(): void {
    const duration = ((state.killTime || Date.now()) - (state.startTime || Date.now())) / 1000;

    console.log('═══════════════════════════════════════════════');
    console.log('              DEMO COMPLETE                    ');
    console.log('═══════════════════════════════════════════════\n');
    console.log('📊 Summary:');
    console.log(`   Duration: ${duration.toFixed(1)} seconds`);
    console.log(`   Total Requests: ${state.totalRequests}`);
    console.log(`   Total Cost: $${state.totalCost.toFixed(2)}`);
    console.log(`   Projected Hourly Cost: $${state.projectedOverrun.toFixed(2)}`);
    console.log(`   Cost Saved by Kill Switch: $${(state.projectedOverrun - state.totalCost).toFixed(2)}\n`);
    console.log('✅ AgentGuard successfully prevented runaway AI costs!\n');
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...state });
    }
  }

  /**
   * Stop demo
   */
  stop(): void {
    this.stopRogueAgent();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    state.phase = 'idle';
    this.notifyStateChange();
  }
}

// ============ CLI Entry Point ============

async function runDemo() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🛡️  DevPulse AgentGuard — 3-Minute Disaster Demo        ║');
  console.log('║                                                           ║');
  console.log('║   Watch as a rogue AI agent gets detected and killed     ║');
  console.log('║   before it can burn through your API budget.            ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');

  const demo = new DisasterDemo();
  
  demo.onUpdate((state) => {
    // Track state changes for UI updates
  });

  await demo.start();

  // Auto-stop after 3 minutes
  setTimeout(() => {
    if (state.phase !== 'complete') {
      console.log('\n⏰ Demo timeout reached (3 minutes)\n');
      demo.stop();
    }
  }, 180000);
}

// Run if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };
