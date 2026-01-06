/**
 * Cron Pricing Refresh - Vercel Cron Job for scheduled SaaS pricing updates
 *
 * This endpoint is called by Vercel Cron to refresh all tracked pricing pages.
 * Schedule: Daily at 6 AM UTC (configure in vercel.json)
 *
 * GET /api/cron/pricing - Refresh all tracked pricing
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  SAAS_PRICING_DATABASE,
  scrapePricingPage,
  type SaaSPricing,
} from "@/lib/scrapers/saas-pricing";
import { processDiffAlerts, sendNotification } from "@/lib/notifications";

interface TrackedPricing {
  name: string;
  url: string;
  category: string;
  pricing: SaaSPricing | null;
  lastChecked: string;
  lastChanged: string | null;
  error?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;
const KV_PREFIX = "pricing:tracker";

// Who to notify about pricing changes (configure in env)
const PRICING_ALERT_USER_ID = process.env.PRICING_ALERT_USER_ID || "admin";

// ============================================================================
// GET - Refresh all pricing (called by Vercel Cron)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Unauthorized",
      };
      return NextResponse.json(response, { status: 401 });
    }

    const startTime = Date.now();
    const results: {
      name: string;
      success: boolean;
      changed: boolean;
      priceChange?: { old: number | null; new: number | null };
      error?: string;
    }[] = [];

    // Get existing tracked companies or use default database
    let companies = await kv.smembers(`${KV_PREFIX}:companies`);

    if (companies.length === 0) {
      // Initialize with default database
      for (const entry of SAAS_PRICING_DATABASE) {
        await kv.sadd(`${KV_PREFIX}:companies`, entry.name);
      }
      companies = SAAS_PRICING_DATABASE.map((e) => e.name);
    }

    let changedCount = 0;

    // Process each company
    for (const companyName of companies) {
      // Get current data
      const current = await kv.get<TrackedPricing>(
        `${KV_PREFIX}:${companyName}`
      );

      // Find URL (from current data or default database)
      const dbEntry = SAAS_PRICING_DATABASE.find((e) => e.name === companyName);
      const url = current?.url || dbEntry?.url;
      const category = current?.category || dbEntry?.category || "Other";

      if (!url) {
        results.push({
          name: companyName,
          success: false,
          changed: false,
          error: "No URL",
        });
        continue;
      }

      // Scrape new data
      const scraped = await scrapePricingPage(url, companyName);

      let changed = false;
      let priceChange:
        | { old: number | null; new: number | null }
        | undefined;

      if (scraped.success && scraped.data) {
        // Check for changes
        if (current?.pricing) {
          const oldPrices = JSON.stringify(current.pricing.tiers);
          const newPrices = JSON.stringify(scraped.data.tiers);
          changed = oldPrices !== newPrices;

          // Track price changes for the first tier
          if (changed) {
            const oldFirstTier = current.pricing.tiers[0];
            const newFirstTier = scraped.data.tiers[0];

            priceChange = {
              old: oldFirstTier?.price ?? null,
              new: newFirstTier?.price ?? null,
            };

            changedCount++;

            // Trigger diff alerts
            await processDiffAlerts(
              `pricing:${companyName}`,
              { pricing: current.pricing },
              { pricing: scraped.data },
              PRICING_ALERT_USER_ID
            );
          }
        } else {
          changed = true; // First time
        }
      }

      // Update stored data
      const updated: TrackedPricing = {
        name: companyName,
        url,
        category,
        pricing: scraped.success ? scraped.data! : current?.pricing || null,
        lastChecked: new Date().toISOString(),
        lastChanged: changed
          ? new Date().toISOString()
          : current?.lastChanged || null,
        error: scraped.success ? undefined : scraped.error,
      };

      await kv.set(`${KV_PREFIX}:${companyName}`, updated);

      results.push({
        name: companyName,
        success: scraped.success,
        changed,
        priceChange,
        error: scraped.error,
      });

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    const duration = Date.now() - startTime;

    // Send summary notification if there were changes
    if (changedCount > 0) {
      const changedCompanies = results
        .filter((r) => r.changed)
        .map((r) => r.name)
        .join(", ");

      await sendNotification(PRICING_ALERT_USER_ID, {
        title: "SaaS Pricing Changes Detected",
        body: `${changedCount} pricing pages changed: ${changedCompanies}`,
        data: {
          changes: results.filter((r) => r.changed),
        },
        priority: "high",
      });
    }

    // Summary
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      changed: changedCount,
      durationMs: duration,
    };

    const response: ApiResponse<{
      results: typeof results;
      summary: typeof summary;
      nextRun: string;
    }> = {
      success: true,
      data: {
        results,
        summary,
        nextRun: "Tomorrow at 6:00 AM UTC",
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Pricing cron refresh failed:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Pricing refresh failed",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// Vercel Cron Configuration
// ============================================================================

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout for processing all pages
