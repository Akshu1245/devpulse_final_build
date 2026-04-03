/**
 * PHASE 8C: WebSocket Event Hub
 * Central point for broadcasting real-time updates from backend to connected clients
 */

import { WebSocket } from "ws";
import { EventEmitter } from "events";

interface ClientConnection {
  ws: WebSocket;
  workspaceId: number;
  userId: string;
  subscriptions: Set<string>;
}

export class WebSocketEventHub extends EventEmitter {
  private clients: Map<string, ClientConnection> = new Map();
  private eventSubscribers: Map<string, Set<string>> = new Map();
  private readonly DEFAULT_SUBSCRIPTIONS = [
    "riskScoreUpdate",
    "costUpdate",
    "agentUpdate",
    "shadowApiUpdate",
    "vulnerabilityUpdate",
  ];

  constructor() {
    super();
    console.log("[WebSocket Hub] Initialized");
  }

  /**
   * Register a new client connection
   */
  registerConnection(
    clientId: string,
    ws: WebSocket,
    workspaceId: number,
    userId: string
  ): void {
    const connection: ClientConnection = {
      ws,
      workspaceId,
      userId,
      subscriptions: new Set(this.DEFAULT_SUBSCRIPTIONS),
    };

    this.clients.set(clientId, connection);
    console.log(`[WebSocket Hub] Client connected: ${clientId} (workspace: ${workspaceId})`);

    // Handle connection close
    ws.on("close", () => {
      this.unregisterConnection(clientId);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error(`[WebSocket Hub] Client error (${clientId}):`, error);
      this.unregisterConnection(clientId);
    });

    // Handle incoming messages
    ws.on("message", (data: string) => {
      this.handleClientMessage(clientId, data);
    });

    // Send connection confirmation
    this.sendToClient(clientId, {
      type: "connected",
      timestamp: Date.now(),
      clientId,
    });
  }

  /**
   * Unregister a client connection
   */
  unregisterConnection(clientId: string): void {
    const connection = this.clients.get(clientId);
    if (connection) {
      try {
        connection.ws.close();
      } catch (err) {
        console.error(`[WebSocket Hub] Error closing connection (${clientId}):`, err);
      }
      this.clients.delete(clientId);
      console.log(`[WebSocket Hub] Client disconnected: ${clientId}`);
    }
  }

  /**
   * Broadcast update to all clients in a workspace
   */
  broadcastToWorkspace(
    workspaceId: number,
    eventType: string,
    data: any
  ): number {
    let count = 0;
    this.clients.forEach((connection, clientId) => {
      if (connection.workspaceId === workspaceId && connection.subscriptions.has(eventType)) {
        this.sendToClient(clientId, {
          type: eventType,
          data,
          timestamp: Date.now(),
        });
        count++;
      }
    });

    if (count > 0) {
      console.log(
        `[WebSocket Hub] Broadcast ${eventType} to ${count} clients in workspace ${workspaceId}`
      );
    }

    return count;
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcastToAll(eventType: string, data: any): number {
    let count = 0;
    this.clients.forEach((connection, clientId) => {
      if (connection.subscriptions.has(eventType)) {
        this.sendToClient(clientId, {
          type: eventType,
          data,
          timestamp: Date.now(),
        });
        count++;
      }
    });

    if (count > 0) {
      console.log(
        `[WebSocket Hub] Broadcast ${eventType} to ${count} clients globally`
      );
    }

    return count;
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, message: any): boolean {
    const connection = this.clients.get(clientId);
    if (!connection) {
      return false;
    }

    try {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
        return true;
      }
    } catch (err) {
      console.error(`[WebSocket Hub] Error sending to client (${clientId}):`, err);
      this.unregisterConnection(clientId);
    }

    return false;
  }

  /**
   * Get connected client count
   */
  getConnectedClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected clients for workspace
   */
  getWorkspaceClientCount(workspaceId: number): number {
    let count = 0;
    this.clients.forEach((connection) => {
      if (connection.workspaceId === workspaceId) {
        count++;
      }
    });
    return count;
  }

  /**
   * PRIVATE: Handle incoming client message
   */
  private handleClientMessage(clientId: string, data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.type === "subscribe") {
        this.handleSubscribe(clientId, message.events);
      } else if (message.type === "unsubscribe") {
        this.handleUnsubscribe(clientId, message.events);
      } else if (message.type === "ping") {
        this.sendToClient(clientId, { type: "pong", timestamp: Date.now() });
      }
    } catch (err) {
      console.error(`[WebSocket Hub] Error parsing message (${clientId}):`, err);
    }
  }

  /**
   * PRIVATE: Handle subscription request
   */
  private handleSubscribe(clientId: string, events: string[]): void {
    const connection = this.clients.get(clientId);
    if (connection && Array.isArray(events)) {
      events.forEach((event) => {
        connection.subscriptions.add(event);
      });
      console.log(`[WebSocket Hub] Client ${clientId} subscribed to: ${events.join(", ")}`);
    }
  }

  /**
   * PRIVATE: Handle unsubscribe request
   */
  private handleUnsubscribe(clientId: string, events: string[]): void {
    const connection = this.clients.get(clientId);
    if (connection && Array.isArray(events)) {
      events.forEach((event) => {
        connection.subscriptions.delete(event);
      });
      console.log(`[WebSocket Hub] Client ${clientId} unsubscribed from: ${events.join(", ")}`);
    }
  }

  /**
   * Cleanup and close all connections
   */
  shutdown(): void {
    console.log("[WebSocket Hub] Shutting down...");
    this.clients.forEach((connection, clientId) => {
      try {
        connection.ws.close();
      } catch (err) {
        console.error(`[WebSocket Hub] Error closing connection (${clientId}):`, err);
      }
    });
    this.clients.clear();
    console.log("[WebSocket Hub] Shutdown complete");
  }
}

// Singleton instance
let eventHub: WebSocketEventHub | null = null;

export function getWebSocketEventHub(): WebSocketEventHub {
  if (!eventHub) {
    eventHub = new WebSocketEventHub();
  }
  return eventHub;
}

export function createWebSocketEventHub(): WebSocketEventHub {
  eventHub = new WebSocketEventHub();
  return eventHub;
}

/**
 * Helper functions for broadcasting from backend code
 */
export function broadcastRiskScoreUpdate(workspaceId: number, data: any): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "riskScoreUpdate", data);
}

export function broadcastCostUpdate(workspaceId: number, data: any): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "costUpdate", data);
}

export function broadcastAgentUpdate(workspaceId: number, data: any): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "agentUpdate", data);
}

export function broadcastShadowApiUpdate(workspaceId: number, data: any): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "shadowApiUpdate", data);
}

export function broadcastVulnerabilityUpdate(workspaceId: number, data: any): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "vulnerabilityUpdate", data);
}

/**
 * Broadcast kill switch activation to all clients
 */
export function broadcastKillSwitchAlert(workspaceId: number, data: {
  agentId: string;
  reason: string;
  costAtIntervention: number;
  projectedOverrun: number;
  timestamp: number;
}): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "killSwitchAlert", {
    ...data,
    severity: "critical",
  });
}

/**
 * Broadcast budget threshold warning
 */
export function broadcastBudgetWarning(workspaceId: number, data: {
  agentId: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
}): void {
  getWebSocketEventHub().broadcastToWorkspace(workspaceId, "budgetWarning", data);
}

/**
 * Initialize WebSocket server on HTTP server
 */
export function initializeWebSocketHub(httpServer: any): WebSocketEventHub {
  const { WebSocketServer } = require("ws");
  const hub = createWebSocketEventHub();
  
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws/realtime"
  });
  
  wss.on("connection", (ws: WebSocket, req: any) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const workspaceId = parseInt(url.searchParams.get("workspaceId") || "1", 10);
    const userId = url.searchParams.get("userId") || "anonymous";
    const clientId = `${workspaceId}-${userId}-${Date.now()}`;
    
    hub.registerConnection(clientId, ws, workspaceId, userId);
    
    console.log(`[WebSocket] New connection: ${clientId} from ${req.socket.remoteAddress}`);
  });
  
  wss.on("error", (error: Error) => {
    console.error("[WebSocket Server] Error:", error);
  });
  
  console.log("[WebSocket Server] Initialized at /ws/realtime");
  return hub;
}
