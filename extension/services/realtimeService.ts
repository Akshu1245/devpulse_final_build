import * as vscode from "vscode";

/**
 * PHASE 8C: WebSocket Real-Time Service
 * Handles real-time data updates from backend without polling
 */

interface RealtimeMessage {
  type: "riskScoreUpdate" | "costUpdate" | "agentUpdate" | "shadowApiUpdate" | "vulnerabilityUpdate" | "killSwitchAlert" | "budgetWarning" | "connected" | "disconnected" | "error";
  data?: any;
  timestamp?: number;
}

interface RealtimeListener {
  onMessage: (message: RealtimeMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export class RealtimeService {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private listeners: Set<RealtimeListener> = new Set();
  private messageQueue: RealtimeMessage[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // start at 1s
  private maxReconnectDelay: number = 30000; // max 30s
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: number = 30000; // 30 seconds

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log("[DevPulse Realtime] WebSocket connected");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // Notify all listeners
          this.notifyListeners({
            type: "connected",
            timestamp: Date.now(),
          });

          // Start heartbeat
          this.startHeartbeat();

          // Send queued messages
          this.flushMessageQueue();

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: RealtimeMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (err) {
            console.error("[DevPulse Realtime] Failed to parse message:", err);
          }
        };

        this.ws.onerror = (event) => {
          console.error("[DevPulse Realtime] WebSocket error:", event);
          const error = new Error("WebSocket connection error");
          this.notifyListeners({
            type: "error",
            data: error.message,
            timestamp: Date.now(),
          });
        };

        this.ws.onclose = () => {
          console.log("[DevPulse Realtime] WebSocket disconnected");
          this.isConnected = false;
          this.stopHeartbeat();

          // Notify listeners of disconnect
          this.notifyListeners({
            type: "disconnected",
            timestamp: Date.now(),
          });

          // Attempt to reconnect
          this.attemptReconnect();
        };

        // Timeout if connection takes too long
        const connectTimeout = setTimeout(() => {
          if (!this.isConnected && this.ws) {
            console.warn("[DevPulse Realtime] Connection timeout");
            this.ws.close();
            resolve(false);
          }
        }, 5000);

        // Wait for connection callback
        if (this.isConnected) {
          clearTimeout(connectTimeout);
          resolve(true);
        }
      } catch (err) {
        console.error("[DevPulse Realtime] Failed to connect:", err);
        this.attemptReconnect();
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log("[DevPulse Realtime] Disconnecting");
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Send message to server
   */
  send(message: any): boolean {
    if (!this.isConnected || !this.ws) {
      console.warn("[DevPulse Realtime] Not connected, queueing message");
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error("[DevPulse Realtime] Failed to send message:", err);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; attempts: number; delay: number } {
    return {
      connected: this.isConnected,
      attempts: this.reconnectAttempts,
      delay: this.reconnectDelay,
    };
  }

  /**
   * Stream-like API for specific updates
   */
  onRiskScoreUpdate(callback: (data: any) => void): () => void {
    const listener: RealtimeListener = {
      onMessage: (msg) => {
        if (msg.type === "riskScoreUpdate") {
          callback(msg.data);
        }
      },
    };
    return this.subscribe(listener);
  }

  onCostUpdate(callback: (data: any) => void): () => void {
    const listener: RealtimeListener = {
      onMessage: (msg) => {
        if (msg.type === "costUpdate") {
          callback(msg.data);
        }
      },
    };
    return this.subscribe(listener);
  }

  onAgentUpdate(callback: (data: any) => void): () => void {
    const listener: RealtimeListener = {
      onMessage: (msg) => {
        if (msg.type === "agentUpdate") {
          callback(msg.data);
        }
      },
    };
    return this.subscribe(listener);
  }

  onShadowApiUpdate(callback: (data: any) => void): () => void {
    const listener: RealtimeListener = {
      onMessage: (msg) => {
        if (msg.type === "shadowApiUpdate") {
          callback(msg.data);
        }
      },
    };
    return this.subscribe(listener);
  }

  onKillSwitchAlert(callback: (data: any) => void): () => void {
    const listener: RealtimeListener = {
      onMessage: (msg) => {
        if (msg.type === "killSwitchAlert") {
          callback(msg.data);
        }
      },
    };
    return this.subscribe(listener);
  }

  onBudgetWarning(callback: (data: any) => void): () => void {
    const listener: RealtimeListener = {
      onMessage: (msg) => {
        if (msg.type === "budgetWarning") {
          callback(msg.data);
        }
      },
    };
    return this.subscribe(listener);
  }

  /**
   * PRIVATE: Handle incoming message
   */
  private handleMessage(message: RealtimeMessage): void {
    console.log(`[DevPulse Realtime] Received: ${message.type}`);

    // Call all listeners
    this.notifyListeners(message);
  }

  /**
   * PRIVATE: Notify all listeners
   */
  private notifyListeners(message: RealtimeMessage): void {
    this.listeners.forEach((listener) => {
      try {
        if (message.type === "connected" && listener.onConnect) {
          listener.onConnect();
        } else if (message.type === "disconnected" && listener.onDisconnect) {
          listener.onDisconnect();
        } else if (message.type === "error" && listener.onError) {
          listener.onError(new Error(message.data?.toString()));
        } else {
          listener.onMessage(message);
        }
      } catch (err) {
        console.error("[DevPulse Realtime] Listener error:", err);
      }
    });
  }

  /**
   * PRIVATE: Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[DevPulse Realtime] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `[DevPulse Realtime] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        console.error("[DevPulse Realtime] Reconnect failed:", err);
      });
    }, delay);
  }

  /**
   * PRIVATE: Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: "ping" });
      }
    }, this.heartbeatInterval);
  }

  /**
   * PRIVATE: Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * PRIVATE: Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
}

/**
 * Singleton instance management
 */
let realtimeService: RealtimeService | null = null;

export function getRealtimeService(): RealtimeService | null {
  return realtimeService;
}

export function setRealtimeService(service: RealtimeService): void {
  realtimeService = service;
}

export function createRealtimeService(wsUrl: string): RealtimeService {
  const service = new RealtimeService(wsUrl);
  setRealtimeService(service);
  return service;
}

export function disconnectRealtimeService(): void {
  if (realtimeService) {
    realtimeService.disconnect();
    realtimeService = null;
  }
}
