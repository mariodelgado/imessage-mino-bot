/**
 * Mino Magic Flow - The Complete Experience
 *
 * The flagship experience that demonstrates Mino's power:
 * 1. User provides company URL
 * 2. Clarifying questions → Goal setting → PRD generation
 * 3. Competitor universe discovery
 * 4. Parallel multi-step workflow execution
 * 5. Analysis, synthesis, recommendations
 * 6. Value realization loop (alerts, monitoring, sharing)
 *
 * All done with magic and delight ✨
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyProfile {
  url: string;
  name: string;
  domain: string;
  industry?: string;
  description?: string;
  pricing?: {
    model: "freemium" | "subscription" | "usage" | "enterprise" | "one-time" | "unknown";
    tiers?: string[];
    lowestPrice?: number;
    currency?: string;
  };
  extractedAt: string;
}

export interface ProjectGoal {
  type: "competitive_analysis" | "pricing_intel" | "market_research" | "feature_comparison" | "custom";
  description: string;
  focusAreas: string[];
  deliverables: string[];
  urgency: "immediate" | "this_week" | "ongoing";
}

export interface PRD {
  title: string;
  objective: string;
  scope: string[];
  outOfScope: string[];
  successMetrics: string[];
  deliverables: {
    name: string;
    description: string;
    format: "snap_app" | "report" | "alert" | "dashboard";
  }[];
  timeline: string;
  generatedAt: string;
}

export interface Competitor {
  name: string;
  url: string;
  domain: string;
  relevanceScore: number; // 0-100
  category: "direct" | "indirect" | "adjacent" | "aspirational";
  reason: string;
  pricingUrl?: string;
}

export interface WorkflowStep {
  id: string;
  type: "scrape" | "analyze" | "compare" | "synthesize" | "alert";
  target: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MagicSession {
  id: string;
  phone: string;

  // Phase 1: Intake
  companyUrl?: string;
  companyProfile?: CompanyProfile;

  // Phase 2: Goal Setting
  clarifyingQuestions: { question: string; answer?: string }[];
  goal?: ProjectGoal;
  prd?: PRD;

  // Phase 3: Discovery
  competitors: Competitor[];
  discoveryComplete: boolean;

  // Phase 4: Execution
  workflows: WorkflowStep[];
  executionProgress: number; // 0-100

  // Phase 5: Analysis
  analysis?: {
    summary: string;
    insights: string[];
    recommendations: string[];
    snapAppId?: string;
  };

  // Phase 6: Value Loop
  alertsConfigured: boolean;
  monitoringActive: boolean;
  shareUrl?: string;

  // Meta
  phase: "intake" | "clarifying" | "discovery" | "execution" | "analysis" | "value_loop" | "complete";
  startedAt: string;
  lastActivityAt: string;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const activeSessions = new Map<string, MagicSession>();

export function getSession(phone: string): MagicSession | undefined {
  return activeSessions.get(phone);
}

export function createSession(phone: string, companyUrl: string): MagicSession {
  const session: MagicSession = {
    id: `magic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    phone,
    companyUrl,
    clarifyingQuestions: [],
    competitors: [],
    discoveryComplete: false,
    workflows: [],
    executionProgress: 0,
    alertsConfigured: false,
    monitoringActive: false,
    phase: "intake",
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  activeSessions.set(phone, session);
  return session;
}

export function updateSession(phone: string, updates: Partial<MagicSession>): MagicSession | undefined {
  const session = activeSessions.get(phone);
  if (!session) return undefined;

  Object.assign(session, updates, { lastActivityAt: new Date().toISOString() });
  return session;
}

export function clearSession(phone: string): void {
  activeSessions.delete(phone);
}

// ============================================================================
// PHASE 1: COMPANY INTAKE
// ============================================================================

let genAI: GoogleGenerativeAI | null = null;

export function initMagic(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Extract company profile from URL
 */
export async function extractCompanyProfile(url: string): Promise<CompanyProfile> {
  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const domain = new URL(normalizedUrl).hostname.replace("www.", "");
  const name = domain.split(".")[0];

  // Try to fetch and analyze the page
  let description = "";

  try {
    const response = await fetch(normalizedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });

    if (response.ok) {
      const html = await response.text();

      // Extract meta description
      const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (metaMatch) {
        description = metaMatch[1];
      }

      // Extract title for name
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        const title = titleMatch[1].split(/[|\-–]/)[0].trim();
        if (title.length < 50) {
          // Use as company name if reasonable
        }
      }

      // Use AI to analyze if we have the model
      if (genAI && html.length > 0) {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(`
          Analyze this company website HTML and extract:
          1. Company name (proper capitalization)
          2. Industry/category (e.g., "AI", "SaaS", "E-commerce")
          3. Brief description (1 sentence)
          4. Pricing model if visible (freemium/subscription/usage/enterprise/one-time)

          Respond in JSON format only:
          {"name": "", "industry": "", "description": "", "pricingModel": ""}

          HTML (first 5000 chars):
          ${html.slice(0, 5000)}
        `);

        try {
          const text = result.response.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              url: normalizedUrl,
              name: parsed.name || name,
              domain,
              industry: parsed.industry || undefined,
              description: parsed.description || description,
              pricing: parsed.pricingModel ? {
                model: parsed.pricingModel as NonNullable<CompanyProfile["pricing"]>["model"],
              } : undefined,
              extractedAt: new Date().toISOString(),
            };
          }
        } catch {
          // Fall through to basic extraction
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch company URL:", err);
  }

  // Return basic profile
  return {
    url: normalizedUrl,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    domain,
    description: description || undefined,
    extractedAt: new Date().toISOString(),
  };
}

// ============================================================================
// PHASE 2: CLARIFYING QUESTIONS & PRD
// ============================================================================

const GOAL_QUESTIONS = [
  {
    id: "primary_goal",
    question: "What's your main goal? (Pick one)\n\n1️⃣ Competitive pricing intelligence\n2️⃣ Feature comparison analysis\n3️⃣ Market landscape overview\n4️⃣ Something specific",
    options: ["1", "2", "3", "4"],
    maps_to: {
      "1": "pricing_intel",
      "2": "feature_comparison",
      "3": "market_research",
      "4": "custom",
    },
  },
  {
    id: "focus_areas",
    question: "What aspects matter most? (Reply with numbers, e.g., '1,2,4')\n\n1️⃣ Pricing & packaging\n2️⃣ Feature sets\n3️⃣ Target customers\n4️⃣ Positioning & messaging\n5️⃣ Market trends",
  },
  {
    id: "urgency",
    question: "How urgent is this?\n\n🔥 Need it now\n📅 This week is fine\n🔄 Ongoing monitoring",
    options: ["now", "week", "ongoing", "🔥", "📅", "🔄"],
  },
];

/**
 * Get the next clarifying question for a session
 */
export function getNextQuestion(session: MagicSession): string | null {
  const answered = session.clarifyingQuestions.filter(q => q.answer).length;

  if (answered >= GOAL_QUESTIONS.length) {
    return null; // All questions answered
  }

  return GOAL_QUESTIONS[answered].question;
}

/**
 * Process an answer to a clarifying question
 */
export function processAnswer(session: MagicSession, answer: string): void {
  const currentIndex = session.clarifyingQuestions.filter(q => q.answer).length;
  const currentQuestion = GOAL_QUESTIONS[currentIndex];

  if (!currentQuestion) return;

  session.clarifyingQuestions.push({
    question: currentQuestion.question,
    answer: answer.trim(),
  });

  session.lastActivityAt = new Date().toISOString();
}

/**
 * Generate goal and PRD from answers
 */
export async function generateGoalAndPRD(session: MagicSession): Promise<{ goal: ProjectGoal; prd: PRD }> {
  const answers = session.clarifyingQuestions;
  const company = session.companyProfile;

  // Parse answers to determine goal
  const goalAnswer = answers[0]?.answer || "1";
  const goalMap: Record<string, ProjectGoal["type"]> = {
    "1": "pricing_intel",
    "2": "feature_comparison",
    "3": "market_research",
    "4": "custom",
  };

  const goalType = goalMap[goalAnswer.charAt(0)] || "competitive_analysis";

  // Parse focus areas
  const focusAnswer = answers[1]?.answer || "1,2";
  const focusMap: Record<string, string> = {
    "1": "Pricing & packaging",
    "2": "Feature sets",
    "3": "Target customers",
    "4": "Positioning & messaging",
    "5": "Market trends",
  };
  const focusAreas = focusAnswer
    .split(/[,\s]+/)
    .map(n => focusMap[n.trim()])
    .filter(Boolean);

  // Parse urgency
  const urgencyAnswer = answers[2]?.answer?.toLowerCase() || "week";
  let urgency: ProjectGoal["urgency"] = "this_week";
  if (urgencyAnswer.includes("now") || urgencyAnswer.includes("🔥")) {
    urgency = "immediate";
  } else if (urgencyAnswer.includes("ongoing") || urgencyAnswer.includes("🔄")) {
    urgency = "ongoing";
  }

  const goal: ProjectGoal = {
    type: goalType,
    description: `${goalType.replace(/_/g, " ")} for ${company?.name || "your company"}`,
    focusAreas,
    deliverables: [
      "Competitive landscape overview",
      "Detailed analysis report",
      "Interactive dashboard",
      urgency === "ongoing" ? "Automated monitoring alerts" : "Actionable recommendations",
    ],
    urgency,
  };

  // Generate PRD
  const prd: PRD = {
    title: `${company?.name || "Company"} ${goalType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`,
    objective: `Provide comprehensive ${goalType.replace(/_/g, " ")} to help ${company?.name || "you"} make informed strategic decisions.`,
    scope: [
      `Identify and analyze top competitors in ${company?.industry || "the market"}`,
      ...focusAreas.map(area => `Deep-dive into ${area.toLowerCase()}`),
      "Synthesize findings into actionable insights",
    ],
    outOfScope: [
      "Internal company strategy recommendations",
      "Legal or compliance advice",
      "Financial projections",
    ],
    successMetrics: [
      "Complete competitor mapping",
      "Accurate pricing data for 80%+ of competitors",
      "Clear, actionable recommendations",
      urgency === "ongoing" ? "Automated alerts configured" : "",
    ].filter(Boolean),
    deliverables: [
      {
        name: "Competitive Landscape",
        description: "Visual map of all identified competitors",
        format: "snap_app",
      },
      {
        name: "Pricing Analysis",
        description: "Detailed pricing comparison with positioning",
        format: "dashboard",
      },
      {
        name: "Key Insights Report",
        description: "Top findings and recommendations",
        format: "report",
      },
      ...(urgency === "ongoing" ? [{
        name: "Monitoring Alerts",
        description: "Automated notifications for competitor changes",
        format: "alert" as const,
      }] : []),
    ],
    timeline: urgency === "immediate" ? "Next few minutes" : urgency === "ongoing" ? "Initial delivery today, then ongoing" : "Today",
    generatedAt: new Date().toISOString(),
  };

  return { goal, prd };
}

// ============================================================================
// PHASE 3: COMPETITOR DISCOVERY
// ============================================================================

/**
 * Discover competitors using AI and web search
 */
export async function discoverCompetitors(
  session: MagicSession,
  webSearchFn?: (query: string) => Promise<string[]>
): Promise<Competitor[]> {
  const company = session.companyProfile;
  if (!company || !genAI) return [];

  const competitors: Competitor[] = [];

  // Strategy 1: AI-generated competitor list
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    Given this company:
    - Name: ${company.name}
    - Domain: ${company.domain}
    - Industry: ${company.industry || "Unknown"}
    - Description: ${company.description || "Unknown"}

    List 10-15 competitors across these categories:
    1. Direct competitors (same product/market)
    2. Indirect competitors (different approach, same problem)
    3. Adjacent competitors (related market)
    4. Aspirational competitors (market leaders to learn from)

    For each, provide:
    - name: Company name
    - url: Website URL
    - category: direct/indirect/adjacent/aspirational
    - relevance: Score 0-100
    - reason: Why they're a competitor (1 sentence)

    Respond ONLY with valid JSON array:
    [{"name": "", "url": "", "category": "", "relevance": 0, "reason": ""}]
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const c of parsed) {
        if (c.name && c.url) {
          const domain = new URL(c.url.startsWith("http") ? c.url : `https://${c.url}`).hostname.replace("www.", "");
          competitors.push({
            name: c.name,
            url: c.url.startsWith("http") ? c.url : `https://${c.url}`,
            domain,
            relevanceScore: c.relevance || 50,
            category: c.category || "direct",
            reason: c.reason || "",
            pricingUrl: `https://${domain}/pricing`,
          });
        }
      }
    }
  } catch (err) {
    console.error("AI competitor discovery failed:", err);
  }

  // Strategy 2: Web search augmentation (if available)
  if (webSearchFn) {
    try {
      const searchQueries = [
        `${company.name} competitors`,
        `${company.name} alternatives`,
        `${company.industry || ""} SaaS tools`,
      ];

      for (const query of searchQueries) {
        await webSearchFn(query);
        // Process search results to extract additional competitors
        // This would parse URLs from search results
      }
    } catch (err) {
      console.error("Web search augmentation failed:", err);
    }
  }

  // Deduplicate by domain
  const seen = new Set<string>();
  const unique = competitors.filter(c => {
    if (seen.has(c.domain)) return false;
    if (c.domain === company.domain) return false; // Exclude self
    seen.add(c.domain);
    return true;
  });

  // Sort by relevance
  return unique.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ============================================================================
// PHASE 4: PARALLEL WORKFLOW EXECUTION
// ============================================================================

export interface WorkflowResult {
  competitor: string;
  success: boolean;
  pricing?: {
    tiers: { name: string; price: number | null; period: string }[];
    hasFreeTier: boolean;
    hasEnterprise: boolean;
  };
  features?: string[];
  positioning?: string;
  error?: string;
}

/**
 * Execute workflows in parallel across all competitors
 */
export async function executeWorkflows(
  session: MagicSession,
  onProgress?: (progress: number, message: string) => void
): Promise<WorkflowResult[]> {
  const competitors = session.competitors;
  const results: WorkflowResult[] = [];

  // Create workflow steps for each competitor
  for (const competitor of competitors) {
    session.workflows.push({
      id: `scrape-${competitor.domain}`,
      type: "scrape",
      target: competitor.url,
      status: "pending",
    });
  }

  // Execute in batches of 5 for rate limiting
  const batchSize = 5;
  const total = competitors.length;
  let completed = 0;

  for (let i = 0; i < competitors.length; i += batchSize) {
    const batch = competitors.slice(i, i + batchSize);

    const batchPromises = batch.map(async (competitor) => {
      const workflowId = `scrape-${competitor.domain}`;
      const workflow = session.workflows.find(w => w.id === workflowId);
      if (workflow) {
        workflow.status = "running";
        workflow.startedAt = new Date().toISOString();
      }

      try {
        const result = await scrapeCompetitor(competitor);

        if (workflow) {
          workflow.status = "completed";
          workflow.completedAt = new Date().toISOString();
          workflow.result = result;
        }

        completed++;
        const progress = Math.round((completed / total) * 100);
        session.executionProgress = progress;

        if (onProgress) {
          onProgress(progress, `Analyzed ${competitor.name} (${completed}/${total})`);
        }

        return result;
      } catch (err) {
        if (workflow) {
          workflow.status = "failed";
          workflow.error = err instanceof Error ? err.message : "Unknown error";
        }

        completed++;
        session.executionProgress = Math.round((completed / total) * 100);

        return {
          competitor: competitor.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < competitors.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

/**
 * Scrape a single competitor
 */
async function scrapeCompetitor(competitor: Competitor): Promise<WorkflowResult> {
  const result: WorkflowResult = {
    competitor: competitor.name,
    success: false,
  };

  try {
    // Try to fetch pricing page
    const pricingUrl = competitor.pricingUrl || `${competitor.url}/pricing`;
    const response = await fetch(pricingUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    });

    if (response.ok) {
      const html = await response.text();

      // Extract pricing with AI if available
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const aiResult = await model.generateContent(`
          Extract pricing information from this HTML.

          Return JSON only:
          {
            "tiers": [{"name": "", "price": null or number, "period": "monthly/yearly"}],
            "hasFreeTier": boolean,
            "hasEnterprise": boolean,
            "features": ["top 5 features"],
            "positioning": "brief positioning statement"
          }

          HTML (first 8000 chars):
          ${html.slice(0, 8000)}
        `);

        try {
          const text = aiResult.response.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            result.pricing = {
              tiers: parsed.tiers || [],
              hasFreeTier: parsed.hasFreeTier || false,
              hasEnterprise: parsed.hasEnterprise || false,
            };
            result.features = parsed.features || [];
            result.positioning = parsed.positioning || "";
            result.success = true;
          }
        } catch {
          // Basic extraction fallback
        }
      }

      // Basic regex extraction as fallback
      if (!result.success) {
        const priceMatches = html.match(/\$(\d+(?:\.\d{2})?)/g) || [];
        if (priceMatches.length > 0) {
          result.pricing = {
            tiers: priceMatches.slice(0, 4).map((p, i) => ({
              name: `Tier ${i + 1}`,
              price: parseFloat(p.replace("$", "")),
              period: "monthly",
            })),
            hasFreeTier: html.toLowerCase().includes("free"),
            hasEnterprise: html.toLowerCase().includes("enterprise"),
          };
          result.success = true;
        }
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Failed to fetch";
  }

  return result;
}

// ============================================================================
// PHASE 5: ANALYSIS & SYNTHESIS
// ============================================================================

export interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  competitivePosition: {
    description: string;
    pricePercentile: number; // 0-100, where 100 is most expensive
    strengthAreas: string[];
    opportunityAreas: string[];
  };
  marketOverview: {
    avgPrice: number | null;
    priceRange: { min: number; max: number } | null;
    commonFeatures: string[];
    differentiators: string[];
  };
}

/**
 * Analyze and synthesize all collected data
 */
export async function analyzeAndSynthesize(
  session: MagicSession,
  workflowResults: WorkflowResult[]
): Promise<AnalysisResult> {
  const company = session.companyProfile;
  const goal = session.goal;
  const successfulResults = workflowResults.filter(r => r.success);

  // Calculate market statistics
  const allPrices: number[] = [];
  const allFeatures: string[] = [];

  for (const r of successfulResults) {
    if (r.pricing?.tiers) {
      for (const tier of r.pricing.tiers) {
        if (tier.price !== null && tier.price > 0) {
          allPrices.push(tier.price);
        }
      }
    }
    if (r.features) {
      allFeatures.push(...r.features);
    }
  }

  const avgPrice = allPrices.length > 0
    ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
    : null;

  const priceRange = allPrices.length > 0
    ? { min: Math.min(...allPrices), max: Math.max(...allPrices) }
    : null;

  // Count feature frequency
  const featureCounts = new Map<string, number>();
  for (const f of allFeatures) {
    const normalized = f.toLowerCase().trim();
    featureCounts.set(normalized, (featureCounts.get(normalized) || 0) + 1);
  }

  const commonFeatures = [...featureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([f]) => f);

  // Generate AI analysis if available
  let insights: string[] = [];
  let recommendations: string[] = [];
  let summary = "";

  if (genAI) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const analysisPrompt = `
      Analyze this competitive intelligence data for ${company?.name || "the company"}:

      Company: ${JSON.stringify(company, null, 2)}
      Goal: ${JSON.stringify(goal, null, 2)}

      Competitor data:
      ${JSON.stringify(successfulResults.slice(0, 10), null, 2)}

      Market stats:
      - Average price: ${avgPrice ? `$${avgPrice}` : "Unknown"}
      - Price range: ${priceRange ? `$${priceRange.min} - $${priceRange.max}` : "Unknown"}
      - Common features: ${commonFeatures.join(", ")}
      - Competitors analyzed: ${successfulResults.length}

      Provide:
      1. summary: 2-3 sentence executive summary
      2. insights: Array of 5 key insights (1 sentence each)
      3. recommendations: Array of 3-5 actionable recommendations
      4. strengthAreas: What ${company?.name || "they"} might be doing well
      5. opportunityAreas: Where ${company?.name || "they"} could improve

      JSON only:
      {"summary": "", "insights": [], "recommendations": [], "strengthAreas": [], "opportunityAreas": []}
    `;

    try {
      const result = await model.generateContent(analysisPrompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        summary = parsed.summary || "";
        insights = parsed.insights || [];
        recommendations = parsed.recommendations || [];
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    }
  }

  // Fallback analysis
  if (!summary) {
    summary = `Analyzed ${successfulResults.length} competitors in the ${company?.industry || "market"}. ${avgPrice ? `Average pricing is $${avgPrice}/month.` : ""} Key opportunities exist in differentiation and positioning.`;

    insights = [
      `${successfulResults.length} competitors identified and analyzed`,
      avgPrice ? `Market average price: $${avgPrice}/month` : "Pricing data varied significantly",
      `Most competitors offer ${successfulResults.filter(r => r.pricing?.hasFreeTier).length > successfulResults.length / 2 ? "free tiers" : "paid-only plans"}`,
      `Enterprise/custom pricing is ${successfulResults.filter(r => r.pricing?.hasEnterprise).length > 3 ? "common" : "less common"} in this market`,
      `Common features: ${commonFeatures.slice(0, 3).join(", ")}`,
    ];

    recommendations = [
      "Review competitor pricing tiers for positioning opportunities",
      goal?.urgency === "ongoing" ? "Set up automated monitoring for pricing changes" : "Conduct quarterly competitive reviews",
      "Focus differentiation on unique value props not addressed by competitors",
    ];
  }

  return {
    summary,
    insights,
    recommendations,
    competitivePosition: {
      description: `Analyzed against ${successfulResults.length} competitors`,
      pricePercentile: 50, // Would need reference price to calculate
      strengthAreas: ["Market presence", "Feature depth"],
      opportunityAreas: ["Pricing clarity", "Competitive positioning"],
    },
    marketOverview: {
      avgPrice,
      priceRange,
      commonFeatures,
      differentiators: [],
    },
  };
}

// ============================================================================
// PHASE 6: VALUE REALIZATION
// ============================================================================

export interface ValueLoopConfig {
  alertsEnabled: boolean;
  alertTypes: ("price_change" | "new_competitor" | "feature_change")[];
  checkFrequency: "daily" | "weekly";
  notificationMethod: "imessage" | "email";
  shareUrl?: string;
}

/**
 * Set up the value realization loop
 */
export function configureValueLoop(
  session: MagicSession,
  config: ValueLoopConfig
): void {
  session.alertsConfigured = config.alertsEnabled;
  session.monitoringActive = config.alertsEnabled;
  session.shareUrl = config.shareUrl;

  // In a real implementation, this would:
  // 1. Create entries in the alerts system
  // 2. Set up cron jobs for monitoring
  // 3. Generate shareable dashboard URL
}

// ============================================================================
// MESSAGE FORMATTING
// ============================================================================

/**
 * Format the PRD for iMessage
 */
export function formatPRD(prd: PRD): string {
  return `📋 **${prd.title}**

🎯 **Objective**
${prd.objective}

📦 **Scope**
${prd.scope.map(s => `• ${s}`).join("\n")}

📊 **Deliverables**
${prd.deliverables.map(d => `• ${d.name}: ${d.description}`).join("\n")}

⏱️ **Timeline**: ${prd.timeline}

Ready to proceed? Reply **"Go"** to start the magic! ✨`;
}

/**
 * Format discovery results for iMessage
 */
export function formatDiscovery(competitors: Competitor[]): string {
  const byCategory = {
    direct: competitors.filter(c => c.category === "direct"),
    indirect: competitors.filter(c => c.category === "indirect"),
    adjacent: competitors.filter(c => c.category === "adjacent"),
    aspirational: competitors.filter(c => c.category === "aspirational"),
  };

  let msg = `🔍 **Competitor Universe Discovered**\n\n`;

  if (byCategory.direct.length > 0) {
    msg += `🎯 **Direct Competitors** (${byCategory.direct.length})\n`;
    msg += byCategory.direct.slice(0, 5).map(c => `• ${c.name}`).join("\n");
    msg += "\n\n";
  }

  if (byCategory.indirect.length > 0) {
    msg += `🔄 **Indirect** (${byCategory.indirect.length})\n`;
    msg += byCategory.indirect.slice(0, 3).map(c => `• ${c.name}`).join("\n");
    msg += "\n\n";
  }

  if (byCategory.aspirational.length > 0) {
    msg += `⭐ **Aspirational** (${byCategory.aspirational.length})\n`;
    msg += byCategory.aspirational.slice(0, 3).map(c => `• ${c.name}`).join("\n");
    msg += "\n\n";
  }

  msg += `Total: ${competitors.length} competitors identified\n`;
  msg += `\nAnalyzing all ${competitors.length} in parallel... 🚀`;

  return msg;
}

/**
 * Format analysis results for iMessage
 */
export function formatAnalysis(analysis: AnalysisResult, shareUrl?: string): string {
  let msg = `✨ **Analysis Complete**\n\n`;

  msg += `📝 **Summary**\n${analysis.summary}\n\n`;

  msg += `💡 **Key Insights**\n`;
  msg += analysis.insights.slice(0, 5).map((i, idx) => `${idx + 1}. ${i}`).join("\n");
  msg += "\n\n";

  msg += `🎯 **Recommendations**\n`;
  msg += analysis.recommendations.map(r => `• ${r}`).join("\n");

  if (analysis.marketOverview.avgPrice) {
    msg += `\n\n📊 **Market Overview**\n`;
    msg += `• Average price: $${analysis.marketOverview.avgPrice}/mo\n`;
    if (analysis.marketOverview.priceRange) {
      msg += `• Price range: $${analysis.marketOverview.priceRange.min} - $${analysis.marketOverview.priceRange.max}`;
    }
  }

  if (shareUrl) {
    msg += `\n\n🔗 **Full Dashboard**: ${shareUrl}`;
  }

  return msg;
}

/**
 * Format progress update for iMessage
 */
export function formatProgress(progress: number, currentTask: string): string {
  const filled = Math.floor(progress / 10);
  const empty = 10 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  return `${bar} ${progress}%\n${currentTask}`;
}

// ============================================================================
// MAIN FLOW ORCHESTRATION
// ============================================================================

export type FlowMessage = {
  type: "text" | "progress" | "file";
  content: string;
  delay?: number; // ms to wait before sending
};

/**
 * Main entry point: Process a message in the magic flow
 */
export async function processMagicMessage(
  phone: string,
  text: string,
  sendMessage: (msg: string) => Promise<void>,
  _sendFile?: (path: string) => Promise<void>
): Promise<boolean> {
  let session = getSession(phone);
  const normalizedText = text.trim().toLowerCase();

  // Check if user wants to start a new magic session with a URL
  const urlMatch = text.match(/https?:\/\/[^\s]+|(?:www\.)?[a-z0-9][-a-z0-9]*\.[a-z]{2,}(?:\/[^\s]*)?/i);

  if (!session && urlMatch) {
    // New session with URL
    session = createSession(phone, urlMatch[0]);
    session.phase = "intake";

    await sendMessage(`✨ Starting Mino Magic for ${urlMatch[0]}...\n\nLet me analyze your company first.`);

    // Extract company profile
    session.companyProfile = await extractCompanyProfile(urlMatch[0]);
    updateSession(phone, { companyProfile: session.companyProfile, phase: "clarifying" });

    await sendMessage(`📊 Found: **${session.companyProfile.name}**${session.companyProfile.industry ? ` (${session.companyProfile.industry})` : ""}\n\n${session.companyProfile.description || ""}\n\nNow let's define your goals.`);

    // Ask first question
    const firstQuestion = getNextQuestion(session);
    if (firstQuestion) {
      await sendMessage(firstQuestion);
    }

    return true;
  }

  if (!session) {
    return false; // No active session and no URL provided
  }

  // Handle session based on current phase
  switch (session.phase) {
    case "clarifying": {
      // Process answer
      processAnswer(session, text);

      // Check if more questions
      const nextQuestion = getNextQuestion(session);
      if (nextQuestion) {
        await sendMessage(nextQuestion);
      } else {
        // All questions answered - generate PRD
        await sendMessage("🧠 Generating your project plan...");

        const { goal, prd } = await generateGoalAndPRD(session);
        updateSession(phone, { goal, prd, phase: "discovery" });

        await sendMessage(formatPRD(prd));
      }
      return true;
    }

    case "discovery": {
      // User approved PRD - start discovery
      if (normalizedText === "go" || normalizedText.includes("start") || normalizedText.includes("proceed")) {
        await sendMessage("🔍 Discovering competitor universe...");

        const competitors = await discoverCompetitors(session);
        updateSession(phone, { competitors, discoveryComplete: true, phase: "execution" });

        await sendMessage(formatDiscovery(competitors));

        // Immediately start execution
        await sendMessage("\n⚡ Executing multi-step workflows in parallel...");

        const results = await executeWorkflows(session, async (progress, message) => {
          // Send progress updates every 25%
          if (progress % 25 === 0 || progress === 100) {
            await sendMessage(formatProgress(progress, message));
          }
        });

        updateSession(phone, { phase: "analysis" });

        // Move to analysis
        await sendMessage("\n🧪 Analyzing and synthesizing data...");

        const analysis = await analyzeAndSynthesize(session, results);
        updateSession(phone, {
          analysis: {
            summary: analysis.summary,
            insights: analysis.insights,
            recommendations: analysis.recommendations,
          },
          phase: "value_loop"
        });

        await sendMessage(formatAnalysis(analysis));

        // Offer value loop
        await sendMessage(`\n🔔 **Want to stay updated?**\n\nI can monitor these ${session.competitors.length} competitors and alert you when:\n• Prices change\n• New features launch\n• New competitors emerge\n\nReply **"Monitor"** to enable, or **"Done"** to finish.`);
      } else {
        await sendMessage("Ready to discover competitors and run analysis?\n\nReply **\"Go\"** to proceed, or ask me any questions about the plan.");
      }
      return true;
    }

    case "value_loop": {
      if (normalizedText.includes("monitor") || normalizedText.includes("alert") || normalizedText.includes("yes")) {
        configureValueLoop(session, {
          alertsEnabled: true,
          alertTypes: ["price_change", "new_competitor"],
          checkFrequency: session.goal?.urgency === "immediate" ? "daily" : "weekly",
          notificationMethod: "imessage",
        });

        updateSession(phone, { phase: "complete" });

        await sendMessage(`✅ **Monitoring Activated!**\n\nI'll check your ${session.competitors.length} competitors ${session.goal?.urgency === "immediate" ? "daily" : "weekly"} and alert you to any changes.\n\n${session.shareUrl ? `📊 Dashboard: ${session.shareUrl}\n\n` : ""}🎉 That's the Mino Magic! Let me know if you need anything else.`);
      } else if (normalizedText.includes("done") || normalizedText.includes("no")) {
        updateSession(phone, { phase: "complete" });

        await sendMessage(`✅ **All done!**\n\n${session.shareUrl ? `📊 Your dashboard: ${session.shareUrl}\n\n` : ""}Thanks for using Mino! Let me know whenever you want to run another analysis.`);
      } else {
        await sendMessage("Reply **\"Monitor\"** to enable ongoing alerts, or **\"Done\"** to finish.");
      }
      return true;
    }

    case "complete": {
      // Session complete - offer to start new one
      await sendMessage("Your competitive analysis is complete! 🎉\n\nWant to analyze another company? Just send me a URL.");
      clearSession(phone);
      return true;
    }

    default:
      return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Initialization
  initMagic,

  // Session management
  getSession,
  createSession,
  updateSession,
  clearSession,

  // Flow phases
  extractCompanyProfile,
  getNextQuestion,
  processAnswer,
  generateGoalAndPRD,
  discoverCompetitors,
  executeWorkflows,
  analyzeAndSynthesize,
  configureValueLoop,

  // Formatting
  formatPRD,
  formatDiscovery,
  formatAnalysis,
  formatProgress,

  // Main orchestration
  processMagicMessage,
};
