# PHASE 6 — AGENTGUARD SYSTEM ANALYSIS

**Date**: March 28, 2026  
**Status**: Pre-Implementation Analysis  
**Scope**: Dashboard Enhancement + Risk Integration

---

## EXECUTIVE SUMMARY

The AgentGuard system is **partially functional** but has significant gaps:
- ✅ Backend cost-based kill switch works
- ✅ Database persistence complete
- ⚠️ **Dashboard is demo-only** (not connected to real data)
- ⚠️ **NOT integrated with PHASE 4 Unified Risk Engine**
- ⚠️ **WebSocket isolated** (not using central service)
- ⚠️ **Alert history not tracked** (only kills recorded)

For PHASE 6, we need to: **(1) Connect dashboard to real data**, **(2) Add unified risk integration**, **(3) Bridge WebSocket**, **(4) Enhance incident tracking**.

---

## 1. CURRENT AGENTGUARD.TS IMPLEMENTATION

### 1.1 Data Structures

```typescript
// INPUT: Tracked agent call
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

// OUTPUT: Kill switch result
export interface KillSwitchResult {
  success: boolean;
  agentId: string;
  reason: string;
  costSaved: number;
  timestamp: number;
}

// STATS: Aggregated metrics
export interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalCalls: number;
  totalCost: number;
  interventions: number;
  avgCostPerCall: number;
}

// IN-MEMORY: Per-agent tracking
interface AgentState {
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
```

### 1.2 Storage Strategy

**3-tier approach**:

1. **In-Memory (AgentState Map)**
   - Purpose: Real-time tracking, fast checks
   - Scope: Last 24 hours active agents
   - Limitation: Loses data on restart (need Redis for production)

2. **Database (agentguardEvents table)**
   - Purpose: Historical audit trail
   - Data: All calls + kills
   - Schema:
     ```sql
     CREATE TABLE agentguardEvents (
       id INT PRIMARY KEY AUTO_INCREMENT,
       workspaceId INT NOT NULL,
       agentId VARCHAR(128) NOT NULL,
       action VARCHAR(64) NOT NULL,  -- 'call' | 'killed'
       reason VARCHAR(256),
       costUsd DECIMAL(12, 6),
       details TEXT,  -- JSON: totalCalls, duration
       timestamp BIGINT NOT NULL,
       createdAt TIMESTAMP DEFAULT NOW(),
       INDEX(workspaceId),
       INDEX(agentId)
     )
     ```

3. **WebSocket (Real-time alerts)**
   - Purpose: Live notifications
   - Format: { type, agentId, costSaved, workspaceId }
   - Recipients: Internal Map callbacks (should be WebSocketService)

### 1.3 Core Methods

#### **trackAgentCall()**
Tracks a single LLM call, checks budget, auto-kills if exceeded.

```typescript
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
    // KILL THE AGENT
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
```

**Flow**:
1. Get/create agent state in memory
2. Update cost + call count + timestamp
3. **Persist** call event to database
4. Check if cost >= budget → KILL
5. Check if cost >= alert% → WARN
6. Otherwise → OK

**⚠️ ISSUE**: Checks only cost, not security risk score from PHASE 4.

---

#### **killAgent()**
Terminates an agent, records event, broadcasts alert.

```typescript
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
```

**Flow**:
1. Mark state as killed
2. Insert "killed" event to database
3. Log to activity log
4. Broadcast to all WebSocket clients
5. Return result

**⚠️ ISSUE**: WebSocket broadcast uses internal Map (not central service).

---

#### **getAgentStats()**
Aggregates metrics from memory + database.

```typescript
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
  };
}
```

---

### 1.4 Budget Configuration

```typescript
// Per-workspace budget thresholds (in-memory, not persisted)
const workspaceBudgets = new Map<number, { 
  dailyLimit: number;      // e.g., $10
  monthlyLimit: number;    // e.g., $100
  alertAt: number;         // e.g., 80 (percent)
}>();

export function setWorkspaceBudget(
  workspaceId: number,
  config: { dailyLimit?: number; monthlyLimit?: number; alertAt?: number }
) {
  const existing = workspaceBudgets.get(workspaceId) || { 
    dailyLimit: 10, 
    monthlyLimit: 100, 
    alertAt: 80 
  };
  workspaceBudgets.set(workspaceId, { ...existing, ...config });
}
```

**⚠️ ISSUE**: Budgets only in memory. Should be persisted to database.

---

## 2. CURRENT AGENTGUARDPAGE.TSX UI

### 2.1 Current State

**Status**: Demo-only UI, no real data connection

```typescript
export const AgentGuardPage: React.FC = () => {
  const [demoActive, setDemoActive] = useState(false);
  const [demoSpend, setDemoSpend] = useState(0);
  const [demoKilled, setDemoKilled] = useState(false);
  const [demoIncidents, setDemoIncidents] = useState<any[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [demoStartTime, setDemoStartTime] = useState<number | null>(null);

  // Check if demo mode is enabled
  const isDemoMode = process.env.NODE_ENV === 'development' || 
    new URLSearchParams(window.location.search).get('demo') === 'true';

  // DEMO TIMER: Simulates spending
  useEffect(() => {
    if (!demoActive || demoKilled) return;

    const interval = setInterval(() => {
      setDemoSpend((prev) => {
        const newSpend = prev + Math.random() * (8 - 3) + 3; // Random ₹3-8 increment
        
        if (newSpend >= 150) {
          // Agent killed at ₹150 threshold
          setDemoKilled(true);
          const elapsedSeconds = demoStartTime ? Math.floor((Date.now() - demoStartTime) / 1000) : 0;
          setNotificationMessage(`🚨 Rogue Agent Killed — DevPulse saved ₹${newSpend.toFixed(2)} in ${elapsedSeconds}s`);
          setShowNotification(true);
          
          // Add incident entry
          setDemoIncidents((prev) => [
            {
              id: Date.now(),
              agentId: 'rogue-agent-demo',
              action: 'killed',
              reason: 'Budget threshold exceeded',
              spentAmount: newSpend.toFixed(2),
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev,
          ]);

          setTimeout(() => setShowNotification(false), 5000);
          return newSpend;
        }
        
        return newSpend;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [demoActive, demoKilled, demoStartTime]);

  // DEMO BUTTON
  const handleStartDemo = () => {
    setDemoActive(true);
    setDemoKilled(false);
    setDemoSpend(0);
    setDemoStartTime(Date.now());
    setDemoIncidents([]);
  };

  const handleStopDemo = () => {
    setDemoActive(false);
    setDemoKilled(false);
    setDemoSpend(0);
    setDemoStartTime(null);
  };
```

### 2.2 UI Sections

**1. Live Demo Section** (dev-only)
- Shows current spend rate (₹X)
- Status badge: "🔴 AGENT ACTIVE" or "✓ KILLED BY AGENTGUARD"
- Kill confirmation message

**2. Active Agents** (demo data)
- Lists agents currently running
- Shows agent ID, reason, spent amount, timestamp

**3. Incident History** (demo data)
- Table with: Agent ID, Action, Reason, Amount Spent, Timestamp

### 2.3 UI Limitations

| Feature | Current | Needed |
|---------|---------|--------|
| Data Source | Hardcoded demo state | Real API data |
| Updates | Local state only | WebSocket real-time |
| History | In-memory demo array | Database query |
| Active Agents | None shown | List from getActiveAgents() |
| Manual Kill | No button | Kill switch UI |
| Budget Settings | Not shown | Config form |
| Cost Charts | Not shown | Trend visualization |

**⚠️ ISSUE**: Zero connection to backend data. Complete demo-only implementation.

---

## 3. ROUTER ENDPOINTS (AGENTGUARD.*)

Located in [routers.ts](routers.ts#L1122)

### 3.1 Defined Endpoints

#### **1. agentGuard.trackCall** (🔴 mutation)
Tracks an agent LLM call.

```typescript
agentGuard: router({
  trackCall: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        agentId: z.string(),
        costUsd: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      await trackAgent(input);
      
      // PHASE 2: Check for incident thresholds
      try {
        const stats = await getAgentStats(input.agentId);
        if (stats && (
          stats.totalCost > stats.budgetLimit ||
          stats.totalTokens > stats.maxTokens ||
          stats.callsPerMinute > stats.rateLimit
        )) {
          await handleAgentIncident(input.agentId);
        }
      } catch (error) {
        console.error('[AgentGuard] Incident check error:', error);
      }

      return { success: true };
    }),
```

**Input**:
- `workspaceId: number`
- `agentId: string`
- `costUsd: number`

**Process**:
1. Call `trackAgent()` → in-memory + database
2. Get stats → check thresholds
3. If exceeded → call `handleAgentIncident()` (from incident response service)

**⚠️ ISSUE**: References undefined fields (budgetLimit, maxTokens, callsPerMinute).

---

#### **2. agentGuard.killAgent** (🔴 mutation)
Manually kill an agent.

```typescript
killAgent: protectedProcedure
  .input(
    z.object({
      workspaceId: z.number(),
      agentId: z.string(),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const result = await killAgent(input.workspaceId, input.agentId, input.reason || "Manual kill");
    
    // PHASE 2: Send urgent notification
    await enqueueNotification({
      type: 'email',
      workspaceId: input.workspaceId,
      userId: ctx.user?.id,
      recipient: ctx.user?.email || 'admin@example.com',
      title: 'Agent Terminated',
      message: `Agent ${input.agentId} has been terminated. Reason: ${input.reason || 'Manual kill'}`,
      severity: 'critical',
    });

    return result;
  }),
```

**Input**: { workspaceId, agentId, reason? }  
**Output**: KillSwitchResult

---

#### **3. agentGuard.getActiveAgents** (🟢 query)
Get currently active agents.

```typescript
getActiveAgents: protectedProcedure
  .input(z.object({ workspaceId: z.number() }))
  .query(async ({ input }) => {
    return getActiveAgents(input.workspaceId);
  }),
```

**Returns**: AgentState[] (agents seen in last hour)

---

#### **4. agentGuard.getInterventions** (🟢 query)
Get kill history.

```typescript
getInterventions: protectedProcedure
  .input(z.object({ workspaceId: z.number() }))
  .query(async ({ input }) => {
    return await getRecentInterventions(input.workspaceId);
  }),
```

**Returns**: AgentguardEvent[] where action === "killed"

---

#### **5. agentGuard.getStats** (🟢 query)
Get workspace-level statistics.

```typescript
getStats: protectedProcedure
  .input(z.object({ workspaceId: z.number() }))
  .query(async ({ input }) => {
    return await getAgentStats(input.workspaceId);
  }),
```

**Returns**: AgentStats struct

---

#### **6. agentGuard.activeCount** (🟢 query)
Get count of active agents (less verbose).

```typescript
activeCount: protectedProcedure
  .input(z.object({ workspaceId: z.number() }))
  .query(async ({ input }) => {
    const agents = getActiveAgents(input.workspaceId);
    return { count: agents.length };
  }),
```

---

## 4. INCIDENT RESPONSE SERVICE

Located in [_services/incidentResponse.ts](/_services/incidentResponse.ts)

### 4.1 handleAgentIncident()

Checks 3 thresholds and escalates accordingly.

```typescript
export async function handleAgentIncident(agentId: string): Promise<IncidentResponse> {
  console.log(`[IncidentResponse] Handling incident for agent ${agentId}`);

  try {
    const stats = await getAgentStats(agentId);

    if (!stats) {
      throw new Error('Agent not found');
    }

    let severity: 'warning' | 'critical' = 'warning';
    let action: 'alert' | 'quarantine' | 'kill' = 'alert';
    let reason = '';

    // ⚠️ COST THRESHOLD
    if (stats.totalCost > stats.budgetLimit * 1.2) {
      severity = 'critical';
      action = 'kill';
      reason = `Cost overrun: $${stats.totalCost} > ${stats.budgetLimit * 1.2}`;
    }

    // ⚠️ TOKEN THRESHOLD (references undefined field!)
    if (stats.totalTokens > stats.maxTokens * 0.9) {
      severity = stats.totalTokens > stats.maxTokens ? 'critical' : 'warning';
      action = stats.totalTokens > stats.maxTokens ? 'kill' : 'quarantine';
      reason = `Token threshold exceeded: ${stats.totalTokens} / ${stats.maxTokens}`;
    }

    // ⚠️ RATE LIMIT THRESHOLD
    if (stats.callsPerMinute > stats.rateLimit) {
      severity = 'critical';
      action = 'kill';
      reason = `Rate limit exceeded: ${stats.callsPerMinute} calls/min > ${stats.rateLimit}`;
    }

    // Execute action
    if (action === 'kill') {
      await killAgent(agentId);
    }

    // Send notification
    await enqueueNotification({
      type: 'email',
      workspaceId: stats.workspaceId,
      userId: stats.userId,
      recipient: stats.userEmail || 'admin@example.com',
      title: `${severity.toUpperCase()}: Rogue Agent Detected`,
      message: reason,
      severity,
    });

    const response: IncidentResponse = {
      id: `incident_${Date.now()}`,
      agentId,
      severity,
      action,
      reason,
      timestamp: new Date(),
    };

    console.log(`[IncidentResponse] Incident resolved: ${JSON.stringify(response)}`);

    return response;
  } catch (error) {
    console.error(`[IncidentResponse] Error handling incident:`, error);
    throw error;
  }
}
```

**Thresholds**:
1. **Cost**: totalCost > budget × 1.2 → KILL
2. **Tokens**: totalTokens > maxTokens × 0.9 → WARN, > maxTokens → KILL
3. **Rate**: callsPerMinute > rateLimit → KILL

**⚠️ ISSUES**:
- AgentStats doesn't have budgetLimit, maxTokens, callsPerMinute fields
- Service assumes these exist (will fail at runtime)
- No security/risk score checks

---

### 4.2 monitorAllAgents()

Background monitoring loop (runs every 60s).

```typescript
export async function monitorAllAgents() {
  try {
    const agents = await getActiveAgents();

    for (const agentId of agents) {
      const stats = await getAgentStats(agentId);

      if (stats) {
        // Check if any threshold is exceeded
        if (
          stats.totalCost > stats.budgetLimit ||
          stats.totalTokens > stats.maxTokens ||
          stats.callsPerMinute > stats.rateLimit
        ) {
          await handleAgentIncident(agentId);
        }
      }
    }
  } catch (error) {
    console.error('[IncidentResponse] Error monitoring agents:', error);
  }
}

export function startIncidentMonitoring(intervalMs = 60000) {
  console.log('[IncidentResponse] Starting incident monitoring');
  setInterval(monitorAllAgents, intervalMs);
}
```

---

## 5. WEBSOCKET INTEGRATION

### 5.1 Current WebSocket Service

Located in [_services/websocket.ts](/_services/websocket.ts)

Generic infrastructure for workspace-based messaging.

```typescript
export interface WSMessage {
  type: 'notification' | 'alert' | 'update' | 'heartbeat';
  workspaceId: string;
  userId?: string;
  payload: any;
  timestamp: Date;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients = new Map<string, Set<WebSocket>>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupConnections();
  }

  public broadcast(workspaceId: string, message: WSMessage) {
    const workspace = this.clients.get(workspaceId);
    if (!workspace) return;

    const data = JSON.stringify(message);
    workspace.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public sendToUser(workspaceId: string, userId: string, message: WSMessage) {
    message.userId = userId;
    this.broadcast(workspaceId, message);
  }

  public getClientCount(workspaceId: string): number {
    return this.clients.get(workspaceId)?.size || 0;
  }
}
```

### 5.2 AgentGuard WebSocket Bridge

**Current**: Isolated message system in agentGuard.ts

```typescript
// Active WebSocket connections for real-time notifications (ISOLATED)
const wsConnections = new Map<string, (data: unknown) => void>();

export function registerConnection(connectionId: string, sendFn: (data: unknown) => void) {
  wsConnections.set(connectionId, sendFn);
}

export function broadcastAlert(workspaceId: number, alert: unknown) {
  for (const sendFn of wsConnections.values()) {
    try {
      sendFn({ workspaceId, alert, timestamp: Date.now() });
    } catch (err) {
      console.error("[AgentGuard] Failed to broadcast alert:", err);
    }
  }
}
```

**⚠️ ISSUE**: Two separate systems:
- Central: `WebSocketService` (per workspace)
- AgentGuard: Internal Map (generic)
- They don't communicate

**Result**: AgentGuard alerts never reach WebSocket clients.

---

## 6. DATABASE SCHEMA

### 6.1 agentguardEvents Table

From [schema.ts](schema.ts#L211)

```typescript
export const agentguardEvents = mysqlTable("agentguardEvents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull(),
  agentId: varchar("agentId", { length: 128 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),    // 'call' | 'killed'
  reason: varchar("reason", { length: 256 }),
  costUsd: decimal("costUsd", { precision: 12, scale: 6 }),
  details: text("details"),    // JSON: totalCalls, duration
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index("agentguard_workspace_idx").on(table.workspaceId),
  agentIdIdx: index("agentguard_agent_idx").on(table.agentId),
}));
```

**Limitations**:
- ❌ No alert history (only kills tracked)
- ❌ No risk score stored
- ❌ No feature association
- ❌ No manual vs auto-kill distinction

**Missing**:
```typescript
// SHOULD ADD:
- type: 'alert' | 'warning' | 'kill'  // escalation path
- riskScore: number  // from PHASE 4
- featureName: string  // what feature triggered it
- isAutomatic: boolean  // auto-kill vs manual
- metadata: json  // extensible field
```

---

## 7. INTEGRATION WITH PHASE 4 UNIFIED RISK ENGINE

### Current State: ❌ NOT INTEGRATED

**What PHASE 4 provides**:
```typescript
// From routers.ts (line 73)
import { 
  UnifiedRiskEngine, 
  FeatureRiskAnalyzer, 
  RiskTrendAnalyzer 
} from "./_core/unifiedRiskEngine";

// AVAILABLE ENDPOINTS:
// - unified.getOverallScore({ workspaceId }) → UnifiedRiskAssessment
// - unified.getHighestRiskFeatures({ workspaceId, limit })
// - unified.getRiskTrend({ workspaceId, days })
```

**UnifiedRiskAssessment output**:
```typescript
{
  workspaceId: number;
  unifiedScore: number;        // 0-100 (60% security + 40% cost)
  tier: UnifiedRiskTier;       // CRITICAL | HIGH | MEDIUM | LOW | HEALTHY
  riskScore: number;           // 0-100 (security)
  costScore: number;           // 0-100 (budget)
  issuePriority: string;       // URGENT | HIGH | MEDIUM | LOW
  recommendation: string;
  timestamp: number;
}
```

**What AgentGuard currently misses**:
- ❌ No unified score threshold
- ❌ No security-based triggers
- ❌ No anomaly detection
- ❌ No trend analysis

**Proposed integration**:
```typescript
// In agentGuard.ts trackAgentCall():

const riskAssessment = await UnifiedRiskEngine.assess(
  workspaceId,
  severity,       // from vulnerabilities
  cost,           // from llmCostTracker
);

// Add this check:
if (riskAssessment.unifiedScore >= 80) {
  // HIGH/CRITICAL risk → more aggressive auto-kill
  const result = await killAgent(workspaceId, agentId, 
    `High risk score (${riskAssessment.unifiedScore}/100) detected`);
  return { tracked: true, alert: { type: "killed", message: result.reason } };
}
```

---

## 8. INCIDENT HISTORY & PERSISTENCE

### 8.1 What Gets Persisted

✅ **Stored**:
- All LLM call events (from track calls)
- All kill events with reason + cost
- Metadata (JSON details field)
- Timestamps

❌ **NOT Stored**:
- Alert progressions (threshold crossing)
- Quarantine events
- Risk scores at time of kill
- Which feature caused the issue
- Manual vs automatic actions

### 8.2 Query Capabilities

**Available** (via db.ts):
```typescript
export async function getInterventions(workspaceId: number) {
  return db
    .select()
    .from(agentguardEvents)
    .where(
      and(
        eq(agentguardEvents.workspaceId, workspaceId),
        eq(agentguardEvents.action, "killed")
      )
    );
}
```

**Missing**:
```typescript
// NEED TO ADD:
- getAlertHistory(workspaceId, timeRange)
- getAgentHistory(workspaceId, agentId)
- getIncidentsByRiskScore(workspaceId, minScore)
- getTrendingThresholdCrossings(workspaceId, days)
```

---

## 9. GAPS & ISSUES SUMMARY

### Critical Gaps

| # | Gap | Impact | Difficulty |
|---|-----|--------|------------|
| 1 | **Dashboard not connected to real data** | UI is demo-only, users see nothing real | 🟡 Medium |
| 2 | **No Unified Risk Integration** | Ignores security scoring in kill decisions | 🔴 High |
| 3 | **WebSocket isolated from central service** | Real-time updates don't reach clients | 🟡 Medium |
| 4 | **Alert history not tracked** | Only kills recorded, no progression | 🟢 Easy |
| 5 | **AgentStats references undefined fields** | Code will crash at runtime | 🔴 High |
| 6 | **Budget config only in-memory** | Lost on restart, not configurable | 🟡 Medium |
| 7 | **No feature-agent correlation** | Can't tell which feature is causing spends | 🟠 Hard |
| 8 | **No latency/performance triggers** | Only cost-based, missing perf anomalies | 🟠 Hard |

### Code Quality Issues

```typescript
// AgentStats references these (undefined):
stats.budgetLimit           // Not in AgentStats interface!
stats.maxTokens             // ❌
stats.callsPerMinute        // ❌
stats.rateLimit             // ❌
stats.workspaceId           // ❌
stats.userId                // ❌
stats.userEmail             // ❌
```

This will crash when `handleAgentIncident()` is called.

---

## 10. RECOMMENDATIONS FOR PHASE 6

### **Phase 6A: Dashboard Quick-Win** (2 days)

**Goal**: Connect UI to real backend data

1. **Replace demo state with real queries**:
   ```typescript
   const { data: stats } = trpc.agentGuard.getStats.useQuery({ workspaceId });
   const { data: interventions } = trpc.agentGuard.getInterventions.useQuery({ workspaceId });
   const { data: activeAgents } = trpc.agentGuard.getActiveAgents.useQuery({ workspaceId });
   ```

2. **Add WebSocket real-time subscription**:
   ```typescript
   useEffect(() => {
     const ws = new WebSocket(`ws://localhost:3000/ws?workspace=${workspaceId}`);
     ws.onmessage = (event) => {
       const msg = JSON.parse(event.data);
       if (msg.type === 'alert') {
         // Refresh stats, show toast
       }
     };
   }, [workspaceId]);
   ```

3. **Add manual kill button** with confirmation

4. **Show real data in tables**

### **Phase 6B: CRITICAL FIX** (1 day)

**Fix AgentStats data mismatches**:

Current interface missing required fields. Either:
- **Option A**: Add fields to AgentStats
- **Option B**: Refactor handleAgentIncident to work with available data

### **Phase 6C: Unified Risk Integration** (2 days)

1. **Import UnifiedRiskEngine** in agentGuard.ts
2. **Add risk score checks** in trackAgentCall()
3. **Broadcast risk score** with kill event
4. **Update schema** to store riskScore

### **Phase 6D: Alert History** (1 day)

1. **Create alert_incidents table**:
   ```sql
   - id, workspaceId, agentId, type (alert|warning|kill)
   - riskScore, costUsd, reason, timestamp
   ```

2. **Track all events**, not just kills

3. **Add query endpoints**: getAlertHistory, getIncidentTrend

### **Phase 6E: WebSocket Bridge** (1 day)

1. **Replace agentGuard internal Map with WebSocketService**
2. **Route alerts through central WS**
3. **Support filtering** (by severity, type)

### **Phase 6F: Configuration UI** (2 days)

1. **Budget settings form**
2. **Threshold customization**
3. **Auto-escalation rules** (alert → quarantine → kill)

---

## 11. FILES TO MODIFY

```
Priority 1 (CRITICAL):
├── _core/agentGuard.ts           +100 lines (unified risk integration)
├── AgentGuardPage.tsx            +200 lines (real data + WebSocket)
└── _services/incidentResponse.ts +50 lines (fix field references)

Priority 2 (HIGH):
├── schema.ts                     +1 table (alert_history)
├── routers.ts                    +5 endpoints (alert queries)
├── db.ts                         +8 functions (alert CRUD)
└── _services/websocket.ts        +20 lines (optional, if refactoring)

Priority 3 (NICE-TO-HAVE):
├── SettingsPage.tsx              +200 lines (budget/threshold config)
└── complianceReportingService.ts +50 lines (include agent incidents)

Total: ~700 lines across 8 files
```

---

## 12. TESTING CHECKLIST FOR PHASE 6

- [ ] Dashboard loads real stats on mount
- [ ] WebSocket connects and receives real-time alerts
- [ ] Manual kill button works + records event
- [ ] Risk score triggers auto-kill (add unit test)
- [ ] Alert history persists to database
- [ ] Budget settings persist across page refreshes
- [ ] Incident details include feature name + risk score
- [ ] Background monitor (60s loop) triggers incidents correctly
- [ ] Alert escalation (warnings before kills) works
- [ ] No crashes from undefined AgentStats fields

---

## 13. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    AgentGuard System (PHASE 6)                  │
└─────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │   AgentGuardPage │
                         │   (Dashboard)    │
                         └────────┬─────────┘
                                  │
                  ┌───────────────┼───────────────┐
                  │               │               │
         ┌────────▼────────┐  ┌──▼──────────┐  ┌─▼─────────────┐
         │ getStats query  │  │ WebSocket   │  │ getInterven   │
         │                 │  │ Listen for  │  │ tions query   │
         └────────┬────────┘  │ updates     │  └─┬─────────────┘
                  │           └──┬─────────┬┘    │
                  └──────────┬────┼────────┼─────┘
                             │    │        │
                    ┌────────▼────▼───┐    │
                    │    routers.ts   │    │
                    │  (TRPC Server)  │    │
                    └────────┬────────┘    │
                             │             │
              ┌──────────────┴─────────────┘
              │
    ┌─────────▼──────────┐
    │   agentGuard.ts    │
    │  (Core Service)    │
    │                    │
    │ Functions:         │
    │ - trackAgentCall() │────────┐
    │ - killAgent()      │┐       │
    │ - getAgentStats()  ││  ┌────▼────────────┐
    │                    ││  │ UnifiedRisk     │
    │ IN-MEMORY:         │└─▶│ Engine (P4)     │
    │ - agentStates     │   │                 │
    │ - wsConnections   │   │ - getScore()    │
    │                    │   │ - getTier()     │
    └─────────┬──────────┘   │ - getFeatures() │
              │              └─────────────────┘
    ┌─────────▼──────────────────┐
    │  DATABASE (MySQL)          │
    │                            │
    │  agentguardEvents Table:   │
    │  - id, workspaceId         │
    │  - agentId, action         │
    │  - reason, costUsd         │
    │  - details (JSON)          │
    │  - timestamp (indexed)     │
    │                            │
    │  [FUTURE] alert_history    │
    │  - type: alert|warning|kill│
    │  - riskScore, feature      │
    └────────────────────────────┘

┌────────────────────────────────────────┐
│     WebSocket Communication (P4)       │
│                                        │
│  /ws?workspace=123&userId=456          │
│                                        │
│  Message Format:                       │
│  {                                     │
│    type: 'alert'|'update'|'heartbeat'  │
│    workspaceId: string                 │
│    payload: { agentId, reason, ... }   │
│    timestamp: Date                     │
│  }                                     │
└────────────────────────────────────────┘
```

---

## 14. SUCCESS CRITERIA FOR PHASE 6

✅ **Dashboard Connected**
- Loads real data on mount (not demo)
- Display updates when new incidents occur
- Manual kill button visible + functional

✅ **Risk Integrated**
- Unified score influences kill decisions
- Risk score stored with incidents
- Dashboard shows risk tier

✅ **Real-time Working**
- WebSocket establishes on page load
- Alerts appear immediately (< 1s)
- Users see live agent monitoring

✅ **Incident History**
- All alerts + kills tracked
- Historical queries work
- Can filter by time/severity

✅ **Zero Crashes**
- All references resolved
- Graceful error handling
- Type-safe throughout

✅ **Testing Complete**
- Unit tests for risk integration
- Integration test for orchestration
- E2E test for dashboard flow

---

## CONCLUSION

### Current Status: 40% Complete
- ✅ Backend kill switch functional
- ✅ Database persistence complete
- ⚠️ Dashboard demo-only
- ❌ Risk integration missing
- ❌ WebSocket bridged missing
- ❌ Alert history missing

### PHASE 6 scope: **10 days**
- Days 1-2: Dashboard connection
- Days 3-4: Critical bug fixes
- Days 5-6: Risk integration
- Days 7-8: Alert history + WebSocket
- Days 9-10: Config UI + polish

### Estimated LOC: **~1100 lines**
- New code: ~500 lines
- Modifications: ~600 lines
- Tests: ~200 lines (separate)

---

**Next Steps**: Await approval, then move to implementation phase.
