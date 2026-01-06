import { NextRequest, NextResponse } from "next/server";
import { getInvestor } from "@/lib/investors";

// ============================================================================
// INVESTOR BRIEF API - Generates iMessage-friendly text summary
// Uses centralized investor configuration from /lib/investors.ts
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

  return sorted.slice(0, 5).map((item) => {
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
  const investor = getInvestor(id);

  if (!investor) {
    return NextResponse.json({ error: "Investor not found" }, { status: 404 });
  }

  // Check if investor is onboarded
  if (!investor.isOnboarded) {
    return NextResponse.json({
      success: false,
      error: "Investor setup incomplete",
      onboardingStep: investor.onboardingStep,
      message: "Please complete onboarding to receive your daily brief.",
    }, { status: 400 });
  }

  // Fetch latest news from the investor-news API
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  let news: NewsItem[] = [];
  try {
    const newsResponse = await fetch(`${baseUrl}/api/cron/investor-news?investorId=${id}`, {
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
