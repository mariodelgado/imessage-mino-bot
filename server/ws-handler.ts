/**
 * WebSocket Handler for Mino Server
 *
 * Implements ADK-style bidirectional streaming protocol:
 * - Client sends JSON messages with type field
 * - Server responds with typed events
 * - Supports streaming for Mino browser and Gemini chat
 */

import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { sessionManager } from "./index";
import { verifyToken, extractQueryToken, type JWTPayload } from "./auth";
import { MinoBridge } from "./mino-bridge";

// ============================================================================
// MESSAGE TYPES (ADK Protocol)
// ============================================================================

export type ClientMessageType =
  | "auth"
  | "chat"
  | "mino:start"
  | "mino:action"
  | "mino:stop"
  | "ping"
  | "session:end";

export type ServerMessageType =
  | "auth:success"
  | "auth:error"
  | "chat:response"
  | "chat:stream"
  | "chat:error"
  | "mino:started"
  | "mino:screenshot"
  | "mino:action"
  | "mino:result"
  | "mino:error"
  | "mino:ended"
  | "pong"
  | "error"
  | "session:info";

export interface ClientMessage {
  type: ClientMessageType;
  id?: string; // Message ID for request/response correlation
  token?: string; // For auth messages
  payload?: Record<string, unknown>;
}

export interface ServerMessage {
  type: ServerMessageType;
  id?: string; // Correlates to request ID
  timestamp: string;
  payload?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

type MessageHandler = (
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
) => Promise<void>;

const handlers: Record<ClientMessageType, MessageHandler> = {
  auth: handleAuth,
  chat: handleChat,
  "mino:start": handleMinoStart,
  "mino:action": handleMinoAction,
  "mino:stop": handleMinoStop,
  ping: handlePing,
  "session:end": handleSessionEnd,
};

// ============================================================================
// HANDLER IMPLEMENTATIONS
// ============================================================================

async function handleAuth(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
): Promise<void> {
  const token = message.token || (message.payload?.token as string);

  if (!token) {
    sendMessage(socket, {
      type: "auth:error",
      id: message.id,
      error: "Token required",
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    sendMessage(socket, {
      type: "auth:error",
      id: message.id,
      error: "Invalid or expired token",
    });
    return;
  }

  // Authenticate the session
  const success = sessionManager.authenticateSession(
    sessionId,
    payload.userId,
    payload.phone
  );

  if (success) {
    log.info({ sessionId, userId: payload.userId }, "Session authenticated");
    sendMessage(socket, {
      type: "auth:success",
      id: message.id,
      payload: {
        userId: payload.userId,
        sessionId,
      },
    });
  } else {
    sendMessage(socket, {
      type: "auth:error",
      id: message.id,
      error: "Authentication failed",
    });
  }
}

async function handleChat(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
): Promise<void> {
  const session = sessionManager.getSession(sessionId);

  if (!session?.userId) {
    sendMessage(socket, {
      type: "chat:error",
      id: message.id,
      error: "Not authenticated",
    });
    return;
  }

  const userMessage = message.payload?.message as string;
  if (!userMessage) {
    sendMessage(socket, {
      type: "chat:error",
      id: message.id,
      error: "Message required",
    });
    return;
  }

  sessionManager.touchSession(sessionId);
  sessionManager.setSessionStatus(sessionId, "active");

  log.info({ sessionId, messageLength: userMessage.length }, "Chat message received");

  try {
    // Import Gemini chat dynamically to avoid circular deps
    const { chat } = await import("../gemini");

    // Use phone or userId as contact ID
    const contactId = session.phone || session.userId;

    // Get response from Gemini
    const result = await chat(contactId, userMessage);

    // Handle different action types
    if (result.action === "mino" && result.minoRequest) {
      // Start Mino browser session
      sendMessage(socket, {
        type: "chat:response",
        id: message.id,
        payload: {
          text: `🔍 Browsing ${result.minoRequest.url}...`,
          action: "mino",
          minoRequest: result.minoRequest,
        },
      });

      // Trigger Mino bridge (will send mino:* events)
      const bridge = new MinoBridge(sessionId, socket, log);
      await bridge.startSession(result.minoRequest.url, result.minoRequest.goal);
    } else {
      // Regular chat response
      sendMessage(socket, {
        type: "chat:response",
        id: message.id,
        payload: {
          text: result.text,
          action: result.action || "chat",
          ...(result.voiceRequest && { voiceRequest: result.voiceRequest }),
          ...(result.remindRequest && { remindRequest: result.remindRequest }),
          ...(result.homekitRequest && { homekitRequest: result.homekitRequest }),
          ...(result.alertRequest && { alertRequest: result.alertRequest }),
        },
      });
    }
  } catch (error) {
    log.error({ sessionId, error }, "Chat error");
    sendMessage(socket, {
      type: "chat:error",
      id: message.id,
      error: error instanceof Error ? error.message : "Chat failed",
    });
  }
}

async function handleMinoStart(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
): Promise<void> {
  const session = sessionManager.getSession(sessionId);

  if (!session?.userId) {
    sendMessage(socket, {
      type: "mino:error",
      id: message.id,
      error: "Not authenticated",
    });
    return;
  }

  const url = message.payload?.url as string;
  const goal = message.payload?.goal as string;

  if (!url || !goal) {
    sendMessage(socket, {
      type: "mino:error",
      id: message.id,
      error: "URL and goal required",
    });
    return;
  }

  log.info({ sessionId, url, goal }, "Starting Mino session");

  try {
    const bridge = new MinoBridge(sessionId, socket, log);
    await bridge.startSession(url, goal);
  } catch (error) {
    log.error({ sessionId, error }, "Mino start error");
    sendMessage(socket, {
      type: "mino:error",
      id: message.id,
      error: error instanceof Error ? error.message : "Failed to start Mino",
    });
  }
}

async function handleMinoAction(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
): Promise<void> {
  const session = sessionManager.getSession(sessionId);

  if (!session?.minoBrowserSessionId) {
    sendMessage(socket, {
      type: "mino:error",
      id: message.id,
      error: "No active Mino session",
    });
    return;
  }

  // TODO: Forward action to active Mino bridge
  log.info({ sessionId, action: message.payload }, "Mino action");
}

async function handleMinoStop(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
): Promise<void> {
  const session = sessionManager.getSession(sessionId);

  if (session?.minoBrowserSessionId) {
    sessionManager.clearMinoBrowserSession(sessionId);
    log.info({ sessionId }, "Mino session stopped");
  }

  sendMessage(socket, {
    type: "mino:ended",
    id: message.id,
    payload: { reason: "User stopped" },
  });
}

async function handlePing(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  _log: FastifyBaseLogger
): Promise<void> {
  sessionManager.touchSession(sessionId);
  sendMessage(socket, {
    type: "pong",
    id: message.id,
    payload: { serverTime: Date.now() },
  });
}

async function handleSessionEnd(
  sessionId: string,
  message: ClientMessage,
  socket: WebSocket,
  log: FastifyBaseLogger
): Promise<void> {
  log.info({ sessionId }, "Client requested session end");
  sessionManager.closeSession(sessionId, "Client requested");
}

// ============================================================================
// UTILITIES
// ============================================================================

function sendMessage(socket: WebSocket, message: Omit<ServerMessage, "timestamp">): void {
  if (socket.readyState !== WebSocket.OPEN) return;

  try {
    socket.send(
      JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error("[WS] Send error:", error);
  }
}

function parseMessage(data: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed.type) return null;
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN CONNECTION HANDLER
// ============================================================================

export function handleWebSocketConnection(
  socket: WebSocket,
  sessionId: string,
  log: FastifyBaseLogger
): void {
  // Create session
  const session = sessionManager.createSession(sessionId, socket);

  // Send session info
  sendMessage(socket, {
    type: "session:info",
    payload: {
      sessionId,
      status: "connected",
      requiresAuth: true,
    },
  });

  // Handle messages
  socket.on("message", async (data: Buffer) => {
    const raw = data.toString();
    const message = parseMessage(raw);

    if (!message) {
      sendMessage(socket, {
        type: "error",
        error: "Invalid message format",
      });
      return;
    }

    log.debug({ sessionId, type: message.type }, "Received message");

    const handler = handlers[message.type];
    if (!handler) {
      sendMessage(socket, {
        type: "error",
        id: message.id,
        error: `Unknown message type: ${message.type}`,
      });
      return;
    }

    try {
      await handler(sessionId, message, socket, log);
    } catch (error) {
      log.error({ sessionId, type: message.type, error }, "Handler error");
      sendMessage(socket, {
        type: "error",
        id: message.id,
        error: error instanceof Error ? error.message : "Internal error",
      });
    }
  });

  // Handle close
  socket.on("close", (code: number, reason: Buffer) => {
    log.info(
      { sessionId, code, reason: reason.toString() },
      "WebSocket closed"
    );
    sessionManager.closeSession(sessionId, `Connection closed: ${code}`);
  });

  // Handle errors
  socket.on("error", (error: Error) => {
    log.error({ sessionId, error }, "WebSocket error");
  });

  // Check for token in URL (auto-auth)
  // This would be extracted from the upgrade request in production
  // For now, client must send auth message
}

// Export utilities for external use
export { sendMessage, parseMessage };
