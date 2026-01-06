import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// INVESTOR BRIEF API - Generates iMessage-friendly text summary
// ============================================================================

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

interface PortfolioCompany {
  name: string;
  status: "active" | "acquired" | "public" | "board";
  ticker?: string;
  valuation?: string;
  sector: string;
  invested: string;
  ownership?: string;
  round?: string;
  needsAttention?: boolean;
}

// Investor configurations (could move to database later)
const INVESTORS: Record<string, {
  name: string;
  firstName: string;
  firm: string;
  role: string;
  phone: string;
  companies: PortfolioCompany[];
}> = {
  "ece30471-dff9-448e-81f5-6f0286b00a34": {
    name: "Ryan Koh",
    firstName: "Ryan",
    firm: "ICONIQ Capital",
    role: "Partner",
    phone: "+14156836861",
    companies: [
      { name: "TinyFish", status: "active", sector: "AI/ML", invested: "$15M", valuation: "$180M", round: "Series A" },
      { name: "Statsig", status: "acquired", ticker: "OpenAI", sector: "DevTools", invested: "$22M", valuation: "Acquired", round: "Series B" },
      { name: "Adaptive ML", status: "active", sector: "AI/ML", invested: "$18M", valuation: "$320M", round: "Series B" },
      { name: "Pinecone", status: "active", sector: "Infrastructure", invested: "$35M", valuation: "$750M", ownership: "4.2%", round: "Series B" },
      { name: "Groww", status: "public", ticker: "NSE:GROWW", sector: "Fintech", invested: "$28M", valuation: "$3.2B", round: "Series C" },
      { name: "Spotnana", status: "board", sector: "Travel Tech", invested: "$40M", valuation: "$1.1B", ownership: "6.8%", round: "Series C", needsAttention: true },
      { name: "Unit21", status: "active", sector: "Fintech", invested: "$12M", valuation: "$280M", round: "Series B", needsAttention: true },
      { name: "Reprise", status: "active", sector: "Sales Tech", invested: "$8M", valuation: "$120M", round: "Series A" },
      { name: "Highspot", status: "board", sector: "Sales Tech", invested: "$45M", valuation: "$3.5B", ownership: "3.1%", round: "Series D" },
      { name: "Sendbird", status: "board", sector: "Communications", invested: "$25M", valuation: "$1.05B", ownership: "2.4%", round: "Series C" },
    ],
  },
};

// Generate time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Generate executive summary from news
function generateExecutiveSummary(news: NewsItem[]): string {
  const recentNews = news.filter(item => item.hoursAgo <= 24);

  if (recentNews.length === 0) {
    return "No significant portfolio news in the last 24 hours. All positions appear stable.";
  }

  // Group by company
  const newsByCompany = recentNews.reduce((acc, item) => {
    if (!acc[item.company]) acc[item.company] = [];
    acc[item.company].push(item);
    return acc;
  }, {} as Record<string, NewsItem[]>);

  const summaries: string[] = [];

  for (const [company, items] of Object.entries(newsByCompany)) {
    const topItem = items.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })[0];

    let summary = "";
    switch (topItem.category) {
      case "funding":
        summary = topItem.sentiment === "positive"
          ? `${company} secured new funding`
          : `${company} faces funding challenges`;
        break;
      case "exit":
        summary = `${company} has exit activity`;
        break;
      case "competitive":
        summary = topItem.sentiment === "positive"
          ? `${company} gained competitive ground`
          : `${company} faces competitive pressure`;
        break;
      case "product":
        summary = `${company} launched product updates`;
        break;
      case "talent":
        summary = topItem.sentiment === "positive"
          ? `${company} made key hires`
          : `${company} saw leadership changes`;
        break;
      case "legal":
        summary = `${company} has legal/regulatory developments`;
        break;
      case "churn":
        summary = `${company} may have retention concerns`;
        break;
      default:
        summary = `${company} has notable activity`;
    }

    summaries.push(summary);
  }

  return summaries.join(". ") + ".";
}

// Format news for iMessage
function formatNewsForMessage(news: NewsItem[]): string {
  const recentNews = news.filter(item => item.hoursAgo <= 24);
  const sorted = [...recentNews].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority] || a.hoursAgo - b.hoursAgo;
  });

  if (sorted.length === 0) {
    return "No portfolio news in the last 24 hours.";
  }

  return sorted.slice(0, 5).map((item, i) => {
    const emoji = item.priority === "critical" ? "🚨" :
                  item.priority === "high" ? "📰" : "•";
    const categoryEmoji: Record<string, string> = {
      competitive: "⚔️",
      funding: "💰",
      legal: "⚖️",
      product: "🚀",
      talent: "👥",
      exit: "🎯",
      churn: "⚠️",
    };
    const cat = categoryEmoji[item.category] || "";
    return `${emoji} ${item.company} ${cat}\n   ${item.title}\n   ${item.source} · ${item.date}`;
  }).join("\n\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const investor = INVESTORS[id];

  if (!investor) {
    return NextResponse.json({ error: "Investor not found" }, { status: 404 });
  }

  // Fetch latest news from the investor-news API
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  let news: NewsItem[] = [];
  try {
    const newsResponse = await fetch(`${baseUrl}/api/cron/investor-news`, {
      headers: { "x-internal-request": "true" },
    });
    if (newsResponse.ok) {
      const newsData = await newsResponse.json();
      if (newsData.success && newsData.data?.news) {
        news = newsData.data.news;
      }
    }
  } catch (error) {
    console.error("Failed to fetch investor news:", error);
  }

  // Build the iMessage-friendly brief
  const greeting = getGreeting();
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  const executiveSummary = generateExecutiveSummary(news);
  const newsSection = formatNewsForMessage(news);

  // Build brief URL - always use the main domain
  const fullUrl = `https://snap-apps-server.vercel.app/investor/${id}`;

  // Compose the message
  const message = `☀️ ${greeting}, ${investor.firstName}.

📅 ${date}

${executiveSummary}

━━━━━━━━━━━━━━━━━━━━━

${newsSection}

━━━━━━━━━━━━━━━━━━━━━

📱 Full brief: ${fullUrl}

— Mino`;

  return NextResponse.json({
    success: true,
    investorId: id,
    investor: {
      name: investor.name,
      firm: investor.firm,
      phone: investor.phone,
    },
    message,
    newsCount: news.filter(n => n.hoursAgo <= 24).length,
    generatedAt: new Date().toISOString(),
  });
}
