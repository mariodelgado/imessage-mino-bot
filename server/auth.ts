/**
 * JWT Authentication Module for Mino WebSocket Server
 *
 * Handles token generation, validation, and session security.
 */

import jwt, { SignOptions } from "jsonwebtoken";

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "mino-dev-secret-change-in-prod";
const JWT_ISSUER = "mino-server";
const JWT_AUDIENCE = "mino-client";

export interface JWTPayload {
  userId: string;
  phone?: string;
  sessionId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface TokenOptions {
  expiresIn?: string;
  sessionId?: string;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(
  payload: { userId: string; phone?: string },
  options: TokenOptions = {}
): string {
  const { expiresIn = "7d", sessionId } = options;

  const tokenPayload: JWTPayload = {
    userId: payload.userId,
    phone: payload.phone,
    sessionId,
  };

  const signOptions: SignOptions = {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };

  return jwt.sign(tokenPayload, JWT_SECRET, signOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log("[Auth] Token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log("[Auth] Invalid token:", error.message);
    } else {
      console.error("[Auth] Token verification error:", error);
    }
    return null;
  }
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Extract token from WebSocket URL query string
 */
export function extractQueryToken(url: string): string | null {
  try {
    const urlObj = new URL(url, "ws://localhost");
    return urlObj.searchParams.get("token");
  } catch {
    return null;
  }
}

/**
 * Generate a refresh token (longer lived)
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: "30d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Verify a refresh token and return new access token
 */
export function refreshAccessToken(refreshToken: string): string | null {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as { userId: string; type: string };

    if (decoded.type !== "refresh") {
      console.log("[Auth] Invalid refresh token type");
      return null;
    }

    // Generate new access token
    return generateToken({ userId: decoded.userId });
  } catch (error) {
    console.error("[Auth] Refresh token error:", error);
    return null;
  }
}

/**
 * Hash a value for secure comparison (e.g., session validation)
 */
export function hashValue(value: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a secure random string for session IDs, state params, etc.
 */
export function generateSecureId(length: number = 32): string {
  const crypto = require("crypto");
  return crypto.randomBytes(length).toString("hex");
}
