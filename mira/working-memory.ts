/**
 * MIRA Working Memory System
 *
 * Manages short-term context and session state.
 * Unlike long-term memory, working memory doesn't persist across sessions
 * but provides the immediate context window for conversations.
 *
 * Key concepts:
 * - Segments: Chunks of conversation that collapse after idle
 * - Context window: Limited attention span
 * - Relevance scoring: What's most important right now
 */

import memory, { Memory, createMemory } from "./memory";

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_CONTEXT_TOKENS = 8000; // Approximate token limit for context
const MAX_MESSAGES = 50; // Max messages in working memory
const SEGMENT_IDLE_TIMEOUT = 120 * 60 * 1000; // 2 hours of idle = segment collapse
const CONTEXT_RECENCY_WEIGHT = 0.4; // How much to weight recent messages
const CONTEXT_RELEVANCE_WEIGHT = 0.6; // How much to weight relevance

// ============================================================================
// TYPES
// ============================================================================

export interface WorkingMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  importance: number; // 0-1
  tokens: number; // Estimated token count
  metadata?: Record<string, unknown>;
}

export interface Segment {
  id: string;
  messages: WorkingMessage[];
  startTime: Date;
  endTime?: Date;
  topic?: string;
  summary?: string;
  consolidated: boolean;
}

export interface WorkingContext {
  phone: string;
  currentSegment: Segment;
  recentMemories: Memory[];
  activeTools: string[];
  lastActivity: Date;
  sessionStart: Date;
  messageCount: number;
}

// ============================================================================
// IN-MEMORY STATE
// ============================================================================

const workingContexts = new Map<string, WorkingContext>();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Generate a unique segment ID
 */
function generateSegmentId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract topic from messages (simple heuristic)
 */
function extractTopic(messages: WorkingMessage[]): string {
  const userMessages = messages.filter(m => m.role === "user").map(m => m.content);
  if (userMessages.length === 0) return "general";

  // Look for key phrases
  const combined = userMessages.join(" ").toLowerCase();

  const topicPatterns: Record<string, RegExp> = {
    coffee: /coffee|philz|starbucks|cafe|latte|espresso/,
    food: /food|restaurant|eat|dinner|lunch|breakfast|menu/,
    weather: /weather|temperature|rain|sunny|forecast/,
    shopping: /price|buy|shop|order|deal|sale/,
    travel: /travel|flight|hotel|trip|vacation|book/,
    work: /meeting|schedule|calendar|work|office|email/,
    alerts: /alert|notify|remind|monitor|check/,
  };

  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(combined)) return topic;
  }

  return "general";
}

/**
 * Score message relevance to current context
 */
function scoreRelevance(
  message: WorkingMessage,
  currentTopic: string,
  recentMessages: WorkingMessage[]
): number {
  let score = message.importance;

  // Boost if matches current topic
  if (extractTopic([message]) === currentTopic) {
    score += 0.2;
  }

  // Boost recent messages
  const recency = 1 - (Date.now() - message.timestamp.getTime()) / (60 * 60 * 1000);
  score += Math.max(0, recency) * 0.3;

  return Math.min(1, score);
}

// ============================================================================
// WORKING MEMORY MANAGEMENT
// ============================================================================

/**
 * Get or create working context for a phone
 */
export function getWorkingContext(phone: string): WorkingContext {
  let context = workingContexts.get(phone);

  if (!context) {
    context = {
      phone,
      currentSegment: {
        id: generateSegmentId(),
        messages: [],
        startTime: new Date(),
        consolidated: false,
      },
      recentMemories: memory.getRecentMemories(phone, 5),
      activeTools: [],
      lastActivity: new Date(),
      sessionStart: new Date(),
      messageCount: 0,
    };
    workingContexts.set(phone, context);
  }

  return context;
}

/**
 * Add a message to working memory
 */
export function addMessage(
  phone: string,
  role: "user" | "assistant" | "system",
  content: string,
  importance: number = 0.5,
  metadata?: Record<string, unknown>
): WorkingMessage {
  const context = getWorkingContext(phone);

  // Check if segment should collapse (too much idle time)
  const idleTime = Date.now() - context.lastActivity.getTime();
  if (idleTime > SEGMENT_IDLE_TIMEOUT && context.currentSegment.messages.length > 0) {
    collapseSegment(phone);
  }

  const message: WorkingMessage = {
    role,
    content,
    timestamp: new Date(),
    importance,
    tokens: estimateTokens(content),
    metadata,
  };

  context.currentSegment.messages.push(message);
  context.lastActivity = new Date();
  context.messageCount++;

  // Trim if too many messages
  while (context.currentSegment.messages.length > MAX_MESSAGES) {
    const removed = context.currentSegment.messages.shift();
    // Maybe convert to long-term memory if important
    if (removed && removed.importance > 0.7) {
      createMemory(phone, removed.content, {
        memoryType: "episodic",
        importance: removed.importance,
        metadata: { ...removed.metadata, source: "working_memory_overflow" },
      });
    }
  }

  return message;
}

/**
 * Get messages optimized for context window
 */
export function getContextMessages(
  phone: string,
  maxTokens: number = MAX_CONTEXT_TOKENS
): WorkingMessage[] {
  const context = getWorkingContext(phone);
  const messages = context.currentSegment.messages;
  const topic = extractTopic(messages);

  // Score all messages
  const scoredMessages = messages.map(msg => ({
    message: msg,
    score: scoreRelevance(msg, topic, messages),
  }));

  // Build context respecting token limit
  const result: WorkingMessage[] = [];
  let totalTokens = 0;

  // Always include recent messages first (most recent)
  const recentCount = Math.min(10, messages.length);
  for (let i = messages.length - 1; i >= messages.length - recentCount && i >= 0; i--) {
    const msg = messages[i];
    if (totalTokens + msg.tokens <= maxTokens) {
      result.unshift(msg);
      totalTokens += msg.tokens;
    }
  }

  // Fill remaining with highest scored older messages
  const olderScored = scoredMessages
    .slice(0, -recentCount)
    .sort((a, b) => b.score - a.score);

  for (const { message } of olderScored) {
    if (totalTokens + message.tokens <= maxTokens) {
      result.unshift(message);
      totalTokens += message.tokens;
    }
  }

  // Sort by timestamp
  result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return result;
}

/**
 * Collapse current segment into long-term memory
 */
export function collapseSegment(phone: string): void {
  const context = getWorkingContext(phone);
  const segment = context.currentSegment;

  if (segment.messages.length === 0 || segment.consolidated) {
    return;
  }

  // Generate summary of the segment
  const topic = extractTopic(segment.messages);
  const messageCount = segment.messages.length;
  const userMessages = segment.messages.filter(m => m.role === "user");
  const duration = Math.round((Date.now() - segment.startTime.getTime()) / 60000);

  // Create a semantic memory summarizing the conversation
  const summaryContent = `Conversation about ${topic}: ${messageCount} messages over ${duration} minutes. ` +
    `User asked about: ${userMessages.slice(0, 3).map(m => m.content.slice(0, 50)).join("; ")}`;

  createMemory(phone, summaryContent, {
    memoryType: "semantic",
    importance: 0.6,
    tags: [topic, "conversation_summary"],
    metadata: {
      segmentId: segment.id,
      messageCount,
      duration,
      startTime: segment.startTime.toISOString(),
    },
  });

  // Store important individual messages as episodic memories
  for (const msg of segment.messages) {
    if (msg.importance > 0.7 && msg.role === "user") {
      createMemory(phone, msg.content, {
        memoryType: "episodic",
        importance: msg.importance,
        tags: [topic],
        metadata: { timestamp: msg.timestamp.toISOString() },
      });
    }
  }

  // Mark segment as consolidated
  segment.consolidated = true;
  segment.endTime = new Date();
  segment.topic = topic;
  segment.summary = summaryContent;

  // Start new segment
  context.currentSegment = {
    id: generateSegmentId(),
    messages: [],
    startTime: new Date(),
    consolidated: false,
  };

  console.log(`[MIRA] Collapsed segment ${segment.id}: ${messageCount} messages about ${topic}`);
}

/**
 * Inject relevant long-term memories into context
 */
export function getMemoryContext(phone: string, query?: string): string {
  const context = getWorkingContext(phone);

  // Refresh recent memories
  context.recentMemories = memory.getRecentMemories(phone, 5);

  // Also search for query-relevant memories
  let relevantMemories: Memory[] = [];
  if (query) {
    relevantMemories = memory.searchMemories(phone, query, { limit: 3 });
  }

  // Get strongest memories
  const strongMemories = memory.getStrongestMemories(phone, 3);

  // Combine and deduplicate
  const allMemories = [...context.recentMemories, ...relevantMemories, ...strongMemories];
  const uniqueMemories = allMemories.filter((m, i, arr) =>
    arr.findIndex(x => x.id === m.id) === i
  ).slice(0, 8);

  if (uniqueMemories.length === 0) {
    return "";
  }

  // Format for context injection
  let memoryContext = "## Relevant Memories\n";
  for (const mem of uniqueMemories) {
    const age = Math.round((Date.now() - mem.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const ageStr = age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;
    memoryContext += `- [${mem.memoryType}] (${ageStr}, strength: ${mem.strength.toFixed(2)}): ${mem.content}\n`;
  }

  return memoryContext;
}

/**
 * Clear working memory for a phone
 */
export function clearWorkingMemory(phone: string): void {
  const context = workingContexts.get(phone);

  if (context && context.currentSegment.messages.length > 0) {
    collapseSegment(phone);
  }

  workingContexts.delete(phone);
  console.log(`[MIRA] Cleared working memory for ${phone}`);
}

/**
 * Get working memory statistics
 */
export function getWorkingStats(phone: string): {
  messageCount: number;
  tokenCount: number;
  segmentAge: number;
  idleTime: number;
  topic: string;
} {
  const context = getWorkingContext(phone);
  const messages = context.currentSegment.messages;

  return {
    messageCount: messages.length,
    tokenCount: messages.reduce((sum, m) => sum + m.tokens, 0),
    segmentAge: Date.now() - context.currentSegment.startTime.getTime(),
    idleTime: Date.now() - context.lastActivity.getTime(),
    topic: extractTopic(messages),
  };
}

/**
 * Mark a message as important (boosts chance of long-term storage)
 */
export function markImportant(
  phone: string,
  messageIndex: number,
  importance: number = 0.9
): void {
  const context = getWorkingContext(phone);
  if (messageIndex >= 0 && messageIndex < context.currentSegment.messages.length) {
    context.currentSegment.messages[messageIndex].importance = importance;
  }
}

/**
 * Get all active sessions (for admin/debugging)
 */
export function getActiveSessions(): Array<{
  phone: string;
  messageCount: number;
  lastActivity: Date;
  topic: string;
}> {
  const sessions: Array<{
    phone: string;
    messageCount: number;
    lastActivity: Date;
    topic: string;
  }> = [];

  for (const [phone, context] of workingContexts) {
    sessions.push({
      phone,
      messageCount: context.currentSegment.messages.length,
      lastActivity: context.lastActivity,
      topic: extractTopic(context.currentSegment.messages),
    });
  }

  return sessions;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getWorkingContext,
  addMessage,
  getContextMessages,
  collapseSegment,
  getMemoryContext,
  clearWorkingMemory,
  getWorkingStats,
  markImportant,
  getActiveSessions,
};
