/**
 * WebSocket Server for Mino AI Platform
 *
 * Provides ADK-style bidirectional streaming for:
 * - Real-time chat with Gemini
 * - Live Mino browser session streaming
 * - Claude handoff support
 */

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

import { handleWebSocketConnection } from "./ws-handler";
import { SessionManager } from "./session-manager";
import { verifyToken, generateToken, type JWTPayload } from "./auth";

// Load environment
const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const HOST = process.env.WS_HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "mino-dev-secret-change-in-prod";

// Initialize session manager (singleton)
export const sessionManager = new SessionManager();

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
});

// Extend FastifyRequest type for JWT
declare module "fastify" {
  interface FastifyRequest {
    jwtPayload?: JWTPayload;
  }
}

// Register plugins
async function registerPlugins() {
  // CORS for REST endpoints
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // JWT for authentication
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    sign: {
      expiresIn: "7d",
    },
  });

  // WebSocket support
  await fastify.register(websocket, {
    options: {
      maxPayload: 10 * 1024 * 1024, // 10MB max payload
    },
  });
}

// REST Routes
async function registerRoutes() {
  // Health check
  fastify.get("/health", async () => {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      sessions: sessionManager.getActiveSessionCount(),
    };
  });

  // Generate auth token (for development/testing)
  fastify.post<{
    Body: { userId: string; phone?: string };
  }>("/auth/token", async (request, reply) => {
    const { userId, phone } = request.body;

    if (!userId) {
      return reply.status(400).send({ error: "userId required" });
    }

    const token = generateToken({ userId, phone });
    return { token, expiresIn: "7d" };
  });

  // List active sessions (admin endpoint)
  fastify.get("/sessions", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      return reply.status(401).send({ error: "Invalid token" });
    }

    const sessions = sessionManager.getUserSessions(payload.userId);
    return {
      count: sessions.length,
      sessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
      })),
    };
  });

  // WebSocket endpoint
  fastify.get("/stream", { websocket: true }, (socket, request) => {
    const sessionId = uuidv4();
    fastify.log.info({ sessionId }, "New WebSocket connection");

    handleWebSocketConnection(socket, sessionId, fastify.log);
  });
}

// Graceful shutdown
async function shutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);

  // Close all WebSocket connections
  sessionManager.closeAllSessions("Server shutting down");

  await fastify.close();
  process.exit(0);
}

// Main entry point
async function main() {
  try {
    await registerPlugins();
    await registerRoutes();

    // Start server
    await fastify.listen({ port: PORT, host: HOST });

    console.log(`
╔═══════════════════════════════════════════════════╗
║     Mino WebSocket Server                         ║
║                                                   ║
║  🔌 WebSocket: ws://${HOST}:${PORT}/stream${" ".repeat(Math.max(0, 15 - PORT.toString().length))}║
║  🔑 REST API:  http://${HOST}:${PORT}${" ".repeat(Math.max(0, 16 - PORT.toString().length))}║
║  📡 ADK Bidi-Streaming Ready                      ║
╚═══════════════════════════════════════════════════╝
    `);

    // Register shutdown handlers
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();

// Export for testing
export { fastify };
