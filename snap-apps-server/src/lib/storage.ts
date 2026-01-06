/**
 * Snap App Storage - Vercel KV + Blob based storage
 *
 * Primary storage for Snap Apps with support for:
 * - Fast KV lookups by ID
 * - Blob storage for large data payloads
 * - Atomic counters for view/share tracking
 * - TTL support for temporary/scheduled apps
 */

import { kv as vercelKv } from "@vercel/kv";
import { nanoid } from "nanoid";

// ============================================================================
// LOCAL STORAGE FALLBACK (for development without KV)
// ============================================================================

const localStore = new Map<string, unknown>();
const localSortedSets = new Map<string, Array<{ score: number; member: string }>>();

const isKvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

// Define a minimal KV interface that works for both implementations
interface KvInterface {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  zadd(key: string, item: { score: number; member: string }): Promise<unknown>;
  zrem(key: string, member: string): Promise<unknown>;
  zrange<T>(key: string, start: number, stop: number, options?: { rev?: boolean; byScore?: boolean }): Promise<T[]>;
}

// KV-compatible interface for local development
const localKv: KvInterface = {
  async get<T>(key: string): Promise<T | null> {
    return (localStore.get(key) as T) ?? null;
  },
  async set(key: string, value: unknown): Promise<void> {
    localStore.set(key, value);
  },
  async del(key: string): Promise<void> {
    localStore.delete(key);
  },
  async incr(key: string): Promise<number> {
    const current = (localStore.get(key) as number) || 0;
    const next = current + 1;
    localStore.set(key, next);
    return next;
  },
  async zadd(key: string, item: { score: number; member: string }): Promise<void> {
    const set = localSortedSets.get(key) || [];
    const existingIdx = set.findIndex(s => s.member === item.member);
    if (existingIdx >= 0) {
      set[existingIdx] = item;
    } else {
      set.push(item);
    }
    set.sort((a, b) => a.score - b.score);
    localSortedSets.set(key, set);
  },
  async zrem(key: string, member: string): Promise<void> {
    const set = localSortedSets.get(key) || [];
    const idx = set.findIndex(s => s.member === member);
    if (idx >= 0) {
      set.splice(idx, 1);
      localSortedSets.set(key, set);
    }
  },
  async zrange<T>(
    key: string,
    start: number,
    stop: number,
    options?: { rev?: boolean; byScore?: boolean }
  ): Promise<T[]> {
    let set = [...(localSortedSets.get(key) || [])];
    if (options?.rev) {
      set = set.reverse();
    }
    if (options?.byScore) {
      // For byScore, start/stop are scores not indices
      set = set.filter(s => s.score >= start && s.score <= stop);
    } else {
      set = set.slice(start, stop + 1);
    }
    return set.map(s => s.member) as T[];
  },
};

// Use Vercel KV if configured, otherwise use local storage
// Cast to KvInterface to avoid union type incompatibility
const kv: KvInterface = isKvConfigured ? (vercelKv as unknown as KvInterface) : localKv;

if (!isKvConfigured) {
  console.log("⚠️  Using in-memory storage (KV not configured)");
}
import type {
  SnapApp,
  CreateSnapAppRequest,
  UpdateSnapAppRequest,
  ScheduledJob,
} from "@/types/snap-app";

// ============================================================================
// STORAGE KEYS
// ============================================================================

const KEYS = {
  // Snap App by ID
  snapApp: (id: string) => `snap:${id}`,

  // User's snap apps list
  userSnapApps: (userId: string) => `user:${userId}:snaps`,

  // All public snap apps (for discovery/trending)
  publicSnapApps: () => `public:snaps`,

  // Scheduled jobs
  scheduledJob: (id: string) => `schedule:${id}`,

  // Jobs by snap app
  snapAppSchedule: (snapAppId: string) => `snap:${snapAppId}:schedule`,

  // Pending scheduled jobs (sorted set by next run time)
  pendingJobs: () => `jobs:pending`,

  // View counter
  viewCount: (id: string) => `views:${id}`,

  // Share counter
  shareCount: (id: string) => `shares:${id}`,
};

// ============================================================================
// SNAP APP CRUD
// ============================================================================

/**
 * Create a new Snap App
 */
export async function createSnapApp(
  request: CreateSnapAppRequest
): Promise<SnapApp> {
  const id = nanoid(10); // Short, URL-friendly ID
  const now = new Date();

  const snapApp: SnapApp = {
    id,
    type: request.type,
    title: request.title,
    subtitle: request.subtitle,
    sourceUrl: request.sourceUrl,
    shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "https://minnow.so"}/app/${id}`,
    data: request.data,
    insights: request.insights,
    actions: request.actions,
    creatorId: request.creatorId,
    creatorName: request.creatorName,
    createdAt: now,
    updatedAt: now,
    viewCount: 0,
    shareCount: 0,
    isPublic: request.isPublic,
  };

  // Store the snap app
  await kv.set(KEYS.snapApp(id), snapApp);

  // Add to public list if public
  if (snapApp.isPublic) {
    await kv.zadd(KEYS.publicSnapApps(), {
      score: now.getTime(),
      member: id,
    });
  }

  // Add to user's list if creator specified
  if (snapApp.creatorId) {
    await kv.zadd(KEYS.userSnapApps(snapApp.creatorId), {
      score: now.getTime(),
      member: id,
    });
  }

  return snapApp;
}

/**
 * Get a Snap App by ID
 */
export async function getSnapApp(id: string): Promise<SnapApp | null> {
  const snapApp = await kv.get<SnapApp>(KEYS.snapApp(id));
  return snapApp;
}

/**
 * Get a Snap App by ID and increment view count
 */
export async function getSnapAppWithView(id: string): Promise<SnapApp | null> {
  const snapApp = await kv.get<SnapApp>(KEYS.snapApp(id));

  if (snapApp) {
    // Increment view counter atomically
    await kv.incr(KEYS.viewCount(id));

    // Periodically sync view count to main record (every 10 views)
    const viewCount = await kv.get<number>(KEYS.viewCount(id));
    if (viewCount && viewCount % 10 === 0) {
      await kv.set(KEYS.snapApp(id), {
        ...snapApp,
        viewCount,
        updatedAt: new Date(),
      });
    }

    return {
      ...snapApp,
      viewCount: viewCount || snapApp.viewCount,
    };
  }

  return null;
}

/**
 * Update a Snap App
 */
export async function updateSnapApp(
  id: string,
  updates: UpdateSnapAppRequest
): Promise<SnapApp | null> {
  const existing = await kv.get<SnapApp>(KEYS.snapApp(id));

  if (!existing) {
    return null;
  }

  const updated: SnapApp = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  await kv.set(KEYS.snapApp(id), updated);

  // Update public list visibility
  if (updates.isPublic !== undefined) {
    if (updates.isPublic && !existing.isPublic) {
      await kv.zadd(KEYS.publicSnapApps(), {
        score: existing.createdAt.getTime(),
        member: id,
      });
    } else if (!updates.isPublic && existing.isPublic) {
      await kv.zrem(KEYS.publicSnapApps(), id);
    }
  }

  return updated;
}

/**
 * Delete a Snap App
 */
export async function deleteSnapApp(id: string): Promise<boolean> {
  const existing = await kv.get<SnapApp>(KEYS.snapApp(id));

  if (!existing) {
    return false;
  }

  // Remove from all indices
  await Promise.all([
    kv.del(KEYS.snapApp(id)),
    kv.del(KEYS.viewCount(id)),
    kv.del(KEYS.shareCount(id)),
    kv.zrem(KEYS.publicSnapApps(), id),
    existing.creatorId
      ? kv.zrem(KEYS.userSnapApps(existing.creatorId), id)
      : Promise.resolve(),
  ]);

  return true;
}

/**
 * Increment share count
 */
export async function incrementShareCount(id: string): Promise<number> {
  const count = await kv.incr(KEYS.shareCount(id));

  // Periodically sync to main record
  if (count % 5 === 0) {
    const snapApp = await kv.get<SnapApp>(KEYS.snapApp(id));
    if (snapApp) {
      await kv.set(KEYS.snapApp(id), {
        ...snapApp,
        shareCount: count,
        updatedAt: new Date(),
      });
    }
  }

  return count;
}

// ============================================================================
// LISTING OPERATIONS
// ============================================================================

/**
 * Get recent public Snap Apps
 */
export async function getRecentPublicSnapApps(
  limit: number = 20,
  offset: number = 0
): Promise<SnapApp[]> {
  // Get IDs from sorted set (newest first)
  const ids = await kv.zrange<string>(KEYS.publicSnapApps(), offset, offset + limit - 1, {
    rev: true,
  });

  if (!ids.length) {
    return [];
  }

  // Batch fetch all snap apps
  const snapApps = await Promise.all(ids.map((id) => getSnapApp(id)));

  return snapApps.filter((app): app is SnapApp => app !== null);
}

/**
 * Get a user's Snap Apps
 */
export async function getUserSnapApps(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<SnapApp[]> {
  const ids = await kv.zrange<string>(
    KEYS.userSnapApps(userId),
    offset,
    offset + limit - 1,
    { rev: true }
  );

  if (!ids.length) {
    return [];
  }

  const snapApps = await Promise.all(ids.map((id) => getSnapApp(id)));

  return snapApps.filter((app): app is SnapApp => app !== null);
}

// ============================================================================
// SCHEDULING OPERATIONS
// ============================================================================

/**
 * Create a scheduled job for a Snap App
 */
export async function createScheduledJob(
  snapAppId: string,
  options: {
    cronExpression?: string;
    intervalMinutes?: number;
    webhookUrl?: string;
  }
): Promise<ScheduledJob> {
  const id = nanoid(10);
  const now = new Date();

  // Calculate next run time
  let nextRunAt: Date;
  if (options.intervalMinutes) {
    nextRunAt = new Date(now.getTime() + options.intervalMinutes * 60 * 1000);
  } else {
    // Default to 1 hour if no schedule specified
    nextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
  }

  const job: ScheduledJob = {
    id,
    snapAppId,
    cronExpression: options.cronExpression,
    intervalMinutes: options.intervalMinutes,
    webhookUrl: options.webhookUrl,
    nextRunAt,
    isActive: true,
    createdAt: now,
  };

  // Store the job
  await kv.set(KEYS.scheduledJob(id), job);

  // Link to snap app
  await kv.set(KEYS.snapAppSchedule(snapAppId), id);

  // Add to pending jobs queue
  await kv.zadd(KEYS.pendingJobs(), {
    score: nextRunAt.getTime(),
    member: id,
  });

  // Update snap app with schedule info
  const snapApp = await getSnapApp(snapAppId);
  if (snapApp) {
    await updateSnapApp(snapAppId, {});
    await kv.set(KEYS.snapApp(snapAppId), {
      ...snapApp,
      scheduleId: id,
      refreshInterval: options.intervalMinutes,
    });
  }

  return job;
}

/**
 * Get pending jobs that need to run
 */
export async function getPendingJobs(limit: number = 10): Promise<ScheduledJob[]> {
  const now = Date.now();

  // Get jobs due to run
  const jobIds = await kv.zrange<string>(KEYS.pendingJobs(), 0, now, {
    byScore: true,
  });

  if (!jobIds.length) {
    return [];
  }

  // Limit to batch size
  const batchIds = jobIds.slice(0, limit);

  const jobs = await Promise.all(
    batchIds.map((id) => kv.get<ScheduledJob>(KEYS.scheduledJob(id)))
  );

  return jobs.filter((job): job is ScheduledJob => job !== null && job.isActive);
}

/**
 * Mark a job as completed and reschedule if needed
 */
export async function completeScheduledJob(jobId: string): Promise<void> {
  const job = await kv.get<ScheduledJob>(KEYS.scheduledJob(jobId));

  if (!job) {
    return;
  }

  const now = new Date();

  // Calculate next run time
  let nextRunAt: Date | undefined;
  if (job.intervalMinutes) {
    nextRunAt = new Date(now.getTime() + job.intervalMinutes * 60 * 1000);
  }

  // Update job
  const updatedJob: ScheduledJob = {
    ...job,
    lastRunAt: now,
    nextRunAt,
  };

  await kv.set(KEYS.scheduledJob(jobId), updatedJob);

  // Remove from current position in queue
  await kv.zrem(KEYS.pendingJobs(), jobId);

  // Re-add with new run time if recurring
  if (nextRunAt) {
    await kv.zadd(KEYS.pendingJobs(), {
      score: nextRunAt.getTime(),
      member: jobId,
    });
  }

  // Update snap app's last refresh time
  await kv.set(KEYS.snapApp(job.snapAppId), {
    ...(await getSnapApp(job.snapAppId)),
    lastRefreshedAt: now,
    updatedAt: now,
  });
}

/**
 * Cancel a scheduled job
 */
export async function cancelScheduledJob(jobId: string): Promise<void> {
  const job = await kv.get<ScheduledJob>(KEYS.scheduledJob(jobId));

  if (!job) {
    return;
  }

  // Mark as inactive
  await kv.set(KEYS.scheduledJob(jobId), {
    ...job,
    isActive: false,
  });

  // Remove from queue
  await kv.zrem(KEYS.pendingJobs(), jobId);

  // Clear schedule from snap app
  await kv.set(KEYS.snapAppSchedule(job.snapAppId), null);

  const snapApp = await getSnapApp(job.snapAppId);
  if (snapApp) {
    await kv.set(KEYS.snapApp(job.snapAppId), {
      ...snapApp,
      scheduleId: undefined,
      refreshInterval: undefined,
    });
  }
}

// ============================================================================
// INVESTOR PREFERENCES
// ============================================================================

export interface InvestorPreferences {
  investorId: string;
  briefSchedule: {
    enabled: boolean;
    time: string; // "06:00" format (PST)
    timezone: string;
    weekdaysOnly: boolean;
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  };
  notifications: {
    criticalAlerts: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
  };
  displayPreferences: {
    showAllNews: boolean;
    compactView: boolean;
    priorityThreshold: "all" | "high" | "critical";
  };
  updatedAt: Date;
  createdAt: Date;
}

export interface InvestorFeedback {
  id: string;
  investorId: string;
  type: "bug" | "feature" | "general" | "news_quality";
  message: string;
  context?: {
    page?: string;
    newsItemId?: string;
    company?: string;
  };
  status: "pending" | "reviewed" | "resolved";
  createdAt: Date;
}

// Add investor-specific keys
const INVESTOR_KEYS = {
  preferences: (investorId: string) => `investor:${investorId}:preferences`,
  feedback: (investorId: string) => `investor:${investorId}:feedback`,
  feedbackItem: (id: string) => `feedback:${id}`,
  allFeedback: () => `feedback:all`,
};

/**
 * Get investor preferences
 */
export async function getInvestorPreferences(
  investorId: string
): Promise<InvestorPreferences | null> {
  const prefs = await kv.get<InvestorPreferences>(INVESTOR_KEYS.preferences(investorId));
  return prefs;
}

/**
 * Save investor preferences
 */
export async function saveInvestorPreferences(
  investorId: string,
  preferences: Partial<Omit<InvestorPreferences, "investorId" | "createdAt" | "updatedAt">>
): Promise<InvestorPreferences> {
  const existing = await getInvestorPreferences(investorId);
  const now = new Date();

  const defaultPrefs: InvestorPreferences = {
    investorId,
    briefSchedule: {
      enabled: true,
      time: "06:00",
      timezone: "America/Los_Angeles",
      weekdaysOnly: false,
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri by default
    },
    notifications: {
      criticalAlerts: true,
      dailyDigest: true,
      weeklyReport: false,
    },
    displayPreferences: {
      showAllNews: true,
      compactView: false,
      priorityThreshold: "all",
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const merged: InvestorPreferences = {
    ...defaultPrefs,
    ...existing,
    ...preferences,
    investorId,
    briefSchedule: {
      ...defaultPrefs.briefSchedule,
      ...existing?.briefSchedule,
      ...preferences.briefSchedule,
    },
    notifications: {
      ...defaultPrefs.notifications,
      ...existing?.notifications,
      ...preferences.notifications,
    },
    displayPreferences: {
      ...defaultPrefs.displayPreferences,
      ...existing?.displayPreferences,
      ...preferences.displayPreferences,
    },
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  };

  await kv.set(INVESTOR_KEYS.preferences(investorId), merged);
  return merged;
}

/**
 * Add investor feedback
 */
export async function addInvestorFeedback(
  investorId: string,
  feedback: Omit<InvestorFeedback, "id" | "investorId" | "status" | "createdAt">
): Promise<InvestorFeedback> {
  const id = nanoid(10);
  const now = new Date();

  const feedbackItem: InvestorFeedback = {
    id,
    investorId,
    type: feedback.type,
    message: feedback.message,
    context: feedback.context,
    status: "pending",
    createdAt: now,
  };

  // Store the feedback item
  await kv.set(INVESTOR_KEYS.feedbackItem(id), feedbackItem);

  // Add to investor's feedback list
  await kv.zadd(INVESTOR_KEYS.feedback(investorId), {
    score: now.getTime(),
    member: id,
  });

  // Add to global feedback list
  await kv.zadd(INVESTOR_KEYS.allFeedback(), {
    score: now.getTime(),
    member: id,
  });

  return feedbackItem;
}

/**
 * Get investor's feedback history
 */
export async function getInvestorFeedback(
  investorId: string,
  limit: number = 20
): Promise<InvestorFeedback[]> {
  const ids = await kv.zrange<string>(
    INVESTOR_KEYS.feedback(investorId),
    0,
    limit - 1,
    { rev: true }
  );

  if (!ids.length) {
    return [];
  }

  const feedbackItems = await Promise.all(
    ids.map((id) => kv.get<InvestorFeedback>(INVESTOR_KEYS.feedbackItem(id)))
  );

  return feedbackItems.filter((item): item is InvestorFeedback => item !== null);
}

/**
 * Update feedback status
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: InvestorFeedback["status"]
): Promise<InvestorFeedback | null> {
  const feedback = await kv.get<InvestorFeedback>(INVESTOR_KEYS.feedbackItem(feedbackId));

  if (!feedback) {
    return null;
  }

  const updated = { ...feedback, status };
  await kv.set(INVESTOR_KEYS.feedbackItem(feedbackId), updated);
  return updated;
}

// ============================================================================
// INVESTOR ONBOARDING & STATE
// ============================================================================

export interface InvestorState {
  investorId: string;
  stage: "new" | "searched" | "created_app" | "active";
  hasCompletedOnboarding: boolean;
  searchCount: number;
  snapAppCount: number;
  lastSearchQuery?: string;
  lastSearchAt?: Date;
  conversationHistory: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: "search" | "create_app" | "settings" | "help" | "general";
    searchResults?: unknown;
    settingsChanged?: Record<string, unknown>;
  };
}

const ONBOARDING_KEYS = {
  state: (investorId: string) => `investor:${investorId}:state`,
  conversation: (investorId: string) => `investor:${investorId}:conversation`,
};

/**
 * Get investor onboarding state
 */
export async function getInvestorState(investorId: string): Promise<InvestorState | null> {
  const state = await kv.get<InvestorState>(ONBOARDING_KEYS.state(investorId));
  return state;
}

/**
 * Initialize investor state for new users
 */
export async function initializeInvestorState(investorId: string, investorName: string): Promise<InvestorState> {
  const existing = await getInvestorState(investorId);
  if (existing) return existing;

  const now = new Date();
  const firstName = investorName.split(" ")[0];

  const state: InvestorState = {
    investorId,
    stage: "new",
    hasCompletedOnboarding: false,
    searchCount: 0,
    snapAppCount: 0,
    conversationHistory: [
      {
        id: nanoid(8),
        role: "assistant",
        content: `${firstName}, we've been expecting you.\n\nI'm Mino, your portfolio intelligence agent. I can help you:\n\n• **Search** for insights on your portfolio companies\n• **Create Snap Apps** - live dashboards from any search\n• **Manage settings** through natural conversation\n\nWhat would you like to explore first?`,
        timestamp: now,
        metadata: { intent: "general" },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(ONBOARDING_KEYS.state(investorId), state);
  return state;
}

/**
 * Update investor state after a search
 */
export async function recordInvestorSearch(
  investorId: string,
  query: string
): Promise<InvestorState | null> {
  const state = await getInvestorState(investorId);
  if (!state) return null;

  const now = new Date();
  const updated: InvestorState = {
    ...state,
    stage: state.stage === "new" ? "searched" : state.stage,
    searchCount: state.searchCount + 1,
    lastSearchQuery: query,
    lastSearchAt: now,
    updatedAt: now,
  };

  await kv.set(ONBOARDING_KEYS.state(investorId), updated);
  return updated;
}

/**
 * Record snap app creation
 */
export async function recordSnapAppCreation(investorId: string): Promise<InvestorState | null> {
  const state = await getInvestorState(investorId);
  if (!state) return null;

  const now = new Date();
  const updated: InvestorState = {
    ...state,
    stage: "created_app",
    snapAppCount: state.snapAppCount + 1,
    hasCompletedOnboarding: true,
    updatedAt: now,
  };

  await kv.set(ONBOARDING_KEYS.state(investorId), updated);
  return updated;
}

/**
 * Add message to conversation history
 */
export async function addConversationMessage(
  investorId: string,
  message: Omit<ConversationMessage, "id" | "timestamp">
): Promise<InvestorState | null> {
  const state = await getInvestorState(investorId);
  if (!state) return null;

  const now = new Date();
  const newMessage: ConversationMessage = {
    ...message,
    id: nanoid(8),
    timestamp: now,
  };

  // Keep last 50 messages
  const history = [...state.conversationHistory, newMessage].slice(-50);

  const updated: InvestorState = {
    ...state,
    conversationHistory: history,
    updatedAt: now,
  };

  await kv.set(ONBOARDING_KEYS.state(investorId), updated);
  return updated;
}

/**
 * Check if investor can create snap apps (must have searched first)
 */
export function canCreateSnapApp(state: InvestorState): boolean {
  return state.searchCount > 0;
}

// ============================================================================
// BRIEFING SUBSCRIPTIONS
// ============================================================================

export interface BriefingSubscription {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  topics: string[];
  companies: string[];
  schedule: {
    enabled: boolean;
    time: string; // "06:00" format
    timezone: string;
    daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  };
  deliveryMethod: "imessage" | "sms" | "email" | "webhook";
  webhookUrl?: string;
  isActive: boolean;
  lastDeliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefingDelivery {
  id: string;
  subscriptionId: string;
  content: string;
  newsItems: Array<{
    headline: string;
    source: string;
    url: string;
    company?: string;
  }>;
  deliveredAt: Date;
  status: "pending" | "sent" | "failed";
  error?: string;
}

const BRIEFING_KEYS = {
  subscription: (id: string) => `briefing:${id}`,
  userSubscriptions: (userId: string) => `user:${userId}:briefings`,
  allActiveSubscriptions: () => `briefings:active`,
  delivery: (id: string) => `delivery:${id}`,
  subscriptionDeliveries: (subscriptionId: string) => `briefing:${subscriptionId}:deliveries`,
  pendingDeliveries: () => `deliveries:pending`,
};

/**
 * Create a new briefing subscription
 */
export async function createBriefingSubscription(
  data: Omit<BriefingSubscription, "id" | "createdAt" | "updatedAt" | "isActive">
): Promise<BriefingSubscription> {
  const id = nanoid(10);
  const now = new Date();

  const subscription: BriefingSubscription = {
    ...data,
    id,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(BRIEFING_KEYS.subscription(id), subscription);

  // Add to user's subscriptions
  await kv.zadd(BRIEFING_KEYS.userSubscriptions(data.userId), {
    score: now.getTime(),
    member: id,
  });

  // Add to active subscriptions if enabled
  if (subscription.schedule.enabled) {
    await kv.zadd(BRIEFING_KEYS.allActiveSubscriptions(), {
      score: now.getTime(),
      member: id,
    });
  }

  return subscription;
}

/**
 * Get a briefing subscription by ID
 */
export async function getBriefingSubscription(id: string): Promise<BriefingSubscription | null> {
  return kv.get<BriefingSubscription>(BRIEFING_KEYS.subscription(id));
}

/**
 * Get all subscriptions for a user
 */
export async function getUserBriefingSubscriptions(userId: string): Promise<BriefingSubscription[]> {
  const ids = await kv.zrange<string>(
    BRIEFING_KEYS.userSubscriptions(userId),
    0,
    -1,
    { rev: true }
  );

  if (!ids.length) return [];

  const subscriptions = await Promise.all(
    ids.map((id) => getBriefingSubscription(id))
  );

  return subscriptions.filter((s): s is BriefingSubscription => s !== null);
}

/**
 * Get all active subscriptions (for cron job)
 */
export async function getAllActiveSubscriptions(): Promise<BriefingSubscription[]> {
  const ids = await kv.zrange<string>(
    BRIEFING_KEYS.allActiveSubscriptions(),
    0,
    -1
  );

  if (!ids.length) return [];

  const subscriptions = await Promise.all(
    ids.map((id) => getBriefingSubscription(id))
  );

  return subscriptions.filter(
    (s): s is BriefingSubscription => s !== null && s.isActive && s.schedule.enabled
  );
}

/**
 * Update a briefing subscription
 */
export async function updateBriefingSubscription(
  id: string,
  updates: Partial<Omit<BriefingSubscription, "id" | "userId" | "createdAt">>
): Promise<BriefingSubscription | null> {
  const existing = await getBriefingSubscription(id);
  if (!existing) return null;

  const updated: BriefingSubscription = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  await kv.set(BRIEFING_KEYS.subscription(id), updated);

  // Update active subscriptions index
  if (updated.isActive && updated.schedule.enabled) {
    await kv.zadd(BRIEFING_KEYS.allActiveSubscriptions(), {
      score: updated.createdAt.getTime(),
      member: id,
    });
  } else {
    await kv.zrem(BRIEFING_KEYS.allActiveSubscriptions(), id);
  }

  return updated;
}

/**
 * Delete a briefing subscription
 */
export async function deleteBriefingSubscription(id: string): Promise<boolean> {
  const existing = await getBriefingSubscription(id);
  if (!existing) return false;

  await Promise.all([
    kv.del(BRIEFING_KEYS.subscription(id)),
    kv.zrem(BRIEFING_KEYS.userSubscriptions(existing.userId), id),
    kv.zrem(BRIEFING_KEYS.allActiveSubscriptions(), id),
  ]);

  return true;
}

/**
 * Record a briefing delivery
 */
export async function recordBriefingDelivery(
  subscriptionId: string,
  content: string,
  newsItems: BriefingDelivery["newsItems"],
  status: "sent" | "failed",
  error?: string
): Promise<BriefingDelivery> {
  const id = nanoid(10);
  const now = new Date();

  const delivery: BriefingDelivery = {
    id,
    subscriptionId,
    content,
    newsItems,
    deliveredAt: now,
    status,
    error,
  };

  await kv.set(BRIEFING_KEYS.delivery(id), delivery);

  await kv.zadd(BRIEFING_KEYS.subscriptionDeliveries(subscriptionId), {
    score: now.getTime(),
    member: id,
  });

  // Update subscription's last delivered time
  if (status === "sent") {
    await updateBriefingSubscription(subscriptionId, {
      lastDeliveredAt: now,
    });
  }

  return delivery;
}

/**
 * Get delivery history for a subscription
 */
export async function getDeliveryHistory(
  subscriptionId: string,
  limit: number = 10
): Promise<BriefingDelivery[]> {
  const ids = await kv.zrange<string>(
    BRIEFING_KEYS.subscriptionDeliveries(subscriptionId),
    0,
    limit - 1,
    { rev: true }
  );

  if (!ids.length) return [];

  const deliveries = await Promise.all(
    ids.map((id) => kv.get<BriefingDelivery>(BRIEFING_KEYS.delivery(id)))
  );

  return deliveries.filter((d): d is BriefingDelivery => d !== null);
}
