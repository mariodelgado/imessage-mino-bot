/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Investor News Cron - Daily news refresh for investor dashboards
 *
 * This endpoint fetches fresh news about portfolio companies using Google Search.
 * Runs daily at 6 AM PST via Vercel Cron.
 *
 * GET /api/cron/investor-news - Refresh portfolio company news
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Portfolio companies to track for Ryan Koh
const PORTFOLIO_COMPANIES = [
  { name: "TinyFish", sector: "AI/ML", keywords: ["TinyFish AI", "TinyFish startup"] },
  { name: "Statsig", sector: "DevTools", keywords: ["Statsig", "Statsig OpenAI"] },
  { name: "Adaptive ML", sector: "AI/ML", keywords: ["Adaptive ML", "Adaptive machine learning startup"] },
  { name: "Pinecone", sector: "Infrastructure", keywords: ["Pinecone vector database", "Pinecone AI"] },
  { name: "Groww", sector: "Fintech", keywords: ["Groww fintech", "Groww India"] },
  { name: "Spotnana", sector: "Travel Tech", keywords: ["Spotnana", "Spotnana travel"] },
  { name: "Unit21", sector: "Fintech", keywords: ["Unit21", "Unit21 fraud"] },
  { name: "Reprise", sector: "Sales Tech", keywords: ["Reprise demo", "Reprise software"] },
  { name: "Highspot", sector: "Sales Tech", keywords: ["Highspot", "Highspot sales enablement"] },
  { name: "Sendbird", sector: "Communications", keywords: ["Sendbird", "Sendbird chat API"] },
];

interface NewsItem {
  company: string;
  title: string;
  source: string;
  date: string;
  hoursAgo: number;
  sentiment: "positive" | "negative" | "neutral";
  priority: "critical" | "high" | "medium" | "low";
  category: "competitive" | "churn" | "talent" | "funding" | "product" | "legal" | "exit";
  url?: string;
}

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      }
    });

    // Use Gemini with Google Search grounding to find recent news
    const companyList = PORTFOLIO_COMPANIES.map(c => c.name).join(", ");

    const prompt = `Find the most recent and important business news from the past 7 days for these companies: ${companyList}

For each news item found, provide:
1. Company name (must match one from the list)
2. Full headline/title
3. Source publication name
4. Approximate date (e.g., "2d ago", "5h ago", "Jan 5")
5. Hours ago (numeric estimate)
6. Sentiment: "positive", "negative", or "neutral"
7. Priority: "critical" for major M&A/exits/leadership changes, "high" for partnerships/product launches/funding, "medium" for general news
8. Category: "exit" for acquisitions/IPOs, "funding" for fundraising, "product" for launches, "competitive" for partnerships/market moves, "churn" for customer losses, "talent" for hiring/departures, "legal" for regulatory

Focus on:
- M&A activity (acquisitions, exits)
- Major partnerships and customer wins
- Product launches and updates
- Funding rounds
- Leadership changes
- Competitive moves
- Customer churn or losses

Return a JSON array of news items. Only include verified recent news with real sources. Format:
[{"company":"Name","title":"Headline","source":"Publication","date":"2d ago","hoursAgo":48,"sentiment":"positive","priority":"high","category":"product","url":"https://..."}]`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
    } as any);

    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let newsItems: NewsItem[] = [];

    if (jsonMatch) {
      try {
        newsItems = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse news JSON:", jsonMatch[0]);
      }
    }

    // Return the news items
    return NextResponse.json({
      success: true,
      data: {
        news: newsItems,
        fetchedAt: new Date().toISOString(),
        companiesTracked: PORTFOLIO_COMPANIES.length,
      },
    });
  } catch (error) {
    console.error("Investor news cron failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "News fetch failed"
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
