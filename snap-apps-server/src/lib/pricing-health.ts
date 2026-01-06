/**
 * Pricing Health Dashboard
 *
 * Apple Health-style metrics for competitive pricing intelligence.
 * Tracks trends, alerts, and competitive positioning over time.
 */

import { kv } from "@vercel/kv";
import type { SaaSPricing } from "./scrapers/saas-pricing";
import { normalizeToMonthly } from "./scrapers/saas-pricing";

// ============================================================================
// TYPES
// ============================================================================

export interface PricingSnapshot {
  timestamp: string;
  companyName: string;
  tiers: {
    name: string;
    monthlyPrice: number | null;
    yearlyPrice: number | null;
  }[];
}

export interface PricingTrend {
  companyName: string;
  category: string;
  currentPrice: number | null;
  priceHistory: { date: string; price: number | null }[];
  trend: "up" | "down" | "stable" | "unknown";
  percentChange30d: number | null;
  percentChange90d: number | null;
}

export interface HealthMetric {
  name: string;
  value: number | string;
  change: number | null;
  trend: "up" | "down" | "stable";
  status: "good" | "warning" | "bad" | "neutral";
  description: string;
}

export interface PricingHealthDashboard {
  // Summary metrics (like Apple Health rings)
  metrics: {
    competitivePosition: HealthMetric;
    marketAverage: HealthMetric;
    priceVolatility: HealthMetric;
    alertsTriggered: HealthMetric;
  };

  // Trend chart data (like Apple Health graphs)
  trends: PricingTrend[];

  // Alert timeline (like Apple Health notifications)
  recentAlerts: {
    timestamp: string;
    company: string;
    type: "price_increase" | "price_decrease" | "new_tier" | "tier_removed";
    details: string;
    severity: "low" | "medium" | "high";
  }[];

  // Category breakdown (like Apple Health categories)
  categories: {
    name: string;
    avgPrice: number | null;
    companies: number;
    yourPosition: "below" | "at" | "above" | "unknown";
  }[];

  // Competitive grid (simplified comparison)
  competitiveGrid: {
    company: string;
    category: string;
    proTierPrice: number | null;
    vsYou: number | null; // % difference
    trend: "up" | "down" | "stable";
  }[];

  generatedAt: string;
}

const KV_PREFIX = "pricing:tracker";
const HISTORY_PREFIX = "pricing:history";

// ============================================================================
// HISTORY TRACKING
// ============================================================================

/**
 * Save a pricing snapshot to history
 */
export async function savePricingSnapshot(
  companyName: string,
  pricing: SaaSPricing
): Promise<void> {
  const snapshot: PricingSnapshot = {
    timestamp: new Date().toISOString(),
    companyName,
    tiers: pricing.tiers.map(t => ({
      name: t.name,
      monthlyPrice: normalizeToMonthly(t.price, t.period),
      yearlyPrice: t.period === "yearly" ? t.price : (t.price ? t.price * 12 : null),
    })),
  };

  // Store in a sorted set by timestamp
  const key = `${HISTORY_PREFIX}:${companyName}`;
  await kv.zadd(key, { score: Date.now(), member: JSON.stringify(snapshot) });

  // Keep only last 365 days of history
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  await kv.zremrangebyscore(key, 0, oneYearAgo);
}

/**
 * Get pricing history for a company
 */
export async function getPricingHistory(
  companyName: string,
  days: number = 90
): Promise<PricingSnapshot[]> {
  const key = `${HISTORY_PREFIX}:${companyName}`;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // Use zrange with byScore option (Vercel KV API)
  const raw = await kv.zrange(key, cutoff, Date.now(), { byScore: true });
  return raw.map(r => JSON.parse(r as string) as PricingSnapshot);
}

// ============================================================================
// TREND CALCULATION
// ============================================================================

/**
 * Calculate pricing trend for a company
 */
export async function calculatePricingTrend(
  companyName: string,
  category: string,
  currentPricing: SaaSPricing | null
): Promise<PricingTrend> {
  const history = await getPricingHistory(companyName, 90);

  // Find the "pro" tier or first paid tier
  const getCurrentPrice = (pricing: SaaSPricing | null): number | null => {
    if (!pricing) return null;
    const proTier = pricing.tiers.find(t =>
      t.name.toLowerCase().includes("pro") ||
      t.name.toLowerCase().includes("standard")
    ) || pricing.tiers.find(t => t.price && t.price > 0) || pricing.tiers[0];

    return proTier ? normalizeToMonthly(proTier.price, proTier.period) : null;
  };

  const currentPrice = getCurrentPrice(currentPricing);

  // Build price history
  const priceHistory = history.map(h => ({
    date: h.timestamp.split("T")[0],
    price: h.tiers[0]?.monthlyPrice ?? null,
  }));

  // Add current price
  if (currentPrice !== null) {
    priceHistory.push({
      date: new Date().toISOString().split("T")[0],
      price: currentPrice,
    });
  }

  // Calculate changes
  let percentChange30d: number | null = null;
  let percentChange90d: number | null = null;
  let trend: PricingTrend["trend"] = "unknown";

  if (priceHistory.length >= 2 && currentPrice !== null) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const price30d = priceHistory.find(p =>
      new Date(p.date) <= thirtyDaysAgo && p.price !== null
    )?.price;
    const price90d = priceHistory.find(p =>
      new Date(p.date) <= ninetyDaysAgo && p.price !== null
    )?.price;

    if (price30d) {
      percentChange30d = ((currentPrice - price30d) / price30d) * 100;
    }
    if (price90d) {
      percentChange90d = ((currentPrice - price90d) / price90d) * 100;
    }

    // Determine trend
    if (percentChange30d !== null) {
      if (percentChange30d > 2) trend = "up";
      else if (percentChange30d < -2) trend = "down";
      else trend = "stable";
    }
  }

  return {
    companyName,
    category,
    currentPrice,
    priceHistory,
    trend,
    percentChange30d: percentChange30d ? Math.round(percentChange30d * 10) / 10 : null,
    percentChange90d: percentChange90d ? Math.round(percentChange90d * 10) / 10 : null,
  };
}

// ============================================================================
// HEALTH DASHBOARD GENERATION
// ============================================================================

interface TrackedPricing {
  name: string;
  url: string;
  category: string;
  pricing: SaaSPricing | null;
  lastChecked: string;
  lastChanged: string | null;
}

/**
 * Generate the full Pricing Health dashboard
 */
export async function generatePricingHealthDashboard(
  referenceCompany: string = "Mino"
): Promise<PricingHealthDashboard> {
  // Get all tracked companies
  const companies = await kv.smembers(`${KV_PREFIX}:companies`);

  const allPricing: TrackedPricing[] = [];
  for (const name of companies) {
    const data = await kv.get<TrackedPricing>(`${KV_PREFIX}:${name}`);
    if (data) allPricing.push(data);
  }

  // Find reference company
  const reference = allPricing.find(
    p => p.name.toLowerCase() === referenceCompany.toLowerCase()
  );
  const referencePrice = reference?.pricing
    ? getProTierPrice(reference.pricing)
    : null;

  // Calculate competitive grid
  const competitiveGrid: PricingHealthDashboard["competitiveGrid"] = [];
  const prices: number[] = [];

  for (const company of allPricing) {
    if (!company.pricing) continue;

    const proPrice = getProTierPrice(company.pricing);
    if (proPrice !== null) prices.push(proPrice);

    let vsYou: number | null = null;
    if (referencePrice !== null && proPrice !== null) {
      vsYou = Math.round(((proPrice - referencePrice) / referencePrice) * 100);
    }

    const trend = await calculatePricingTrend(
      company.name,
      company.category,
      company.pricing
    );

    competitiveGrid.push({
      company: company.name,
      category: company.category,
      proTierPrice: proPrice,
      vsYou,
      trend: trend.trend === "unknown" ? "stable" : trend.trend,
    });
  }

  // Sort by price
  competitiveGrid.sort((a, b) => {
    if (a.proTierPrice === null) return 1;
    if (b.proTierPrice === null) return -1;
    return a.proTierPrice - b.proTierPrice;
  });

  // Calculate category breakdown
  const categoryMap = new Map<string, { prices: number[]; count: number }>();
  for (const company of allPricing) {
    const cat = company.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { prices: [], count: 0 });
    }
    const entry = categoryMap.get(cat)!;
    entry.count++;
    const price = company.pricing ? getProTierPrice(company.pricing) : null;
    if (price !== null) entry.prices.push(price);
  }

  const categories: PricingHealthDashboard["categories"] = [];
  for (const [name, data] of categoryMap) {
    const avgPrice = data.prices.length > 0
      ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length)
      : null;

    let yourPosition: "below" | "at" | "above" | "unknown" = "unknown";
    if (referencePrice !== null && avgPrice !== null) {
      if (referencePrice < avgPrice * 0.9) yourPosition = "below";
      else if (referencePrice > avgPrice * 1.1) yourPosition = "above";
      else yourPosition = "at";
    }

    categories.push({
      name,
      avgPrice,
      companies: data.count,
      yourPosition,
    });
  }

  // Calculate health metrics
  const avgMarketPrice = prices.length > 0
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null;

  const yourRank = referencePrice !== null
    ? prices.filter(p => p < referencePrice).length + 1
    : null;

  const percentile = yourRank !== null
    ? Math.round(((prices.length - yourRank + 1) / prices.length) * 100)
    : null;

  const metrics: PricingHealthDashboard["metrics"] = {
    competitivePosition: {
      name: "Competitive Position",
      value: percentile !== null ? `Top ${100 - percentile}%` : "Unknown",
      change: null, // Would need history
      trend: "stable",
      status: percentile !== null
        ? (percentile > 70 ? "good" : percentile > 40 ? "neutral" : "warning")
        : "neutral",
      description: `Your pricing ranks #${yourRank} of ${prices.length} tracked competitors`,
    },
    marketAverage: {
      name: "Market Average",
      value: avgMarketPrice !== null ? `$${avgMarketPrice}/mo` : "Unknown",
      change: null,
      trend: "stable",
      status: "neutral",
      description: `Average pro-tier price across ${prices.length} competitors`,
    },
    priceVolatility: {
      name: "Market Volatility",
      value: "Low", // Would calculate from history
      change: null,
      trend: "stable",
      status: "good",
      description: "Price change frequency in the market",
    },
    alertsTriggered: {
      name: "Recent Alerts",
      value: 0, // Would count from alert history
      change: null,
      trend: "stable",
      status: "good",
      description: "Price changes detected in last 7 days",
    },
  };

  // Get trends for visualization
  const trends: PricingTrend[] = [];
  for (const company of allPricing.slice(0, 10)) { // Top 10 for performance
    const trend = await calculatePricingTrend(
      company.name,
      company.category,
      company.pricing
    );
    trends.push(trend);
  }

  return {
    metrics,
    trends,
    recentAlerts: [], // Would populate from alert history
    categories,
    competitiveGrid,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getProTierPrice(pricing: SaaSPricing): number | null {
  const proTier = pricing.tiers.find(t =>
    t.name.toLowerCase().includes("pro") ||
    t.name.toLowerCase().includes("standard") ||
    t.name.toLowerCase().includes("plus")
  ) || pricing.tiers.find(t => t.price && t.price > 0) || pricing.tiers[1];

  return proTier ? normalizeToMonthly(proTier.price, proTier.period) : null;
}
