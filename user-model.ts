/**
 * Advanced User Modeling System
 *
 * Tracks everything about a user to personalize the experience:
 * - Behavioral patterns (when they text, what they ask about)
 * - Interests and preferences (inferred from conversations)
 * - Communication style (formal vs casual, emoji usage, etc.)
 * - Engagement metrics (response patterns, session length)
 * - Predictive signals (what they might want next)
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "bot.db");
const db = new Database(DB_PATH);

// ============================================================================
// SCHEMA
// ============================================================================

db.exec(`
  -- User profile with inferred attributes
  CREATE TABLE IF NOT EXISTS user_profiles (
    phone TEXT PRIMARY KEY,

    -- Basic info
    name TEXT,
    timezone TEXT,

    -- Communication style (0-1 scale)
    formality_score REAL DEFAULT 0.5,
    emoji_usage REAL DEFAULT 0.5,
    brevity_preference REAL DEFAULT 0.5,

    -- Activity patterns
    typical_morning_hour INTEGER,
    typical_evening_hour INTEGER,
    most_active_day TEXT,
    avg_messages_per_session REAL DEFAULT 1,
    avg_session_duration_mins REAL DEFAULT 5,

    -- Preferences (JSON)
    interests JSON DEFAULT '[]',
    favorite_sites JSON DEFAULT '[]',
    topic_frequencies JSON DEFAULT '{}',

    -- Engagement
    total_messages INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    first_seen TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen TEXT,

    -- Prediction features
    likely_next_topics JSON DEFAULT '[]',
    churn_risk REAL DEFAULT 0,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Individual interactions for learning
  CREATE TABLE IF NOT EXISTS user_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Interaction details
    message_type TEXT,  -- 'question', 'command', 'chat', 'feedback'
    topic TEXT,
    sentiment REAL,     -- -1 to 1
    intent TEXT,
    entities JSON,      -- extracted entities like locations, products, etc.

    -- Context
    hour_of_day INTEGER,
    day_of_week INTEGER,
    session_id TEXT,

    -- Outcome
    was_helpful INTEGER,  -- 1 if user continued positively, 0 if frustrated
    response_time_ms INTEGER,

    FOREIGN KEY (phone) REFERENCES user_profiles(phone)
  );

  -- Tracked interests with decay
  CREATE TABLE IF NOT EXISTS user_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    interest TEXT NOT NULL,
    category TEXT,  -- 'food', 'tech', 'shopping', 'travel', 'finance', etc.
    strength REAL DEFAULT 1.0,
    first_mentioned TEXT DEFAULT CURRENT_TIMESTAMP,
    last_mentioned TEXT DEFAULT CURRENT_TIMESTAMP,
    mention_count INTEGER DEFAULT 1,
    UNIQUE(phone, interest),
    FOREIGN KEY (phone) REFERENCES user_profiles(phone)
  );

  -- Sites/URLs the user frequently checks
  CREATE TABLE IF NOT EXISTS user_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    domain TEXT NOT NULL,
    purpose TEXT,  -- 'coffee menu', 'stock prices', 'news'
    check_count INTEGER DEFAULT 1,
    last_check TEXT DEFAULT CURRENT_TIMESTAMP,
    suggested_alert INTEGER DEFAULT 0,  -- Have we suggested making this an alert?
    UNIQUE(phone, domain),
    FOREIGN KEY (phone) REFERENCES user_profiles(phone)
  );

  -- Predictive patterns
  CREATE TABLE IF NOT EXISTS user_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    pattern_type TEXT,  -- 'daily_routine', 'weekly_habit', 'trigger_response'
    pattern_data JSON,
    confidence REAL DEFAULT 0.5,
    last_triggered TEXT,
    FOREIGN KEY (phone) REFERENCES user_profiles(phone)
  );

  CREATE INDEX IF NOT EXISTS idx_interactions_phone ON user_interactions(phone);
  CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON user_interactions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_interests_phone ON user_interests(phone);
  CREATE INDEX IF NOT EXISTS idx_sites_phone ON user_sites(phone);
`);

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  phone: string;
  name: string | null;
  timezone: string | null;

  // Communication style
  formalityScore: number;
  emojiUsage: number;
  brevityPreference: number;

  // Activity patterns
  typicalMorningHour: number | null;
  typicalEveningHour: number | null;
  mostActiveDay: string | null;
  avgMessagesPerSession: number;
  avgSessionDurationMins: number;

  // Preferences
  interests: string[];
  favoriteSites: string[];
  topicFrequencies: Record<string, number>;

  // Engagement
  totalMessages: number;
  totalSessions: number;
  firstSeen: string;
  lastSeen: string | null;

  // Predictions
  likelyNextTopics: string[];
  churnRisk: number;
}

export interface Interest {
  interest: string;
  category: string;
  strength: number;
  mentionCount: number;
}

export interface TrackedSite {
  domain: string;
  purpose: string | null;
  checkCount: number;
  suggestedAlert: boolean;
}

// ============================================================================
// TOPIC/INTENT EXTRACTION
// ============================================================================

const TOPIC_PATTERNS: Array<{ pattern: RegExp; topic: string; category: string }> = [
  // Food & Drink
  { pattern: /\b(coffee|philz|starbucks|cafe|latte|espresso)\b/i, topic: "coffee", category: "food" },
  { pattern: /\b(restaurant|food|eat|dinner|lunch|breakfast|brunch)\b/i, topic: "dining", category: "food" },
  { pattern: /\b(menu|order|delivery|doordash|ubereats|grubhub)\b/i, topic: "food_delivery", category: "food" },

  // Shopping
  { pattern: /\b(buy|purchase|shop|amazon|ebay|price|deal|sale|discount)\b/i, topic: "shopping", category: "shopping" },
  { pattern: /\b(stock|inventory|available|in stock|sold out)\b/i, topic: "availability", category: "shopping" },

  // Travel
  { pattern: /\b(flight|hotel|travel|trip|vacation|airbnb|booking)\b/i, topic: "travel", category: "travel" },
  { pattern: /\b(direction|navigate|drive|route|how to get|maps)\b/i, topic: "navigation", category: "travel" },

  // Finance
  { pattern: /\b(stock|invest|crypto|bitcoin|eth|market|trading)\b/i, topic: "investing", category: "finance" },
  { pattern: /\b(bank|account|transfer|payment|venmo|paypal)\b/i, topic: "banking", category: "finance" },

  // Tech
  { pattern: /\b(app|software|code|programming|developer|api)\b/i, topic: "tech", category: "tech" },
  { pattern: /\b(iphone|android|mac|windows|computer|laptop)\b/i, topic: "devices", category: "tech" },

  // Entertainment
  { pattern: /\b(movie|film|netflix|show|watch|stream|hulu|disney)\b/i, topic: "streaming", category: "entertainment" },
  { pattern: /\b(music|spotify|song|album|artist|concert|playlist)\b/i, topic: "music", category: "entertainment" },
  { pattern: /\b(game|gaming|xbox|playstation|nintendo|steam)\b/i, topic: "gaming", category: "entertainment" },

  // Health & Fitness
  { pattern: /\b(workout|gym|exercise|fitness|health|doctor)\b/i, topic: "fitness", category: "health" },
  { pattern: /\b(weather|rain|sunny|temperature|forecast)\b/i, topic: "weather", category: "lifestyle" },

  // News & Information
  { pattern: /\b(news|headline|article|blog|hacker news|reddit)\b/i, topic: "news", category: "information" },
  { pattern: /\b(learn|study|course|tutorial|how to)\b/i, topic: "learning", category: "information" },
];

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /\b(what is|what's|tell me about|explain)\b/i, intent: "information_seeking" },
  { pattern: /\b(how do|how can|how to)\b/i, intent: "how_to" },
  { pattern: /\b(find|search|look for|where)\b/i, intent: "search" },
  { pattern: /\b(remind|alert|notify|tell me when)\b/i, intent: "reminder" },
  { pattern: /\b(check|monitor|watch|track)\b/i, intent: "monitoring" },
  { pattern: /\b(compare|vs|versus|difference)\b/i, intent: "comparison" },
  { pattern: /\b(best|top|recommend|suggestion)\b/i, intent: "recommendation" },
  { pattern: /\b(help|assist|support)\b/i, intent: "help" },
  { pattern: /\b(thank|thanks|thx|awesome|great|perfect)\b/i, intent: "positive_feedback" },
  { pattern: /\b(no|wrong|not what|bad|terrible)\b/i, intent: "negative_feedback" },
];

function extractTopics(message: string): Array<{ topic: string; category: string }> {
  const topics: Array<{ topic: string; category: string }> = [];
  for (const { pattern, topic, category } of TOPIC_PATTERNS) {
    if (pattern.test(message)) {
      topics.push({ topic, category });
    }
  }
  return topics;
}

function extractIntent(message: string): string {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      return intent;
    }
  }
  return "general";
}

function extractEntities(message: string): Record<string, string[]> {
  const entities: Record<string, string[]> = {};

  // URLs
  const urls = message.match(/https?:\/\/[^\s]+/gi) || [];
  if (urls.length) entities.urls = urls;

  // Domains
  const domains = message.match(/\b([a-z0-9-]+\.(?:com|org|net|io|co|ai))\b/gi) || [];
  if (domains.length) entities.domains = domains;

  // Times
  const times = message.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi) || [];
  if (times.length) entities.times = times;

  // Prices
  const prices = message.match(/\$\d+(?:\.\d{2})?/g) || [];
  if (prices.length) entities.prices = prices;

  return entities;
}

function analyzeSentiment(message: string): number {
  const positive = /\b(love|great|awesome|perfect|thanks|thank|happy|excited|amazing|wonderful)\b/gi;
  const negative = /\b(hate|bad|terrible|awful|wrong|frustrated|annoyed|angry|disappointed)\b/gi;

  const posCount = (message.match(positive) || []).length;
  const negCount = (message.match(negative) || []).length;

  if (posCount === 0 && negCount === 0) return 0;
  return (posCount - negCount) / (posCount + negCount);
}

function analyzeFormality(message: string): number {
  // Indicators of informality
  const informal = /\b(gonna|wanna|gotta|yeah|yup|nope|lol|haha|omg|wtf|idk)\b/gi;
  const contractions = /\b(i'm|you're|we're|they're|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't)\b/gi;
  const emojiCount = (message.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;

  const informalCount = (message.match(informal) || []).length;
  const contractionCount = (message.match(contractions) || []).length;

  // Lower score = more informal
  const formalityScore = 1 - Math.min(1, (informalCount * 0.2 + contractionCount * 0.1 + emojiCount * 0.15));
  return formalityScore;
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

export function getOrCreateProfile(phone: string): UserProfile {
  const existing = db.prepare("SELECT * FROM user_profiles WHERE phone = ?").get(phone) as any;

  if (existing) {
    return {
      phone: existing.phone,
      name: existing.name,
      timezone: existing.timezone,
      formalityScore: existing.formality_score,
      emojiUsage: existing.emoji_usage,
      brevityPreference: existing.brevity_preference,
      typicalMorningHour: existing.typical_morning_hour,
      typicalEveningHour: existing.typical_evening_hour,
      mostActiveDay: existing.most_active_day,
      avgMessagesPerSession: existing.avg_messages_per_session,
      avgSessionDurationMins: existing.avg_session_duration_mins,
      interests: JSON.parse(existing.interests || "[]"),
      favoriteSites: JSON.parse(existing.favorite_sites || "[]"),
      topicFrequencies: JSON.parse(existing.topic_frequencies || "{}"),
      totalMessages: existing.total_messages,
      totalSessions: existing.total_sessions,
      firstSeen: existing.first_seen,
      lastSeen: existing.last_seen,
      likelyNextTopics: JSON.parse(existing.likely_next_topics || "[]"),
      churnRisk: existing.churn_risk,
    };
  }

  db.prepare(`
    INSERT INTO user_profiles (phone) VALUES (?)
  `).run(phone);

  return getOrCreateProfile(phone);
}

export function updateProfileName(phone: string, name: string): void {
  db.prepare("UPDATE user_profiles SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?").run(name, phone);
}

// ============================================================================
// INTERACTION TRACKING
// ============================================================================

let currentSessions = new Map<string, { id: string; startTime: number; messageCount: number }>();

export function trackInteraction(phone: string, message: string): void {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Session management (new session if >30 min gap)
  let session = currentSessions.get(phone);
  const thirtyMinMs = 30 * 60 * 1000;

  if (!session || (Date.now() - session.startTime) > thirtyMinMs) {
    session = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startTime: Date.now(),
      messageCount: 0,
    };
    currentSessions.set(phone, session);

    // Increment session count
    db.prepare(`
      UPDATE user_profiles
      SET total_sessions = total_sessions + 1, updated_at = CURRENT_TIMESTAMP
      WHERE phone = ?
    `).run(phone);
  }
  session.messageCount++;

  // Extract features
  const topics = extractTopics(message);
  const intent = extractIntent(message);
  const entities = extractEntities(message);
  const sentiment = analyzeSentiment(message);
  const formality = analyzeFormality(message);

  // Store interaction
  db.prepare(`
    INSERT INTO user_interactions (phone, message_type, topic, sentiment, intent, entities, hour_of_day, day_of_week, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    phone,
    topics.length > 0 ? "query" : "chat",
    topics[0]?.topic || null,
    sentiment,
    intent,
    JSON.stringify(entities),
    hour,
    day,
    session.id
  );

  // Update interests
  for (const { topic, category } of topics) {
    db.prepare(`
      INSERT INTO user_interests (phone, interest, category, strength, mention_count)
      VALUES (?, ?, ?, 1.0, 1)
      ON CONFLICT(phone, interest) DO UPDATE SET
        strength = MIN(strength + 0.1, 2.0),
        mention_count = mention_count + 1,
        last_mentioned = CURRENT_TIMESTAMP
    `).run(phone, topic, category);
  }

  // Track domains
  if (entities.domains) {
    for (const domain of entities.domains) {
      db.prepare(`
        INSERT INTO user_sites (phone, domain, check_count)
        VALUES (?, ?, 1)
        ON CONFLICT(phone, domain) DO UPDATE SET
          check_count = check_count + 1,
          last_check = CURRENT_TIMESTAMP
      `).run(phone, domain.toLowerCase());
    }
  }

  // Update profile stats
  const emojiCount = (message.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  const hasEmoji = emojiCount > 0 ? 1 : 0;

  db.prepare(`
    UPDATE user_profiles SET
      total_messages = total_messages + 1,
      last_seen = CURRENT_TIMESTAMP,
      formality_score = (formality_score * 0.9) + (? * 0.1),
      emoji_usage = (emoji_usage * 0.9) + (? * 0.1),
      brevity_preference = (brevity_preference * 0.9) + (? * 0.1),
      updated_at = CURRENT_TIMESTAMP
    WHERE phone = ?
  `).run(
    formality,
    hasEmoji,
    message.length < 50 ? 1 : message.length < 100 ? 0.5 : 0,
    phone
  );

  // Update activity patterns
  updateActivityPatterns(phone, hour, day);
}

function updateActivityPatterns(phone: string, hour: number, day: number): void {
  // Get recent interactions to compute patterns
  const recentHours = db.prepare(`
    SELECT hour_of_day, COUNT(*) as count FROM user_interactions
    WHERE phone = ? AND timestamp > datetime('now', '-30 days')
    GROUP BY hour_of_day ORDER BY count DESC LIMIT 3
  `).all(phone) as Array<{ hour_of_day: number; count: number }>;

  const recentDays = db.prepare(`
    SELECT day_of_week, COUNT(*) as count FROM user_interactions
    WHERE phone = ? AND timestamp > datetime('now', '-30 days')
    GROUP BY day_of_week ORDER BY count DESC LIMIT 1
  `).all(phone) as Array<{ day_of_week: number; count: number }>;

  if (recentHours.length > 0) {
    const morningHours = recentHours.filter(h => h.hour_of_day >= 5 && h.hour_of_day < 12);
    const eveningHours = recentHours.filter(h => h.hour_of_day >= 17 && h.hour_of_day < 23);

    const morningHour = morningHours[0]?.hour_of_day;
    const eveningHour = eveningHours[0]?.hour_of_day;

    if (morningHour || eveningHour) {
      db.prepare(`
        UPDATE user_profiles SET
          typical_morning_hour = COALESCE(?, typical_morning_hour),
          typical_evening_hour = COALESCE(?, typical_evening_hour),
          updated_at = CURRENT_TIMESTAMP
        WHERE phone = ?
      `).run(morningHour || null, eveningHour || null, phone);
    }
  }

  if (recentDays.length > 0) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    db.prepare(`
      UPDATE user_profiles SET most_active_day = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?
    `).run(days[recentDays[0].day_of_week], phone);
  }
}

// ============================================================================
// INTEREST & PREDICTION QUERIES
// ============================================================================

export function getTopInterests(phone: string, limit: number = 5): Interest[] {
  // Apply time decay - interests lose strength over time
  db.prepare(`
    UPDATE user_interests SET
      strength = strength * 0.99
    WHERE phone = ? AND julianday('now') - julianday(last_mentioned) > 1
  `).run(phone);

  return db.prepare(`
    SELECT interest, category, strength, mention_count
    FROM user_interests
    WHERE phone = ? AND strength > 0.1
    ORDER BY strength DESC, mention_count DESC
    LIMIT ?
  `).all(phone, limit) as Interest[];
}

export function getFrequentSites(phone: string, limit: number = 5): TrackedSite[] {
  return db.prepare(`
    SELECT domain, purpose, check_count, suggested_alert
    FROM user_sites
    WHERE phone = ?
    ORDER BY check_count DESC
    LIMIT ?
  `).all(phone, limit).map((s: any) => ({
    domain: s.domain,
    purpose: s.purpose,
    checkCount: s.check_count,
    suggestedAlert: s.suggested_alert === 1,
  }));
}

export function getSitesForAlertSuggestion(phone: string): TrackedSite[] {
  // Sites checked 3+ times that we haven't suggested alerts for yet
  return db.prepare(`
    SELECT domain, purpose, check_count, suggested_alert
    FROM user_sites
    WHERE phone = ? AND check_count >= 3 AND suggested_alert = 0
    ORDER BY check_count DESC
  `).all(phone).map((s: any) => ({
    domain: s.domain,
    purpose: s.purpose,
    checkCount: s.check_count,
    suggestedAlert: false,
  }));
}

export function markAlertSuggested(phone: string, domain: string): void {
  db.prepare(`
    UPDATE user_sites SET suggested_alert = 1 WHERE phone = ? AND domain = ?
  `).run(phone, domain);
}

// ============================================================================
// CHURN RISK MODELING
// ============================================================================

/**
 * Calculate churn risk score (0-1) based on:
 * - Days since last interaction
 * - Trend in session frequency
 * - Sentiment trend
 * - Response satisfaction
 */
export function calculateChurnRisk(phone: string): number {
  const profile = getOrCreateProfile(phone);

  // Factor 1: Days since last seen (0-0.4)
  let daysSinceActive = 30; // default high
  if (profile.lastSeen) {
    const lastSeenDate = new Date(profile.lastSeen);
    daysSinceActive = Math.floor((Date.now() - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  const inactivityRisk = Math.min(0.4, daysSinceActive / 30 * 0.4);

  // Factor 2: Session frequency decline (0-0.3)
  const recentSessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM user_interactions
    WHERE phone = ? AND timestamp > datetime('now', '-7 days')
  `).get(phone) as { count: number } | undefined;

  const olderSessions = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count FROM user_interactions
    WHERE phone = ? AND timestamp > datetime('now', '-30 days') AND timestamp <= datetime('now', '-7 days')
  `).get(phone) as { count: number } | undefined;

  let frequencyRisk = 0;
  const recentCount = recentSessions?.count || 0;
  const olderCount = olderSessions?.count || 0;

  if (olderCount > 0) {
    // Normalize to weekly rate
    const olderWeeklyRate = olderCount / 3.3; // ~3.3 weeks in 23 days
    if (olderWeeklyRate > recentCount) {
      frequencyRisk = Math.min(0.3, (1 - recentCount / olderWeeklyRate) * 0.3);
    }
  }

  // Factor 3: Negative sentiment trend (0-0.2)
  const recentSentiment = db.prepare(`
    SELECT AVG(sentiment) as avg FROM user_interactions
    WHERE phone = ? AND timestamp > datetime('now', '-7 days') AND sentiment IS NOT NULL
  `).get(phone) as { avg: number | null } | undefined;

  let sentimentRisk = 0;
  if (recentSentiment?.avg !== null && recentSentiment?.avg !== undefined) {
    if (recentSentiment.avg < 0) {
      sentimentRisk = Math.min(0.2, Math.abs(recentSentiment.avg) * 0.2);
    }
  }

  // Factor 4: Low engagement (few messages per session) (0-0.1)
  let engagementRisk = 0;
  if (profile.avgMessagesPerSession < 2) {
    engagementRisk = 0.1;
  } else if (profile.avgMessagesPerSession < 3) {
    engagementRisk = 0.05;
  }

  const totalRisk = inactivityRisk + frequencyRisk + sentimentRisk + engagementRisk;

  // Update profile with computed risk
  db.prepare(`
    UPDATE user_profiles SET churn_risk = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?
  `).run(totalRisk, phone);

  return totalRisk;
}

/**
 * Get users at high churn risk for proactive re-engagement
 */
export function getHighChurnRiskUsers(threshold: number = 0.5): Array<{ phone: string; risk: number; lastSeen: string }> {
  return db.prepare(`
    SELECT phone, churn_risk as risk, last_seen as lastSeen
    FROM user_profiles
    WHERE churn_risk >= ? AND last_seen IS NOT NULL
    ORDER BY churn_risk DESC
  `).all(threshold) as Array<{ phone: string; risk: number; lastSeen: string }>;
}

export function predictNextTopics(phone: string): string[] {
  // Based on time of day and historical patterns
  const hour = new Date().getHours();

  // Morning: coffee, news, weather
  // Lunch: food, restaurants
  // Evening: entertainment, relaxation
  // Night: planning for tomorrow

  const timeBasedTopics: Record<string, string[]> = {
    morning: ["coffee", "news", "weather"],
    lunch: ["dining", "food_delivery"],
    afternoon: ["shopping", "availability"],
    evening: ["streaming", "music", "dining"],
    night: ["weather", "news"],
  };

  let timeSlot = "afternoon";
  if (hour >= 5 && hour < 11) timeSlot = "morning";
  else if (hour >= 11 && hour < 14) timeSlot = "lunch";
  else if (hour >= 14 && hour < 18) timeSlot = "afternoon";
  else if (hour >= 18 && hour < 22) timeSlot = "evening";
  else timeSlot = "night";

  const timePredictions = timeBasedTopics[timeSlot] || [];

  // Combine with user's top interests
  const interests = getTopInterests(phone, 3);
  const interestTopics = interests.map(i => i.interest);

  // Dedupe and return
  return [...new Set([...timePredictions, ...interestTopics])].slice(0, 5);
}

// ============================================================================
// PERSONALIZATION HELPERS
// ============================================================================

export function getPersonalizedGreeting(phone: string): string {
  const profile = getOrCreateProfile(phone);
  const hour = new Date().getHours();

  let timeGreeting = "Hey";
  if (hour >= 5 && hour < 12) timeGreeting = "Good morning";
  else if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
  else if (hour >= 17 && hour < 21) timeGreeting = "Good evening";

  if (profile.name) {
    return `${timeGreeting}, ${profile.name}!`;
  }
  return `${timeGreeting}!`;
}

export function shouldUseEmoji(phone: string): boolean {
  const profile = getOrCreateProfile(phone);
  return profile.emojiUsage > 0.3;
}

export function getPreferredResponseLength(phone: string): "brief" | "normal" | "detailed" {
  const profile = getOrCreateProfile(phone);
  if (profile.brevityPreference > 0.7) return "brief";
  if (profile.brevityPreference < 0.3) return "detailed";
  return "normal";
}

export function getUserContext(phone: string): string {
  const profile = getOrCreateProfile(phone);
  const interests = getTopInterests(phone, 3);
  const sites = getFrequentSites(phone, 3);

  let context = "";

  if (profile.name) {
    context += `User's name: ${profile.name}. `;
  }

  if (interests.length > 0) {
    context += `Their interests: ${interests.map(i => i.interest).join(", ")}. `;
  }

  if (sites.length > 0) {
    context += `They frequently check: ${sites.map(s => s.domain).join(", ")}. `;
  }

  if (profile.formalityScore < 0.4) {
    context += "They prefer casual, informal conversation. ";
  } else if (profile.formalityScore > 0.7) {
    context += "They prefer more formal communication. ";
  }

  if (profile.brevityPreference > 0.6) {
    context += "They prefer brief, concise responses. ";
  }

  return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getOrCreateProfile,
  updateProfileName,
  trackInteraction,
  getTopInterests,
  getFrequentSites,
  getSitesForAlertSuggestion,
  markAlertSuggested,
  calculateChurnRisk,
  getHighChurnRiskUsers,
  predictNextTopics,
  getPersonalizedGreeting,
  shouldUseEmoji,
  getPreferredResponseLength,
  getUserContext,
};
