/**
 * Mino SSE-to-WebSocket Bridge
 *
 * Connects to Mino browser automation service via SSE
 * and streams events to WebSocket clients in real-time.
 *
 * ADK Pattern: Server-side bridge between Mino's SSE stream
 * and client's WebSocket connection for live browser viewing.
 */

import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { sessionManager } from "./index";

// Mino service configuration
const MINO_SERVICE_URL = process.env.MINO_SERVICE_URL || "http://localhost:8001";
const MINO_API_KEY = process.env.MINO_API_KEY;

// ============================================================================
// TYPES
// ============================================================================

export interface MinoEvent {
  type: "screenshot" | "action" | "thought" | "result" | "error" | "done";
  data: {
    screenshot?: string; // Base64 encoded
    action?: string;
    thought?: string;
    result?: unknown;
    error?: string;
    metadata?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface MinoSessionConfig {
  url: string;
  goal: string;
  maxSteps?: number;
  screenshotInterval?: number;
  headless?: boolean;
}

// ============================================================================
// MINO BRIDGE CLASS
// ============================================================================

export class MinoBridge {
  private sessionId: string;
  private socket: WebSocket;
  private log: FastifyBaseLogger;
  private abortController?: AbortController;
  private isActive: boolean = false;

  constructor(sessionId: string, socket: WebSocket, log: FastifyBaseLogger) {
    this.sessionId = sessionId;
    this.socket = socket;
    this.log = log;
  }

  /**
   * Start a Mino browser session and stream events to WebSocket
   */
  async startSession(url: string, goal: string, config?: Partial<MinoSessionConfig>): Promise<void> {
    if (this.isActive) {
      throw new Error("Session already active");
    }

    this.isActive = true;
    this.abortController = new AbortController();

    const fullConfig: MinoSessionConfig = {
      url,
      goal,
      maxSteps: config?.maxSteps ?? 10,
      screenshotInterval: config?.screenshotInterval ?? 1000,
      headless: config?.headless ?? true,
    };

    this.log.info({ sessionId: this.sessionId, url, goal }, "Starting Mino session");

    // Track in session manager
    const browserSessionId = `mino-${Date.now()}`;
    sessionManager.setMinoBrowserSession(this.sessionId, browserSessionId);

    // Send started event
    this.sendToClient({
      type: "mino:started",
      payload: {
        browserSessionId,
        url,
        goal,
      },
    });

    try {
      // Connect to Mino SSE stream
      await this.connectToMinoStream(fullConfig);
    } catch (error) {
      this.log.error({ sessionId: this.sessionId, error }, "Mino session error");
      this.sendToClient({
        type: "mino:error",
        payload: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } finally {
      this.cleanup();
    }
  }

  /**
   * Connect to Mino's SSE endpoint and process events
   */
  private async connectToMinoStream(config: MinoSessionConfig): Promise<void> {
    const endpoint = `${MINO_SERVICE_URL}/api/browse`;

    this.log.info({ endpoint, url: config.url }, "Connecting to Mino service");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(MINO_API_KEY && { Authorization: `Bearer ${MINO_API_KEY}` }),
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          url: config.url,
          goal: config.goal,
          max_steps: config.maxSteps,
          screenshot_interval: config.screenshotInterval,
          headless: config.headless,
          stream: true,
        }),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`Mino service error: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // SSE streaming response
        await this.processSSEStream(response);
      } else {
        // JSON response (non-streaming fallback)
        const result = await response.json();
        this.handleMinoResult(result);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        this.log.info({ sessionId: this.sessionId }, "Mino session aborted");
        return;
      }
      throw error;
    }
  }

  /**
   * Process SSE stream from Mino service
   */
  private async processSSEStream(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (this.isActive) {
        const { done, value } = await reader.read();

        if (done) {
          this.log.info({ sessionId: this.sessionId }, "Mino stream ended");
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const events = this.parseSSEEvents(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          await this.handleSSEEvent(event);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse SSE events from buffer
   */
  private parseSSEEvents(buffer: string): {
    parsed: MinoEvent[];
    remaining: string;
  } {
    const events: MinoEvent[] = [];
    const lines = buffer.split("\n");
    let remaining = "";
    let currentData = "";
    let currentEvent = "message";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this might be an incomplete line at the end
      if (i === lines.length - 1 && line !== "") {
        remaining = line;
        continue;
      }

      if (line === "") {
        // Empty line = event boundary
        if (currentData) {
          try {
            const data = JSON.parse(currentData);
            events.push({
              type: this.mapEventType(currentEvent),
              data,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            this.log.warn({ data: currentData }, "Failed to parse SSE data");
          }
          currentData = "";
          currentEvent = "message";
        }
      } else if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        currentData += line.slice(5).trim();
      }
    }

    return { parsed: events, remaining };
  }

  /**
   * Map Mino event types to our types
   */
  private mapEventType(
    eventType: string
  ): "screenshot" | "action" | "thought" | "result" | "error" | "done" {
    const mapping: Record<string, MinoEvent["type"]> = {
      screenshot: "screenshot",
      action: "action",
      thought: "thought",
      result: "result",
      error: "error",
      done: "done",
      complete: "done",
      message: "thought",
    };
    return mapping[eventType] || "thought";
  }

  /**
   * Handle individual SSE event
   */
  private async handleSSEEvent(event: MinoEvent): Promise<void> {
    this.log.debug(
      { sessionId: this.sessionId, type: event.type },
      "Mino event received"
    );

    switch (event.type) {
      case "screenshot":
        this.sendToClient({
          type: "mino:screenshot",
          payload: {
            screenshot: event.data.screenshot,
            timestamp: event.timestamp,
          },
        });
        break;

      case "action":
        this.sendToClient({
          type: "mino:action",
          payload: {
            action: event.data.action,
            thought: event.data.thought,
            timestamp: event.timestamp,
          },
        });
        break;

      case "thought":
        this.sendToClient({
          type: "mino:action",
          payload: {
            thought: event.data.thought,
            timestamp: event.timestamp,
          },
        });
        break;

      case "result":
        this.handleMinoResult(event.data.result);
        break;

      case "error":
        this.sendToClient({
          type: "mino:error",
          payload: {
            error: event.data.error,
            timestamp: event.timestamp,
          },
        });
        break;

      case "done":
        this.sendToClient({
          type: "mino:ended",
          payload: {
            reason: "completed",
            result: event.data.result,
            timestamp: event.timestamp,
          },
        });
        this.isActive = false;
        break;
    }
  }

  /**
   * Handle final Mino result
   */
  private handleMinoResult(result: unknown): void {
    this.sendToClient({
      type: "mino:result",
      payload: {
        result,
        timestamp: new Date().toISOString(),
      },
    });

    // Store result for follow-up questions
    const session = sessionManager.getSession(this.sessionId);
    if (session?.phone || session?.userId) {
      // Import setLastMinoResult dynamically
      import("../gemini").then(({ setLastMinoResult }) => {
        const contactId = session.phone || session.userId!;
        setLastMinoResult(
          contactId,
          "", // URL already tracked
          "", // Goal already tracked
          result
        );
      });
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendToClient(message: {
    type: string;
    payload?: Record<string, unknown>;
  }): void {
    if (this.socket.readyState !== WebSocket.OPEN) {
      this.log.warn({ sessionId: this.sessionId }, "Socket not open, can't send");
      return;
    }

    try {
      this.socket.send(
        JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      this.log.error({ sessionId: this.sessionId, error }, "Send to client error");
    }
  }

  /**
   * Stop the Mino session
   */
  stop(): void {
    this.log.info({ sessionId: this.sessionId }, "Stopping Mino session");
    this.abortController?.abort();
    this.isActive = false;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isActive = false;
    this.abortController = undefined;
    sessionManager.clearMinoBrowserSession(this.sessionId);

    this.sendToClient({
      type: "mino:ended",
      payload: {
        reason: "session_cleanup",
      },
    });
  }
}

// ============================================================================
// SINGLETON BRIDGE MANAGER (for tracking active bridges)
// ============================================================================

class BridgeManager {
  private bridges: Map<string, MinoBridge> = new Map();

  register(sessionId: string, bridge: MinoBridge): void {
    this.bridges.set(sessionId, bridge);
  }

  get(sessionId: string): MinoBridge | undefined {
    return this.bridges.get(sessionId);
  }

  remove(sessionId: string): void {
    const bridge = this.bridges.get(sessionId);
    if (bridge) {
      bridge.stop();
      this.bridges.delete(sessionId);
    }
  }

  stopAll(): void {
    for (const bridge of this.bridges.values()) {
      bridge.stop();
    }
    this.bridges.clear();
  }
}

export const bridgeManager = new BridgeManager();
