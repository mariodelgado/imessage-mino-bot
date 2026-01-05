/**
 * WebSocket Hook for Mino Mobile
 *
 * Manages WebSocket connection with:
 * - Auto-reconnection
 * - JWT authentication
 * - Message queuing
 * - Ping/pong heartbeat
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  ClientMessage,
  ServerMessage,
  ConnectionState,
} from "../types";

const PING_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: string) => void;
}

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  send: (message: Omit<ClientMessage, "id">) => string;
  connect: () => void;
  disconnect: () => void;
  authenticate: (token: string) => Promise<boolean>;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    autoConnect = true,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef<ClientMessage[]>([]);
  const messageIdRef = useRef(0);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
  });

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${Date.now()}-${messageIdRef.current}`;
  }, []);

  // Update connection state
  const updateState = useCallback(
    (update: Partial<ConnectionState>) => {
      setConnectionState((prev) => ({ ...prev, ...update }));
    },
    []
  );

  // Send message
  const send = useCallback(
    (message: Omit<ClientMessage, "id">) => {
      const id = generateMessageId();
      const fullMessage: ClientMessage = { ...message, id };

      if (
        socketRef.current?.readyState === WebSocket.OPEN &&
        connectionState.status === "authenticated"
      ) {
        socketRef.current.send(JSON.stringify(fullMessage));
      } else {
        // Queue message for later
        messageQueueRef.current.push(fullMessage);
      }

      return id;
    },
    [connectionState.status, generateMessageId]
  );

  // Flush message queue
  const flushMessageQueue = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;

    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message) {
        socketRef.current.send(JSON.stringify(message));
      }
    }
  }, []);

  // Start ping interval
  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: "ping", id: generateMessageId() })
        );
      }
    }, PING_INTERVAL);
  }, [generateMessageId]);

  // Stop ping interval
  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case "session:info":
            updateState({
              status: "connected",
              sessionId: message.payload?.sessionId as string,
            });
            break;

          case "auth:success":
            updateState({
              status: "authenticated",
              userId: message.payload?.userId as string,
            });
            reconnectAttemptsRef.current = 0;
            flushMessageQueue();
            break;

          case "auth:error":
            updateState({
              status: "error",
              error: message.error || "Authentication failed",
            });
            break;

          case "pong":
            updateState({ lastPong: new Date() });
            break;

          case "error":
            onError?.(message.error || "Unknown error");
            break;
        }

        onMessage?.(message);
      } catch (error) {
        console.error("[WS] Parse error:", error);
      }
    },
    [onMessage, onError, updateState, flushMessageQueue]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (
      socketRef.current?.readyState === WebSocket.OPEN ||
      socketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    updateState({ status: "connecting", error: undefined });

    try {
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log("[WS] Connected");
        updateState({ status: "connected" });
        startPing();
        onConnect?.();
      };

      socket.onmessage = handleMessage;

      socket.onclose = (event) => {
        console.log("[WS] Closed:", event.code, event.reason);
        stopPing();
        updateState({ status: "disconnected" });
        onDisconnect?.(event.reason || "Connection closed");

        // Auto-reconnect
        if (
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
          event.code !== 1000
        ) {
          reconnectAttemptsRef.current += 1;
          console.log(
            `[WS] Reconnecting (attempt ${reconnectAttemptsRef.current})...`
          );
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      socket.onerror = (error) => {
        console.error("[WS] Error:", error);
        updateState({ status: "error", error: "Connection error" });
        onError?.("Connection error");
      };

      socketRef.current = socket;
    } catch (error) {
      console.error("[WS] Connect error:", error);
      updateState({ status: "error", error: "Failed to connect" });
    }
  }, [
    url,
    handleMessage,
    onConnect,
    onDisconnect,
    onError,
    startPing,
    stopPing,
    updateState,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    stopPing();

    if (socketRef.current) {
      socketRef.current.close(1000, "User disconnect");
      socketRef.current = null;
    }

    updateState({ status: "disconnected" });
  }, [stopPing, updateState]);

  // Authenticate with token
  const authenticate = useCallback(
    async (token: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
          resolve(false);
          return;
        }

        // Store token for reconnection
        SecureStore.setItemAsync("auth_token", token).catch(console.error);

        // Send auth message
        socketRef.current.send(
          JSON.stringify({
            type: "auth",
            id: generateMessageId(),
            token,
          })
        );

        // Wait for auth response
        const timeout = setTimeout(() => resolve(false), 5000);

        const checkAuth = () => {
          if (connectionState.status === "authenticated") {
            clearTimeout(timeout);
            resolve(true);
          } else if (connectionState.status === "error") {
            clearTimeout(timeout);
            resolve(false);
          } else {
            setTimeout(checkAuth, 100);
          }
        };

        checkAuth();
      });
    },
    [connectionState.status, generateMessageId]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-authenticate with stored token on connect
  useEffect(() => {
    if (connectionState.status === "connected") {
      SecureStore.getItemAsync("auth_token").then((token) => {
        if (token) {
          authenticate(token);
        }
      });
    }
  }, [connectionState.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connectionState,
    send,
    connect,
    disconnect,
    authenticate,
  };
}

export default useWebSocket;
