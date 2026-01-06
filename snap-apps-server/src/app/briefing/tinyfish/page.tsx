"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Building2,
  Users,
  Handshake,
  Briefcase,
  Newspaper,
  Sparkles,
  Share2,
  Check,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
  category: "product" | "funding" | "partnership" | "hiring" | "general";
  url?: string;
}

interface BriefingData {
  news: NewsItem[];
  summary: string;
  fetchedAt: string;
  generatedFor: string;
}

// ============================================================================
// CATEGORY ICONS
// ============================================================================

const categoryConfig: Record<NewsItem["category"], { icon: React.ElementType; label: string; color: string }> = {
  product: { icon: Sparkles, label: "Product", color: "text-blue-400" },
  funding: { icon: TrendingUp, label: "Funding", color: "text-emerald-400" },
  partnership: { icon: Handshake, label: "Partnership", color: "text-violet-400" },
  hiring: { icon: Users, label: "Hiring", color: "text-amber-400" },
  general: { icon: Newspaper, label: "News", color: "text-slate-400" },
};

const sentimentConfig: Record<NewsItem["sentiment"], { icon: React.ElementType; color: string; bg: string }> = {
  positive: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  negative: { icon: TrendingDown, color: "text-rose-400", bg: "bg-rose-500/10" },
  neutral: { icon: Minus, color: "text-slate-400", bg: "bg-slate-500/10" },
};

// ============================================================================
// NEWS CARD
// ============================================================================

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const category = categoryConfig[item.category];
  const sentiment = sentimentConfig[item.sentiment];
  const CategoryIcon = category.icon;
  const SentimentIcon = sentiment.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group"
    >
      <div className="relative p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
        {/* Category & Sentiment Badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.05] text-[11px] uppercase tracking-wider ${category.color}`}>
            <CategoryIcon className="w-3 h-3" />
            {category.label}
          </span>
          <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${sentiment.bg} text-[11px] ${sentiment.color}`}>
            <SentimentIcon className="w-3 h-3" />
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-medium text-white/90 leading-snug mb-2 group-hover:text-white transition-colors">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline underline-offset-2"
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h3>

        {/* Summary */}
        <p className="text-[13px] text-white/50 leading-relaxed mb-3">{item.summary}</p>

        {/* Meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-white/30">
            <span>{item.source}</span>
            <span className="text-white/20">·</span>
            <span>{item.date}</span>
          </div>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Read</span>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function TinyFishBriefingPage() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBriefing = async () => {
    try {
      const res = await fetch("/api/briefing/tinyfish");
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || "Failed to fetch briefing");
      }
    } catch (err) {
      setError("Failed to connect to briefing service");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBriefing();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div
      className="min-h-screen bg-[#0A0A0B] text-white"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-violet-950/10 pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-2xl mx-auto px-5 py-12 md:py-16">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          {/* Logo & Brand */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight">TinyFish.ai</h1>
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Daily Intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className={`p-2.5 rounded-lg border transition-all duration-200 ${
                  copied
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]"
                }`}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Share2 className="w-4 h-4 text-white/50" />
                )}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-white/50 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Greeting */}
          <div className="mb-6">
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">{today}</p>
            <h2 className="text-[28px] md:text-[32px] font-light tracking-tight text-white/90">
              {greeting}, Sudheesh.
            </h2>
          </div>

          {/* Executive Summary */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-[14px] text-white/50">Gathering intelligence...</p>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-5 rounded-xl bg-rose-500/5 border border-rose-500/20"
              >
                <p className="text-[14px] text-rose-400">{error}</p>
              </motion.div>
            ) : data ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="p-5 rounded-xl bg-gradient-to-br from-blue-500/5 to-violet-500/5 border border-white/[0.08]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-1 h-full min-h-[40px] rounded-full bg-gradient-to-b from-blue-500 to-violet-500" />
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Executive Summary</p>
                    <p className="text-[15px] text-white/80 leading-relaxed">{data.summary}</p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.header>

        {/* News Section */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-white/40" />
              <h3 className="text-[13px] text-white/40 uppercase tracking-wider">Latest Updates</h3>
            </div>
            {data && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                <Clock className="w-3 h-3" />
                <span>
                  {new Date(data.fetchedAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* News List */}
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="news-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse"
                    >
                      <div className="h-4 w-20 bg-white/[0.05] rounded mb-3" />
                      <div className="h-5 w-3/4 bg-white/[0.05] rounded mb-2" />
                      <div className="h-4 w-full bg-white/[0.03] rounded mb-1" />
                      <div className="h-4 w-2/3 bg-white/[0.03] rounded" />
                    </div>
                  ))}
                </motion.div>
              ) : data && data.news.length > 0 ? (
                <motion.div key="news-list" className="space-y-3">
                  {data.news.map((item, index) => (
                    <NewsCard key={index} item={item} index={index} />
                  ))}
                </motion.div>
              ) : data && data.news.length === 0 ? (
                <motion.div
                  key="no-news"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center"
                >
                  <Briefcase className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="text-[14px] text-white/40">No recent news found for TinyFish.ai</p>
                  <p className="text-[12px] text-white/25 mt-1">Check back later for updates</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/[0.06]"
        >
          <div className="flex items-center justify-between text-[11px] text-white/25">
            <p>Powered by Mino</p>
            <p>Generated for {data?.generatedFor || "Sudheesh Nair"}</p>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
