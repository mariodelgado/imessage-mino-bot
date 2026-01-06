/**
 * Database module for storing users and messages
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "bot.db");

// Initialize database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    mino_api_key TEXT,
    mino_state TEXT,
    mino_code_verifier TEXT,
    mino_access_token TEXT,
    mino_refresh_token TEXT,
    mino_token_expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_message_at TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  CREATE INDEX IF NOT EXISTS idx_users_mino_state ON users(mino_state);

  -- Bot state for tracking processed messages
  CREATE TABLE IF NOT EXISTS bot_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export interface User {
  id: number;
  phone: string;
  name: string | null;
  mino_api_key: string | null;
  mino_state: string | null;
  mino_code_verifier: string | null;
  mino_access_token: string | null;
  mino_refresh_token: string | null;
  mino_token_expires_at: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface MessageRecord {
  id: number;
  user_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

// Get or create a user by phone number
export function getOrCreateUser(phone: string): User {
  const existing = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as User | undefined;

  if (existing) {
    return existing;
  }

  const result = db.prepare("INSERT INTO users (phone) VALUES (?)").run(phone);
  return {
    id: result.lastInsertRowid as number,
    phone,
    name: null,
    mino_api_key: null,
    mino_state: null,
    mino_code_verifier: null,
    mino_access_token: null,
    mino_refresh_token: null,
    mino_token_expires_at: null,
    created_at: new Date().toISOString(),
    last_message_at: null,
  };
}

// Update user's name
export function updateUserName(phone: string, name: string): void {
  db.prepare("UPDATE users SET name = ? WHERE phone = ?").run(name, phone);
}

// Get user by phone
export function getUserByPhone(phone: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone) as User | undefined;
}

// Store a message
export function storeMessage(phone: string, role: "user" | "assistant" | "system", content: string): void {
  const user = getOrCreateUser(phone);

  db.prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)").run(user.id, role, content);
  db.prepare("UPDATE users SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
}

// Get recent messages for a user (for context)
export function getRecentMessages(phone: string, limit: number = 20): MessageRecord[] {
  const user = getUserByPhone(phone);
  if (!user) return [];

  return db.prepare(`
    SELECT * FROM messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(user.id, limit).reverse() as MessageRecord[];
}

// Check if this is a new user (no messages yet)
export function isNewUser(phone: string): boolean {
  const user = getUserByPhone(phone);
  if (!user) return true;

  const count = db.prepare("SELECT COUNT(*) as count FROM messages WHERE user_id = ?").get(user.id) as { count: number };
  return count.count === 0;
}

// Get all users
export function getAllUsers(): User[] {
  return db.prepare("SELECT * FROM users ORDER BY last_message_at DESC").all() as User[];
}

// Set Mino OAuth state for a user (used to link callback to phone)
export function setMinoState(phone: string, state: string): void {
  getOrCreateUser(phone); // Ensure user exists
  db.prepare("UPDATE users SET mino_state = ? WHERE phone = ?").run(state, phone);
}

// Get user by Mino OAuth state
export function getUserByMinoState(state: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE mino_state = ?").get(state) as User | undefined;
}

// Set Mino API key for a user
export function setMinoApiKey(phone: string, apiKey: string): void {
  db.prepare("UPDATE users SET mino_api_key = ?, mino_state = NULL WHERE phone = ?").run(apiKey, phone);
}

// Get Mino API key for a user
export function getMinoApiKey(phone: string): string | null {
  const user = getUserByPhone(phone);
  return user?.mino_api_key || null;
}

// Clear Mino state after OAuth completes
export function clearMinoState(phone: string): void {
  db.prepare("UPDATE users SET mino_state = NULL WHERE phone = ?").run(phone);
}

// Store PKCE code verifier for OAuth flow
export function setMinoCodeVerifier(phone: string, codeVerifier: string): void {
  db.prepare("UPDATE users SET mino_code_verifier = ? WHERE phone = ?").run(codeVerifier, phone);
}

// Get PKCE code verifier
export function getMinoCodeVerifier(phone: string): string | null {
  const user = getUserByPhone(phone);
  return user?.mino_code_verifier || null;
}

// Store OAuth tokens after successful authentication
export function setMinoTokens(
  phone: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number // seconds until expiry
): void {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  db.prepare(`
    UPDATE users SET
      mino_access_token = ?,
      mino_refresh_token = ?,
      mino_token_expires_at = ?,
      mino_state = NULL,
      mino_code_verifier = NULL
    WHERE phone = ?
  `).run(accessToken, refreshToken, expiresAt, phone);
}

// Get current access token (checks expiry)
export function getMinoAccessToken(phone: string): string | null {
  const user = getUserByPhone(phone);
  if (!user?.mino_access_token) return null;

  // Check if token is expired (with 5 min buffer)
  if (user.mino_token_expires_at) {
    const expiresAt = new Date(user.mino_token_expires_at);
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    if (expiresAt.getTime() - bufferMs < Date.now()) {
      return null; // Token expired or about to expire
    }
  }

  return user.mino_access_token;
}

// Get refresh token for token refresh flow
export function getMinoRefreshToken(phone: string): string | null {
  const user = getUserByPhone(phone);
  return user?.mino_refresh_token || null;
}

// Check if user needs to re-authenticate
export function needsMinoReauth(phone: string): boolean {
  const user = getUserByPhone(phone);
  if (!user) return true;

  // Has valid access token?
  if (getMinoAccessToken(phone)) return false;

  // Has refresh token we can use?
  if (user.mino_refresh_token) return false;

  // Has legacy API key?
  if (user.mino_api_key) return false;

  return true;
}

// Clear all Mino auth data (for logout)
export function clearMinoAuth(phone: string): void {
  db.prepare(`
    UPDATE users SET
      mino_api_key = NULL,
      mino_state = NULL,
      mino_code_verifier = NULL,
      mino_access_token = NULL,
      mino_refresh_token = NULL,
      mino_token_expires_at = NULL
    WHERE phone = ?
  `).run(phone);
}

// ============================================================================
// BOT STATE (for tracking last processed message, etc.)
// ============================================================================

export function getBotState(key: string): string | null {
  const row = db.prepare("SELECT value FROM bot_state WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value || null;
}

export function setBotState(key: string, value: string): void {
  db.prepare(`
    INSERT INTO bot_state (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

export function getLastProcessedMessageId(): number {
  const value = getBotState("last_processed_message_id");
  return value ? parseInt(value, 10) : 0;
}

export function setLastProcessedMessageId(messageId: number): void {
  setBotState("last_processed_message_id", messageId.toString());
}

export { db };
