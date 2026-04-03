/**
 * WebSocket Service
 * =================
 * Real-time notifications via WebSocket
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

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

  private setupConnections() {
    this.wss.on('connection', (ws, req) => {
      console.log('[WebSocket] New client connected');

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const workspaceId = url.searchParams.get('workspace');
      const userId = url.searchParams.get('userId');

      if (!workspaceId) {
        ws.close(1008, 'Missing workspace ID');
        return;
      }

      // Track client
      if (!this.clients.has(workspaceId)) {
        this.clients.set(workspaceId, new Set());
      }
      this.clients.get(workspaceId)!.add(ws);

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message, workspaceId);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        const workspace = this.clients.get(workspaceId);
        if (workspace) {
          workspace.delete(ws);
          if (workspace.size === 0) {
            this.clients.delete(workspaceId);
          }
        }
        console.log('[WebSocket] Client disconnected');
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
      });

      // Send heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date(),
            })
          );
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);
    });
  }

  private handleMessage(message: WSMessage, workspaceId: string) {
    console.log('[WebSocket] Message received:', message.type);
    // Handle incoming messages if needed
  }

  /**
   * Broadcast message to workspace
   */
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

  /**
   * Send message to specific user
   */
  public sendToUser(workspaceId: string, userId: string, message: WSMessage) {
    // In production, would need to track user->client mapping
    message.userId = userId;
    this.broadcast(workspaceId, message);
  }

  /**
   * Get connected clients count
   */
  public getClientCount(workspaceId: string): number {
    return this.clients.get(workspaceId)?.size || 0;
  }
}

let wsService: WebSocketService | null = null;

export function initWebSocketService(server: Server): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(server);
  }
  return wsService;
}

export function getWebSocketService(): WebSocketService {
  if (!wsService) {
    throw new Error('WebSocket service not initialized');
  }
  return wsService;
}
