/**
 * Claude Code Bridge - L11 Engineering Edition
 *
 * Allows controlling Claude Code sessions via iMessage with:
 * - Full conversation context (last N turns, not just last message)
 * - Session health monitoring (idle time, message count)
 * - Smart session naming (git branch, active file, task context)
 * - Async streaming responses with progress updates
 * - Session state persistence for quick reconnection
 * - Conversation preview before sending
 */

import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CLAUDE_DIR = path.join(process.env.HOME || "", ".claude");
const HISTORY_FILE = path.join(CLAUDE_DIR, "history.jsonl");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

// Exclude bot's own directory to prevent recursion
const EXCLUDED_DIRS = [
  "/Users/marioelysian/imessage-mino-bot",
];

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface ClaudeSession {
  pid: number;
  cwd: string;
  tty: string;  // Terminal TTY (e.g., "ttys001")
  projectName: string;
  sessionId: string | null;

  // Enhanced metadata
  gitBranch: string | null;
  lastActiveFile: string | null;
  idleMinutes: number;

  // Conversation context
  lastMessage: string | null;
  lastResponse: string | null;
  lastTimestamp: number | null;
  messageCount: number;

  // Recent conversation for context
  recentTurns: ConversationTurn[];
}

export interface SendResult {
  success: boolean;
  output: string;
  streamedChunks?: string[];
  durationMs?: number;
}

// ============================================================================
// TMUX INTEGRATION
// ============================================================================

/**
 * Find the tmux pane that owns a given TTY.
 * Returns pane target (e.g., "0:0.1") or null if not in tmux.
 */
function findTmuxPaneForTty(tty: string): string | null {
  try {
    // List all tmux panes with their TTYs
    // Format: session:window.pane tty
    const output = execSync(
      "tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_tty}'",
      { encoding: "utf-8" }
    ).trim();

    if (!output) return null;

    const ttyPath = tty.startsWith("/dev/") ? tty : `/dev/${tty}`;

    for (const line of output.split("\n")) {
      const [paneTarget, paneTty] = line.split(" ");
      if (paneTty === ttyPath) {
        return paneTarget;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Send keystrokes to a tmux pane using send-keys.
 * This literally types into the terminal.
 */
export async function sendKeysToTmux(
  paneTarget: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Escape special characters for tmux send-keys
    // We use -l (literal) flag to avoid key name interpretation
    const escapedMessage = message.replace(/'/g, "'\\''");

    execSync(`tmux send-keys -t '${paneTarget}' -l '${escapedMessage}'`, {
      encoding: "utf-8",
    });

    // Send Enter key separately
    execSync(`tmux send-keys -t '${paneTarget}' Enter`, {
      encoding: "utf-8",
    });

    return { success: true, message: `Sent to tmux pane ${paneTarget}` };
  } catch (err) {
    return {
      success: false,
      message: `Failed to send to tmux: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Find ANY Claude process running in tmux.
 * Returns the first tmux pane found with Claude running.
 */
function findAnyClaudeInTmux(): string | null {
  try {
    const psOutput = execSync(
      "ps -eo pid,tty,command | grep 'claude' | grep -v grep",
      { encoding: "utf-8" }
    ).trim();

    if (!psOutput) return null;

    for (const line of psOutput.split("\n")) {
      const parts = line.trim().split(/\s+/);
      const tty = parts[1];

      if (tty && tty !== "??" && tty !== "?") {
        const pane = findTmuxPaneForTty(tty);
        if (pane) {
          return pane;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Inject message into a Claude session by literally typing into its tmux pane.
 * Returns immediately - response will appear in the terminal, not returned.
 * @param message - The message to type into the terminal
 * @param tty - Optional TTY to target a specific session (e.g., "ttys001")
 */
export async function injectToSessionLive(
  message: string,
  tty?: string
): Promise<SendResult> {
  // Find tmux pane - either by specific TTY or any Claude session
  let pane: string | null = null;

  if (tty) {
    pane = findTmuxPaneForTty(tty);
    if (!pane) {
      return {
        success: false,
        output: `Could not find tmux pane for TTY ${tty}. Is that session running in tmux?`,
      };
    }
  } else {
    pane = findAnyClaudeInTmux();
    if (!pane) {
      return {
        success: false,
        output: "Could not find tmux pane for this session. Is Claude running in tmux?",
      };
    }
  }

  console.log(`[Claude Bridge] Live injection to tmux pane ${pane}${tty ? ` (TTY: ${tty})` : ""}`);

  const result = await sendKeysToTmux(pane, message);

  if (result.success) {
    return {
      success: true,
      output: `✨ Typed into tmux pane ${pane}. Watch your terminal!`,
    };
  } else {
    return {
      success: false,
      output: result.message,
    };
  }
}

/**
 * Parse live injection command: @! message
 * The ! indicates "live" mode - types into terminal instead of spawning new process.
 * Finds any Claude in tmux automatically (no session ID needed).
 */
export function parseLiveInjection(text: string): {
  index?: number;
  message: string;
} | null {
  // @!N message - live tmux injection to session N
  // @! message - finds any Claude in tmux (first available)
  const match = text.match(/^@!(\d+)?\s+(.+)/si);
  if (match) {
    return {
      index: match[1] ? parseInt(match[1], 10) : undefined,
      message: match[2].trim(),
    };
  }
  return null;
}

// ============================================================================
// PROCESS DETECTION
// ============================================================================

function getClaudeProcesses(): Array<{ pid: number; cwd: string; tty: string; idleMinutes: number }> {
  try {
    // Use ps with elapsed time for idle detection
    const psOutput = execSync(
      "ps -eo pid,tty,etime,command | grep 'claude --dangerously' | grep -v grep",
      { encoding: "utf-8" }
    ).trim();

    if (!psOutput) return [];

    const processes: Array<{ pid: number; cwd: string; tty: string; idleMinutes: number }> = [];

    for (const line of psOutput.split("\n")) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[0], 10);
      const tty = parts[1];

      if (isNaN(pid)) continue;

      try {
        // Get working directory
        const lsofOutput = execSync(`lsof -p ${pid} 2>/dev/null | grep cwd || true`, {
          encoding: "utf-8",
        }).trim();

        if (lsofOutput) {
          const lsofParts = lsofOutput.split(/\s+/);
          const cwd = lsofParts[lsofParts.length - 1];

          if (cwd && cwd.startsWith("/") && !EXCLUDED_DIRS.includes(cwd)) {
            // Calculate idle time from process stat file modification
            let idleMinutes = 0;
            try {
              // Check the TTY device modification time for activity
              const ttyPath = `/dev/${tty}`;
              const stat = fs.statSync(ttyPath);
              idleMinutes = Math.floor((Date.now() - stat.mtimeMs) / 60000);
            } catch {
              idleMinutes = 0;
            }

            processes.push({ pid, cwd, tty, idleMinutes });
          }
        }
      } catch {
        // Process might have exited
      }
    }

    return processes;
  } catch {
    return [];
  }
}

// ============================================================================
// GIT & FILE CONTEXT
// ============================================================================

function getGitBranch(cwd: string): string | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
      cwd,
      encoding: "utf-8",
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

function getGitStatus(cwd: string): { modified: number; staged: number; untracked: number } | null {
  try {
    const status = execSync("git status --porcelain 2>/dev/null", {
      cwd,
      encoding: "utf-8",
    }).trim();

    if (!status) return { modified: 0, staged: 0, untracked: 0 };

    const lines = status.split("\n");
    return {
      modified: lines.filter(l => l.startsWith(" M") || l.startsWith("MM")).length,
      staged: lines.filter(l => l.startsWith("M ") || l.startsWith("A ")).length,
      untracked: lines.filter(l => l.startsWith("??")).length,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// CONVERSATION PARSING
// ============================================================================

function getProjectKey(projectPath: string): string {
  // Convert /Users/marioelysian/ux-labs to -Users-marioelysian-ux-labs
  // Note: Claude uses leading dash in project folder names
  return projectPath.replace(/\//g, "-");
}

function getSessionConversation(projectPath: string, sessionId: string, maxTurns: number = 5): ConversationTurn[] {
  try {
    const projectKey = getProjectKey(projectPath);
    const sessionFile = path.join(PROJECTS_DIR, projectKey, `${sessionId}.jsonl`);

    if (!fs.existsSync(sessionFile)) return [];

    const content = fs.readFileSync(sessionFile, "utf-8");
    const lines = content.trim().split("\n");
    const turns: ConversationTurn[] = [];

    // Parse from end for efficiency
    for (let i = lines.length - 1; i >= 0 && turns.length < maxTurns * 2; i--) {
      try {
        const entry = JSON.parse(lines[i]);

        if (entry.type === "user") {
          const msg = entry.message?.content;
          if (typeof msg === "string" && msg.trim() && !msg.startsWith("<")) {
            turns.unshift({
              role: "user",
              content: msg.slice(0, 200),
              timestamp: entry.timestamp,
            });
          }
        } else if (entry.type === "assistant") {
          const content = entry.message?.content;
          if (Array.isArray(content)) {
            const textBlock = content.find((c: any) => c.type === "text");
            if (textBlock?.text) {
              turns.unshift({
                role: "assistant",
                content: textBlock.text.slice(0, 200),
                timestamp: entry.timestamp,
              });
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Return only the last N complete turns (user + assistant pairs)
    const completeTurns: ConversationTurn[] = [];
    for (let i = 0; i < turns.length && completeTurns.length < maxTurns * 2; i++) {
      completeTurns.push(turns[i]);
    }

    return completeTurns.slice(-maxTurns * 2);
  } catch {
    return [];
  }
}

function getSessionInfo(projectPath: string): {
  sessionId: string;
  lastMessage: string;
  lastResponse: string | null;
  timestamp: number;
  messageCount: number;
} | null {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return null;

    const content = fs.readFileSync(HISTORY_FILE, "utf-8");
    const lines = content.trim().split("\n");

    let messageCount = 0;
    let lastEntry: any = null;

    // Count messages for this project and find the last one
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.project === projectPath) {
          messageCount++;
          if (!lastEntry) {
            lastEntry = entry;
          }
        }
      } catch {
        // Skip malformed
      }
    }

    if (!lastEntry) return null;

    // Get the last response from the session file
    let lastResponse: string | null = null;
    if (lastEntry.sessionId) {
      const turns = getSessionConversation(projectPath, lastEntry.sessionId, 1);
      const assistantTurn = turns.find(t => t.role === "assistant");
      if (assistantTurn) {
        lastResponse = assistantTurn.content;
      }
    }

    return {
      sessionId: lastEntry.sessionId,
      lastMessage: lastEntry.display,
      lastResponse,
      timestamp: lastEntry.timestamp,
      messageCount,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// SESSION LISTING
// ============================================================================

export function listSessions(): ClaudeSession[] {
  const processes = getClaudeProcesses();
  const sessions: ClaudeSession[] = [];
  const seenCwds = new Set<string>();

  for (const { pid, cwd, tty, idleMinutes } of processes) {
    // Deduplicate by cwd - only keep the first (most recently started) process per directory
    if (seenCwds.has(cwd)) {
      continue;
    }
    seenCwds.add(cwd);

    const sessionInfo = getSessionInfo(cwd);
    const projectName = path.basename(cwd) || cwd;
    const gitBranch = getGitBranch(cwd);

    // Get recent conversation turns for context
    const recentTurns = sessionInfo?.sessionId
      ? getSessionConversation(cwd, sessionInfo.sessionId, 3)
      : [];

    sessions.push({
      pid,
      cwd,
      tty,
      projectName: gitBranch ? `${projectName} (${gitBranch})` : projectName,
      sessionId: sessionInfo?.sessionId || null,
      gitBranch,
      lastActiveFile: null, // Could parse from conversation
      idleMinutes,
      lastMessage: sessionInfo?.lastMessage || null,
      lastResponse: sessionInfo?.lastResponse || null,
      lastTimestamp: sessionInfo?.timestamp || null,
      messageCount: sessionInfo?.messageCount || 0,
      recentTurns,
    });
  }

  // Sort by most recently active
  sessions.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

  return sessions;
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatIdleTime(minutes: number): string {
  if (minutes < 1) return "active";
  if (minutes < 60) return `${minutes}m idle`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h idle`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

export function formatSessionList(sessions: ClaudeSession[]): string {
  if (sessions.length === 0) {
    return "No active Claude Code sessions found.\n\nStart a session with `claude` in Terminal.";
  }

  let output = "🖥️ **Claude Code Sessions**\n\n";

  sessions.forEach((session, index) => {
    const num = index + 1;
    const idle = formatIdleTime(session.idleMinutes);
    const time = session.lastTimestamp ? formatTimestamp(session.lastTimestamp) : "";
    const msgCount = session.messageCount > 0 ? `${session.messageCount} msgs` : "";

    // Status indicator
    const status = session.idleMinutes < 5 ? "🟢" : session.idleMinutes < 30 ? "🟡" : "🔴";

    output += `${status} **@${num}** ${session.projectName}\n`;

    // Git status if available
    if (session.gitBranch) {
      const gitStatus = getGitStatus(session.cwd);
      if (gitStatus && (gitStatus.modified + gitStatus.staged > 0)) {
        output += `   📝 ${gitStatus.modified} modified, ${gitStatus.staged} staged\n`;
      }
    }

    // Last exchange
    if (session.lastMessage) {
      const lastMsg = session.lastMessage.slice(0, 50) + (session.lastMessage.length > 50 ? "..." : "");
      output += `   ↳ You: "${lastMsg}"\n`;
    }
    if (session.lastResponse) {
      const lastResp = session.lastResponse.slice(0, 50) + (session.lastResponse.length > 50 ? "..." : "");
      output += `   ↳ Claude: "${lastResp}"\n`;
    }

    // Metadata
    const meta = [idle, time, msgCount].filter(Boolean).join(" • ");
    if (meta) {
      output += `   ${meta}\n`;
    }

    output += "\n";
  });

  output += `**Commands:**\n`;
  output += `• @N <message> - Send to session N\n`;
  output += `• @N? - Preview session N's recent conversation\n`;
  output += `• /cc - Refresh this list`;

  return output;
}

export function formatSessionPreview(session: ClaudeSession): string {
  let output = `📋 **${session.projectName}** Preview\n\n`;

  if (session.recentTurns.length === 0) {
    output += "No recent conversation found.";
    return output;
  }

  output += "**Recent conversation:**\n\n";

  for (const turn of session.recentTurns) {
    const prefix = turn.role === "user" ? "👤" : "🤖";
    const content = turn.content.slice(0, 150) + (turn.content.length > 150 ? "..." : "");
    output += `${prefix} ${content}\n\n`;
  }

  return output;
}

// ============================================================================
// MESSAGE SENDING
// ============================================================================

export async function sendToSession(
  session: ClaudeSession,
  message: string,
  onProgress?: (chunk: string) => void
): Promise<SendResult> {
  return new Promise((resolve) => {
    if (!session.sessionId) {
      resolve({
        success: false,
        output: `Session ${session.projectName} has no session ID. Send a message in that terminal first.`,
      });
      return;
    }

    console.log(`[Claude Bridge] Sending to ${session.projectName} (${session.sessionId})`);
    const startTime = Date.now();

    const args = [
      "--resume", session.sessionId,
      "--print",
      "--dangerously-skip-permissions",
    ];

    let output = "";
    let errorOutput = "";
    const streamedChunks: string[] = [];

    const proc = spawn("claude", args, {
      cwd: session.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // Send the message
    proc.stdin.write(message);
    proc.stdin.end();

    // Stream stdout
    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      streamedChunks.push(chunk);

      // Progress callback for streaming updates
      if (onProgress && chunk.trim()) {
        onProgress(chunk);
      }
    });

    proc.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    // Timeout after 3 minutes
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        success: false,
        output: "Request timed out after 3 minutes. The session may be processing a complex task.",
        durationMs: Date.now() - startTime,
      });
    }, 180000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      if (code === 0) {
        resolve({
          success: true,
          output: output.trim() || "Command completed successfully.",
          streamedChunks,
          durationMs,
        });
      } else {
        resolve({
          success: false,
          output: errorOutput || output || `Process exited with code ${code}`,
          durationMs,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: `Failed to start Claude: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

/**
 * Send message directly to a session by ID, bypassing EXCLUDED_DIRS.
 * Used to inject messages into the current session (which is normally excluded).
 */
export async function sendToSessionDirect(
  sessionId: string,
  cwd: string,
  message: string,
  onProgress?: (chunk: string) => void
): Promise<SendResult> {
  return new Promise((resolve) => {
    console.log(`[Claude Bridge] Direct injection to ${sessionId} in ${cwd}`);
    const startTime = Date.now();

    const args = [
      "--resume", sessionId,
      "--print",
      "--dangerously-skip-permissions",
    ];

    let output = "";
    let errorOutput = "";
    const streamedChunks: string[] = [];

    const proc = spawn("claude", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    proc.stdin.write(message);
    proc.stdin.end();

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      streamedChunks.push(chunk);
      if (onProgress && chunk.trim()) {
        onProgress(chunk);
      }
    });

    proc.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        success: false,
        output: "Request timed out after 3 minutes.",
        durationMs: Date.now() - startTime,
      });
    }, 180000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      if (code === 0) {
        resolve({
          success: true,
          output: output.trim() || "Command completed successfully.",
          streamedChunks,
          durationMs,
        });
      } else {
        resolve({
          success: false,
          output: errorOutput || output || `Process exited with code ${code}`,
          durationMs,
        });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: `Failed to start Claude: ${err.message}`,
        durationMs: Date.now() - startTime,
      });
    });
  });
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse direct session injection: @@SESSION_ID message
 * Used to bypass EXCLUDED_DIRS and inject into current session.
 */
export function parseDirectInjection(text: string): {
  sessionId: string;
  message: string;
} | null {
  // @@UUID message - direct session injection
  const match = text.match(/^@@([a-f0-9-]{36})\s+(.+)/si);
  if (match) {
    return {
      sessionId: match[1],
      message: match[2].trim(),
    };
  }
  return null;
}

export function parseTargetedMessage(text: string): {
  index: number;
  message: string;
  isPreview: boolean;
} | null {
  // @N? for preview
  const previewMatch = text.match(/^@(\d+)\?$/);
  if (previewMatch) {
    return {
      index: parseInt(previewMatch[1], 10),
      message: "",
      isPreview: true,
    };
  }

  // @N message
  const messageMatch = text.match(/^@(\d+)\s+(.+)/s);
  if (messageMatch) {
    return {
      index: parseInt(messageMatch[1], 10),
      message: messageMatch[2].trim(),
      isPreview: false,
    };
  }

  return null;
}

// ============================================================================
// SESSION CACHE
// ============================================================================

let cachedSessions: ClaudeSession[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds (shorter for freshness)

export function getCachedSessions(forceRefresh = false): ClaudeSession[] {
  const now = Date.now();
  if (forceRefresh || now - cacheTimestamp > CACHE_TTL) {
    cachedSessions = listSessions();
    cacheTimestamp = now;
  }
  return cachedSessions;
}

export function getSessionByIndex(index: number): ClaudeSession | null {
  const sessions = getCachedSessions();
  if (index < 1 || index > sessions.length) {
    return null;
  }
  return sessions[index - 1];
}

// ============================================================================
// PROJECT DISCOVERY (for starting new sessions)
// ============================================================================

export interface AvailableProject {
  path: string;
  name: string;
  gitBranch: string | null;
  lastActivity: Date | null;
  messageCount: number;
  hasActiveSession: boolean;
}

/**
 * Convert Claude project folder name back to real path
 * -Users-marioelysian-ux-labs -> /Users/marioelysian/ux-labs
 * But preserve dashes in actual folder names like imessage-mino-bot
 */
function projectFolderToPath(folder: string): string | null {
  // Remove leading dash and split by dash
  const parts = folder.slice(1).split("-");

  // Try progressively joining parts to find the real path
  // Start from the beginning, accumulating path components
  let currentPath = "/";
  let result = "/";

  for (let i = 0; i < parts.length; i++) {
    // Try adding this part as a new directory
    const tryPath = path.join(currentPath, parts[i]);

    if (fs.existsSync(tryPath)) {
      currentPath = tryPath;
      result = tryPath;
    } else {
      // Try joining with previous as a hyphenated name
      // e.g., "imessage-mino-bot" instead of "imessage/mino/bot"
      let found = false;
      for (let j = i + 1; j <= parts.length; j++) {
        const hyphenated = parts.slice(i, j).join("-");
        const tryHyphenPath = path.join(currentPath, hyphenated);
        if (fs.existsSync(tryHyphenPath)) {
          currentPath = tryHyphenPath;
          result = tryHyphenPath;
          i = j - 1; // Skip the parts we just consumed
          found = true;
          break;
        }
      }
      if (!found) {
        // If nothing works, try just appending hyphenated rest
        const rest = parts.slice(i).join("-");
        const tryRest = path.join(currentPath, rest);
        if (fs.existsSync(tryRest)) {
          return tryRest;
        }
        // Give up - path doesn't exist
        return null;
      }
    }
  }

  return result;
}

/**
 * Get all known projects from Claude's history
 */
export function getAvailableProjects(): AvailableProject[] {
  const projects = new Map<string, AvailableProject>();

  try {
    // Scan ~/.claude/projects/ for known project folders
    const projectsDir = path.join(CLAUDE_DIR, "projects");
    const folders = fs.readdirSync(projectsDir).filter(f => {
      const stat = fs.statSync(path.join(projectsDir, f));
      return stat.isDirectory() && f.startsWith("-");
    });

    // Get currently active sessions to mark them
    const activeSessions = getCachedSessions();
    const activeProjects = new Set(activeSessions.map(s => s.cwd));

    for (const folder of folders) {
      // Convert folder name back to real path
      const projectPath = projectFolderToPath(folder);
      if (!projectPath) continue;

      // Skip excluded dirs
      if (EXCLUDED_DIRS.includes(projectPath)) continue;

      const name = path.basename(projectPath);
      const gitBranch = getGitBranch(projectPath);

      // Count messages and find last activity from session files
      let messageCount = 0;
      let lastActivity: Date | null = null;

      const projectDir = path.join(projectsDir, folder);
      try {
        const sessionFiles = fs.readdirSync(projectDir).filter(f => f.endsWith(".jsonl"));
        messageCount = sessionFiles.length;

        // Get most recent session file modification time
        for (const sf of sessionFiles) {
          const stat = fs.statSync(path.join(projectDir, sf));
          if (!lastActivity || stat.mtime > lastActivity) {
            lastActivity = stat.mtime;
          }
        }
      } catch {
        // Ignore errors reading session files
      }

      projects.set(projectPath, {
        path: projectPath,
        name: gitBranch ? `${name} (${gitBranch})` : name,
        gitBranch,
        lastActivity,
        messageCount,
        hasActiveSession: activeProjects.has(projectPath),
      });
    }
  } catch (e) {
    console.error("[Claude Bridge] Error scanning projects:", e);
  }

  // Sort by last activity (most recent first), then by name
  return Array.from(projects.values()).sort((a, b) => {
    // Active sessions first
    if (a.hasActiveSession && !b.hasActiveSession) return -1;
    if (!a.hasActiveSession && b.hasActiveSession) return 1;
    // Then by last activity
    if (a.lastActivity && b.lastActivity) {
      return b.lastActivity.getTime() - a.lastActivity.getTime();
    }
    if (a.lastActivity) return -1;
    if (b.lastActivity) return 1;
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });
}

/**
 * Format the list of available projects for starting new sessions
 */
export function formatProjectList(projects: AvailableProject[]): string {
  if (projects.length === 0) {
    return "No known projects found.\n\nStart a Claude session manually first to register projects.";
  }

  let output = "📁 **Available Projects**\n\n";

  projects.forEach((project, index) => {
    const num = index + 1;
    const status = project.hasActiveSession ? "🟢" : "⚫";
    const activity = project.lastActivity
      ? formatTimestamp(project.lastActivity.getTime())
      : "never";

    output += `${status} **#${num}** ${project.name}\n`;
    output += `   📍 ${project.path}\n`;
    output += `   ${project.hasActiveSession ? "Active session" : `Last: ${activity}`}`;
    if (project.messageCount > 0) {
      output += ` • ${project.messageCount} sessions`;
    }
    output += "\n\n";
  });

  output += `**Commands:**\n`;
  output += `• #N - Start new session in project N\n`;
  output += `• #N <message> - Start session with initial message\n`;
  output += `• /cc - Back to active sessions`;

  return output;
}

/**
 * Start a new Claude Code session in Terminal
 */
export async function startNewSession(
  projectPath: string,
  initialMessage?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate path exists
    if (!fs.existsSync(projectPath)) {
      return { success: false, message: `Project path not found: ${projectPath}` };
    }

    // Build the AppleScript to open Terminal with claude
    const escapedPath = projectPath.replace(/'/g, "'\\''");
    const claudeCmd = initialMessage
      ? `echo '${initialMessage.replace(/'/g, "'\\''")}' | claude --dangerously-skip-permissions`
      : `claude --dangerously-skip-permissions`;

    const appleScript = `
      tell application "Terminal"
        activate
        do script "cd '${escapedPath}' && ${claudeCmd}"
      end tell
    `;

    execSync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
    });

    // Clear cache so next /cc picks up the new session
    cacheTimestamp = 0;

    return {
      success: true,
      message: `Started new Claude session in ${path.basename(projectPath)}`,
    };
  } catch (e) {
    return {
      success: false,
      message: `Failed to start session: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Parse project selection command (#N or #N message)
 */
export function parseProjectSelection(text: string): {
  index: number;
  message: string | null;
} | null {
  // #N message (optional message)
  const match = text.match(/^#(\d+)(?:\s+(.+))?$/s);
  if (match) {
    return {
      index: parseInt(match[1], 10),
      message: match[2]?.trim() || null,
    };
  }
  return null;
}

// Project cache
let cachedProjects: AvailableProject[] = [];
let projectCacheTimestamp = 0;
const PROJECT_CACHE_TTL = 60000; // 1 minute

export function getCachedProjects(forceRefresh = false): AvailableProject[] {
  const now = Date.now();
  if (forceRefresh || now - projectCacheTimestamp > PROJECT_CACHE_TTL) {
    cachedProjects = getAvailableProjects();
    projectCacheTimestamp = now;
  }
  return cachedProjects;
}

export function getProjectByIndex(index: number): AvailableProject | null {
  const projects = getCachedProjects();
  if (index < 1 || index > projects.length) {
    return null;
  }
  return projects[index - 1];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  listSessions,
  formatSessionList,
  formatSessionPreview,
  sendToSession,
  sendToSessionDirect,
  parseTargetedMessage,
  parseDirectInjection,
  getCachedSessions,
  getSessionByIndex,
  // New session management
  getAvailableProjects,
  formatProjectList,
  startNewSession,
  parseProjectSelection,
  getCachedProjects,
  getProjectByIndex,
  // Live tmux injection
  parseLiveInjection,
  injectToSessionLive,
  sendKeysToTmux,
};
