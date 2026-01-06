/**
 * Snap App Refresh API Endpoint
 *
 * POST /api/snap-apps/:id/refresh
 *
 * Triggers a Mino browser automation run to fetch fresh data.
 * CRITICAL: Does NOT wipe existing data until new data is successfully received.
 */

import { NextResponse } from "next/server";
import { getSnapApp, updateSnapApp } from "@/lib/storage";
import type { ApiResponse, SnapApp, SnapAppInsight, RefreshMeta } from "@/types/snap-app";

// Types for Mino automation
interface MinoResult {
  status: "success" | "error" | "running";
  result?: string;
  error?: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Environment variable for Mino API key
const MINO_API_KEY = process.env.MINO_API_KEY || "";
const MINO_API_URL = process.env.MINO_API_URL || "https://api.mino.ai";

/**
 * Run Mino browser automation to fetch fresh data
 */
async function runMinoAutomation(
  apiKey: string,
  url: string,
  goal: string
): Promise<MinoResult> {
  try {
    const response = await fetch(`${MINO_API_URL}/v1/automations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        goal,
        output_format: "json",
        timeout: 60000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        status: "error",
        error: `Mino API error: ${response.status} - ${errorText}`,
      };
    }

    // Handle SSE streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return { status: "error", error: "No response body" };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let lastResult: string | undefined;
    let lastError: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.status === "completed" && data.result) {
              lastResult = data.result;
            } else if (data.status === "error" || data.error) {
              lastError = data.error || "Unknown error";
            }
          } catch {
            // Ignore JSON parse errors in SSE stream
          }
        }
      }
    }

    if (lastResult) {
      return { status: "success", result: lastResult };
    } else if (lastError) {
      return { status: "error", error: lastError };
    } else {
      return { status: "error", error: "No result received" };
    }
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse Mino result into structured data
 */
function parseMinoResult(result: string): Record<string, unknown> | null {
  try {
    return JSON.parse(result);
  } catch {
    // If not valid JSON, wrap the text result
    return { content: result };
  }
}

/**
 * Generate insights from the new data
 */
function generateInsights(
  data: Record<string, unknown>,
  oldData?: Record<string, unknown>
): SnapAppInsight[] {
  const insights: SnapAppInsight[] = [];

  // Check for price changes
  if (data.items && Array.isArray(data.items)) {
    const items = data.items as { price?: number; name?: string }[];
    const prices = items.filter((i) => i.price).map((i) => i.price!);

    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      insights.push({
        type: "positive",
        text: `Lowest: $${minPrice}`,
        icon: "💰",
      });

      if (maxPrice > minPrice) {
        const savings = Math.round(((maxPrice - minPrice) / maxPrice) * 100);
        insights.push({
          type: "positive",
          text: `Save up to ${savings}%`,
          icon: "📉",
        });
      }
    }
  }

  // Check for availability
  if (data.available !== undefined) {
    insights.push({
      type: data.available ? "positive" : "negative",
      text: data.available ? "In Stock" : "Out of Stock",
      icon: data.available ? "✅" : "❌",
    });
  }

  // Check for data changes
  if (oldData) {
    const oldStr = JSON.stringify(oldData);
    const newStr = JSON.stringify(data);
    if (oldStr !== newStr) {
      insights.push({
        type: "warning",
        text: "Data updated",
        icon: "🔄",
      });
    }
  }

  // Add timestamp insight
  insights.push({
    type: "neutral",
    text: `Refreshed ${new Date().toLocaleTimeString()}`,
    icon: "🕐",
  });

  return insights.slice(0, 4); // Max 4 insights
}

/**
 * POST /api/snap-apps/:id/refresh
 * Refresh a Snap App with fresh data from Mino
 */
export async function POST(
  _request: Request,
  context: RouteContext
): Promise<NextResponse<ApiResponse<SnapApp, RefreshMeta>>> {
  try {
    const { id } = await context.params;

    // Get existing Snap App
    const existingApp = await getSnapApp(id);
    if (!existingApp) {
      return NextResponse.json(
        {
          success: false,
          error: "Snap App not found",
        },
        { status: 404 }
      );
    }

    // Check for Mino API key
    if (!MINO_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Mino API not configured",
        },
        { status: 503 }
      );
    }

    // Check for source URL
    if (!existingApp.sourceUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "No source URL for this Snap App",
        },
        { status: 400 }
      );
    }

    // Infer goal from existing app data
    const goal = inferGoalFromApp(existingApp);

    // Run Mino automation to get fresh data
    console.log(`[Refresh] Running Mino for ${existingApp.sourceUrl}: ${goal}`);
    const minoResult = await runMinoAutomation(
      MINO_API_KEY,
      existingApp.sourceUrl,
      goal
    );

    // If Mino failed, return error but DON'T wipe existing data
    if (minoResult.status === "error" || !minoResult.result) {
      console.error(`[Refresh] Mino error: ${minoResult.error}`);
      return NextResponse.json(
        {
          success: false,
          error: minoResult.error || "Failed to fetch fresh data",
          // Return existing app so UI can still display it
          data: existingApp,
        },
        { status: 502 }
      );
    }

    // Parse the new data
    const newData = parseMinoResult(minoResult.result);
    if (!newData) {
      console.error(`[Refresh] Failed to parse Mino result`);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse fresh data",
          data: existingApp,
        },
        { status: 502 }
      );
    }

    // Generate new insights comparing old and new data
    const insights = generateInsights(
      newData,
      existingApp.data as Record<string, unknown>
    );

    // Update the Snap App with new data
    // Note: updatedAt is automatically set by updateSnapApp
    const updatedApp = await updateSnapApp(id, {
      data: newData,
      insights,
    });

    if (!updatedApp) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update Snap App",
          data: existingApp,
        },
        { status: 500 }
      );
    }

    console.log(`[Refresh] Successfully refreshed Snap App ${id}`);

    return NextResponse.json({
      success: true,
      data: updatedApp,
      meta: {
        refreshedAt: new Date().toISOString(),
        dataChanged:
          JSON.stringify(existingApp.data) !== JSON.stringify(newData),
      },
    });
  } catch (error) {
    console.error("[Refresh] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Infer the goal/query from existing Snap App data
 */
function inferGoalFromApp(app: SnapApp): string {
  // Use title and subtitle to infer what to look for
  const parts: string[] = [];

  switch (app.type) {
    case "price_comparison":
      parts.push("Compare prices");
      break;
    case "product_gallery":
      parts.push("Find products");
      break;
    case "availability":
      parts.push("Check availability");
      break;
    case "article":
      parts.push("Get article summary");
      break;
    case "data_table":
      parts.push("Extract data table");
      break;
    case "pricing_health":
      parts.push("Analyze competitive pricing");
      break;
    default:
      parts.push("Get information");
  }

  if (app.title) {
    parts.push(`for ${app.title}`);
  }

  if (app.subtitle) {
    parts.push(`- ${app.subtitle}`);
  }

  return parts.join(" ");
}
