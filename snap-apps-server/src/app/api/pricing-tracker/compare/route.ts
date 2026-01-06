/**
 * Pricing Comparison API
 *
 * GET /api/pricing-tracker/compare - Compare pricing across SaaS companies
 * GET /api/pricing-tracker/compare?vs=mino - Compare against Mino's pricing
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import {
  normalizeToMonthly,
  type SaaSPricing,
  type PricingTier,
} from "@/lib/scrapers/saas-pricing";

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

interface ComparisonEntry {
  company: string;
  category: string;
  tier: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  hasFreeTier: boolean;
  hasEnterprise: boolean;
  vsReference: {
    percentDiff: number | null;
    cheaper: boolean | null;
  } | null;
}

const KV_PREFIX = "pricing:tracker";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vsCompany = searchParams.get("vs") || "mino";
    const category = searchParams.get("category");
    const tierFilter = searchParams.get("tier"); // "free", "pro", "enterprise"

    // Get all tracked companies
    const trackedCompanies = await kv.smembers(`${KV_PREFIX}:companies`);

    if (trackedCompanies.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No pricing data. Call POST /api/pricing-tracker with action='refresh' first.",
      }, { status: 404 });
    }

    // Fetch all pricing data
    const allPricing: TrackedPricing[] = [];
    for (const companyName of trackedCompanies) {
      const data = await kv.get<TrackedPricing>(`${KV_PREFIX}:${companyName}`);
      if (data?.pricing) {
        if (category && data.category !== category) continue;
        allPricing.push(data);
      }
    }

    // Find reference company for comparison
    const reference = allPricing.find(
      p => p.name.toLowerCase() === vsCompany.toLowerCase()
    );

    // Get reference tier price (usually "Pro" or middle tier)
    let referencePrice: number | null = null;
    if (reference?.pricing) {
      const refTier = findComparableTier(reference.pricing.tiers);
      if (refTier) {
        referencePrice = normalizeToMonthly(refTier.price, refTier.period);
      }
    }

    // Build comparison data
    const comparisons: ComparisonEntry[] = [];

    for (const company of allPricing) {
      if (!company.pricing) continue;

      // Filter by tier type
      let tiers = company.pricing.tiers;
      if (tierFilter) {
        tiers = tiers.filter(t => matchesTierFilter(t, tierFilter));
      }

      for (const tier of tiers) {
        const monthlyPrice = normalizeToMonthly(tier.price, tier.period);
        const yearlyPrice = tier.period === "yearly"
          ? tier.price
          : (monthlyPrice ? monthlyPrice * 12 : null);

        let vsReference: ComparisonEntry["vsReference"] = null;

        if (referencePrice !== null && monthlyPrice !== null && company.name !== vsCompany) {
          const percentDiff = ((monthlyPrice - referencePrice) / referencePrice) * 100;
          vsReference = {
            percentDiff: Math.round(percentDiff * 10) / 10,
            cheaper: percentDiff < 0,
          };
        }

        comparisons.push({
          company: company.name,
          category: company.category,
          tier: tier.name,
          monthlyPrice,
          yearlyPrice,
          hasFreeTier: company.pricing.hasFreeTier,
          hasEnterprise: company.pricing.hasEnterprise,
          vsReference,
        });
      }
    }

    // Sort by monthly price
    comparisons.sort((a, b) => {
      if (a.monthlyPrice === null) return 1;
      if (b.monthlyPrice === null) return -1;
      return a.monthlyPrice - b.monthlyPrice;
    });

    // Calculate statistics
    const prices = comparisons
      .map(c => c.monthlyPrice)
      .filter((p): p is number => p !== null);

    const stats = {
      totalCompanies: new Set(comparisons.map(c => c.company)).size,
      totalTiers: comparisons.length,
      priceRange: prices.length > 0
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : null,
      averagePrice: prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100
        : null,
      medianPrice: prices.length > 0
        ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
        : null,
      referenceCompany: vsCompany,
      referencePrice,
      cheaperThanReference: comparisons.filter(c => c.vsReference?.cheaper === true).length,
      moreExpensiveThanReference: comparisons.filter(c => c.vsReference?.cheaper === false).length,
    };

    // Group by category
    const byCategory = comparisons.reduce((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {} as Record<string, ComparisonEntry[]>);

    const response: ApiResponse<{
      comparisons: ComparisonEntry[];
      byCategory: typeof byCategory;
      stats: typeof stats;
    }> = {
      success: true,
      data: {
        comparisons,
        byCategory,
        stats,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to compare pricing:", error);

    return NextResponse.json(
      { success: false, error: "Failed to compare pricing" },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function findComparableTier(tiers: PricingTier[]): PricingTier | null {
  // Priority: Pro > Standard > Plus > Growth > second tier > first paid tier
  const priorities = ["pro", "standard", "plus", "growth", "team", "business"];

  for (const priority of priorities) {
    const tier = tiers.find(t => t.name.toLowerCase().includes(priority));
    if (tier) return tier;
  }

  // If no named tier found, return the second tier (often the "standard" one)
  if (tiers.length > 1) {
    const paidTiers = tiers.filter(t => t.price !== 0);
    return paidTiers[0] || tiers[1];
  }

  // Fallback to first tier
  return tiers[0] || null;
}

function matchesTierFilter(tier: PricingTier, filter: string): boolean {
  const name = tier.name.toLowerCase();
  const price = tier.price;

  switch (filter.toLowerCase()) {
    case "free":
      return price === 0 || name.includes("free");
    case "pro":
    case "standard":
      return !name.includes("free") &&
             !name.includes("enterprise") &&
             price !== null &&
             price > 0;
    case "enterprise":
      return name.includes("enterprise") ||
             name.includes("business") ||
             price === null;
    default:
      return true;
  }
}
