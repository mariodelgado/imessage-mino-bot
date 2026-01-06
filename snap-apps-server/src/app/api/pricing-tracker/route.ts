/**
 * SaaS Pricing Tracker API
 *
 * GET /api/pricing-tracker - Get all tracked pricing data
 * POST /api/pricing-tracker - Add a new pricing page to track
 * POST /api/pricing-tracker/refresh - Trigger a refresh of all pricing data
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  SAAS_PRICING_DATABASE,
  scrapePricingPage,
  type SaaSPricing,
} from "@/lib/scrapers/saas-pricing";
import { processDiffAlerts } from "@/lib/notifications";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface TrackedPricing {
  name: string;
  url: string;
  category: string;
  pricing: SaaSPricing | null;
  lastChecked: string;
  lastChanged: string | null;
  error?: string;
}

const KV_PREFIX = "pricing:tracker";

// ============================================================================
// GET - Get all tracked pricing data
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const company = searchParams.get("company");

    // Get all tracked companies
    const trackedCompanies = await kv.smembers(`${KV_PREFIX}:companies`);

    if (trackedCompanies.length === 0) {
      // Initialize with default database if empty
      return NextResponse.json({
        success: true,
        data: {
          companies: SAAS_PRICING_DATABASE,
          message: "No pricing data yet. Call POST /api/pricing-tracker/refresh to populate.",
        },
      });
    }

    // Fetch all pricing data
    const pricingData: TrackedPricing[] = [];

    for (const companyName of trackedCompanies) {
      const data = await kv.get<TrackedPricing>(`${KV_PREFIX}:${companyName}`);
      if (data) {
        // Filter by category if specified
        if (category && data.category !== category) continue;
        // Filter by company if specified
        if (company && data.name.toLowerCase() !== company.toLowerCase()) continue;

        pricingData.push(data);
      }
    }

    // Sort by name
    pricingData.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate summary stats
    const categories = [...new Set(pricingData.map(p => p.category))];
    const summary = {
      total: pricingData.length,
      withPricing: pricingData.filter(p => p.pricing !== null).length,
      withErrors: pricingData.filter(p => p.error).length,
      categories: categories.map(cat => ({
        name: cat,
        count: pricingData.filter(p => p.category === cat).length,
      })),
    };

    const response: ApiResponse<{ companies: TrackedPricing[]; summary: typeof summary }> = {
      success: true,
      data: {
        companies: pricingData,
        summary,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get pricing data:", error);

    return NextResponse.json(
      { success: false, error: "Failed to get pricing data" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Add a new company to track or trigger refresh
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, name, url, category } = body;

    // Refresh all pricing data
    if (action === "refresh") {
      return handleRefresh();
    }

    // Add new company to track
    if (action === "add" && name && url) {
      // Check if already exists
      const exists = await kv.sismember(`${KV_PREFIX}:companies`, name);
      if (exists) {
        return NextResponse.json(
          { success: false, error: "Company already tracked" },
          { status: 400 }
        );
      }

      // Add to set
      await kv.sadd(`${KV_PREFIX}:companies`, name);

      // Scrape initial data
      const scraped = await scrapePricingPage(url, name);

      const tracked: TrackedPricing = {
        name,
        url,
        category: category || "Other",
        pricing: scraped.success ? scraped.data! : null,
        lastChecked: new Date().toISOString(),
        lastChanged: scraped.success ? new Date().toISOString() : null,
        error: scraped.error,
      };

      await kv.set(`${KV_PREFIX}:${name}`, tracked);

      return NextResponse.json({
        success: true,
        data: tracked,
      }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'refresh' or 'add' with name/url." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to process pricing tracker request:", error);

    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// ============================================================================
// REFRESH HANDLER
// ============================================================================

async function handleRefresh(): Promise<NextResponse> {
  const results: { name: string; success: boolean; changed: boolean; error?: string }[] = [];

  // Get existing tracked companies or use default database
  let companies = await kv.smembers(`${KV_PREFIX}:companies`);

  if (companies.length === 0) {
    // Initialize with default database
    for (const entry of SAAS_PRICING_DATABASE) {
      await kv.sadd(`${KV_PREFIX}:companies`, entry.name);
    }
    companies = SAAS_PRICING_DATABASE.map(e => e.name);
  }

  // Process each company
  for (const companyName of companies) {
    // Get current data
    const current = await kv.get<TrackedPricing>(`${KV_PREFIX}:${companyName}`);

    // Find URL (from current data or default database)
    const dbEntry = SAAS_PRICING_DATABASE.find(e => e.name === companyName);
    const url = current?.url || dbEntry?.url;
    const category = current?.category || dbEntry?.category || "Other";

    if (!url) {
      results.push({ name: companyName, success: false, changed: false, error: "No URL" });
      continue;
    }

    // Scrape new data
    const scraped = await scrapePricingPage(url, companyName);

    let changed = false;

    if (scraped.success && scraped.data) {
      // Check for changes
      if (current?.pricing) {
        const oldPrices = JSON.stringify(current.pricing.tiers);
        const newPrices = JSON.stringify(scraped.data.tiers);
        changed = oldPrices !== newPrices;

        // If changed, trigger diff alerts
        if (changed) {
          // Create a SnapApp-compatible structure for diff alerts
          await processDiffAlerts(
            `pricing:${companyName}`,
            { pricing: current.pricing },
            { pricing: scraped.data }
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
      lastChanged: changed ? new Date().toISOString() : (current?.lastChanged || null),
      error: scraped.success ? undefined : scraped.error,
    };

    await kv.set(`${KV_PREFIX}:${companyName}`, updated);

    results.push({
      name: companyName,
      success: scraped.success,
      changed,
      error: scraped.error,
    });

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  const summary = {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    changed: results.filter(r => r.changed).length,
  };

  return NextResponse.json({
    success: true,
    data: {
      results,
      summary,
      refreshedAt: new Date().toISOString(),
    },
  });
}
