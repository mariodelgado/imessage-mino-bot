/**
 * SaaS Pricing Scraper
 *
 * Extracts pricing information from SaaS pricing pages.
 * Designed to work with common pricing page patterns.
 */

import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================

export const PricingTierSchema = z.object({
  name: z.string(),
  price: z.number().nullable(), // null for "Contact Sales" or custom pricing
  period: z.enum(["monthly", "yearly", "one-time", "custom"]).default("monthly"),
  currency: z.string().default("USD"),
  features: z.array(z.string()),
  highlighted: z.boolean().default(false), // "Popular" or featured tier
  cta: z.string().optional(), // Call to action text
});

export const SaaSPricingSchema = z.object({
  companyName: z.string(),
  url: z.string().url(),
  tiers: z.array(PricingTierSchema),
  hasFreeTier: z.boolean(),
  hasEnterprise: z.boolean(),
  lastUpdated: z.string(),
  rawHtml: z.string().optional(), // For debugging
});

export type PricingTier = z.infer<typeof PricingTierSchema>;
export type SaaSPricing = z.infer<typeof SaaSPricingSchema>;

// ============================================================================
// KNOWN SAAS PRICING PAGES
// ============================================================================

export const SAAS_PRICING_DATABASE: { name: string; url: string; category: string }[] = [
  // AI & ML
  { name: "OpenAI", url: "https://openai.com/pricing", category: "AI" },
  { name: "Anthropic", url: "https://www.anthropic.com/pricing", category: "AI" },
  { name: "Cohere", url: "https://cohere.com/pricing", category: "AI" },
  { name: "Replicate", url: "https://replicate.com/pricing", category: "AI" },
  { name: "Hugging Face", url: "https://huggingface.co/pricing", category: "AI" },

  // Developer Tools
  { name: "GitHub", url: "https://github.com/pricing", category: "Dev Tools" },
  { name: "GitLab", url: "https://about.gitlab.com/pricing/", category: "Dev Tools" },
  { name: "Vercel", url: "https://vercel.com/pricing", category: "Dev Tools" },
  { name: "Netlify", url: "https://www.netlify.com/pricing/", category: "Dev Tools" },
  { name: "Railway", url: "https://railway.app/pricing", category: "Dev Tools" },
  { name: "Render", url: "https://render.com/pricing", category: "Dev Tools" },
  { name: "Fly.io", url: "https://fly.io/pricing/", category: "Dev Tools" },

  // Productivity
  { name: "Notion", url: "https://www.notion.so/pricing", category: "Productivity" },
  { name: "Linear", url: "https://linear.app/pricing", category: "Productivity" },
  { name: "Slack", url: "https://slack.com/pricing", category: "Productivity" },
  { name: "Figma", url: "https://www.figma.com/pricing/", category: "Productivity" },

  // Analytics & Monitoring
  { name: "Posthog", url: "https://posthog.com/pricing", category: "Analytics" },
  { name: "Amplitude", url: "https://amplitude.com/pricing", category: "Analytics" },
  { name: "Mixpanel", url: "https://mixpanel.com/pricing/", category: "Analytics" },
  { name: "Datadog", url: "https://www.datadoghq.com/pricing/", category: "Monitoring" },
  { name: "Sentry", url: "https://sentry.io/pricing/", category: "Monitoring" },

  // Database & Backend
  { name: "Supabase", url: "https://supabase.com/pricing", category: "Database" },
  { name: "PlanetScale", url: "https://planetscale.com/pricing", category: "Database" },
  { name: "Neon", url: "https://neon.tech/pricing", category: "Database" },
  { name: "Firebase", url: "https://firebase.google.com/pricing", category: "Database" },
  { name: "Upstash", url: "https://upstash.com/pricing", category: "Database" },

  // Auth
  { name: "Auth0", url: "https://auth0.com/pricing", category: "Auth" },
  { name: "Clerk", url: "https://clerk.com/pricing", category: "Auth" },

  // Email & Communication
  { name: "Resend", url: "https://resend.com/pricing", category: "Email" },
  { name: "Postmark", url: "https://postmarkapp.com/pricing", category: "Email" },
  { name: "SendGrid", url: "https://sendgrid.com/en-us/pricing", category: "Email" },
  { name: "Twilio", url: "https://www.twilio.com/en-us/pricing", category: "Communication" },

  // CMS & Content
  { name: "Sanity", url: "https://www.sanity.io/pricing", category: "CMS" },
  { name: "Contentful", url: "https://www.contentful.com/pricing/", category: "CMS" },

  // Our reference
  { name: "Mino", url: "https://billing.mino.ai/", category: "AI" },
];

// ============================================================================
// PRICE EXTRACTION HELPERS
// ============================================================================

/**
 * Extract price from common formats:
 * - "$10/mo", "$10 / month", "$10/month"
 * - "$120/year", "$120 annually"
 * - "Free", "$0"
 * - "Contact Sales", "Custom"
 */
export function extractPrice(text: string): { price: number | null; period: PricingTier["period"] } {
  const normalized = text.toLowerCase().trim();

  // Free tier
  if (normalized === "free" || normalized === "$0" || normalized === "0") {
    return { price: 0, period: "monthly" };
  }

  // Contact sales / Custom
  if (
    normalized.includes("contact") ||
    normalized.includes("custom") ||
    normalized.includes("enterprise") ||
    normalized.includes("talk to")
  ) {
    return { price: null, period: "custom" };
  }

  // Extract numeric price
  const priceMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (!priceMatch) {
    return { price: null, period: "custom" };
  }

  const price = parseFloat(priceMatch[1].replace(",", ""));

  // Determine period
  let period: PricingTier["period"] = "monthly";
  if (normalized.includes("year") || normalized.includes("annual") || normalized.includes("/yr")) {
    period = "yearly";
  } else if (normalized.includes("one-time") || normalized.includes("once")) {
    period = "one-time";
  }

  return { price, period };
}

/**
 * Normalize yearly price to monthly for comparison
 */
export function normalizeToMonthly(price: number | null, period: PricingTier["period"]): number | null {
  if (price === null) return null;
  if (period === "yearly") return price / 12;
  return price;
}

// ============================================================================
// PRICING ANALYSIS
// ============================================================================

export interface PricingComparison {
  company: string;
  tier: string;
  monthlyPrice: number | null;
  vsMinoPercent: number | null; // Positive = more expensive, negative = cheaper
  features: string[];
}

/**
 * Compare extracted pricing against Mino's pricing
 */
export function comparePricing(
  allPricing: SaaSPricing[],
  minoPricing: SaaSPricing
): PricingComparison[] {
  const comparisons: PricingComparison[] = [];

  // Get Mino's comparable tier (usually "Pro" or middle tier)
  const minoProTier = minoPricing.tiers.find(
    t => t.name.toLowerCase().includes("pro") ||
         t.name.toLowerCase().includes("standard") ||
         (!t.name.toLowerCase().includes("free") && !t.name.toLowerCase().includes("enterprise"))
  ) || minoPricing.tiers[1]; // Fallback to second tier

  const minoMonthly = minoProTier
    ? normalizeToMonthly(minoProTier.price, minoProTier.period)
    : null;

  for (const pricing of allPricing) {
    if (pricing.companyName === "Mino") continue;

    for (const tier of pricing.tiers) {
      const monthlyPrice = normalizeToMonthly(tier.price, tier.period);

      let vsMinoPercent: number | null = null;
      if (monthlyPrice !== null && minoMonthly !== null && minoMonthly > 0) {
        vsMinoPercent = ((monthlyPrice - minoMonthly) / minoMonthly) * 100;
      }

      comparisons.push({
        company: pricing.companyName,
        tier: tier.name,
        monthlyPrice,
        vsMinoPercent,
        features: tier.features.slice(0, 5), // Top 5 features
      });
    }
  }

  return comparisons.sort((a, b) => {
    if (a.monthlyPrice === null) return 1;
    if (b.monthlyPrice === null) return -1;
    return a.monthlyPrice - b.monthlyPrice;
  });
}

// ============================================================================
// SCRAPE ORCHESTRATION
// ============================================================================

export interface ScrapedPricing {
  success: boolean;
  data?: SaaSPricing;
  error?: string;
  rawResponse?: string;
}

/**
 * Scrape pricing from a URL using an AI extraction approach
 * This is a placeholder - in production, use Firecrawl, Browserless, or similar
 */
export async function scrapePricingPage(
  url: string,
  companyName: string
): Promise<ScrapedPricing> {
  try {
    // In production, use a proper scraping service
    // For now, we'll use a simple fetch + regex approach
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const html = await response.text();

    // Very basic extraction - real implementation would use AI or DOM parsing
    const tiers: PricingTier[] = [];

    // Look for common pricing patterns
    const pricePatterns = [
      /\$(\d+(?:\.\d{2})?)\s*\/?\s*(mo(?:nth)?|yr|year|annually)?/gi,
      /(\d+(?:\.\d{2})?)\s*USD\s*\/?\s*(mo(?:nth)?|yr|year)?/gi,
    ];

    const prices: string[] = [];
    for (const pattern of pricePatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        prices.push(match[0]);
      }
    }

    // Dedupe and create tiers
    const uniquePrices = [...new Set(prices)].slice(0, 4);
    for (let i = 0; i < uniquePrices.length; i++) {
      const { price, period } = extractPrice(uniquePrices[i]);
      tiers.push({
        name: `Tier ${i + 1}`,
        price,
        period,
        currency: "USD",
        features: [],
        highlighted: i === 1, // Middle tier often highlighted
      });
    }

    // Determine has free tier
    const hasFreeTier = tiers.some(t => t.price === 0) ||
                        html.toLowerCase().includes("free tier") ||
                        html.toLowerCase().includes("free plan");

    // Determine has enterprise
    const hasEnterprise = html.toLowerCase().includes("enterprise") ||
                          html.toLowerCase().includes("contact sales");

    const data: SaaSPricing = {
      companyName,
      url,
      tiers,
      hasFreeTier,
      hasEnterprise,
      lastUpdated: new Date().toISOString(),
    };

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Scrape all known SaaS pricing pages
 */
export async function scrapeAllPricingPages(): Promise<Map<string, ScrapedPricing>> {
  const results = new Map<string, ScrapedPricing>();

  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < SAAS_PRICING_DATABASE.length; i += batchSize) {
    const batch = SAAS_PRICING_DATABASE.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(({ name, url }) => scrapePricingPage(url, name))
    );

    for (let j = 0; j < batch.length; j++) {
      results.set(batch[j].name, batchResults[j]);
    }

    // Small delay between batches
    if (i + batchSize < SAAS_PRICING_DATABASE.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}
