/**
 * MIRA Event Processor
 *
 * Handles background events and "sleep" cycles for memory consolidation.
 * Like the brain during sleep, this processes and organizes memories.
 *
 * Event Types:
 * - SegmentCollapse: Idle timeout triggers conversation summarization
 * - MemoryDecay: Periodic pruning of forgotten memories
 * - DreamConsolidate: Pattern extraction and memory linking
 * - ToolExpiry: Deactivate unused tools
 */

import memory, { Memory, runDecayCycle, getMemoryStats, linkMemories, searchMemories } from "./memory";
import workingMemory, { getActiveSessions, collapseSegment } from "./working-memory";
import tools, { deactivateExpiredTools, getToolStats } from "./tools";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface EventConfig {
  segmentCollapseCheckInterval: number;  // How often to check for idle segments
  segmentIdleTimeout: number;            // How long before segment collapses
  memoryDecayInterval: number;           // How often to run decay cycle
  dreamConsolidationInterval: number;    // How often to run pattern extraction
  toolExpiryCheckInterval: number;       // How often to check tool expiry
}

const DEFAULT_CONFIG: EventConfig = {
  segmentCollapseCheckInterval: 5 * 60 * 1000,     // 5 minutes
  segmentIdleTimeout: 120 * 60 * 1000,             // 2 hours
  memoryDecayInterval: 24 * 60 * 60 * 1000,        // 24 hours
  dreamConsolidationInterval: 6 * 60 * 60 * 1000,  // 6 hours
  toolExpiryCheckInterval: 10 * 60 * 1000,         // 10 minutes
};

// ============================================================================
// TYPES
// ============================================================================

export interface MiraEvent {
  type: "segment_collapse" | "memory_decay" | "dream_consolidate" | "tool_expiry" | "custom";
  timestamp: Date;
  phone?: string;
  data?: Record<string, unknown>;
}

export interface EventResult {
  success: boolean;
  event: MiraEvent;
  details?: string;
  error?: string;
}

type EventHandler = (event: MiraEvent) => Promise<EventResult>;

// ============================================================================
// EVENT QUEUE & STATE
// ============================================================================

const eventQueue: MiraEvent[] = [];
const eventHandlers = new Map<string, EventHandler>();
let isProcessing = false;
let isRunning = false;

const intervals: {
  segmentCheck?: ReturnType<typeof setInterval>;
  decayCycle?: ReturnType<typeof setInterval>;
  dreamCycle?: ReturnType<typeof setInterval>;
  toolExpiry?: ReturnType<typeof setInterval>;
} = {};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle segment collapse events
 */
async function handleSegmentCollapse(event: MiraEvent): Promise<EventResult> {
  const sessions = getActiveSessions();
  let collapsed = 0;

  for (const session of sessions) {
    const idleTime = Date.now() - session.lastActivity.getTime();
    if (idleTime > DEFAULT_CONFIG.segmentIdleTimeout && session.messageCount > 0) {
      collapseSegment(session.phone);
      collapsed++;
    }
  }

  return {
    success: true,
    event,
    details: `Collapsed ${collapsed} idle segments`,
  };
}

/**
 * Handle memory decay events
 */
async function handleMemoryDecay(event: MiraEvent): Promise<EventResult> {
  const result = runDecayCycle();

  return {
    success: true,
    event,
    details: `Pruned ${result.pruned} memories, ${result.remaining} remaining`,
  };
}

/**
 * Handle dream consolidation events
 * This is where we find patterns and create links between memories
 */
async function handleDreamConsolidate(event: MiraEvent): Promise<EventResult> {
  let linksCreated = 0;
  let patternsFound = 0;

  // Get all phones with memories
  const phones = new Set<string>();
  // We'd need to query all phones, but for simplicity let's work with active sessions
  const sessions = getActiveSessions();

  for (const session of sessions) {
    const stats = getMemoryStats(session.phone);
    if (stats.total < 2) continue;

    // Find similar memories and link them
    const memories = memory.getStrongestMemories(session.phone, 20);

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const similarity = calculateSimilarity(memories[i].content, memories[j].content);
        if (similarity > 0.5) {
          linkMemories(memories[i].id, memories[j].id, "related", similarity);
          linksCreated++;
        }
      }
    }

    // Extract patterns from memory tags
    const tagCounts = new Map<string, number>();
    for (const mem of memories) {
      for (const tag of mem.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Create "pattern" memories for frequent themes
    for (const [tag, count] of tagCounts) {
      if (count >= 3) {
        const existingPattern = memory.searchMemories(session.phone, `pattern:${tag}`, { limit: 1 });
        if (existingPattern.length === 0) {
          memory.createMemory(
            session.phone,
            `pattern:${tag} - User frequently discusses topics related to ${tag}`,
            {
              memoryType: "semantic",
              importance: 0.7,
              tags: ["pattern", tag],
              metadata: { count, extractedAt: new Date().toISOString() },
            }
          );
          patternsFound++;
        }
      }
    }
  }

  return {
    success: true,
    event,
    details: `Dream consolidation: ${linksCreated} links created, ${patternsFound} patterns found`,
  };
}

/**
 * Handle tool expiry events
 */
async function handleToolExpiry(event: MiraEvent): Promise<EventResult> {
  const expired = deactivateExpiredTools();

  return {
    success: true,
    event,
    details: `Deactivated ${expired} expired tools`,
  };
}

/**
 * Simple similarity calculation (Jaccard on words)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// ============================================================================
// EVENT QUEUE MANAGEMENT
// ============================================================================

/**
 * Queue an event for processing
 */
export function queueEvent(event: MiraEvent): void {
  eventQueue.push(event);
  processQueue();
}

/**
 * Process queued events
 */
async function processQueue(): Promise<void> {
  if (isProcessing || eventQueue.length === 0) return;

  isProcessing = true;

  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (!event) continue;

    try {
      let result: EventResult;

      switch (event.type) {
        case "segment_collapse":
          result = await handleSegmentCollapse(event);
          break;
        case "memory_decay":
          result = await handleMemoryDecay(event);
          break;
        case "dream_consolidate":
          result = await handleDreamConsolidate(event);
          break;
        case "tool_expiry":
          result = await handleToolExpiry(event);
          break;
        case "custom":
          const handler = eventHandlers.get(event.data?.handlerId as string);
          if (handler) {
            result = await handler(event);
          } else {
            result = { success: false, event, error: "No handler for custom event" };
          }
          break;
        default:
          result = { success: false, event, error: `Unknown event type: ${event.type}` };
      }

      if (result.details) {
        console.log(`[MIRA Event] ${event.type}: ${result.details}`);
      }
    } catch (error) {
      console.error(`[MIRA Event] Error processing ${event.type}:`, error);
    }
  }

  isProcessing = false;
}

/**
 * Register a custom event handler
 */
export function registerEventHandler(id: string, handler: EventHandler): void {
  eventHandlers.set(id, handler);
}

/**
 * Unregister a custom event handler
 */
export function unregisterEventHandler(id: string): void {
  eventHandlers.delete(id);
}

// ============================================================================
// SCHEDULER
// ============================================================================

/**
 * Start the event processor
 */
export function startEventProcessor(config: Partial<EventConfig> = {}): void {
  if (isRunning) {
    console.log("[MIRA Events] Already running");
    return;
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  isRunning = true;

  console.log("[MIRA Events] Starting event processor");

  // Segment collapse check
  intervals.segmentCheck = setInterval(() => {
    queueEvent({
      type: "segment_collapse",
      timestamp: new Date(),
    });
  }, cfg.segmentCollapseCheckInterval);

  // Memory decay cycle
  intervals.decayCycle = setInterval(() => {
    queueEvent({
      type: "memory_decay",
      timestamp: new Date(),
    });
  }, cfg.memoryDecayInterval);

  // Dream consolidation
  intervals.dreamCycle = setInterval(() => {
    queueEvent({
      type: "dream_consolidate",
      timestamp: new Date(),
    });
  }, cfg.dreamConsolidationInterval);

  // Tool expiry check
  intervals.toolExpiry = setInterval(() => {
    queueEvent({
      type: "tool_expiry",
      timestamp: new Date(),
    });
  }, cfg.toolExpiryCheckInterval);

  // Run initial checks
  queueEvent({ type: "segment_collapse", timestamp: new Date() });
  queueEvent({ type: "tool_expiry", timestamp: new Date() });
}

/**
 * Stop the event processor
 */
export function stopEventProcessor(): void {
  if (!isRunning) return;

  console.log("[MIRA Events] Stopping event processor");

  if (intervals.segmentCheck) clearInterval(intervals.segmentCheck);
  if (intervals.decayCycle) clearInterval(intervals.decayCycle);
  if (intervals.dreamCycle) clearInterval(intervals.dreamCycle);
  if (intervals.toolExpiry) clearInterval(intervals.toolExpiry);

  isRunning = false;
}

/**
 * Trigger an immediate event
 */
export function triggerEvent(type: MiraEvent["type"], phone?: string, data?: Record<string, unknown>): void {
  queueEvent({
    type,
    timestamp: new Date(),
    phone,
    data,
  });
}

/**
 * Force a "sleep" cycle - run all consolidation events
 */
export async function forceSleepCycle(): Promise<{
  segmentCollapse: EventResult;
  memoryDecay: EventResult;
  dreamConsolidate: EventResult;
  toolExpiry: EventResult;
}> {
  console.log("[MIRA Events] Forcing sleep cycle");

  const now = new Date();

  const segmentCollapse = await handleSegmentCollapse({ type: "segment_collapse", timestamp: now });
  const memoryDecay = await handleMemoryDecay({ type: "memory_decay", timestamp: now });
  const dreamConsolidate = await handleDreamConsolidate({ type: "dream_consolidate", timestamp: now });
  const toolExpiry = await handleToolExpiry({ type: "tool_expiry", timestamp: now });

  return { segmentCollapse, memoryDecay, dreamConsolidate, toolExpiry };
}

/**
 * Get event processor status
 */
export function getEventProcessorStatus(): {
  isRunning: boolean;
  queueLength: number;
  registeredHandlers: string[];
} {
  return {
    isRunning,
    queueLength: eventQueue.length,
    registeredHandlers: [...eventHandlers.keys()],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  queueEvent,
  registerEventHandler,
  unregisterEventHandler,
  startEventProcessor,
  stopEventProcessor,
  triggerEvent,
  forceSleepCycle,
  getEventProcessorStatus,
};
