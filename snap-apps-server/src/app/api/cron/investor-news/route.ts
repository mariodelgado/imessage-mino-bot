/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Investor News Cron - Daily news refresh for investor dashboards
 *
 * This endpoint fetches fresh news about portfolio companies using Google Search.
 * Runs daily at 6 AM PST via Vercel Cron.
 *
 * GET /api/cron/investor-news - Refresh portfolio company news
 * GET /api/cron/investor-news?investorId=xxx - Fetch news for specific investor
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getInvestor, getInvestorCompanyNames, getAllCompanyNames } from "@/lib/investors";

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
    // Check for internal request (from brief API)
    const isInternalRequest = request.headers.get("x-internal-request") === "true";

    // Verify cron secret (skip for internal requests)
    const authHeader = request.headers.get("authorization");

    if (!isInternalRequest && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get investorId from query params
    const { searchParams } = new URL(request.url);
    const investorId = searchParams.get("investorId");

    // Get company names based on investorId
    let companyNames: string[];
    let investorName: string | undefined;

    if (investorId) {
      const investor = getInvestor(investorId);
      if (!investor) {
        return NextResponse.json(
          { success: false, error: "Investor not found" },
          { status: 404 }
        );
      }
      companyNames = getInvestorCompanyNames(investorId);
      investorName = investor.name;

      if (companyNames.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            news: [],
            fetchedAt: new Date().toISOString(),
            companiesTracked: 0,
            investorId,
            investorName,
            message: "No portfolio companies configured",
          },
        });
      }
    } else {
      // Fetch news for all companies across all investors
      companyNames = getAllCompanyNames();
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
    const companyList = companyNames.join(", ");

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

    // Extract JSON from response - handle markdown code blocks
    let jsonString = responseText;

    // Remove markdown code block markers if present
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    }

    // Find the JSON array
    const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
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
        companiesTracked: companyNames.length,
        ...(investorId && { investorId }),
        ...(investorName && { investorName }),
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
