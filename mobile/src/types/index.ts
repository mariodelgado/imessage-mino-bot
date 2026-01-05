/**
 * Shared types for Mino Mobile App
 */

// ============================================================================
// WEBSOCKET MESSAGE TYPES
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
  id?: string;
  token?: string;
  payload?: Record<string, unknown>;
}

export interface ServerMessage {
  type: ServerMessageType;
  id?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "sending" | "sent" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  action?: string;
  minoRequest?: {
    url: string;
    goal: string;
  };
}

// ============================================================================
// MINO BROWSER TYPES
// ============================================================================

export interface MinoSession {
  id: string;
  url: string;
  goal: string;
  status: "starting" | "active" | "completed" | "error";
  screenshots: MinoScreenshot[];
  actions: MinoAction[];
  result?: unknown;
}

export interface MinoScreenshot {
  timestamp: Date;
  base64: string;
}

export interface MinoAction {
  timestamp: Date;
  action: string;
  thought?: string;
}

// ============================================================================
// CONNECTION TYPES
// ============================================================================

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "authenticated"
  | "error";

export interface ConnectionState {
  status: ConnectionStatus;
  error?: string;
  sessionId?: string;
  userId?: string;
  lastPong?: Date;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface AppSettings {
  serverUrl: string;
  onDeviceLlmEnabled: boolean;
  hapticFeedback: boolean;
  darkMode: boolean;
  notificationsEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: "ws://localhost:3001/stream",
  onDeviceLlmEnabled: true,
  hapticFeedback: true,
  darkMode: true,
  notificationsEnabled: true,
  theme: 'system',
};
