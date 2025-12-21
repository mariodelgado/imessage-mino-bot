/**
 * MIRA Long-Term Memory System
 *
 * Implements persistent memory with natural decay - memories fade
 * unless reinforced through access, just like human memory.
 *
 * Memory Types:
 * - episodic: Specific events/conversations (decays fastest)
 * - semantic: Facts and knowledge (decays slower)
 * - procedural: How-to knowledge (decays slowest)
 */

import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";

const DB_PATH = path.join(process.cwd(), "bot.db");
const db = new Database(DB_PATH);

// ============================================================================
// CONFIGURATION
// ============================================================================

interface MemoryConfig {
  halfLife: number;      // Days until strength halves
  boostOnAccess: number; // Strength boost when accessed
  forgetThreshold: number; // Below this, memory is pruned
  maxStrength: number;   // Cap on strength
}

const MEMORY_CONFIG: Record<string, MemoryConfig> = {
  episodic: {
    halfLife: 7,
    boostOnAccess: 0.3,
    forgetThreshold: 0.1,
    maxStrength: 1.0,
  },
  semantic: {
    halfLife: 30,
    boostOnAccess: 0.2,
    forgetThreshold: 0.05,
    maxStrength: 1.0,
  },
  procedural: {
    halfLife: 90,
    boostOnAccess: 0.1,
    forgetThreshold: 0.05,
    maxStrength: 1.0,
  },
};

// ============================================================================
// SCHEMA
// ============================================================================

db.exec(`
  -- Long-term memories with decay
  CREATE TABLE IF NOT EXISTS mira_memories (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    memory_type TEXT DEFAULT 'episodic',
    strength REAL DEFAULT 1.0,
    importance REAL DEFAULT 0.5,
    embedding TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_accessed TEXT DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    related_memories JSON DEFAULT '[]',
    metadata JSON DEFAULT '{}',
    tags JSON DEFAULT '[]'
  );

  -- Memory relationships (for association)
  CREATE TABLE IF NOT EXISTS mira_memory_links (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    link_type TEXT DEFAULT 'related',
    strength REAL DEFAULT 0.5,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source_id, target_id),
    FOREIGN KEY (source_id) REFERENCES mira_memories(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES mira_memories(id) ON DELETE CASCADE
  );

  -- Domain documents (permanent, no decay)
  CREATE TABLE IF NOT EXISTS mira_domaindocs (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    doc_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
  );

  -- Indices for efficient queries
  CREATE INDEX IF NOT EXISTS idx_mira_memories_phone ON mira_memories(phone);
  CREATE INDEX IF NOT EXISTS idx_mira_memories_strength ON mira_memories(strength);
  CREATE INDEX IF NOT EXISTS idx_mira_memories_type ON mira_memories(memory_type);
  CREATE INDEX IF NOT EXISTS idx_mira_domaindocs_phone ON mira_domaindocs(phone);
`);

// ============================================================================
// TYPES
// ============================================================================

export interface Memory {
  id: string;
  phone: string;
  content: string;
  memoryType: "episodic" | "semantic" | "procedural";
  strength: number;
  importance: number;
  embedding?: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  relatedMemories: string[];
  metadata: Record<string, unknown>;
  tags: string[];
}

export interface MemoryLink {
  sourceId: string;
  targetId: string;
  linkType: "related" | "caused_by" | "leads_to" | "contradicts";
  strength: number;
}

export interface DomainDoc {
  id: string;
  phone: string;
  title: string;
  content: string;
  docType?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================================================
// DECAY ALGORITHM
// ============================================================================

/**
 * Calculate current strength of a memory based on decay
 *
 * Formula: strength = initial * (0.5 ^ (days_since_access / half_life))
 */
export function calculateDecay(
  lastStrength: number,
  lastAccessed: Date,
  memoryType: string = "episodic"
): number {
  const config = MEMORY_CONFIG[memoryType] || MEMORY_CONFIG.episodic;
  const now = new Date();
  const daysSinceAccess = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

  const decayedStrength = lastStrength * Math.pow(0.5, daysSinceAccess / config.halfLife);
  return Math.max(0, decayedStrength);
}

/**
 * Boost memory strength on access
 */
export function boostStrength(
  currentStrength: number,
  memoryType: string = "episodic"
): number {
  const config = MEMORY_CONFIG[memoryType] || MEMORY_CONFIG.episodic;
  return Math.min(config.maxStrength, currentStrength + config.boostOnAccess);
}

// ============================================================================
// MEMORY CRUD
// ============================================================================

/**
 * Create a new memory
 */
export function createMemory(
  phone: string,
  content: string,
  options: {
    memoryType?: "episodic" | "semantic" | "procedural";
    importance?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
    relatedMemories?: string[];
  } = {}
): Memory {
  const id = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();

  const memory: Memory = {
    id,
    phone,
    content,
    memoryType: options.memoryType || "episodic",
    strength: 1.0,
    importance: options.importance || 0.5,
    createdAt: new Date(),
    lastAccessed: new Date(),
    accessCount: 1,
    relatedMemories: options.relatedMemories || [],
    metadata: options.metadata || {},
    tags: options.tags || [],
  };

  db.prepare(`
    INSERT INTO mira_memories (id, phone, content, memory_type, strength, importance,
      created_at, last_accessed, access_count, related_memories, metadata, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    phone,
    content,
    memory.memoryType,
    memory.strength,
    memory.importance,
    now,
    now,
    1,
    JSON.stringify(memory.relatedMemories),
    JSON.stringify(memory.metadata),
    JSON.stringify(memory.tags)
  );

  // Auto-link related memories
  for (const relatedId of memory.relatedMemories) {
    linkMemories(id, relatedId, "related", 0.5);
  }

  console.log(`[MIRA] Created ${memory.memoryType} memory: ${content.slice(0, 50)}...`);
  return memory;
}

/**
 * Get a memory by ID, applying decay and boosting strength
 */
export function getMemory(id: string, boost: boolean = true): Memory | null {
  const row = db.prepare(`
    SELECT * FROM mira_memories WHERE id = ?
  `).get(id) as any;

  if (!row) return null;

  const lastAccessed = new Date(row.last_accessed);
  const decayedStrength = calculateDecay(row.strength, lastAccessed, row.memory_type);

  // Check if memory should be forgotten
  const config = MEMORY_CONFIG[row.memory_type] || MEMORY_CONFIG.episodic;
  if (decayedStrength < config.forgetThreshold) {
    forgetMemory(id);
    return null;
  }

  // Boost on access
  if (boost) {
    const boostedStrength = boostStrength(decayedStrength, row.memory_type);
    db.prepare(`
      UPDATE mira_memories
      SET strength = ?, last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1
      WHERE id = ?
    `).run(boostedStrength, id);
  }

  return {
    id: row.id,
    phone: row.phone,
    content: row.content,
    memoryType: row.memory_type,
    strength: boost ? boostStrength(decayedStrength, row.memory_type) : decayedStrength,
    importance: row.importance,
    embedding: row.embedding,
    createdAt: new Date(row.created_at),
    lastAccessed: new Date(),
    accessCount: row.access_count + (boost ? 1 : 0),
    relatedMemories: JSON.parse(row.related_memories || "[]"),
    metadata: JSON.parse(row.metadata || "{}"),
    tags: JSON.parse(row.tags || "[]"),
  };
}

/**
 * Search memories for a phone number
 */
export function searchMemories(
  phone: string,
  query: string,
  options: {
    limit?: number;
    minStrength?: number;
    memoryTypes?: string[];
    tags?: string[];
  } = {}
): Memory[] {
  const { limit = 10, minStrength = 0.1, memoryTypes, tags } = options;

  let sql = `
    SELECT * FROM mira_memories
    WHERE phone = ?
    AND content LIKE ?
  `;
  const params: any[] = [phone, `%${query}%`];

  if (memoryTypes && memoryTypes.length > 0) {
    sql += ` AND memory_type IN (${memoryTypes.map(() => "?").join(",")})`;
    params.push(...memoryTypes);
  }

  sql += ` ORDER BY strength * importance DESC LIMIT ?`;
  params.push(limit * 2); // Fetch more to account for decay filtering

  const rows = db.prepare(sql).all(...params) as any[];

  // Apply decay and filter
  const memories: Memory[] = [];
  for (const row of rows) {
    const decayedStrength = calculateDecay(
      row.strength,
      new Date(row.last_accessed),
      row.memory_type
    );

    if (decayedStrength >= minStrength) {
      memories.push({
        id: row.id,
        phone: row.phone,
        content: row.content,
        memoryType: row.memory_type,
        strength: decayedStrength,
        importance: row.importance,
        embedding: row.embedding,
        createdAt: new Date(row.created_at),
        lastAccessed: new Date(row.last_accessed),
        accessCount: row.access_count,
        relatedMemories: JSON.parse(row.related_memories || "[]"),
        metadata: JSON.parse(row.metadata || "{}"),
        tags: JSON.parse(row.tags || "[]"),
      });
    }

    if (memories.length >= limit) break;
  }

  // Filter by tags if specified
  if (tags && tags.length > 0) {
    return memories.filter(m =>
      tags.some(tag => m.tags.includes(tag))
    );
  }

  return memories;
}

/**
 * Get recent memories for a phone (for context injection)
 */
export function getRecentMemories(
  phone: string,
  limit: number = 5,
  minStrength: number = 0.2
): Memory[] {
  const rows = db.prepare(`
    SELECT * FROM mira_memories
    WHERE phone = ?
    ORDER BY last_accessed DESC
    LIMIT ?
  `).all(phone, limit * 2) as any[];

  const memories: Memory[] = [];
  for (const row of rows) {
    const decayedStrength = calculateDecay(
      row.strength,
      new Date(row.last_accessed),
      row.memory_type
    );

    if (decayedStrength >= minStrength) {
      memories.push({
        id: row.id,
        phone: row.phone,
        content: row.content,
        memoryType: row.memory_type,
        strength: decayedStrength,
        importance: row.importance,
        createdAt: new Date(row.created_at),
        lastAccessed: new Date(row.last_accessed),
        accessCount: row.access_count,
        relatedMemories: JSON.parse(row.related_memories || "[]"),
        metadata: JSON.parse(row.metadata || "{}"),
        tags: JSON.parse(row.tags || "[]"),
      });
    }

    if (memories.length >= limit) break;
  }

  return memories;
}

/**
 * Get strongest memories for a phone (for context)
 */
export function getStrongestMemories(
  phone: string,
  limit: number = 10
): Memory[] {
  const rows = db.prepare(`
    SELECT * FROM mira_memories
    WHERE phone = ?
    ORDER BY strength * importance DESC
    LIMIT ?
  `).all(phone, limit * 2) as any[];

  const memories: Memory[] = [];
  for (const row of rows) {
    const decayedStrength = calculateDecay(
      row.strength,
      new Date(row.last_accessed),
      row.memory_type
    );

    const config = MEMORY_CONFIG[row.memory_type] || MEMORY_CONFIG.episodic;
    if (decayedStrength >= config.forgetThreshold) {
      memories.push({
        id: row.id,
        phone: row.phone,
        content: row.content,
        memoryType: row.memory_type,
        strength: decayedStrength,
        importance: row.importance,
        createdAt: new Date(row.created_at),
        lastAccessed: new Date(row.last_accessed),
        accessCount: row.access_count,
        relatedMemories: JSON.parse(row.related_memories || "[]"),
        metadata: JSON.parse(row.metadata || "{}"),
        tags: JSON.parse(row.tags || "[]"),
      });
    }

    if (memories.length >= limit) break;
  }

  return memories;
}

/**
 * Forget (delete) a memory
 */
export function forgetMemory(id: string): boolean {
  const result = db.prepare(`DELETE FROM mira_memories WHERE id = ?`).run(id);

  // Also delete any links
  db.prepare(`DELETE FROM mira_memory_links WHERE source_id = ? OR target_id = ?`).run(id, id);

  console.log(`[MIRA] Forgot memory: ${id}`);
  return result.changes > 0;
}

/**
 * Update memory importance
 */
export function updateImportance(id: string, importance: number): void {
  db.prepare(`
    UPDATE mira_memories SET importance = ? WHERE id = ?
  `).run(Math.min(1, Math.max(0, importance)), id);
}

// ============================================================================
// MEMORY LINKING
// ============================================================================

/**
 * Link two memories together
 */
export function linkMemories(
  sourceId: string,
  targetId: string,
  linkType: MemoryLink["linkType"] = "related",
  strength: number = 0.5
): void {
  db.prepare(`
    INSERT OR REPLACE INTO mira_memory_links (source_id, target_id, link_type, strength)
    VALUES (?, ?, ?, ?)
  `).run(sourceId, targetId, linkType, strength);
}

/**
 * Get linked memories
 */
export function getLinkedMemories(
  id: string,
  linkType?: string
): Array<{ memory: Memory; linkStrength: number; linkType: string }> {
  let sql = `
    SELECT m.*, ml.strength as link_strength, ml.link_type
    FROM mira_memory_links ml
    JOIN mira_memories m ON ml.target_id = m.id
    WHERE ml.source_id = ?
  `;
  const params: any[] = [id];

  if (linkType) {
    sql += ` AND ml.link_type = ?`;
    params.push(linkType);
  }

  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(row => ({
    memory: {
      id: row.id,
      phone: row.phone,
      content: row.content,
      memoryType: row.memory_type,
      strength: calculateDecay(row.strength, new Date(row.last_accessed), row.memory_type),
      importance: row.importance,
      createdAt: new Date(row.created_at),
      lastAccessed: new Date(row.last_accessed),
      accessCount: row.access_count,
      relatedMemories: JSON.parse(row.related_memories || "[]"),
      metadata: JSON.parse(row.metadata || "{}"),
      tags: JSON.parse(row.tags || "[]"),
    },
    linkStrength: row.link_strength,
    linkType: row.link_type,
  }));
}

// ============================================================================
// DOMAIN DOCUMENTS (Permanent)
// ============================================================================

/**
 * Create or update a domain document
 */
export function setDomainDoc(
  phone: string,
  title: string,
  content: string,
  docType?: string
): DomainDoc {
  const id = crypto.createHash("sha256").update(`${phone}:${title}`).digest("hex").slice(0, 32);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO mira_domaindocs (id, phone, title, content, doc_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET content = ?, updated_at = ?
  `).run(id, phone, title, content, docType || null, now, now, content, now);

  return {
    id,
    phone,
    title,
    content,
    docType,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

/**
 * Get domain documents for a phone
 */
export function getDomainDocs(phone: string): DomainDoc[] {
  const rows = db.prepare(`
    SELECT * FROM mira_domaindocs WHERE phone = ? ORDER BY updated_at DESC
  `).all(phone) as any[];

  return rows.map(row => ({
    id: row.id,
    phone: row.phone,
    title: row.title,
    content: row.content,
    docType: row.doc_type,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  }));
}

/**
 * Delete a domain document
 */
export function deleteDomainDoc(id: string): boolean {
  const result = db.prepare(`DELETE FROM mira_domaindocs WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================================================
// DECAY MAINTENANCE
// ============================================================================

/**
 * Run decay cycle - prune forgotten memories
 */
export function runDecayCycle(): { pruned: number; remaining: number } {
  const rows = db.prepare(`SELECT id, strength, last_accessed, memory_type FROM mira_memories`).all() as any[];

  let pruned = 0;
  for (const row of rows) {
    const decayedStrength = calculateDecay(
      row.strength,
      new Date(row.last_accessed),
      row.memory_type
    );

    const config = MEMORY_CONFIG[row.memory_type] || MEMORY_CONFIG.episodic;
    if (decayedStrength < config.forgetThreshold) {
      forgetMemory(row.id);
      pruned++;
    } else {
      // Update stored strength
      db.prepare(`UPDATE mira_memories SET strength = ? WHERE id = ?`).run(decayedStrength, row.id);
    }
  }

  const remaining = rows.length - pruned;
  console.log(`[MIRA] Decay cycle: pruned ${pruned} memories, ${remaining} remaining`);
  return { pruned, remaining };
}

/**
 * Get memory statistics for a phone
 */
export function getMemoryStats(phone: string): {
  total: number;
  byType: Record<string, number>;
  avgStrength: number;
  oldestMemory?: Date;
  newestMemory?: Date;
} {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(strength) as avg_strength,
      MIN(created_at) as oldest,
      MAX(created_at) as newest
    FROM mira_memories
    WHERE phone = ?
  `).get(phone) as any;

  const byType = db.prepare(`
    SELECT memory_type, COUNT(*) as count
    FROM mira_memories
    WHERE phone = ?
    GROUP BY memory_type
  `).all(phone) as any[];

  return {
    total: stats?.total || 0,
    byType: byType.reduce((acc, row) => ({ ...acc, [row.memory_type]: row.count }), {}),
    avgStrength: stats?.avg_strength || 0,
    oldestMemory: stats?.oldest ? new Date(stats.oldest) : undefined,
    newestMemory: stats?.newest ? new Date(stats.newest) : undefined,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // CRUD
  createMemory,
  getMemory,
  searchMemories,
  getRecentMemories,
  getStrongestMemories,
  forgetMemory,
  updateImportance,

  // Linking
  linkMemories,
  getLinkedMemories,

  // Domain docs
  setDomainDoc,
  getDomainDocs,
  deleteDomainDoc,

  // Maintenance
  runDecayCycle,
  getMemoryStats,

  // Utilities
  calculateDecay,
  boostStrength,
};
