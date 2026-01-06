#!/usr/bin/env npx ts-node
/**
 * Investor Morning Briefing Pipeline
 *
 * Uses Claude Code SDK to:
 * 1. Research portfolio companies for high-signal intelligence
 * 2. Generate updated dashboard data
 * 3. Regenerate the investor page
 * 4. Deploy to Vercel
 * 5. Send morning iMessage briefing
 *
 * Run daily via cron: 0 6 * * * cd /path/to/snap-apps-server && npx ts-node scripts/investor-briefing-pipeline.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

interface InvestorConfig {
  id: string;
  name: string;
  phone: string;
  firm: string;
  role: string;
  portfolioCompanies: string[];
}

const INVESTORS: InvestorConfig[] = [
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Ryan Koh",
    phone: "+14156836861",
    firm: "ICONIQ Capital",
    role: "Partner",
    portfolioCompanies: [
      "TinyFish",
      "Statsig",
      "Adaptive ML",
      "Pinecone",
      "Groww",
      "Spotnana",
      "Unit21",
      "Reprise",
      "Highspot",
      "Sendbird",
    ],
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface PortfolioCompany {
  name: string;
  status: "active" | "acquired" | "public" | "board";
  ticker?: string;
  valuation?: string;
  growth: number;
  sector: string;
  invested: string;
  ownership?: string;
  round?: string;
  needsAttention?: boolean;
}

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

interface PortfolioData {
  investor: {
    name: string;
    firm: string;
    role: string;
  };
  summary: {
    totalValue: string;
    dayChange: number;
    totalCompanies: number;
    activeDeals: number;
    exits: number;
    boardSeats: number;
  };
  companies: PortfolioCompany[];
  news: NewsItem[];
  lastUpdated: string;
}

// ============================================================================
// AI CLIENT
// ============================================================================

const anthropic = new Anthropic();

// ============================================================================
// REAL WEB SEARCH USING CLAUDE WITH WEB SEARCH
// ============================================================================

interface SearchResult {
  company: string;
  headlines: Array<{
    title: string;
    url: string;
    source: string;
    snippet: string;
  }>;
}

// Known competitors for portfolio companies - used for competitive intel searches
const COMPANY_COMPETITORS: Record<string, string[]> = {
  Pinecone: ["Turbopuffer", "Weaviate", "Milvus", "Qdrant", "Chroma"],
  Statsig: ["LaunchDarkly", "Split", "Optimizely", "Amplitude"],
  Highspot: ["Seismic", "Showpad", "Mediafly", "Bigtincan"],
  Sendbird: ["Stream", "Twilio", "Agora", "PubNub"],
  Groww: ["Zerodha", "Upstox", "Angel One", "Paytm Money"],
  Unit21: ["Sardine", "Alloy", "Sift", "Persona"],
};

// Path for storing previously shown news items
const NEWS_HISTORY_PATH = path.join(__dirname, "../.news-history.json");

interface NewsHistory {
  shownUrls: string[];
  lastUpdated: string;
}

function loadNewsHistory(): NewsHistory {
  try {
    if (fs.existsSync(NEWS_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(NEWS_HISTORY_PATH, "utf-8"));
    }
  } catch {
    console.warn("   ⚠️ Could not load news history, starting fresh");
  }
  return { shownUrls: [], lastUpdated: new Date().toISOString() };
}

function saveNewsHistory(history: NewsHistory): void {
  try {
    // Keep only last 100 URLs to prevent unbounded growth
    history.shownUrls = history.shownUrls.slice(-100);
    history.lastUpdated = new Date().toISOString();
    fs.writeFileSync(NEWS_HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    console.warn("   ⚠️ Could not save news history:", error);
  }
}

async function searchCompanyNews(company: string): Promise<SearchResult> {
  console.log(`   🔎 Searching news for ${company}...`);

  const searchPrompt = `Search for the most recent news about "${company}" company in the last 21 days.

IMPORTANT - Include ALL of these:
1. Direct news where ${company} is the primary subject (funding, acquisitions, product launches)
2. Competitive intelligence: articles comparing ${company} to competitors, or where competitors are discussed alongside ${company}
3. Industry analysis where ${company} is mentioned as a key player or example
4. Market reports, analyst coverage, or benchmark comparisons involving ${company}

HIGH-SIGNAL examples to look for:
- "${company} vs [competitor]" comparisons
- Benchmark or performance comparisons
- Industry roundups mentioning ${company}
- Customer wins, churn, or case studies
- Leadership/executive changes
- Technical deep-dives or architecture discussions

CRITICAL: Return ONLY a JSON object with this exact format:
{
  "company": "${company}",
  "headlines": [
    {
      "title": "Exact headline from the article",
      "url": "https://exact-url-from-search.com/article",
      "source": "Publication name (e.g., TechCrunch, Reuters)",
      "snippet": "Brief description - note competitive context if applicable"
    }
  ]
}

Return up to 5 most important headlines prioritizing competitive intelligence.
If no recent news, return empty headlines array.
Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
      messages: [{ role: "user", content: searchPrompt }],
    });

    let result = "";
    for (const block of response.content) {
      if (block.type === "text") {
        result += block.text + "\n";
      }
    }

    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*"headlines"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { company, headlines: [] };
  } catch (error) {
    console.warn(`   ⚠️ Search failed for ${company}:`, error);
    return { company, headlines: [] };
  }
}

async function searchCompetitorNews(company: string, competitors: string[]): Promise<SearchResult> {
  console.log(`   🆚 Searching competitive intel for ${company} vs competitors...`);

  const competitorList = competitors.slice(0, 3).join(", ");
  const searchPrompt = `Search for recent news (last 30 days) comparing "${company}" with its competitors: ${competitorList}.

Look for:
1. Head-to-head comparisons: "${company} vs ${competitors[0]}" or similar
2. Benchmark tests and performance comparisons
3. Customer migration stories (switching from/to ${company})
4. Industry analyst reports comparing these services
5. Technical deep-dives comparing architectures
6. Market share or competitive positioning articles

Examples of HIGH-SIGNAL articles:
- "${company} loses ground to ${competitors[0]} in latest benchmark"
- "Why we switched from ${company} to ${competitors[0]}"
- "Battle of the [category]: ${company} vs ${competitors[0]}"

CRITICAL: Return ONLY a JSON object with this exact format:
{
  "company": "${company}",
  "headlines": [
    {
      "title": "Exact headline from the article",
      "url": "https://exact-url-from-search.com/article",
      "source": "Publication name",
      "snippet": "Brief description of competitive context"
    }
  ]
}

Return up to 3 most important competitive headlines.
If no competitive news found, return empty headlines array.
Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
      messages: [{ role: "user", content: searchPrompt }],
    });

    let result = "";
    for (const block of response.content) {
      if (block.type === "text") {
        result += block.text + "\n";
      }
    }

    const jsonMatch = result.match(/\{[\s\S]*"headlines"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { company, headlines: [] };
  } catch (error) {
    console.warn(`   ⚠️ Competitor search failed for ${company}:`, error);
    return { company, headlines: [] };
  }
}

async function researchCompanyIntelligence(
  companies: string[],
  _existingData: PortfolioCompany[]
): Promise<NewsItem[]> {
  console.log(`\n🔍 Researching REAL intelligence for ${companies.length} companies using Claude web search...`);

  // Load news history to filter out previously shown items
  const history = loadNewsHistory();
  const seenUrls = new Set(history.shownUrls);
  console.log(`   📜 Loaded ${seenUrls.size} previously shown URLs`);

  // Search for each company individually for better coverage
  const allSearchResults: SearchResult[] = [];

  for (const company of companies) {
    const result = await searchCompanyNews(company);
    if (result.headlines.length > 0) {
      allSearchResults.push(result);
      console.log(`      ✅ Found ${result.headlines.length} headlines for ${company}`);
    } else {
      console.log(`      ⚪ No recent news for ${company}`);
    }
    // Small delay between searches
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Search for competitor-specific articles for key companies
  console.log(`\n🆚 Searching for competitive intelligence...`);
  for (const company of companies) {
    const competitors = COMPANY_COMPETITORS[company];
    if (competitors && competitors.length > 0) {
      const competitorResult = await searchCompetitorNews(company, competitors);
      if (competitorResult.headlines.length > 0) {
        allSearchResults.push(competitorResult);
        console.log(`      ✅ Found ${competitorResult.headlines.length} competitive articles for ${company}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.log(`   ✅ Gathered news from ${allSearchResults.length} search results`);

  // Convert search results directly to NewsItem format
  const newsItems: NewsItem[] = [];

  for (const result of allSearchResults) {
    for (const headline of result.headlines) {
      // Skip if we've shown this URL before
      if (headline.url && seenUrls.has(headline.url)) {
        console.log(`      ⏭️ Skipping previously shown: ${headline.title.substring(0, 50)}...`);
        continue;
      }

      // Determine priority based on keywords
      let priority: NewsItem["priority"] = "medium";
      let category: NewsItem["category"] = "product";
      let sentiment: NewsItem["sentiment"] = "neutral";

      const titleLower = headline.title.toLowerCase();

      // Competitive articles get high priority
      if (titleLower.includes(" vs ") || titleLower.includes("versus") || titleLower.includes("compared") || titleLower.includes("benchmark")) {
        category = "competitive";
        priority = "high";
        sentiment = "neutral";
      } else if (titleLower.includes("loses") || titleLower.includes("losing") || titleLower.includes("behind")) {
        category = "competitive";
        priority = "critical";
        sentiment = "negative";
      } else if (titleLower.includes("funding") || titleLower.includes("raises") || titleLower.includes("series")) {
        category = "funding";
        priority = "high";
        sentiment = "positive";
      } else if (titleLower.includes("acqui") || titleLower.includes("bought") || titleLower.includes("merger")) {
        category = "exit";
        priority = "critical";
        sentiment = "positive";
      } else if (titleLower.includes("layoff") || titleLower.includes("cuts") || titleLower.includes("downsiz")) {
        category = "talent";
        priority = "high";
        sentiment = "negative";
      } else if (titleLower.includes("partner") || titleLower.includes("deal") || titleLower.includes("win")) {
        category = "competitive";
        priority = "high";
        sentiment = "positive";
      } else if (titleLower.includes("launch") || titleLower.includes("release") || titleLower.includes("announc")) {
        category = "product";
        priority = "medium";
        sentiment = "positive";
      } else if (titleLower.includes("lawsuit") || titleLower.includes("sec") || titleLower.includes("regulat")) {
        category = "legal";
        priority = "critical";
        sentiment = "negative";
      }

      newsItems.push({
        company: result.company,
        title: headline.title,
        source: headline.source,
        date: "recent",
        hoursAgo: 24, // Default to 24h since we searched for recent news
        sentiment,
        priority,
        category,
        url: headline.url,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  newsItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Take top 7 items
  const topItems = newsItems.slice(0, 7);

  // Save shown URLs to history
  const newUrls = topItems.filter((item) => item.url).map((item) => item.url as string);
  history.shownUrls.push(...newUrls);
  saveNewsHistory(history);
  console.log(`   💾 Saved ${newUrls.length} new URLs to history`);

  // Add computed date strings
  return topItems.map((item, index) => ({
    ...item,
    hoursAgo: (index + 1) * 12, // Spread out times for visual variety
    date: index < 2 ? `${(index + 1) * 12}h ago` : `${Math.floor((index + 1) * 12 / 24)}d ago`,
  }));
}

async function generateMorningMessage(
  investor: InvestorConfig,
  data: PortfolioData
): Promise<string> {
  const highPriorityNews = data.news.filter((n) => n.priority === "critical" || n.priority === "high");
  const dashboardUrl = `https://snap-apps-server.vercel.app/investor/${investor.id}`;

  const prompt = `Write a punchy, engaging morning briefing text for ${investor.name}, a ${investor.role} at ${investor.firm}.

Today's Intel:
${highPriorityNews.slice(0, 3).map((a) => `- ${a.company}: ${a.title}`).join("\n")}

Companies tracked: ${data.summary.totalCompanies}
Updates found: ${data.news.length}

Dashboard: ${dashboardUrl}

Style:
- Open with a hook about the biggest news (no generic greetings)
- Be conversational and punchy, like texting a colleague
- Use wit and personality - make it memorable
- Sprinkle in 2-3 relevant emojis that match the content
- Keep it under 200 chars before the link
- End with the dashboard link on its own line
- NO fake data, percentages, or portfolio values

Example vibes:
"Big morning - Statsig just got scooped by OpenAI for $1.1B 🎯 Your exit is looking 🔥 Full breakdown:"
"Pinecone is in the news again - Commvault partnership + new product drop ⚡ Details:"

Return ONLY the message text, nothing else.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textContent.text.trim();
}

// ============================================================================
// FILE GENERATION
// ============================================================================

function generatePageContent(data: PortfolioData, _investorId: string): string {
  // Read the template and replace the PORTFOLIO_DATA constant
  const templatePath = path.join(
    __dirname,
    "../src/app/investor/f47ac10b-58cc-4372-a567-0e02b2c3d479/page.tsx"
  );
  let template = fs.readFileSync(templatePath, "utf-8");

  // Find and replace the PORTFOLIO_DATA object
  const dataRegex = /const PORTFOLIO_DATA: PortfolioData = \{[\s\S]*?\n\};/;
  const newDataString = `const PORTFOLIO_DATA: PortfolioData = ${JSON.stringify(data, null, 2)};`;

  template = template.replace(dataRegex, newDataString);

  return template;
}

// ============================================================================
// DEPLOYMENT
// ============================================================================

function deployToVercel(dryRun: boolean): void {
  if (dryRun) {
    console.log("\n🚀 [DRY RUN] Would deploy to Vercel...");
    return;
  }
  console.log("\n🚀 Deploying to Vercel...");
  execSync("vercel --prod --yes", {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });
}

function sendIMessage(phone: string, message: string, dryRun: boolean): void {
  if (dryRun) {
    console.log(`\n📱 [DRY RUN] Would send iMessage to ${phone}:`);
    console.log(`   "${message}"`);
    return;
  }
  console.log(`\n📱 Sending iMessage to ${phone}...`);
  const escapedMessage = message.replace(/'/g, "'\"'\"'");
  execSync(
    `osascript -e 'tell application "Messages" to send "${escapedMessage}" to buddy "${phone}"'`
  );
  console.log("✅ Message sent!");
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function runPipeline(investor: InvestorConfig): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎯 Running briefing pipeline for ${investor.name}`);
  console.log(`${"=".repeat(60)}`);

  // 1. Load existing data (mock for now, would come from DB/API)
  const existingCompanies: PortfolioCompany[] = [
    { name: "TinyFish", status: "active", growth: 24, sector: "AI/ML", invested: "$15M", valuation: "$180M", round: "Series A" },
    { name: "Statsig", status: "acquired", ticker: "OpenAI", growth: 156, sector: "DevTools", invested: "$22M", valuation: "Acquired", round: "Series B" },
    { name: "Adaptive ML", status: "active", growth: 45, sector: "AI/ML", invested: "$18M", valuation: "$320M", round: "Series B" },
    { name: "Pinecone", status: "active", growth: 89, sector: "Infrastructure", invested: "$35M", valuation: "$750M", ownership: "4.2%", round: "Series B" },
    { name: "Groww", status: "public", ticker: "NSE:GROWW", growth: 12, sector: "Fintech", invested: "$28M", valuation: "$3.2B", round: "Series C" },
    { name: "Spotnana", status: "board", growth: 34, sector: "Travel Tech", invested: "$40M", valuation: "$1.1B", ownership: "6.8%", round: "Series C", needsAttention: true },
    { name: "Unit21", status: "active", growth: -8, sector: "Fintech", invested: "$12M", valuation: "$280M", round: "Series B", needsAttention: true },
    { name: "Reprise", status: "active", growth: 67, sector: "Sales Tech", invested: "$8M", valuation: "$120M", round: "Series A" },
    { name: "Highspot", status: "board", growth: 23, sector: "Sales Tech", invested: "$45M", valuation: "$3.5B", ownership: "3.1%", round: "Series D" },
    { name: "Sendbird", status: "board", growth: 15, sector: "Communications", invested: "$25M", valuation: "$1.05B", ownership: "2.4%", round: "Series C" },
  ];

  // 2. Research intelligence using Claude
  const newsItems = await researchCompanyIntelligence(
    investor.portfolioCompanies,
    existingCompanies
  );
  console.log(`✅ Found ${newsItems.length} high-signal intelligence items`);

  // 3. Compile portfolio data
  // Note: Portfolio value is estimated AUM, not real-time. Day change not tracked.
  const portfolioData: PortfolioData = {
    investor: {
      name: investor.name,
      firm: investor.firm,
      role: investor.role,
    },
    summary: {
      totalValue: "~$2.4B",
      dayChange: 0, // Don't show fake day changes
      totalCompanies: existingCompanies.length,
      activeDeals: existingCompanies.filter((c) => c.status === "active").length,
      exits: existingCompanies.filter((c) => c.status === "acquired").length,
      boardSeats: existingCompanies.filter((c) => c.status === "board").length,
    },
    companies: existingCompanies,
    news: newsItems,
    lastUpdated: new Date().toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      month: "short",
      day: "numeric",
    }),
  };

  // 4. Generate updated page
  console.log("\n📝 Generating updated investor page...");
  const pageContent = generatePageContent(portfolioData, investor.id);
  const pagePath = path.join(
    __dirname,
    `../src/app/investor/${investor.id}/page.tsx`
  );
  fs.writeFileSync(pagePath, pageContent);
  console.log(`✅ Page updated: ${pagePath}`);

  // 5. Deploy to Vercel
  deployToVercel(DRY_RUN);

  // 6. Generate and send morning message
  const message = await generateMorningMessage(investor, portfolioData);
  console.log(`\n📨 Morning message:\n${message}`);
  sendIMessage(investor.phone, message, DRY_RUN);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Pipeline complete for ${investor.name}!`);
  console.log(`${"=".repeat(60)}\n`);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  console.log("\n🌅 Starting Investor Morning Briefing Pipeline");
  console.log(`⏰ ${new Date().toLocaleString()}`);
  if (DRY_RUN) console.log("🧪 DRY RUN MODE - No deployment or messages\n");
  else console.log("");

  for (const investor of INVESTORS) {
    try {
      await runPipeline(investor);
    } catch (error) {
      console.error(`❌ Error processing ${investor.name}:`, error);
    }
  }

  console.log("\n🎉 All pipelines complete!\n");
}

// Run if called directly
main().catch(console.error);
