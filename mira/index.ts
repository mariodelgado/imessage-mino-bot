/**
 * MIRA - Memory, Intelligence, Reasoning, Awareness
 *
 * A persistent AI entity with memory decay and self-directed tools.
 * This is the main entry point that ties together all MIRA subsystems.
 *
 * Core Philosophy:
 * - Single eternal thread: One conversation forever, not sessions
 * - Natural forgetting: Memories decay unless reinforced
 * - Self-directed: Tools activate and deactivate based on need
 * - Event-driven: Background processing mimics sleep cycles
 */

import memory from "./memory";
import workingMemory from "./working-memory";
import tools from "./tools";
import events from "./events";

// Re-export types
export type { Memory, MemoryLink, DomainDoc } from "./memory";
export type { WorkingMessage, WorkingContext } from "./working-memory";
export type { ToolDefinition, ToolState } from "./tools";
export type { MiraEvent, EventResult } from "./events";

// ============================================================================
// MIRA CNS (Central Nervous System) - Main Interface
// ============================================================================

export interface MiraContext {
  phone: string;
  memories: any[];
  workingMemory: any[];
  activeTools: any[];
  memoryContext: string;
  toolContext: string;
}

/**
 * Get full MIRA context for a conversation turn
 * This is the main entry point for integrating with the chat system
 */
export function getMiraContext(phone: string, userMessage?: string): MiraContext {
  // Auto-activate tools based on message content
  if (userMessage) {
    tools.autoActivateTools(phone, userMessage);
  }

  // Get working memory messages
  const workingMessages = workingMemory.getContextMessages(phone);

  // Get relevant long-term memories
  const recentMemories = memory.getRecentMemories(phone, 3);
  const strongMemories = memory.getStrongestMemories(phone, 3);

  // Search for message-specific memories
  let searchResults: any[] = [];
  if (userMessage) {
    searchResults = memory.searchMemories(phone, userMessage, { limit: 2 });
  }

  // Deduplicate memories
  const allMemories = [...recentMemories, ...strongMemories, ...searchResults];
  const uniqueMemories = allMemories.filter((m, i, arr) =>
    arr.findIndex(x => x.id === m.id) === i
  );

  // Get active tools
  const activeTools = tools.getActiveTools(phone);

  // Format contexts for injection
  const memoryContext = workingMemory.getMemoryContext(phone, userMessage);
  const toolContext = tools.formatToolsForContext(phone);

  return {
    phone,
    memories: uniqueMemories,
    workingMemory: workingMessages,
    activeTools,
    memoryContext,
    toolContext,
  };
}

/**
 * Process a user message through MIRA
 */
export function processUserMessage(
  phone: string,
  message: string,
  importance: number = 0.5
): {
  context: MiraContext;
  activated: any[];
  expired: string[];
} {
  // Add to working memory
  workingMemory.addMessage(phone, "user", message, importance);

  // Get context
  const context = getMiraContext(phone, message);

  // Auto-activate tools
  const activated = tools.autoActivateTools(phone, message);

  // Advance turn and expire old tools
  const expired = tools.advanceTurn(phone);

  return { context, activated, expired };
}

/**
 * Process an assistant response through MIRA
 */
export function processAssistantResponse(
  phone: string,
  response: string,
  toolsUsed?: string[]
): void {
  // Add to working memory
  workingMemory.addMessage(phone, "assistant", response);

  // Record tool usage
  if (toolsUsed) {
    for (const tool of toolsUsed) {
      tools.recordToolUse(phone, tool);
    }
  }
}

/**
 * Remember something important
 */
export function remember(
  phone: string,
  content: string,
  options?: {
    type?: "episodic" | "semantic" | "procedural";
    importance?: number;
    tags?: string[];
  }
): any {
  return memory.createMemory(phone, content, {
    memoryType: options?.type || "semantic",
    importance: options?.importance || 0.7,
    tags: options?.tags || [],
  });
}

/**
 * Forget something (explicit user request)
 */
export function forget(phone: string, memoryId: string): boolean {
  return memory.forgetMemory(memoryId);
}

/**
 * Search memories with a query
 */
export function recall(
  phone: string,
  query: string,
  limit: number = 5
): any[] {
  return memory.searchMemories(phone, query, { limit });
}

/**
 * Get formatted context string for injection into prompts
 */
export function getFormattedContext(phone: string, userMessage?: string): string {
  const context = getMiraContext(phone, userMessage);

  let formatted = "";

  // Add memory context
  if (context.memoryContext) {
    formatted += context.memoryContext + "\n\n";
  }

  // Add tool context
  if (context.toolContext) {
    formatted += context.toolContext + "\n\n";
  }

  // Add working memory summary
  if (context.workingMemory.length > 0) {
    formatted += `## Recent Conversation\n`;
    formatted += `(${context.workingMemory.length} messages in current segment)\n\n`;
  }

  return formatted;
}

/**
 * Get MIRA system status
 */
export function getStatus(phone?: string): {
  eventProcessor: any;
  sessions: number;
  memory?: any;
  tools?: any;
  working?: any;
} {
  const status: any = {
    eventProcessor: events.getEventProcessorStatus(),
    sessions: workingMemory.getActiveSessions().length,
  };

  if (phone) {
    status.memory = memory.getMemoryStats(phone);
    status.tools = tools.getToolStats(phone);
    status.working = workingMemory.getWorkingStats(phone);
  }

  return status;
}

// ============================================================================
// LIFECYCLE
// ============================================================================

let initialized = false;

/**
 * Initialize MIRA system
 */
export function initMira(): void {
  if (initialized) return;

  console.log("[MIRA] Initializing...");

  // Start background event processor
  events.startEventProcessor();

  initialized = true;
  console.log("[MIRA] Initialized successfully");
}

/**
 * Shutdown MIRA system
 */
export function shutdownMira(): void {
  if (!initialized) return;

  console.log("[MIRA] Shutting down...");

  // Collapse all active segments
  const sessions = workingMemory.getActiveSessions();
  for (const session of sessions) {
    workingMemory.collapseSegment(session.phone);
  }

  // Run final decay cycle
  memory.runDecayCycle();

  // Stop event processor
  events.stopEventProcessor();

  initialized = false;
  console.log("[MIRA] Shutdown complete");
}

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

// Memory functions
export const getRecentMemories = memory.getRecentMemories;
export const getStrongestMemories = memory.getStrongestMemories;
export const searchMemories = memory.searchMemories;
export const createMemory = memory.createMemory;
export const getMemoryStats = memory.getMemoryStats;
export const forgetMemory = memory.forgetMemory;
export const linkMemories = memory.linkMemories;
export const getLinkedMemories = memory.getLinkedMemories;
export const setDomainDoc = memory.setDomainDoc;
export const getDomainDocs = memory.getDomainDocs;
export const runDecayCycle = memory.runDecayCycle;

// Working memory functions
export const getWorkingContext = workingMemory.getWorkingContext;
export const addMessage = workingMemory.addMessage;
export const getContextMessages = workingMemory.getContextMessages;
export const collapseSegment = workingMemory.collapseSegment;
export const getMemoryContext = workingMemory.getMemoryContext;
export const clearWorkingMemory = workingMemory.clearWorkingMemory;
export const getWorkingStats = workingMemory.getWorkingStats;
export const markImportant = workingMemory.markImportant;
export const getActiveSessions = workingMemory.getActiveSessions;

// Tool functions
export const getActiveTools = tools.getActiveTools;
export const activateTool = tools.activateTool;
export const deactivateTool = tools.deactivateTool;
export const recordToolUse = tools.recordToolUse;
export const advanceTurn = tools.advanceTurn;
export const autoActivateTools = tools.autoActivateTools;
export const getSuggestedTools = tools.getSuggestedTools;
export const registerTool = tools.registerTool;
export const getAllTools = tools.getAllTools;
export const getToolStats = tools.getToolStats;
export const formatToolsForContext = tools.formatToolsForContext;

// Event functions
export const startEventProcessor = events.startEventProcessor;
export const stopEventProcessor = events.stopEventProcessor;
export const triggerEvent = events.triggerEvent;
export const forceSleepCycle = events.forceSleepCycle;
export const getEventProcessorStatus = events.getEventProcessorStatus;
export const registerEventHandler = events.registerEventHandler;

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Main interface
  getMiraContext,
  processUserMessage,
  processAssistantResponse,
  remember,
  forget,
  recall,
  getFormattedContext,
  getStatus,

  // Lifecycle
  initMira,
  shutdownMira,

  // Memory access (re-exported for convenience)
  getRecentMemories: memory.getRecentMemories,
  getStrongestMemories: memory.getStrongestMemories,
  searchMemories: memory.searchMemories,
  createMemory: memory.createMemory,
  getMemoryStats: memory.getMemoryStats,

  // Subsystems
  memory,
  workingMemory,
  tools,
  events,
};
