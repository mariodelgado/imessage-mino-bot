/**
 * Snap App Agent - Claude Agent SDK powered Snap App generation
 *
 * This module uses the Claude Agent SDK to intelligently transform
 * raw Mino browser data into structured Snap Apps for the mobile app.
 */

import Anthropic from "@anthropic-ai/sdk";

// Snap App types matching mobile/src/stores/snapAppStore.ts
export type SnapAppType =
  | "price_comparison"
  | "product_gallery"
  | "article"
  | "map_view"
  | "availability"
  | "code_block"
  | "data_table"
  | "smart_card";

export interface SnapAppInsight {
  icon: string;
  text: string;
  type: "positive" | "negative" | "neutral" | "warning";
}

export interface SnapAppAction {
  label: string;
  icon: string;
  action: "share" | "save" | "refresh" | "open_url";
  url?: string;
}

export interface SnapApp {
  id: string;
  type: SnapAppType;
  title: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  data: Record<string, unknown>;
  insights: SnapAppInsight[];
  actions: SnapAppAction[];
  sourceUrl: string;
  createdAt: Date;
}

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SNAP_APP_SYSTEM_PROMPT = `You are a Snap App Generator. Your job is to transform raw web data into beautiful, interactive card formats for a mobile app.

Given raw data from a web page, you will analyze it and output a structured JSON object that represents a "Snap App" card.

## Card Types

Choose the most appropriate type based on the data:

- **price_comparison**: For comparing prices across vendors/options. Use when data contains multiple items with prices from different sources.
- **product_gallery**: For showcasing products with images, prices, ratings. Use for shopping/product data.
- **article**: For summarizing articles with key points. Use for news, blogs, documentation.
- **map_view**: For location-based data with addresses. Use when addresses or locations are present.
- **availability**: For date/time availability calendars. Use for reservations, flights, appointments.
- **code_block**: For code snippets with syntax highlighting. Use for technical documentation.
- **data_table**: For tabular data comparisons. Use for structured comparisons.
- **smart_card**: Fallback for any other structured data that doesn't fit above types.

## Output Format

Return a JSON object with this structure:
{
  "type": "price_comparison" | "product_gallery" | "article" | etc.,
  "title": "Concise title (max 50 chars)",
  "subtitle": "Optional context like '6 options' or 'Updated today'",
  "icon": "emoji representing the content",
  "color": "hex color for the card accent",
  "data": {
    // Type-specific structured data
  },
  "insights": [
    {
      "icon": "emoji",
      "text": "Actionable insight about the data",
      "type": "positive" | "negative" | "neutral" | "warning"
    }
  ],
  "actions": [
    {
      "label": "Action name",
      "icon": "emoji",
      "action": "share" | "save" | "refresh" | "open_url",
      "url": "optional URL for open_url action"
    }
  ]
}

## Data Structures by Type

### price_comparison
data: {
  items: [
    { vendor: string, price: number, currency: string, url?: string, rating?: number }
  ],
  lowestPrice: { vendor: string, price: number }
}

### product_gallery
data: {
  products: [
    { name: string, price: number, currency: string, image?: string, rating?: number, reviews?: number }
  ]
}

### article
data: {
  headline: string,
  summary: string,
  keyPoints: string[],
  author?: string,
  date?: string,
  readTime?: string
}

### availability
data: {
  dates: [
    { date: string, available: boolean, price?: number, note?: string }
  ]
}

### map_view
data: {
  locations: [
    { name: string, address: string, lat?: number, lng?: number, rating?: number }
  ]
}

## Insight Guidelines

- Generate 1-3 insights that provide REAL VALUE to the user
- Insights should be actionable or informative
- Examples:
  - "Cheapest option saves you $45"
  - "Best rated with 4.8 stars"
  - "Prices 15% lower than last month"
  - "Feb 13 has lowest fare this month"

## Action Guidelines

- Always include at least "share" and "save" actions
- Add "open_url" if there's a clear primary URL
- Add "refresh" if the data is time-sensitive (prices, availability)`;

/**
 * Generate a Snap App from raw Mino browser data
 */
export async function generateSnapApp(
  sourceUrl: string,
  userGoal: string,
  rawData: unknown
): Promise<SnapApp | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠️ Snap App Agent: No ANTHROPIC_API_KEY configured");
    return null;
  }

  try {
    console.log("✨ Snap App Agent: Generating from data...");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SNAP_APP_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Source URL: ${sourceUrl}
User Goal: ${userGoal}

Raw Data:
${JSON.stringify(rawData, null, 2)}

Generate a Snap App card from this data. Return ONLY the JSON object, no markdown or explanation.`,
        },
      ],
    });

    // Extract text content
    const textContent = message.content.find((c: { type: string }) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("Snap App Agent: No text response");
      return null;
    }

    // Parse JSON from response
    let jsonStr = textContent.text.trim();
    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    // Construct full Snap App with metadata
    const snapApp: SnapApp = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: parsed.type || "smart_card",
      title: parsed.title || "Research Results",
      subtitle: parsed.subtitle,
      icon: parsed.icon || "📋",
      color: parsed.color || "#007AFF",
      data: parsed.data || {},
      insights: parsed.insights || [],
      actions: parsed.actions || [
        { label: "Share", icon: "📤", action: "share" },
        { label: "Save", icon: "📌", action: "save" },
      ],
      sourceUrl,
      createdAt: new Date(),
    };

    console.log(`✨ Snap App Agent: Generated ${snapApp.type} - "${snapApp.title}"`);
    return snapApp;
  } catch (err) {
    console.error("Snap App Agent error:", err);
    return null;
  }
}

/**
 * Determine if data is suitable for Snap App generation
 */
export function isSnapAppCandidate(data: unknown): boolean {
  if (!data) return false;

  // Must be an object or array with meaningful content
  if (typeof data !== "object") return false;

  const str = JSON.stringify(data);
  // Skip very small or very large data
  if (str.length < 50 || str.length > 50000) return false;

  return true;
}

export default {
  generateSnapApp,
  isSnapAppCandidate,
};
