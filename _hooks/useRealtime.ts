/**
 * useRealtime Hook
 * ================
 * WebSocket subscription for real-time updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface RealtimeMessage {
  type: 'notification' | 'alert' | 'update' | 'heartbeat';
  payload: any;
  timestamp: Date;
}

export interface UseRealtimeOptions {
  workspaceId: string;
  userId?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function useRealtime({
  workspaceId,
  userId,
  autoConnect = true,
  reconnectAttempts = 5,
  reconnectDelay = 3000,
}: UseRealtimeOptions) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const params = new URLSearchParams({
        workspace: workspaceId,
        ...(userId && { userId }),
      });

      const ws = new WebSocket(`${protocol}://${window.location.host}/ws?${params}`);

      ws.onopen = () => {
        console.log('[Realtime] Connected');
        setConnected(true);
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          setLastMessage(message);
        } catch (error) {
          console.error('[Realtime] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Realtime] Error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('[Realtime] Disconnected');
        setConnected(false);
        wsRef.current = null;

        // Attempt reconnect
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[Realtime] Reconnecting (attempt ${reconnectCountRef.current})`);
            connect();
          }, reconnectDelay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[Realtime] Connection error:', error);
      setConnected(false);
    }
  }, [workspaceId, userId, reconnectAttempts, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const send = useCallback(
    (message: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('[Realtime] WebSocket not connected');
      }
    },
    []
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    lastMessage,
    send,
    connect,
    disconnect,
  };
}
