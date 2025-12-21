/**
 * MIRA Self-Directed Tool Manager
 *
 * Tools auto-register when needed and expire when unused.
 * This keeps the context window lean by only including
 * relevant tools.
 *
 * Key concepts:
 * - On-demand activation: Tools activate when context suggests need
 * - TTL expiry: Unused tools automatically deactivate
 * - Usage tracking: Learn which tools are frequently used together
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "bot.db");
const db = new Database(DB_PATH);

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_TTL = 5; // Tool expires after 5 turns of non-use
const MAX_ACTIVE_TOOLS = 5; // Maximum active tools per user

// ============================================================================
// SCHEMA
// ============================================================================

db.exec(`
  -- Tool state tracking
  CREATE TABLE IF NOT EXISTS mira_tool_state (
    tool_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    last_used TEXT,
    use_count INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 0,
    turns_since_use INTEGER DEFAULT 0,
    total_uses INTEGER DEFAULT 0,
    avg_session_uses REAL DEFAULT 0,
    metadata JSON DEFAULT '{}',
    PRIMARY KEY (tool_name, phone)
  );

  -- Tool co-occurrence (which tools are used together)
  CREATE TABLE IF NOT EXISTS mira_tool_cooccurrence (
    tool_a TEXT NOT NULL,
    tool_b TEXT NOT NULL,
    phone TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    PRIMARY KEY (tool_a, tool_b, phone)
  );

  CREATE INDEX IF NOT EXISTS idx_tool_state_phone ON mira_tool_state(phone);
  CREATE INDEX IF NOT EXISTS idx_tool_state_enabled ON mira_tool_state(enabled);
`);

// ============================================================================
// TYPES
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  triggers: string[]; // Keywords/patterns that suggest this tool is needed
  category: "browser" | "ios" | "data" | "utility" | "external";
  alwaysActive?: boolean; // Some tools are always available
  schema?: Record<string, unknown>; // Tool parameter schema
}

export interface ToolState {
  name: string;
  phone: string;
  lastUsed?: Date;
  useCount: number;
  enabled: boolean;
  turnsSinceUse: number;
  totalUses: number;
  avgSessionUses: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

const toolRegistry = new Map<string, ToolDefinition>();

// Built-in tools
const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: "mino_browser",
    description: "Browse websites and extract information",
    triggers: ["website", "browse", "check", "look up", "find on", "menu", "price", "availability"],
    category: "browser",
    alwaysActive: true, // Core functionality
  },
  {
    name: "voice_message",
    description: "Send a voice message",
    triggers: ["voice", "speak", "say", "read aloud", "audio"],
    category: "ios",
  },
  {
    name: "location_card",
    description: "Send a location/map card",
    triggers: ["location", "address", "directions", "map", "where is", "how to get"],
    category: "ios",
  },
  {
    name: "calendar_event",
    description: "Create a calendar event",
    triggers: ["calendar", "schedule", "appointment", "meeting", "reminder", "event"],
    category: "ios",
  },
  {
    name: "homekit",
    description: "Control HomeKit scenes",
    triggers: ["homekit", "lights", "home", "scene", "smart home"],
    category: "ios",
  },
  {
    name: "alert_monitor",
    description: "Set up recurring monitoring alerts",
    triggers: ["alert", "notify", "monitor", "watch", "check for", "let me know"],
    category: "utility",
  },
  {
    name: "weather",
    description: "Get weather information",
    triggers: ["weather", "temperature", "rain", "sunny", "forecast", "cold", "hot"],
    category: "external",
  },
  {
    name: "maps",
    description: "Get directions and distance",
    triggers: ["directions", "route", "how far", "drive to", "walk to", "distance"],
    category: "external",
  },
];

// Register built-in tools
for (const tool of BUILTIN_TOOLS) {
  toolRegistry.set(tool.name, tool);
}

// ============================================================================
// TOOL STATE MANAGEMENT
// ============================================================================

/**
 * Get tool state for a phone
 */
export function getToolState(phone: string, toolName: string): ToolState | null {
  const row = db.prepare(`
    SELECT * FROM mira_tool_state WHERE phone = ? AND tool_name = ?
  `).get(phone, toolName) as any;

  if (!row) return null;

  return {
    name: row.tool_name,
    phone: row.phone,
    lastUsed: row.last_used ? new Date(row.last_used) : undefined,
    useCount: row.use_count,
    enabled: row.enabled === 1,
    turnsSinceUse: row.turns_since_use,
    totalUses: row.total_uses,
    avgSessionUses: row.avg_session_uses,
    metadata: JSON.parse(row.metadata || "{}"),
  };
}

/**
 * Get all active tools for a phone
 */
export function getActiveTools(phone: string): ToolDefinition[] {
  const rows = db.prepare(`
    SELECT tool_name FROM mira_tool_state
    WHERE phone = ? AND enabled = 1
    ORDER BY use_count DESC
  `).all(phone) as any[];

  const activeTools: ToolDefinition[] = [];

  // Always include always-active tools
  for (const [name, def] of toolRegistry) {
    if (def.alwaysActive) {
      activeTools.push(def);
    }
  }

  // Add user-activated tools
  for (const row of rows) {
    const def = toolRegistry.get(row.tool_name);
    if (def && !def.alwaysActive) {
      activeTools.push(def);
    }
  }

  return activeTools.slice(0, MAX_ACTIVE_TOOLS);
}

/**
 * Activate a tool for a phone
 */
export function activateTool(phone: string, toolName: string): boolean {
  const def = toolRegistry.get(toolName);
  if (!def) return false;

  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO mira_tool_state (tool_name, phone, last_used, use_count, enabled, turns_since_use)
    VALUES (?, ?, ?, 1, 1, 0)
    ON CONFLICT(tool_name, phone) DO UPDATE SET
      enabled = 1,
      last_used = ?,
      use_count = use_count + 1,
      turns_since_use = 0
  `).run(toolName, phone, now, now);

  console.log(`[MIRA Tools] Activated ${toolName} for ${phone}`);
  return true;
}

/**
 * Record tool usage
 */
export function recordToolUse(phone: string, toolName: string): void {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO mira_tool_state (tool_name, phone, last_used, use_count, enabled, turns_since_use, total_uses)
    VALUES (?, ?, ?, 1, 1, 0, 1)
    ON CONFLICT(tool_name, phone) DO UPDATE SET
      last_used = ?,
      use_count = use_count + 1,
      turns_since_use = 0,
      total_uses = total_uses + 1
  `).run(toolName, phone, now, now);

  // Track co-occurrence with other active tools
  const activeTools = getActiveTools(phone);
  for (const tool of activeTools) {
    if (tool.name !== toolName) {
      recordCooccurrence(phone, toolName, tool.name);
    }
  }
}

/**
 * Record that two tools were used together
 */
function recordCooccurrence(phone: string, toolA: string, toolB: string): void {
  // Normalize order for consistency
  const [first, second] = [toolA, toolB].sort();

  db.prepare(`
    INSERT INTO mira_tool_cooccurrence (tool_a, tool_b, phone, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(tool_a, tool_b, phone) DO UPDATE SET count = count + 1
  `).run(first, second, phone);
}

/**
 * Deactivate a tool
 */
export function deactivateTool(phone: string, toolName: string): boolean {
  const def = toolRegistry.get(toolName);
  if (def?.alwaysActive) return false; // Can't deactivate always-active tools

  const result = db.prepare(`
    UPDATE mira_tool_state SET enabled = 0 WHERE phone = ? AND tool_name = ?
  `).run(phone, toolName);

  if (result.changes > 0) {
    console.log(`[MIRA Tools] Deactivated ${toolName} for ${phone}`);
    return true;
  }
  return false;
}

/**
 * Increment turn counter and deactivate expired tools
 */
export function advanceTurn(phone: string): string[] {
  // Increment turns_since_use for all active tools
  db.prepare(`
    UPDATE mira_tool_state
    SET turns_since_use = turns_since_use + 1
    WHERE phone = ? AND enabled = 1
  `).run(phone);

  // Deactivate tools that exceeded TTL
  const expired = db.prepare(`
    SELECT tool_name FROM mira_tool_state
    WHERE phone = ? AND enabled = 1 AND turns_since_use > ?
  `).all(phone, DEFAULT_TTL) as any[];

  const deactivated: string[] = [];
  for (const row of expired) {
    const def = toolRegistry.get(row.tool_name);
    if (!def?.alwaysActive) {
      deactivateTool(phone, row.tool_name);
      deactivated.push(row.tool_name);
    }
  }

  return deactivated;
}

/**
 * Deactivate all expired tools across all phones
 */
export function deactivateExpiredTools(): number {
  const expired = db.prepare(`
    SELECT tool_name, phone FROM mira_tool_state
    WHERE enabled = 1 AND turns_since_use > ?
  `).all(DEFAULT_TTL) as any[];

  let count = 0;
  for (const row of expired) {
    const def = toolRegistry.get(row.tool_name);
    if (!def?.alwaysActive) {
      deactivateTool(row.phone, row.tool_name);
      count++;
    }
  }

  return count;
}

// ============================================================================
// TOOL DETECTION
// ============================================================================

/**
 * Detect which tools might be needed based on user input
 */
export function detectNeededTools(input: string): ToolDefinition[] {
  const inputLower = input.toLowerCase();
  const needed: ToolDefinition[] = [];

  for (const [name, def] of toolRegistry) {
    if (def.alwaysActive) continue;

    const matchesAnyTrigger = def.triggers.some(trigger =>
      inputLower.includes(trigger.toLowerCase())
    );

    if (matchesAnyTrigger) {
      needed.push(def);
    }
  }

  return needed;
}

/**
 * Auto-activate tools based on user input
 */
export function autoActivateTools(phone: string, input: string): ToolDefinition[] {
  const needed = detectNeededTools(input);
  const activated: ToolDefinition[] = [];

  for (const tool of needed) {
    const wasActive = getToolState(phone, tool.name)?.enabled;
    activateTool(phone, tool.name);
    if (!wasActive) {
      activated.push(tool);
    }
  }

  return activated;
}

/**
 * Get suggested tools based on co-occurrence patterns
 */
export function getSuggestedTools(phone: string, currentTool: string): string[] {
  const rows = db.prepare(`
    SELECT
      CASE WHEN tool_a = ? THEN tool_b ELSE tool_a END as related_tool,
      count
    FROM mira_tool_cooccurrence
    WHERE phone = ? AND (tool_a = ? OR tool_b = ?)
    ORDER BY count DESC
    LIMIT 3
  `).all(currentTool, phone, currentTool, currentTool) as any[];

  return rows.map(r => r.related_tool);
}

// ============================================================================
// TOOL REGISTRY MANAGEMENT
// ============================================================================

/**
 * Register a new tool
 */
export function registerTool(tool: ToolDefinition): void {
  toolRegistry.set(tool.name, tool);
  console.log(`[MIRA Tools] Registered tool: ${tool.name}`);
}

/**
 * Unregister a tool
 */
export function unregisterTool(name: string): boolean {
  return toolRegistry.delete(name);
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolDefinition[] {
  return [...toolRegistry.values()];
}

/**
 * Get tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get tool usage statistics for a phone
 */
export function getToolStats(phone: string): {
  active: number;
  totalUses: number;
  mostUsed: string[];
  recentlyUsed: string[];
} {
  const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM mira_tool_state WHERE phone = ? AND enabled = 1
  `).get(phone) as { count: number };

  const totalUses = db.prepare(`
    SELECT SUM(total_uses) as total FROM mira_tool_state WHERE phone = ?
  `).get(phone) as { total: number | null };

  const mostUsed = db.prepare(`
    SELECT tool_name FROM mira_tool_state WHERE phone = ?
    ORDER BY total_uses DESC LIMIT 5
  `).all(phone) as any[];

  const recentlyUsed = db.prepare(`
    SELECT tool_name FROM mira_tool_state WHERE phone = ?
    ORDER BY last_used DESC LIMIT 5
  `).all(phone) as any[];

  return {
    active: activeCount?.count || 0,
    totalUses: totalUses?.total || 0,
    mostUsed: mostUsed.map(r => r.tool_name),
    recentlyUsed: recentlyUsed.map(r => r.tool_name),
  };
}

/**
 * Format active tools for context injection
 */
export function formatToolsForContext(phone: string): string {
  const activeTools = getActiveTools(phone);

  if (activeTools.length === 0) {
    return "";
  }

  let context = "## Available Tools\n";
  for (const tool of activeTools) {
    context += `- **${tool.name}**: ${tool.description}\n`;
  }

  return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // State management
  getToolState,
  getActiveTools,
  activateTool,
  deactivateTool,
  recordToolUse,
  advanceTurn,
  deactivateExpiredTools,

  // Detection
  detectNeededTools,
  autoActivateTools,
  getSuggestedTools,

  // Registry
  registerTool,
  unregisterTool,
  getAllTools,
  getTool,

  // Statistics
  getToolStats,
  formatToolsForContext,
};
