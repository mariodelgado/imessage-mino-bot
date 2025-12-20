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
`);

export interface User {
  id: number;
  phone: string;
  name: string | null;
  mino_api_key: string | null;
  mino_state: string | null;
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
  const user = getOrCreateUser(phone);
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

export { db };
