/**
 * Session Manager for Mino WebSocket Server
 *
 * Manages WebSocket session lifecycle, state, and cleanup.
 * Supports multiple sessions per user with activity tracking.
 */

import { WebSocket } from "ws";
import { EventEmitter } from "events";

export type SessionStatus = "connecting" | "authenticated" | "active" | "idle" | "disconnecting" | "closed";

export interface SessionState {
  id: string;
  userId?: string;
  phone?: string;
  status: SessionStatus;
  socket: WebSocket;
  createdAt: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
  // Mino browser session tracking
  minoBrowserSessionId?: string;
  minoStreamActive?: boolean;
}

export interface SessionManagerConfig {
  idleTimeoutMs?: number;
  maxSessionsPerUser?: number;
  cleanupIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<SessionManagerConfig> = {
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxSessionsPerUser: 5,
  cleanupIntervalMs: 60 * 1000, // 1 minute
};

export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private config: Required<SessionManagerConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: SessionManagerConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }

  /**
   * Create a new session for a WebSocket connection
   */
  createSession(sessionId: string, socket: WebSocket): SessionState {
    const session: SessionState = {
      id: sessionId,
      status: "connecting",
      socket,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {},
    };

    this.sessions.set(sessionId, session);
    this.emit("session:created", session);

    console.log(`[SessionManager] Session created: ${sessionId}`);
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Authenticate a session with user info
   */
  authenticateSession(
    sessionId: string,
    userId: string,
    phone?: string
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[SessionManager] Session not found for auth: ${sessionId}`);
      return false;
    }

    // Check max sessions per user
    const existingUserSessions = this.userSessions.get(userId) || new Set();
    if (existingUserSessions.size >= this.config.maxSessionsPerUser) {
      // Close oldest session
      const oldestSessionId = [...existingUserSessions][0];
      this.closeSession(oldestSessionId, "Max sessions exceeded");
    }

    // Update session
    session.userId = userId;
    session.phone = phone;
    session.status = "authenticated";
    session.lastActivity = new Date();

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    this.emit("session:authenticated", session);
    console.log(`[SessionManager] Session authenticated: ${sessionId} -> ${userId}`);
    return true;
  }

  /**
   * Update session activity timestamp
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      if (session.status === "idle") {
        session.status = "active";
      }
    }
  }

  /**
   * Set session status
   */
  setSessionStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const oldStatus = session.status;
      session.status = status;
      this.emit("session:status", { session, oldStatus, newStatus: status });
    }
  }

  /**
   * Update session metadata
   */
  updateMetadata(sessionId: string, metadata: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata = { ...session.metadata, ...metadata };
    }
  }

  /**
   * Track Mino browser session
   */
  setMinoBrowserSession(sessionId: string, browserSessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.minoBrowserSessionId = browserSessionId;
      session.minoStreamActive = true;
      this.emit("mino:session:started", { sessionId, browserSessionId });
    }
  }

  /**
   * Clear Mino browser session
   */
  clearMinoBrowserSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const browserSessionId = session.minoBrowserSessionId;
      session.minoBrowserSessionId = undefined;
      session.minoStreamActive = false;
      this.emit("mino:session:ended", { sessionId, browserSessionId });
    }
  }

  /**
   * Get sessions for a user
   */
  getUserSessions(userId: string): SessionState[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return [...sessionIds]
      .map((id) => this.sessions.get(id))
      .filter((s): s is SessionState => s !== undefined);
  }

  /**
   * Close a session
   */
  closeSession(sessionId: string, reason: string = "Session closed"): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = "disconnecting";

    // Send close message if socket is open
    if (session.socket.readyState === WebSocket.OPEN) {
      try {
        session.socket.send(
          JSON.stringify({
            type: "session:closing",
            reason,
            timestamp: new Date().toISOString(),
          })
        );
        session.socket.close(1000, reason);
      } catch (error) {
        console.error(`[SessionManager] Error closing socket: ${error}`);
      }
    }

    // Cleanup tracking
    if (session.userId) {
      const userSessionSet = this.userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
    }

    session.status = "closed";
    this.sessions.delete(sessionId);
    this.emit("session:closed", { sessionId, reason });

    console.log(`[SessionManager] Session closed: ${sessionId} - ${reason}`);
  }

  /**
   * Close all sessions for a user
   */
  closeUserSessions(userId: string, reason: string = "User sessions closed"): void {
    const sessions = this.getUserSessions(userId);
    for (const session of sessions) {
      this.closeSession(session.id, reason);
    }
  }

  /**
   * Close all sessions
   */
  closeAllSessions(reason: string = "Server shutdown"): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId, reason);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return [...this.sessions.keys()];
  }

  /**
   * Broadcast message to all sessions
   */
  broadcast(message: object, filter?: (session: SessionState) => boolean): void {
    const payload = JSON.stringify(message);

    for (const session of this.sessions.values()) {
      if (filter && !filter(session)) continue;
      if (session.socket.readyState !== WebSocket.OPEN) continue;

      try {
        session.socket.send(payload);
      } catch (error) {
        console.error(`[SessionManager] Broadcast error to ${session.id}:`, error);
      }
    }
  }

  /**
   * Send message to a specific session
   */
  sendToSession(sessionId: string, message: object): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      session.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[SessionManager] Send error to ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Start idle session cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Clean up idle sessions
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    const idleThreshold = this.config.idleTimeoutMs;

    for (const session of this.sessions.values()) {
      const idleTime = now - session.lastActivity.getTime();

      if (idleTime > idleThreshold) {
        console.log(
          `[SessionManager] Closing idle session: ${session.id} (idle ${Math.round(idleTime / 1000)}s)`
        );
        this.closeSession(session.id, "Session idle timeout");
      } else if (idleTime > idleThreshold / 2 && session.status === "active") {
        session.status = "idle";
        this.emit("session:idle", session);
      }
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Get session stats
   */
  getStats(): {
    totalSessions: number;
    authenticatedSessions: number;
    activeMino: number;
    uniqueUsers: number;
  } {
    let authenticated = 0;
    let activeMino = 0;

    for (const session of this.sessions.values()) {
      if (session.userId) authenticated++;
      if (session.minoStreamActive) activeMino++;
    }

    return {
      totalSessions: this.sessions.size,
      authenticatedSessions: authenticated,
      activeMino,
      uniqueUsers: this.userSessions.size,
    };
  }
}
