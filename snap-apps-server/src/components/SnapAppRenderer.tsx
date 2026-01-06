"use client";

/**
 * Snap App Renderer - Server-side rendering of Snap App content
 *
 * Type-specific renderers that match the mobile app's visual language
 * but optimized for web.
 */

import { motion } from "framer-motion";
import type { SnapApp, SnapAppType, SnapAppInsight } from "@/types/snap-app";
import { SNAP_APP_TYPE_METADATA } from "@/types/snap-app";

// ============================================================================
// TYPE ICONS (Emoji fallbacks for mobile parity)
// ============================================================================

// Icon names for potential Heroicon/Lucide integration
const _TYPE_ICONS: Record<SnapAppType, string> = {
  price_comparison: "chart-bar",
  product_gallery: "shopping-bag",
  article: "document-text",
  map_view: "map",
  availability: "calendar",
  code_block: "code",
  data_table: "table",
  smart_card: "sparkles",
  pricing_health: "heart",
  investor_dashboard: "briefcase",
};

const TYPE_EMOJIS: Record<SnapAppType, string> = {
  price_comparison: "📊",
  product_gallery: "🛒",
  article: "📄",
  map_view: "🗺️",
  availability: "📅",
  code_block: "💻",
  data_table: "📋",
  smart_card: "✨",
  pricing_health: "❤️",
  investor_dashboard: "💼",
};

// ============================================================================
// INSIGHT BADGE
// ============================================================================

interface InsightBadgeProps {
  insight: SnapAppInsight;
  index: number;
}

export function InsightBadge({ insight, index }: InsightBadgeProps) {
  const bgClass = {
    positive: "insight-positive",
    negative: "insight-negative",
    warning: "insight-warning",
    neutral: "insight-neutral",
  }[insight.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${bgClass}`}
    >
      <span>{insight.icon}</span>
      <span className="font-medium">{insight.text}</span>
    </motion.div>
  );
}

// ============================================================================
// PRICE COMPARISON CONTENT
// ============================================================================

interface PriceComparisonContentProps {
  data: Record<string, unknown>;
}

function PriceComparisonContent({ data }: PriceComparisonContentProps) {
  const items =
    (data.items as { name: string; price: number; rating?: number }[]) || [];
  const maxPrice = Math.max(...items.map((i) => i.price), 1);

  return (
    <div className="space-y-4">
      {items.slice(0, 5).map((item, index) => {
        const barWidth = (item.price / maxPrice) * 100;
        const isLowest = item.price === Math.min(...items.map((i) => i.price));

        return (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.08, duration: 0.3 }}
            className="space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-white/90 font-medium truncate pr-4">
                {item.name}
              </span>
              <span
                className={`font-semibold whitespace-nowrap ${
                  isLowest ? "text-emerald-400" : "text-cyan-400"
                }`}
              >
                ${item.price}
                {isLowest && (
                  <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                    LOWEST
                  </span>
                )}
              </span>
            </div>

            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                className={`h-full rounded-full ${
                  isLowest
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                    : "bg-gradient-to-r from-cyan-600 to-cyan-400"
                }`}
              />
            </div>

            {item.rating && (
              <div className="text-xs text-white/50">
                {"⭐".repeat(Math.floor(item.rating))} {item.rating.toFixed(1)}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================================
// PRODUCT GALLERY CONTENT
// ============================================================================

interface ProductGalleryContentProps {
  data: Record<string, unknown>;
}

function ProductGalleryContent({ data }: ProductGalleryContentProps) {
  const items =
    (data.items as { name: string; price: number; score?: number }[]) || [];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.slice(0, 6).map((item, index) => (
        <motion.div
          key={item.name}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
          className="glass rounded-xl p-3 text-center space-y-2"
        >
          <div className="w-12 h-12 mx-auto bg-violet-500/20 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🖼️</span>
          </div>
          <p className="text-sm text-white/90 font-medium truncate">
            {item.name}
          </p>
          <p className="text-cyan-400 font-semibold">${item.price}</p>
          {item.score && (
            <div className="text-xs text-white/50">Score: {item.score}/10</div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// ARTICLE CONTENT
// ============================================================================

interface ArticleContentProps {
  data: Record<string, unknown>;
}

function ArticleContent({ data }: ArticleContentProps) {
  const summary = (data.summary as string) || "";
  const keyPoints = (data.keyPoints as string[]) || [];

  return (
    <div className="space-y-4">
      {summary && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-white/70 leading-relaxed"
        >
          {summary}
        </motion.p>
      )}

      {keyPoints.length > 0 && (
        <div className="space-y-2">
          {keyPoints.slice(0, 5).map((point, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.05, duration: 0.3 }}
              className="flex items-start gap-3"
            >
              <span className="text-cyan-400">•</span>
              <span className="text-white/80 text-sm">{point}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AVAILABILITY CONTENT
// ============================================================================

interface AvailabilityContentProps {
  data: Record<string, unknown>;
}

function AvailabilityContent({ data }: AvailabilityContentProps) {
  const dates =
    (data.dates as { date: string; price: number; available: boolean }[]) || [];
  const minPrice = Math.min(...dates.map((d) => d.price));

  return (
    <div className="flex flex-wrap gap-2">
      {dates.slice(0, 7).map((item, index) => {
        const isLowest = item.price === minPrice;
        const date = new Date(item.date);
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
        const dayNum = date.getDate();

        return (
          <motion.div
            key={item.date}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.04, duration: 0.2 }}
            className={`flex-1 min-w-[60px] p-2 rounded-lg text-center border ${
              isLowest
                ? "bg-cyan-500/20 border-cyan-500/50"
                : item.available
                ? "bg-white/5 border-white/10"
                : "bg-red-500/10 border-red-500/20 opacity-50"
            }`}
          >
            <div
              className={`text-xs ${
                isLowest ? "text-cyan-400" : "text-white/50"
              }`}
            >
              {dayName}
            </div>
            <div
              className={`text-lg font-semibold ${
                isLowest ? "text-cyan-400" : "text-white/90"
              }`}
            >
              {dayNum}
            </div>
            <div
              className={`text-xs ${
                item.available
                  ? isLowest
                    ? "text-cyan-400"
                    : "text-white/70"
                  : "text-red-400"
              }`}
            >
              ${item.price}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================================
// DATA TABLE CONTENT
// ============================================================================

interface DataTableContentProps {
  data: Record<string, unknown>;
}

function DataTableContent({ data }: DataTableContentProps) {
  const headers = (data.headers as string[]) || [];
  const rows = (data.rows as string[][]) || [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((header, i) => (
              <th
                key={i}
                className="text-left py-2 px-3 text-white/70 font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, rowIndex) => (
            <motion.tr
              key={rowIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + rowIndex * 0.03, duration: 0.2 }}
              className="border-b border-white/5"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-2 px-3 text-white/80">
                  {cell}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// CODE BLOCK CONTENT
// ============================================================================

interface CodeBlockContentProps {
  data: Record<string, unknown>;
}

function CodeBlockContent({ data }: CodeBlockContentProps) {
  const code = (data.code as string) || "";
  const language = (data.language as string) || "text";

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
        {language}
      </div>
      <pre className="bg-black/30 rounded-xl p-4 overflow-x-auto">
        <code className="text-sm text-green-400 font-mono whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}

// ============================================================================
// SMART CARD CONTENT
// ============================================================================

interface SmartCardContentProps {
  data: Record<string, unknown>;
}

function SmartCardContent({ data }: SmartCardContentProps) {
  const content = (data.content as string) || "";
  const highlights = (data.highlights as string[]) || [];

  return (
    <div className="space-y-4">
      <p className="text-white/80 leading-relaxed">{content}</p>

      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {highlights.map((highlight, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm"
            >
              {highlight}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PRICING HEALTH CONTENT (Apple Health-style dashboard)
// ============================================================================

interface PricingHealthContentProps {
  data: Record<string, unknown>;
}

interface HealthMetricData {
  name: string;
  value: number | string;
  change: number | null;
  trend: "up" | "down" | "stable";
  status: "good" | "warning" | "bad" | "neutral";
  description: string;
}

interface CompetitiveGridItem {
  company: string;
  category: string;
  proTierPrice: number | null;
  vsYou: number | null;
  trend: "up" | "down" | "stable";
}

function PricingHealthContent({ data }: PricingHealthContentProps) {
  const metrics = data.metrics as Record<string, HealthMetricData> | undefined;
  const competitiveGrid = (data.competitiveGrid as CompetitiveGridItem[]) || [];
  const categories =
    (data.categories as {
      name: string;
      avgPrice: number | null;
      companies: number;
      yourPosition: string;
    }[]) || [];

  const getStatusColor = (status: HealthMetricData["status"]) => {
    switch (status) {
      case "good":
        return "text-emerald-400";
      case "warning":
        return "text-amber-400";
      case "bad":
        return "text-red-400";
      default:
        return "text-white/70";
    }
  };

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "↑";
      case "down":
        return "↓";
      default:
        return "→";
    }
  };

  return (
    <div className="space-y-6">
      {/* Health Rings / Metrics Summary */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3">
          {Object.values(metrics).map((metric, index) => (
            <motion.div
              key={metric.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
              className="glass rounded-xl p-4 text-center"
            >
              <div className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
                {metric.value}
              </div>
              <div className="text-xs text-white/50 mt-1">{metric.name}</div>
              {metric.change !== null && (
                <div
                  className={`text-xs mt-1 ${
                    metric.trend === "up"
                      ? "text-emerald-400"
                      : metric.trend === "down"
                      ? "text-red-400"
                      : "text-white/50"
                  }`}
                >
                  {getTrendIcon(metric.trend)} {Math.abs(metric.change)}%
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Competitive Grid */}
      {competitiveGrid.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Competitive Pricing</h3>
          <div className="space-y-2">
            {competitiveGrid.slice(0, 8).map((item, index) => (
              <motion.div
                key={item.company}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.04, duration: 0.3 }}
                className="flex items-center justify-between py-2 px-3 glass rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white/90 font-medium">{item.company}</span>
                  <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-semibold">
                    {item.proTierPrice !== null ? `$${item.proTierPrice}/mo` : "Custom"}
                  </span>
                  {item.vsYou !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        item.vsYou > 0
                          ? "bg-emerald-500/20 text-emerald-400"
                          : item.vsYou < 0
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      {item.vsYou > 0 ? "+" : ""}
                      {item.vsYou}%
                    </span>
                  )}
                  <span
                    className={`text-sm ${
                      item.trend === "up"
                        ? "text-red-400"
                        : item.trend === "down"
                        ? "text-emerald-400"
                        : "text-white/30"
                    }`}
                  >
                    {getTrendIcon(item.trend)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">Categories</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat, index) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.03, duration: 0.2 }}
                className={`px-3 py-2 rounded-lg glass text-sm ${
                  cat.yourPosition === "below"
                    ? "border border-emerald-500/30"
                    : cat.yourPosition === "above"
                    ? "border border-amber-500/30"
                    : ""
                }`}
              >
                <div className="font-medium text-white/90">{cat.name}</div>
                <div className="text-xs text-white/50">
                  {cat.avgPrice !== null ? `Avg $${cat.avgPrice}/mo` : "N/A"} •{" "}
                  {cat.companies} tracked
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INVESTOR DASHBOARD CONTENT (Premium iOS 26-style Portfolio Tracker)
// ============================================================================

interface InvestorDashboardContentProps {
  data: Record<string, unknown>;
}

interface PortfolioCompany {
  name: string;
  ticker?: string;
  logo?: string;
  status: "active" | "acquired" | "public" | "board";
  lastUpdate?: string;
  sentiment?: "positive" | "negative" | "neutral";
  metrics?: {
    valuation?: string;
    growth?: number;
    runway?: string;
  };
}

interface NewsItem {
  title: string;
  source: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
  company: string;
  summary?: string;
  url?: string;
}

function InvestorDashboardContent({ data }: InvestorDashboardContentProps) {
  const companies = (data.companies as PortfolioCompany[]) || [];
  const news = (data.news as NewsItem[]) || [];
  const portfolioValue = data.portfolioValue as string | undefined;
  const dayChange = data.dayChange as number | undefined;
  const updatedAt = data.updatedAt as string | undefined;

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "text-emerald-400";
      case "negative":
        return "text-red-400";
      default:
        return "text-white/60";
    }
  };

  const getSentimentBg = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-emerald-500/10 border-emerald-500/20";
      case "negative":
        return "bg-red-500/10 border-red-500/20";
      default:
        return "bg-white/5 border-white/10";
    }
  };

  const getStatusBadge = (status: PortfolioCompany["status"]) => {
    const badges = {
      active: { label: "Active", bg: "bg-blue-500/20", text: "text-blue-400" },
      acquired: { label: "Acquired", bg: "bg-purple-500/20", text: "text-purple-400" },
      public: { label: "Public", bg: "bg-emerald-500/20", text: "text-emerald-400" },
      board: { label: "Board", bg: "bg-amber-500/20", text: "text-amber-400" },
    };
    return badges[status] || badges.active;
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary - iOS 26 Style Glass Card */}
      {(portfolioValue || dayChange !== undefined) && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="relative overflow-hidden rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(30, 64, 175, 0.15) 0%, rgba(30, 64, 175, 0.05) 100%)",
            boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.1) inset, 0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Animated gradient orb */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30 blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-medium mb-1">
                Portfolio Value
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {portfolioValue || "—"}
              </div>
            </div>
            {dayChange !== undefined && (
              <div className={`text-right ${dayChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                <div className="text-2xl font-bold">
                  {dayChange >= 0 ? "+" : ""}{dayChange}%
                </div>
                <div className="text-xs opacity-70">Today</div>
              </div>
            )}
          </div>

          {updatedAt && (
            <div className="mt-3 text-xs text-white/40">
              Last synced: {updatedAt}
            </div>
          )}
        </motion.div>
      )}

      {/* Portfolio Companies Grid */}
      {companies.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Portfolio Companies
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {companies.slice(0, 10).map((company, index) => {
              const badge = getStatusBadge(company.status);
              return (
                <motion.div
                  key={company.name}
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 0.05 + index * 0.03,
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className="group relative overflow-hidden rounded-xl p-3 cursor-pointer transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
                  }}
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: "radial-gradient(circle at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
                    }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-bold text-white/80">
                        {company.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {company.name}
                        </div>
                        {company.ticker && (
                          <div className="text-xs text-white/40">{company.ticker}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {company.metrics?.growth !== undefined && (
                        <span className={`text-xs font-medium ${
                          company.metrics.growth >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {company.metrics.growth >= 0 ? "+" : ""}{company.metrics.growth}%
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* News Feed - Premium Card Style */}
      {news.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Latest Updates
          </h3>
          <div className="space-y-2">
            {news.slice(0, 5).map((item, index) => (
              <motion.div
                key={`${item.company}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.1 + index * 0.04,
                  duration: 0.3,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className={`relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:scale-[1.01] ${getSentimentBg(item.sentiment)}`}
              >
                {/* Sentiment indicator bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    item.sentiment === "positive"
                      ? "bg-emerald-500"
                      : item.sentiment === "negative"
                      ? "bg-red-500"
                      : "bg-white/20"
                  }`}
                />

                <div className="pl-2">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-blue-400 mr-2">
                        {item.company}
                      </span>
                      <span className="text-xs text-white/40">
                        {item.source} · {item.date}
                      </span>
                    </div>
                    <span className={`text-lg ${getSentimentColor(item.sentiment)}`}>
                      {item.sentiment === "positive" ? "↑" : item.sentiment === "negative" ? "↓" : "→"}
                    </span>
                  </div>

                  <h4 className="text-sm font-medium text-white/90 leading-snug">
                    {item.title}
                  </h4>

                  {item.summary && (
                    <p className="text-xs text-white/50 mt-2 line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {companies.length === 0 && news.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">💼</div>
          <div className="text-white/50 text-sm">No portfolio data available</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN CONTENT RENDERER
// ============================================================================

interface ContentRendererProps {
  type: SnapAppType;
  data: Record<string, unknown>;
}

export function ContentRenderer({ type, data }: ContentRendererProps) {
  switch (type) {
    case "price_comparison":
      return <PriceComparisonContent data={data} />;
    case "product_gallery":
      return <ProductGalleryContent data={data} />;
    case "article":
      return <ArticleContent data={data} />;
    case "availability":
      return <AvailabilityContent data={data} />;
    case "data_table":
      return <DataTableContent data={data} />;
    case "code_block":
      return <CodeBlockContent data={data} />;
    case "smart_card":
      return <SmartCardContent data={data} />;
    case "pricing_health":
      return <PricingHealthContent data={data} />;
    case "investor_dashboard":
      return <InvestorDashboardContent data={data} />;
    default:
      return (
        <div className="text-white/50 text-sm">
          Content preview not available
        </div>
      );
  }
}

// ============================================================================
// FULL SNAP APP CARD
// ============================================================================

interface SnapAppCardProps {
  app: SnapApp;
  showActions?: boolean;
}

export function SnapAppCard({ app, showActions = true }: SnapAppCardProps) {
  const typeColor = SNAP_APP_TYPE_METADATA[app.type]?.color || "#00D4FF";
  const typeEmoji = TYPE_EMOJIS[app.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="snap-card max-w-2xl mx-auto"
    >
      {/* Accent gradient - matching mobile */}
      <div
        className="h-0.5"
        style={{
          background: `linear-gradient(90deg, ${typeColor} 0%, ${typeColor}80 50%, transparent 100%)`,
        }}
      />

      <div className="p-6 space-y-5 relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{
                backgroundColor: `${typeColor}15`,
                boxShadow: `0 0 20px ${typeColor}20`,
              }}
            >
              {typeEmoji}
            </div>
            <div>
              <div
                className="text-[10px] font-semibold uppercase tracking-wider opacity-80"
                style={{ color: typeColor }}
              >
                {app.type.replace("_", " ")}
              </div>
              <h1 className="text-lg font-semibold" style={{ color: 'var(--mino-text-primary)' }}>
                {app.title}
              </h1>
            </div>
          </div>

          <div className="text-right text-xs" style={{ color: 'var(--mino-text-tertiary)' }}>
            <div>{app.viewCount.toLocaleString()} views</div>
            <div>{app.shareCount.toLocaleString()} shares</div>
          </div>
        </div>

        {/* Subtitle */}
        {app.subtitle && (
          <p className="text-sm" style={{ color: 'var(--mino-text-secondary)' }}>
            {app.subtitle}
          </p>
        )}

        {/* Content */}
        <div className="py-1">
          <ContentRenderer type={app.type} data={app.data} />
        </div>

        {/* Insights */}
        {app.insights.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {app.insights.map((insight, i) => (
              <InsightBadge key={i} insight={insight} index={i} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-4"
          style={{ borderTop: '1px solid var(--mino-glass-border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--mino-text-tertiary)' }}>
            {app.creatorName && <>Created by {app.creatorName} · </>}
            {new Date(app.createdAt).toLocaleDateString()}
          </div>

          {showActions && (
            <div className="flex gap-2">
              <button className="btn-secondary text-sm flex items-center gap-2">
                <span>🔗</span>
                Share
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
