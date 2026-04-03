# PHASE 1 — Integration Guide

## How to Use New Modules

### 1. Worker/Queue System

```typescript
// Enqueue a scan job
import { enqueueScan } from './_workers/queues/scanQueue';

const job = await enqueueScan({
  workspaceId: 'ws_123',
  projectId: 'proj_456',
  apiEndpoint: 'https://api.example.com/users',
  method: 'GET',
});

// Job processes in background automatically
// Get status: await getScanStatus(job.id)
```

### 2. Cache Layer

```typescript
import { getCacheManager, TTL } from './_cache';
import { getCachedRiskScore, cacheRiskScore } from './_cache/strategies/riskScoreCache';

// Store in cache
await cacheRiskScore('scan_123', {
  scanId: 'scan_123',
  score: 87,
  severity: 'high',
  vulnerabilityCount: 5,
  timestamp: new Date(),
});

// Retrieve from cache
const cached = await getCachedRiskScore('scan_123');
```

### 3. Services

```typescript
// WebSocket Broadcasting
import { getWebSocketService } from './_services/websocket';

const ws = getWebSocketService();
ws.broadcast('workspace_123', {
  type: 'alert',
  workspaceId: 'workspace_123',
  payload: { message: 'Critical vulnerability found' },
  timestamp: new Date(),
});

// Incident Response
import { handleAgentIncident } from './_services/incidentResponse';

await handleAgentIncident('agent_123');
// Auto-kills if thresholds exceeded

// Notifications
import { sendUrgentNotification } from './_services/notifications';

await sendUrgentNotification({
  type: 'email',
  workspaceId: 'ws_123',
  recipient: 'admin@example.com',
  title: 'Critical Security Alert',
  message: 'Vulnerabilities detected in API',
  severity: 'critical',
});
```

### 4. React Hooks

```typescript
// In your React component
import { useAuth } from './_hooks/useAuth';
import { useWorkspace } from './_hooks/useWorkspace';
import { useRealtime } from './_hooks/useRealtime';

export function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const { workspace } = useWorkspace();
  const { connected, lastMessage } = useRealtime({
    workspaceId: workspace?.id || '',
  });

  return (
    <div>
      <h1>Welcome {user?.name}</h1>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
}
```

## Updating Existing Routes

### Example: Update scan endpoint to use queue + cache

```typescript
// OLD: routers.ts (synchronous)
scanProcedure.mutation(async ({ input }) => {
  // ... slow scan operation
  return results;
});

// NEW: routers.ts (async + cache)
import { enqueueScan } from './_workers/queues/scanQueue';
import { getCachedScanResults, cacheScanResults } from './_cache/strategies/scanCache';

scanProcedure.mutation(async ({ input }) => {
  // Check cache first
  const cached = await getCachedScanResults(input.scanId);
  if (cached) return cached;

  // Enqueue job (non-blocking)
  const job = await enqueueScan({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apiEndpoint: input.endpoint,
    method: input.method,
  });

  // Return job info immediately
  return {
    jobId: job.id,
    status: 'queued',
    message: 'Scan queued for processing',
  };
});
```

## File Changes Needed in Existing Code

To fully integrate new modules, update:

1. **routers.ts**
   - Import cache strategies
   - Add cache checks before DB queries
   - Use notificationQueue for alerts

2. **middleware/security.ts**
   - Import auth service
   - Use validateWorkspaceAccess()
   - Check user permissions

3. **extension.ts**
   - Initialize WebSocket service on startup
   - Start incident monitoring

4. **Home.tsx & other components**
   - Wrap with AuthProvider, WorkspaceProvider
   - Use useAuth(), useWorkspace(), useRealtime()

5. **utils/trpc.ts**
   - No changes needed (already works with new routers)

## Testing New Modules

### Test Workers
```bash
npm run build
node dist/_workers/index.ts
# Should initialize 3 workers for logs
```

### Test Cache
```typescript
import { getCacheManager, TTL } from './_cache';

const cache = getCacheManager();
await cache.connect();
await cache.set('test', { value: 123 }, TTL.MEDIUM);
const result = await cache.get('test');
console.log(result); // { value: 123 }
```

### Test WebSocket
```typescript
import { initWebSocketService } from './_services/websocket';
import { createServer } from 'http';

const server = createServer();
const ws = initWebSocketService(server);
server.listen(3000);
```

## Environment Variables

Add to `.env`:
```
REDIS_HOST=redis
REDIS_PORT=6379
DATABASE_URL=postgresql://user:pass@postgres:5432/devpulse
NODE_ENV=production
WEBSOCKET_PORT=3000
```

## Performance Benchmarks

After integration, measure:

1. **Scan Endpoint Response Time**
   - Before: ~3-5 seconds (blocking)
   - After: <100ms (queued)

2. **Risk Score Retrieval**
   - Cache hit: <10ms
   - Cache miss: ~500-1000ms (first query)

3. **Real-time Notifications**
   - WebSocket latency: <100ms
   - Email delivery: <5 seconds

4. **Worker Processing**
   - Scan completion: 30-60 seconds
   - Report generation: 5-10 seconds
   - Notification dispatch: <1 second

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redis connection fails | Check REDIS_HOST/PORT, ensure Redis running |
| Workers not processing | Check Redis connection, verify BullMQ UI on port 3001 |
| WebSocket disconnects | Check firewall, ensure WSS if using HTTPS |
| Cache not working | Verify TTL values, check Redis memory |
| Notifications not sending | Check email config (Nodemailer), SMS key (Twilio) |

## Next: PHASE 2

After confirming all modules work:
1. Run integration tests
2. Update existing routes to use new services
3. Connect WebSocket to frontend
4. Deploy to staging
5. Monitor performance improvements
