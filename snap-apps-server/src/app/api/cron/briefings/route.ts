import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getAllActiveSubscriptions,
  recordBriefingDelivery,
  updateBriefingSubscription,
  type BriefingSubscription,
} from "@/lib/storage";

// Vercel cron configuration
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

interface NewsItem {
  topic: string;
  title: string;
  source: string;
  url?: string;
  snippet: string;
}

interface SearchResult {
  query: string;
  headlines: Array<{
    title: string;
    url: string;
    source: string;
    snippet: string;
  }>;
}

// ============================================================================
// WEB SEARCH
// ============================================================================

async function searchTopic(topic: string): Promise<SearchResult> {
  const searchPrompt = `Search for the most recent news about "${topic}" in the last 7 days.

Focus on:
1. Breaking news and major developments
2. Industry trends and analysis
3. Funding, M&A, and business moves
4. Expert insights

Return ONLY a JSON object:
{
  "query": "${topic}",
  "headlines": [
    {
      "title": "Headline text",
      "url": "https://url.com",
      "source": "Publication",
      "snippet": "Brief summary"
    }
  ]
}

Return up to 3 most important headlines.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ],
      messages: [{ role: "user", content: searchPrompt }],
    });

    let result = "";
    for (const block of response.content) {
      if (block.type === "text") {
        result += block.text;
      }
    }

    const jsonMatch = result.match(/\{[\s\S]*"headlines"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { query: topic, headlines: [] };
  } catch (error) {
    console.error(`Search failed for ${topic}:`, error);
    return { query: topic, headlines: [] };
  }
}

async function researchSubscription(
  subscription: BriefingSubscription
): Promise<NewsItem[]> {
  const searchQueries = [
    ...subscription.topics.slice(0, 3),
    ...subscription.companies.slice(0, 3).map((c) => `${c} company`),
  ];

  const allResults: SearchResult[] = [];

  for (const query of searchQueries) {
    const result = await searchTopic(query);
    if (result.headlines.length > 0) {
      allResults.push(result);
    }
    // Small delay between searches
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const newsItems: NewsItem[] = [];
  for (const result of allResults) {
    for (const headline of result.headlines) {
      newsItems.push({
        topic: result.query,
        title: headline.title,
        source: headline.source,
        url: headline.url,
        snippet: headline.snippet,
      });
    }
  }

  return newsItems.slice(0, 7);
}

// ============================================================================
// BRIEFING GENERATION
// ============================================================================

async function generateBriefingMessage(
  subscription: BriefingSubscription,
  newsItems: NewsItem[]
): Promise<string> {
  const firstName = subscription.name.split(" ")[0];

  if (newsItems.length === 0) {
    return `${firstName}, no significant news today for your tracked topics. Check back tomorrow!`;
  }

  const highlights = newsItems
    .slice(0, 3)
    .map((n) => `- ${n.topic}: ${n.title}`)
    .join("\n");

  const prompt = `Write a brief morning briefing for ${firstName}.

Top news:
${highlights}

Style:
- Open with a hook about the biggest story
- Be conversational, like texting a friend
- Under 200 characters
- 1-2 relevant emojis

Return ONLY the message text.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  return textContent && textContent.type === "text"
    ? textContent.text.trim()
    : `${firstName}, here's your daily briefing with ${newsItems.length} updates.`;
}

// ============================================================================
// DELIVERY (placeholder for server-side)
// ============================================================================

async function deliverBriefing(
  subscription: BriefingSubscription,
  message: string,
  newsItems: NewsItem[]
): Promise<{ success: boolean; error?: string }> {
  // Build full message with links
  const fullMessage =
    message +
    "\n\n" +
    newsItems
      .slice(0, 3)
      .map((n) => (n.url ? `${n.title}\n${n.url}` : n.title))
      .join("\n\n");

  console.log(`Delivering to ${subscription.name} via ${subscription.deliveryMethod}`);
  console.log(`Message: ${fullMessage.substring(0, 100)}...`);

  switch (subscription.deliveryMethod) {
    case "email":
      // TODO: Integrate with Resend or SendGrid
      console.log(`Would send email to ${subscription.email}`);
      return { success: true };

    case "webhook":
      if (subscription.webhookUrl) {
        try {
          const response = await fetch(subscription.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "daily_briefing",
              subscription_id: subscription.id,
              message: fullMessage,
              news_items: newsItems,
              timestamp: new Date().toISOString(),
            }),
          });
          return { success: response.ok };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      }
      return { success: false, error: "No webhook URL" };

    case "imessage":
    case "sms":
      // iMessage/SMS require local execution (osascript for iMessage, Twilio for SMS)
      // In production, this would call a separate service
      console.log(`Would send ${subscription.deliveryMethod} to ${subscription.phone}`);
      console.log(`Message: ${fullMessage}`);
      return { success: true };

    default:
      return { success: false, error: "Unknown delivery method" };
  }
}

// ============================================================================
// SCHEDULE CHECK
// ============================================================================

function shouldDeliverNow(subscription: BriefingSubscription): boolean {
  const now = new Date();

  // Check day of week
  const dayOfWeek = now.getDay();
  if (!subscription.schedule.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  // Parse schedule time
  const [scheduleHour, scheduleMinute] = subscription.schedule.time.split(":").map(Number);

  // Get current time in the subscription's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: subscription.schedule.timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const timeParts = formatter.formatToParts(now);
  const currentHour = parseInt(timeParts.find((p) => p.type === "hour")?.value || "0");
  const currentMinute = parseInt(timeParts.find((p) => p.type === "minute")?.value || "0");

  // Allow a 15-minute window for delivery
  const scheduleMinutes = scheduleHour * 60 + scheduleMinute;
  const currentMinutes = currentHour * 60 + currentMinute;

  return currentMinutes >= scheduleMinutes && currentMinutes < scheduleMinutes + 15;
}

// ============================================================================
// CRON HANDLER
// ============================================================================

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    subscriptionId: string;
    name: string;
    status: "delivered" | "skipped" | "failed";
    reason?: string;
  }> = [];

  try {
    // Get all active subscriptions
    const subscriptions = await getAllActiveSubscriptions();
    console.log(`Found ${subscriptions.length} active subscriptions`);

    for (const subscription of subscriptions) {
      // Check if we should deliver now
      if (!shouldDeliverNow(subscription)) {
        results.push({
          subscriptionId: subscription.id,
          name: subscription.name,
          status: "skipped",
          reason: "Not scheduled for this time",
        });
        continue;
      }

      // Check if already delivered today
      if (subscription.lastDeliveredAt) {
        const lastDelivery = new Date(subscription.lastDeliveredAt);
        const now = new Date();
        if (
          lastDelivery.toDateString() === now.toDateString()
        ) {
          results.push({
            subscriptionId: subscription.id,
            name: subscription.name,
            status: "skipped",
            reason: "Already delivered today",
          });
          continue;
        }
      }

      try {
        // Research news
        const newsItems = await researchSubscription(subscription);

        // Generate message
        const message = await generateBriefingMessage(subscription, newsItems);

        // Deliver
        const delivery = await deliverBriefing(subscription, message, newsItems);

        // Record delivery
        await recordBriefingDelivery(
          subscription.id,
          message,
          newsItems.map((n) => ({
            headline: n.title,
            source: n.source,
            url: n.url || "",
            company: n.topic,
          })),
          delivery.success ? "sent" : "failed",
          delivery.error
        );

        // Update last delivered
        if (delivery.success) {
          await updateBriefingSubscription(subscription.id, {
            lastDeliveredAt: new Date(),
          });
        }

        results.push({
          subscriptionId: subscription.id,
          name: subscription.name,
          status: delivery.success ? "delivered" : "failed",
          reason: delivery.error,
        });
      } catch (error) {
        console.error(`Error processing ${subscription.name}:`, error);
        results.push({
          subscriptionId: subscription.id,
          name: subscription.name,
          status: "failed",
          reason: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      delivered: results.filter((r) => r.status === "delivered").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Failed to process briefings", details: String(error) },
      { status: 500 }
    );
  }
}
