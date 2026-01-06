/**
 * TinyFish.ai Daily Briefing API
 *
 * Fetches latest news and updates about TinyFish.ai using Gemini with Google Search grounding.
 * Used for Sudheesh Nair's daily briefing.
 *
 * GET /api/briefing/tinyfish - Fetch latest TinyFish.ai news
 */

import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
  category: "product" | "funding" | "partnership" | "hiring" | "general";
  url?: string;
}

interface BriefingResponse {
  success: boolean;
  data?: {
    news: NewsItem[];
    summary: string;
    fetchedAt: string;
    generatedFor: string;
  };
  error?: string;
}

// Initialize Vertex AI
function getVertexAI() {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || "us-central1";

  if (!projectId) {
    throw new Error("GCP_PROJECT_ID not configured");
  }

  return new VertexAI({ project: projectId, location });
}

export async function GET(): Promise<NextResponse<BriefingResponse>> {
  try {
    const vertexAI = getVertexAI();

    // Use Gemini with Google Search grounding for real-time news
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const prompt = `You are a business intelligence analyst. Search for the latest news and updates about TinyFish.ai (also known as TinyFish AI or TinyFish).

Today is ${today}.

Search for:
1. Recent company news, announcements, or press releases
2. Product launches or updates
3. Funding rounds or investment news
4. Partnerships or integrations
5. Industry mentions or comparisons
6. Executive or team news
7. Customer wins or case studies

Return your findings as a JSON object with this exact structure:
{
  "news": [
    {
      "title": "Headline of the news item",
      "summary": "2-3 sentence summary of the news",
      "source": "Publication or website name",
      "date": "Date or relative time (e.g., '2 days ago', 'Jan 5, 2025')",
      "sentiment": "positive" | "negative" | "neutral",
      "category": "product" | "funding" | "partnership" | "hiring" | "general",
      "url": "URL if available, otherwise omit"
    }
  ],
  "summary": "A 2-3 sentence executive summary of the key developments"
}

If you find no recent news, return an empty news array with a summary explaining that.
Important: Return ONLY the JSON object, no markdown formatting or code blocks.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the JSON response
    let parsedData: { news: NewsItem[]; summary: string };
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // Fallback if parsing fails
      parsedData = {
        news: [],
        summary: "Unable to parse news data. Raw response available.",
      };
      console.error("Failed to parse TinyFish news response:", responseText);
    }

    return NextResponse.json({
      success: true,
      data: {
        news: parsedData.news || [],
        summary: parsedData.summary || "No summary available",
        fetchedAt: new Date().toISOString(),
        generatedFor: "Sudheesh Nair",
      },
    });
  } catch (error) {
    console.error("TinyFish briefing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch TinyFish briefing",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
