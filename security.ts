/**
 * Security Module
 *
 * Comprehensive security features:
 * 1. Rate limiting - prevent abuse
 * 2. Token encryption at rest - protect stored credentials
 * 3. Audit logging - track security events
 * 4. Session management - token revocation
 * 5. Input sanitization - prevent injection
 * 6. Failed auth lockout - prevent brute force
 * 7. Request signing - verify request integrity
 */

import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "bot.db");
const db = new Database(DB_PATH);

// ============================================================================
// CONFIGURATION
// ============================================================================

// Encryption key - should be set via environment variable
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Rate limiting defaults
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
const RATE_LIMIT_MINO_REQUESTS = 10; // 10 Mino requests per minute (more expensive)

// Lockout settings
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// SCHEMA
// ============================================================================

db.exec(`
  -- Security audit log
  CREATE TABLE IF NOT EXISTS security_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    phone TEXT,
    event_type TEXT NOT NULL,
    event_data JSON,
    ip_address TEXT,
    user_agent TEXT,
    severity TEXT DEFAULT 'info'
  );

  -- Rate limiting
  CREATE TABLE IF NOT EXISTS rate_limits (
    phone TEXT NOT NULL,
    request_type TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    request_count INTEGER DEFAULT 1,
    PRIMARY KEY (phone, request_type, window_start)
  );

  -- Failed authentication attempts
  CREATE TABLE IF NOT EXISTS failed_auth_attempts (
    phone TEXT PRIMARY KEY,
    attempt_count INTEGER DEFAULT 0,
    first_attempt TEXT,
    last_attempt TEXT,
    locked_until TEXT
  );

  -- Active sessions (for revocation)
  CREATE TABLE IF NOT EXISTS active_sessions (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used TEXT,
    expires_at TEXT,
    revoked INTEGER DEFAULT 0,
    device_info TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_phone ON security_audit_log(phone);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_audit_event ON security_audit_log(event_type);
  CREATE INDEX IF NOT EXISTS idx_sessions_phone ON active_sessions(phone);
`);

// ============================================================================
// 1. TOKEN ENCRYPTION AT REST
// ============================================================================

/**
 * Encrypt sensitive data before storing
 */
export function encryptToken(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt stored sensitive data
 */
export function decryptToken(encryptedData: string): string | null {
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
    if (!ivHex || !authTagHex || !encrypted) return null;

    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[Security] Decryption failed:", error);
    return null;
  }
}

/**
 * Hash a token for storage (one-way, for lookup)
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ============================================================================
// 2. RATE LIMITING
// ============================================================================

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds until reset
}

/**
 * Check and update rate limit for a phone number
 */
export function checkRateLimit(
  phone: string,
  requestType: string = "general",
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS
): RateLimitResult {
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;

  // Get current count
  const existing = db.prepare(`
    SELECT request_count FROM rate_limits
    WHERE phone = ? AND request_type = ? AND window_start = ?
  `).get(phone, requestType, windowStart) as { request_count: number } | undefined;

  const currentCount = existing?.request_count || 0;

  if (currentCount >= maxRequests) {
    const resetIn = (windowStart + RATE_LIMIT_WINDOW_MS) - now;
    logSecurityEvent(phone, "rate_limit_exceeded", { requestType, count: currentCount }, "warning");
    return { allowed: false, remaining: 0, resetIn };
  }

  // Increment counter
  db.prepare(`
    INSERT INTO rate_limits (phone, request_type, window_start, request_count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(phone, request_type, window_start)
    DO UPDATE SET request_count = request_count + 1
  `).run(phone, requestType, windowStart);

  // Cleanup old windows
  db.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).run(now - RATE_LIMIT_WINDOW_MS * 2);

  return {
    allowed: true,
    remaining: maxRequests - currentCount - 1,
    resetIn: (windowStart + RATE_LIMIT_WINDOW_MS) - now,
  };
}

/**
 * Check Mino-specific rate limit (more restrictive)
 */
export function checkMinoRateLimit(phone: string): RateLimitResult {
  return checkRateLimit(phone, "mino", RATE_LIMIT_MINO_REQUESTS);
}

// ============================================================================
// 3. AUDIT LOGGING
// ============================================================================

type SecurityEventType =
  | "auth_success"
  | "auth_failure"
  | "token_refresh"
  | "token_revoked"
  | "rate_limit_exceeded"
  | "lockout_triggered"
  | "lockout_cleared"
  | "suspicious_input"
  | "oauth_started"
  | "oauth_completed"
  | "oauth_failed"
  | "guardrail_triggered"
  | "session_created"
  | "session_expired";

type Severity = "info" | "warning" | "error" | "critical";

/**
 * Log a security event
 */
export function logSecurityEvent(
  phone: string | null,
  eventType: SecurityEventType,
  eventData?: Record<string, unknown>,
  severity: Severity = "info",
  ipAddress?: string,
  userAgent?: string
): void {
  db.prepare(`
    INSERT INTO security_audit_log (phone, event_type, event_data, severity, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    phone,
    eventType,
    eventData ? JSON.stringify(eventData) : null,
    severity,
    ipAddress || null,
    userAgent || null
  );

  // Console output for critical events
  if (severity === "critical" || severity === "error") {
    console.error(`[Security] ${severity.toUpperCase()}: ${eventType} for ${phone}`, eventData);
  }
}

/**
 * Get recent security events for a phone
 */
export function getSecurityEvents(
  phone: string,
  limit: number = 50
): Array<{ timestamp: string; event_type: string; event_data: string; severity: string }> {
  return db.prepare(`
    SELECT timestamp, event_type, event_data, severity
    FROM security_audit_log
    WHERE phone = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(phone, limit) as Array<{ timestamp: string; event_type: string; event_data: string; severity: string }>;
}

/**
 * Get all security events (admin)
 */
export function getAllSecurityEvents(
  severity?: Severity,
  limit: number = 100
): Array<{ timestamp: string; phone: string; event_type: string; severity: string }> {
  if (severity) {
    return db.prepare(`
      SELECT timestamp, phone, event_type, severity
      FROM security_audit_log
      WHERE severity = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(severity, limit) as Array<{ timestamp: string; phone: string; event_type: string; severity: string }>;
  }

  return db.prepare(`
    SELECT timestamp, phone, event_type, severity
    FROM security_audit_log
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as Array<{ timestamp: string; phone: string; event_type: string; severity: string }>;
}

// ============================================================================
// 4. FAILED AUTH LOCKOUT
// ============================================================================

/**
 * Record a failed authentication attempt
 */
export function recordFailedAuth(phone: string): { locked: boolean; attemptsRemaining: number } {
  const now = new Date().toISOString();

  const existing = db.prepare(`
    SELECT attempt_count, locked_until FROM failed_auth_attempts WHERE phone = ?
  `).get(phone) as { attempt_count: number; locked_until: string | null } | undefined;

  // Check if currently locked
  if (existing?.locked_until) {
    const lockedUntil = new Date(existing.locked_until);
    if (lockedUntil > new Date()) {
      return { locked: true, attemptsRemaining: 0 };
    }
    // Lock expired, reset
    db.prepare(`DELETE FROM failed_auth_attempts WHERE phone = ?`).run(phone);
  }

  const newCount = (existing?.attempt_count || 0) + 1;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    db.prepare(`
      INSERT INTO failed_auth_attempts (phone, attempt_count, first_attempt, last_attempt, locked_until)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        attempt_count = ?,
        last_attempt = ?,
        locked_until = ?
    `).run(phone, newCount, now, now, lockedUntil, newCount, now, lockedUntil);

    logSecurityEvent(phone, "lockout_triggered", { attempts: newCount }, "warning");
    return { locked: true, attemptsRemaining: 0 };
  }

  // Record attempt
  db.prepare(`
    INSERT INTO failed_auth_attempts (phone, attempt_count, first_attempt, last_attempt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      attempt_count = ?,
      last_attempt = ?
  `).run(phone, newCount, now, now, newCount, now);

  logSecurityEvent(phone, "auth_failure", { attempts: newCount }, "info");
  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - newCount };
}

/**
 * Clear failed auth attempts after successful login
 */
export function clearFailedAuth(phone: string): void {
  const existing = db.prepare(`
    SELECT attempt_count FROM failed_auth_attempts WHERE phone = ?
  `).get(phone) as { attempt_count: number } | undefined;

  if (existing && existing.attempt_count > 0) {
    logSecurityEvent(phone, "lockout_cleared", { previousAttempts: existing.attempt_count }, "info");
  }

  db.prepare(`DELETE FROM failed_auth_attempts WHERE phone = ?`).run(phone);
}

/**
 * Check if phone is currently locked out
 */
export function isLockedOut(phone: string): { locked: boolean; unlockIn?: number } {
  const existing = db.prepare(`
    SELECT locked_until FROM failed_auth_attempts WHERE phone = ?
  `).get(phone) as { locked_until: string | null } | undefined;

  if (!existing?.locked_until) {
    return { locked: false };
  }

  const lockedUntil = new Date(existing.locked_until);
  const now = new Date();

  if (lockedUntil > now) {
    return { locked: true, unlockIn: lockedUntil.getTime() - now.getTime() };
  }

  return { locked: false };
}

// ============================================================================
// 5. SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session for a phone
 */
export function createSession(
  phone: string,
  token: string,
  expiresIn: number,
  deviceInfo?: string
): string {
  const sessionId = crypto.randomBytes(16).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  db.prepare(`
    INSERT INTO active_sessions (id, phone, token_hash, expires_at, device_info, last_used)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(sessionId, phone, tokenHash, expiresAt, deviceInfo || null);

  logSecurityEvent(phone, "session_created", { sessionId, expiresAt }, "info");
  return sessionId;
}

/**
 * Validate and update session
 */
export function validateSession(sessionId: string, token: string): boolean {
  const tokenHash = hashToken(token);

  const session = db.prepare(`
    SELECT * FROM active_sessions
    WHERE id = ? AND token_hash = ? AND revoked = 0
  `).get(sessionId, tokenHash) as { expires_at: string; phone: string } | undefined;

  if (!session) return false;

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    logSecurityEvent(session.phone, "session_expired", { sessionId }, "info");
    return false;
  }

  // Update last used
  db.prepare(`UPDATE active_sessions SET last_used = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
  return true;
}

/**
 * Revoke a specific session
 */
export function revokeSession(sessionId: string): boolean {
  const session = db.prepare(`SELECT phone FROM active_sessions WHERE id = ?`).get(sessionId) as { phone: string } | undefined;

  if (!session) return false;

  db.prepare(`UPDATE active_sessions SET revoked = 1 WHERE id = ?`).run(sessionId);
  logSecurityEvent(session.phone, "token_revoked", { sessionId }, "info");
  return true;
}

/**
 * Revoke all sessions for a phone
 */
export function revokeAllSessions(phone: string): number {
  const result = db.prepare(`UPDATE active_sessions SET revoked = 1 WHERE phone = ? AND revoked = 0`).run(phone);
  logSecurityEvent(phone, "token_revoked", { count: result.changes, reason: "revoke_all" }, "info");
  return result.changes;
}

/**
 * Get active sessions for a phone
 */
export function getActiveSessions(phone: string): Array<{ id: string; created_at: string; last_used: string; device_info: string | null }> {
  return db.prepare(`
    SELECT id, created_at, last_used, device_info
    FROM active_sessions
    WHERE phone = ? AND revoked = 0 AND expires_at > CURRENT_TIMESTAMP
    ORDER BY last_used DESC
  `).all(phone) as Array<{ id: string; created_at: string; last_used: string; device_info: string | null }>;
}

// ============================================================================
// 6. INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Limit length
  sanitized = sanitized.slice(0, 10000);

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Check for suspicious patterns in input
 */
export function detectSuspiciousInput(input: string, phone: string): boolean {
  const suspiciousPatterns = [
    // SQL injection attempts
    /('|"|;|--|\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b|\bDROP\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b)/i,
    // Command injection
    /(\||`|\$\(|&&|\beval\b|\bexec\b)/,
    // Path traversal
    /\.\.\//,
    // Extremely long repeating patterns (DoS attempt)
    /(.)\1{100,}/,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      logSecurityEvent(phone, "suspicious_input", {
        pattern: pattern.source,
        sample: input.slice(0, 100),
      }, "warning");
      return true;
    }
  }

  return false;
}

/**
 * Validate URL is safe to browse
 */
export function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    // Block local/internal URLs
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
    if (blockedHosts.includes(parsed.hostname)) {
      return { safe: false, reason: "Local URLs not allowed" };
    }

    // Block internal IP ranges
    const ipv4Match = parsed.hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 10.x.x.x, 172.16-31.x.x, 192.168.x.x
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        return { safe: false, reason: "Internal IP addresses not allowed" };
      }
    }

    // Block non-http(s) protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { safe: false, reason: "Only HTTP/HTTPS URLs allowed" };
    }

    // Block file:// and data:// type URLs
    if (parsed.protocol === "file:" || parsed.protocol === "data:") {
      return { safe: false, reason: "File/data URLs not allowed" };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }
}

// ============================================================================
// 7. REQUEST SIGNING (for webhooks/callbacks)
// ============================================================================

const SIGNING_SECRET = process.env.WEBHOOK_SIGNING_SECRET || crypto.randomBytes(32).toString("hex");

/**
 * Generate signature for outgoing requests
 */
export function signRequest(payload: string, timestamp: number): string {
  const message = `${timestamp}.${payload}`;
  return crypto.createHmac("sha256", SIGNING_SECRET).update(message).digest("hex");
}

/**
 * Verify signature on incoming webhooks
 */
export function verifySignature(
  payload: string,
  signature: string,
  timestamp: number,
  maxAge: number = 300000 // 5 minutes
): boolean {
  // Check timestamp freshness
  const age = Date.now() - timestamp;
  if (age > maxAge || age < 0) {
    return false;
  }

  const expectedSignature = signRequest(payload, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup old security data
 */
export function cleanupSecurityData(): void {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Delete old audit logs (keep 30 days)
  db.prepare(`DELETE FROM security_audit_log WHERE timestamp < ?`).run(thirtyDaysAgo);

  // Delete old rate limit records (keep 1 hour)
  db.prepare(`DELETE FROM rate_limits WHERE window_start < ?`).run(Date.now() - 60 * 60 * 1000);

  // Delete old failed auth records (keep 7 days)
  db.prepare(`DELETE FROM failed_auth_attempts WHERE last_attempt < ?`).run(sevenDaysAgo);

  // Delete expired/revoked sessions (keep 7 days for audit)
  db.prepare(`DELETE FROM active_sessions WHERE (revoked = 1 OR expires_at < CURRENT_TIMESTAMP) AND created_at < ?`).run(sevenDaysAgo);

  console.log("[Security] Cleanup completed");
}

// Run cleanup every hour
setInterval(cleanupSecurityData, 60 * 60 * 1000);

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Encryption
  encryptToken,
  decryptToken,
  hashToken,

  // Rate limiting
  checkRateLimit,
  checkMinoRateLimit,

  // Audit logging
  logSecurityEvent,
  getSecurityEvents,
  getAllSecurityEvents,

  // Auth lockout
  recordFailedAuth,
  clearFailedAuth,
  isLockedOut,

  // Sessions
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  getActiveSessions,

  // Input validation
  sanitizeInput,
  detectSuspiciousInput,
  isUrlSafe,

  // Request signing
  signRequest,
  verifySignature,

  // Maintenance
  cleanupSecurityData,
};
