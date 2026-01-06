/**
 * Mobile Sync - WebSocket server for pushing Snap Apps to mobile clients
 *
 * Provides real-time push updates to the Mino mobile app when new
 * Snap Apps are generated from Mino browser sessions.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { SnapApp } from "./snap-app-agent";

// Port for WebSocket connections from mobile app
const WS_PORT = parseInt(process.env.MOBILE_WS_PORT || "8082", 10);

// Connected mobile clients mapped by phone number
const clients = new Map<string, Set<WebSocket>>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Message types for mobile sync protocol
export interface MobileSyncMessage {
  type: "SNAP_APP" | "SNAP_APP_UPDATE" | "SNAP_APP_DELETE" | "PING" | "PONG";
  payload?: unknown;
  timestamp: number;
}

/**
 * Initialize the WebSocket server for mobile sync
 */
export function initMobileSync(): WebSocketServer {
  if (wss) {
    console.log("📱 Mobile sync already initialized");
    return wss;
  }

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on("connection", (ws, req) => {
    // Extract phone number from URL query params
    // Expected URL: ws://host:8082?phone=+14156836861
    const url = new URL(req.url || "/", `http://localhost:${WS_PORT}`);
    const phone = url.searchParams.get("phone");

    if (!phone) {
      console.log("📱 Mobile connection rejected: no phone number");
      ws.close(4001, "Phone number required");
      return;
    }

    // Add to clients map
    if (!clients.has(phone)) {
      clients.set(phone, new Set());
    }
    clients.get(phone)!.add(ws);

    console.log(`📱 Mobile connected: ${phone} (${clients.get(phone)!.size} connections)`);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "CONNECTED",
        payload: { phone },
        timestamp: Date.now(),
      })
    );

    // Handle pings for keep-alive
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "PING") {
          ws.send(
            JSON.stringify({
              type: "PONG",
              timestamp: Date.now(),
            })
          );
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      if (phone && clients.has(phone)) {
        clients.get(phone)!.delete(ws);
        if (clients.get(phone)!.size === 0) {
          clients.delete(phone);
        }
        console.log(`📱 Mobile disconnected: ${phone}`);
      }
    });

    // Handle errors
    ws.on("error", (err) => {
      console.error(`📱 Mobile WebSocket error for ${phone}:`, err.message);
    });
  });

  wss.on("error", (err) => {
    console.error("📱 Mobile sync server error:", err);
  });

  console.log(`📱 Mobile sync server started on port ${WS_PORT}`);
  return wss;
}

/**
 * Push a new Snap App to a specific mobile client
 */
export async function pushSnapAppToMobile(phone: string, snapApp: SnapApp): Promise<boolean> {
  const phoneClients = clients.get(phone);

  if (!phoneClients || phoneClients.size === 0) {
    console.log(`📱 No mobile clients connected for ${phone}`);
    return false;
  }

  const message: MobileSyncMessage = {
    type: "SNAP_APP",
    payload: snapApp,
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);
  let sent = 0;

  phoneClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
      sent++;
    }
  });

  if (sent > 0) {
    console.log(`📤 Pushed Snap App to ${phone} (${sent} clients)`);
    return true;
  }

  return false;
}

/**
 * Push an update to an existing Snap App
 */
export async function pushSnapAppUpdate(
  phone: string,
  appId: string,
  updates: Partial<SnapApp>
): Promise<boolean> {
  const phoneClients = clients.get(phone);

  if (!phoneClients || phoneClients.size === 0) {
    return false;
  }

  const message: MobileSyncMessage = {
    type: "SNAP_APP_UPDATE",
    payload: { id: appId, updates },
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);
  let sent = 0;

  phoneClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
      sent++;
    }
  });

  return sent > 0;
}

/**
 * Delete a Snap App from mobile client
 */
export async function deleteSnapAppFromMobile(phone: string, appId: string): Promise<boolean> {
  const phoneClients = clients.get(phone);

  if (!phoneClients || phoneClients.size === 0) {
    return false;
  }

  const message: MobileSyncMessage = {
    type: "SNAP_APP_DELETE",
    payload: { id: appId },
    timestamp: Date.now(),
  };

  const messageStr = JSON.stringify(message);
  let sent = 0;

  phoneClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
      sent++;
    }
  });

  return sent > 0;
}

/**
 * Check if a phone has connected mobile clients
 */
export function hasMobileClient(phone: string): boolean {
  const phoneClients = clients.get(phone);
  if (!phoneClients) return false;

  // Check if any connections are still open
  for (const ws of phoneClients) {
    if (ws.readyState === WebSocket.OPEN) {
      return true;
    }
  }

  return false;
}

/**
 * Get count of connected mobile clients
 */
export function getMobileClientCount(): number {
  let count = 0;
  clients.forEach((set) => {
    set.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        count++;
      }
    });
  });
  return count;
}

/**
 * Close the WebSocket server
 */
export function closeMobileSync(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }

    // Close all client connections
    clients.forEach((set) => {
      set.forEach((ws) => {
        ws.close(1000, "Server shutting down");
      });
    });
    clients.clear();

    wss.close(() => {
      wss = null;
      console.log("📱 Mobile sync server closed");
      resolve();
    });
  });
}

export default {
  initMobileSync,
  pushSnapAppToMobile,
  pushSnapAppUpdate,
  deleteSnapAppFromMobile,
  hasMobileClient,
  getMobileClientCount,
  closeMobileSync,
};
