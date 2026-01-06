#!/usr/bin/env npx ts-node
/**
 * Dynamic Briefing Pipeline
 *
 * Supports user-defined briefing subscriptions:
 * 1. Loads active subscriptions from storage
 * 2. Researches topics and companies using Claude web search
 * 3. Generates personalized briefings
 * 4. Delivers via iMessage, SMS, email, or webhook
 *
 * Run daily via cron or on-demand
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPES
// ============================================================================

interface BriefingSubscription {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  topics: string[];
  companies: string[];
  schedule: {
    enabled: boolean;
    time: string;
    timezone: string;
    daysOfWeek: number[];
  };
  deliveryMethod: "imessage" | "sms" | "email" | "webhook";
  webhookUrl?: string;
  isActive: boolean;
  lastDeliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface NewsItem {
  topic: string;
  title: string;
  source: string;
  url?: string;
  snippet: string;
  priority: "critical" | "high" | "medium" | "low";
  sentiment: "positive" | "negative" | "neutral";
}

interface BriefingContent {
  greeting: string;
  highlights: NewsItem[];
  summary: string;
  generatedAt: Date;
}

// ============================================================================
// AI CLIENT
// ============================================================================

const anthropic = new Anthropic();

// ============================================================================
// STORAGE ACCESS
// ============================================================================

// For local development, we'll load subscriptions from a JSON file
// In production, this would connect to Vercel KV
const SUBSCRIPTIONS_FILE = path.join(__dirname, "../.subscriptions.json");

interface SubscriptionStore {
  subscriptions: BriefingSubscription[];
  lastUpdated: string;
}

function loadSubscriptions(): BriefingSubscription[] {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data: SubscriptionStore = JSON.parse(
        fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8")
      );
      return data.subscriptions.filter((s) => s.isActive && s.schedule.enabled);
    }
  } catch (error) {
    console.warn("   Could not load subscriptions file:", error);
  }
  return [];
}

function saveDeliveryRecord(
  subscriptionId: string,
  content: BriefingContent,
  status: "sent" | "failed",
  error?: string
): void {
  const DELIVERIES_FILE = path.join(__dirname, "../.deliveries.json");
  try {
    let deliveries: Array<{
      id: string;
      subscriptionId: string;
      content: BriefingContent;
      status: string;
      error?: string;
      deliveredAt: string;
    }> = [];

    if (fs.existsSync(DELIVERIES_FILE)) {
      deliveries = JSON.parse(fs.readFileSync(DELIVERIES_FILE, "utf-8"));
    }

    deliveries.push({
      id: `del_${Date.now()}`,
      subscriptionId,
      content,
      status,
      error,
      deliveredAt: new Date().toISOString(),
    });

    // Keep last 100 deliveries
    deliveries = deliveries.slice(-100);
    fs.writeFileSync(DELIVERIES_FILE, JSON.stringify(deliveries, null, 2));
  } catch (err) {
    console.warn("   Could not save delivery record:", err);
  }
}

// ============================================================================
// NEWS HISTORY (Deduplication)
// ============================================================================

const NEWS_HISTORY_PATH = path.join(__dirname, "../.briefing-news-history.json");

interface NewsHistory {
  shownUrls: string[];
  lastUpdated: string;
}

function loadNewsHistory(): NewsHistory {
  try {
    if (fs.existsSync(NEWS_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(NEWS_HISTORY_PATH, "utf-8"));
    }
  } catch {
    console.warn("   Could not load news history, starting fresh");
  }
  return { shownUrls: [], lastUpdated: new Date().toISOString() };
}

function saveNewsHistory(history: NewsHistory): void {
  try {
    history.shownUrls = history.shownUrls.slice(-200);
    history.lastUpdated = new Date().toISOString();
    fs.writeFileSync(NEWS_HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    console.warn("   Could not save news history:", error);
  }
}

// ============================================================================
// WEB SEARCH
// ============================================================================

interface SearchResult {
  query: string;
  headlines: Array<{
    title: string;
    url: string;
    source: string;
    snippet: string;
  }>;
}

async function searchTopic(topic: string): Promise<SearchResult> {
  console.log(`   Searching: ${topic}...`);

  const searchPrompt = `Search for the most recent and important news about "${topic}" in the last 7 days.

Focus on:
1. Breaking news and developments
2. Industry trends and analysis
3. Major announcements and launches
4. Funding, M&A, and business moves
5. Expert opinions and insights

CRITICAL: Return ONLY a JSON object with this exact format:
{
  "query": "${topic}",
  "headlines": [
    {
      "title": "Exact headline from the article",
      "url": "https://exact-url-from-search.com/article",
      "source": "Publication name (e.g., TechCrunch, Reuters)",
      "snippet": "Brief 1-2 sentence summary of the key point"
    }
  ]
}

Return up to 5 most important and recent headlines.
If no relevant news, return empty headlines array.
Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
      messages: [{ role: "user", content: searchPrompt }],
    });

    let result = "";
    for (const block of response.content) {
      if (block.type === "text") {
        result += block.text + "\n";
      }
    }

    const jsonMatch = result.match(/\{[\s\S]*"headlines"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { query: topic, headlines: [] };
  } catch (error) {
    console.warn(`   Search failed for ${topic}:`, error);
    return { query: topic, headlines: [] };
  }
}

async function researchSubscription(
  subscription: BriefingSubscription
): Promise<NewsItem[]> {
  const searchQueries = [
    ...subscription.topics,
    ...subscription.companies.map((c) => `${c} company news`),
  ];

  console.log(`\n   Researching ${searchQueries.length} topics/companies...`);

  const history = loadNewsHistory();
  const seenUrls = new Set(history.shownUrls);

  const allResults: SearchResult[] = [];

  for (const query of searchQueries) {
    const result = await searchTopic(query);
    if (result.headlines.length > 0) {
      allResults.push(result);
      console.log(`      Found ${result.headlines.length} items for: ${query}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Convert to NewsItems, filtering duplicates
  const newsItems: NewsItem[] = [];

  for (const result of allResults) {
    for (const headline of result.headlines) {
      if (headline.url && seenUrls.has(headline.url)) {
        continue;
      }

      // Determine priority based on content
      let priority: NewsItem["priority"] = "medium";
      let sentiment: NewsItem["sentiment"] = "neutral";
      const titleLower = headline.title.toLowerCase();

      if (
        titleLower.includes("breakthrough") ||
        titleLower.includes("major") ||
        titleLower.includes("billion")
      ) {
        priority = "critical";
      } else if (
        titleLower.includes("funding") ||
        titleLower.includes("raises") ||
        titleLower.includes("launch")
      ) {
        priority = "high";
      }

      if (
        titleLower.includes("surge") ||
        titleLower.includes("growth") ||
        titleLower.includes("success")
      ) {
        sentiment = "positive";
      } else if (
        titleLower.includes("decline") ||
        titleLower.includes("layoff") ||
        titleLower.includes("concern")
      ) {
        sentiment = "negative";
      }

      newsItems.push({
        topic: result.query,
        title: headline.title,
        source: headline.source,
        url: headline.url,
        snippet: headline.snippet,
        priority,
        sentiment,
      });

      if (headline.url) {
        seenUrls.add(headline.url);
      }
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  newsItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Take top items
  const topItems = newsItems.slice(0, 7);

  // Save to history
  const newUrls = topItems.filter((item) => item.url).map((item) => item.url!);
  history.shownUrls.push(...newUrls);
  saveNewsHistory(history);

  return topItems;
}

// ============================================================================
// BRIEFING GENERATION
// ============================================================================

async function generateBriefing(
  subscription: BriefingSubscription,
  newsItems: NewsItem[]
): Promise<BriefingContent> {
  const firstName = subscription.name.split(" ")[0];

  // Generate the summary message using Claude
  const topicsString = [
    ...subscription.topics,
    ...subscription.companies,
  ].join(", ");

  const highlightsText = newsItems
    .slice(0, 3)
    .map((n) => `- ${n.topic}: ${n.title}`)
    .join("\n");

  const prompt = `Write a brief, punchy morning briefing for ${firstName}.

Their interests: ${topicsString}
Top news today:
${highlightsText}

Style:
- Open with a hook about the biggest story (no generic greetings like "Good morning")
- Be conversational and engaging, like texting a friend
- Keep it under 200 characters
- Use 1-2 relevant emojis
- End with a simple call-to-action

Return ONLY the message text.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  const summary =
    textContent && textContent.type === "text"
      ? textContent.text.trim()
      : `${firstName}, here's your daily briefing with ${newsItems.length} updates.`;

  return {
    greeting: `Good morning, ${firstName}!`,
    highlights: newsItems,
    summary,
    generatedAt: new Date(),
  };
}

// ============================================================================
// DELIVERY METHODS
// ============================================================================

function sendIMessage(phone: string, message: string, dryRun: boolean): boolean {
  if (dryRun) {
    console.log(`   [DRY RUN] Would send iMessage to ${phone}`);
    return true;
  }

  try {
    console.log(`   Sending iMessage to ${phone}...`);
    const escapedMessage = message.replace(/'/g, "'\"'\"'");
    execSync(
      `osascript -e 'tell application "Messages" to send "${escapedMessage}" to buddy "${phone}"'`
    );
    console.log(`   iMessage sent!`);
    return true;
  } catch (error) {
    console.error(`   Failed to send iMessage:`, error);
    return false;
  }
}

function sendSMS(phone: string, message: string, dryRun: boolean): boolean {
  if (dryRun) {
    console.log(`   [DRY RUN] Would send SMS to ${phone}`);
    return true;
  }

  // For SMS, we would integrate with Twilio or similar
  // For now, fall back to iMessage on macOS
  console.log(`   SMS delivery - falling back to iMessage...`);
  return sendIMessage(phone, message, dryRun);
}

async function sendEmail(
  email: string,
  subject: string,
  body: string,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`   [DRY RUN] Would send email to ${email}`);
    console.log(`   Subject: ${subject}`);
    return true;
  }

  // For email, we would integrate with Resend, SendGrid, etc.
  // For now, log it
  console.log(`   Email delivery not yet implemented for ${email}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body: ${body.substring(0, 100)}...`);
  return false;
}

async function sendWebhook(
  webhookUrl: string,
  content: BriefingContent,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`   [DRY RUN] Would POST to webhook: ${webhookUrl}`);
    return true;
  }

  try {
    console.log(`   Sending webhook to ${webhookUrl}...`);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "daily_briefing",
        content,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log(`   Webhook delivered!`);
      return true;
    } else {
      console.error(`   Webhook failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`   Webhook error:`, error);
    return false;
  }
}

async function deliverBriefing(
  subscription: BriefingSubscription,
  content: BriefingContent,
  dryRun: boolean
): Promise<boolean> {
  const { deliveryMethod, phone, email, webhookUrl, name } = subscription;

  // Build the message
  const messageLines = [content.summary];

  // Add top headlines
  if (content.highlights.length > 0) {
    messageLines.push("");
    content.highlights.slice(0, 3).forEach((h) => {
      messageLines.push(`${h.title}`);
      if (h.url) messageLines.push(h.url);
    });
  }

  const fullMessage = messageLines.join("\n");

  console.log(`\n   Delivering to ${name} via ${deliveryMethod}...`);

  switch (deliveryMethod) {
    case "imessage":
      if (!phone) {
        console.error("   No phone number for iMessage delivery");
        return false;
      }
      return sendIMessage(phone, fullMessage, dryRun);

    case "sms":
      if (!phone) {
        console.error("   No phone number for SMS delivery");
        return false;
      }
      return sendSMS(phone, fullMessage, dryRun);

    case "email":
      if (!email) {
        console.error("   No email for email delivery");
        return false;
      }
      return sendEmail(
        email,
        `Your Daily Briefing - ${new Date().toLocaleDateString()}`,
        fullMessage,
        dryRun
      );

    case "webhook":
      if (!webhookUrl) {
        console.error("   No webhook URL for webhook delivery");
        return false;
      }
      return sendWebhook(webhookUrl, content, dryRun);

    default:
      console.error(`   Unknown delivery method: ${deliveryMethod}`);
      return false;
  }
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runPipelineForSubscription(
  subscription: BriefingSubscription,
  dryRun: boolean
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${subscription.name}`);
  console.log(`Topics: ${subscription.topics.join(", ") || "None"}`);
  console.log(`Companies: ${subscription.companies.join(", ") || "None"}`);
  console.log(`Delivery: ${subscription.deliveryMethod}`);
  console.log(`${"=".repeat(60)}`);

  try {
    // 1. Research news for this subscription
    const newsItems = await researchSubscription(subscription);
    console.log(`   Found ${newsItems.length} news items`);

    if (newsItems.length === 0) {
      console.log(`   No news found, skipping delivery`);
      return;
    }

    // 2. Generate the briefing content
    const content = await generateBriefing(subscription, newsItems);
    console.log(`\n   Briefing:\n   "${content.summary}"`);

    // 3. Deliver the briefing
    const success = await deliverBriefing(subscription, content, dryRun);

    // 4. Record the delivery
    saveDeliveryRecord(
      subscription.id,
      content,
      success ? "sent" : "failed",
      success ? undefined : "Delivery failed"
    );

    console.log(`\n   ${success ? "Delivered!" : "Delivery failed"}`);
  } catch (error) {
    console.error(`   Error processing ${subscription.name}:`, error);
    saveDeliveryRecord(
      subscription.id,
      {
        greeting: "",
        highlights: [],
        summary: "",
        generatedAt: new Date(),
      },
      "failed",
      String(error)
    );
  }
}

function shouldRunForSubscription(subscription: BriefingSubscription): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Check if today is in the allowed days
  if (!subscription.schedule.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  // For cron-triggered runs, we assume the scheduler handles timing
  // For manual runs, we run regardless of time
  return true;
}

// ============================================================================
// ENTRY POINT
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");
const RUN_ALL = process.argv.includes("--all");

async function main(): Promise<void> {
  console.log("\n Daily Briefing Pipeline");
  console.log(`${new Date().toLocaleString()}`);
  if (DRY_RUN) console.log("[DRY RUN MODE]\n");
  else console.log("");

  // Load subscriptions
  let subscriptions = loadSubscriptions();

  if (subscriptions.length === 0) {
    console.log("No active subscriptions found.");
    console.log("Create subscriptions via the /subscribe page or API.\n");

    // For demo purposes, show what would happen with a sample subscription
    if (DRY_RUN) {
      console.log("Demo mode: Creating sample subscription...\n");
      subscriptions = [
        {
          id: "demo-001",
          userId: "demo",
          name: "Demo User",
          phone: "+15555550000",
          topics: ["AI & Machine Learning", "Fintech"],
          companies: ["OpenAI", "Stripe"],
          schedule: {
            enabled: true,
            time: "07:00",
            timezone: "America/Los_Angeles",
            daysOfWeek: [1, 2, 3, 4, 5],
          },
          deliveryMethod: "imessage",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    } else {
      return;
    }
  }

  console.log(`Found ${subscriptions.length} active subscriptions\n`);

  // Filter subscriptions that should run today
  const todaysSubscriptions = RUN_ALL
    ? subscriptions
    : subscriptions.filter(shouldRunForSubscription);

  console.log(`Running for ${todaysSubscriptions.length} subscriptions\n`);

  // Process each subscription
  for (const subscription of todaysSubscriptions) {
    await runPipelineForSubscription(subscription, DRY_RUN);
  }

  console.log("\n Pipeline complete!\n");
}

main().catch(console.error);
