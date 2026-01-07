"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Clock,
  Share2,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Activity,
  Settings,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  briefing: string;
  stats: {
    totalDocuments: number;
    newThisWeek: number;
    changedThisWeek: number;
    activeSources: number;
    lastScrape: string | null;
  };
  charts: {
    regionActivity: Array<{ region: string; document_count: number; new_count: number; changed_count: number }>;
    timeline: Array<{ date: string; new_count: number; changed_count: number; removed_count: number }>;
    topicHeatmap: Array<{ topic_id: string; topic_name: string; document_count: number; avg_relevance: number }>;
  };
  recentChanges: Array<{
    id: string;
    title: string;
    url: string;
    source_name: string;
    region: string;
    change_type: "new" | "changed";
    changed_at: string;
    topics: string[];
    metadata?: { date?: string };
  }>;
  topicActivity: Array<{
    topic_id: string;
    topic_name: string;
    new_count: number;
    changed_count: number;
    total_count: number;
  }>;
  sourceHealth: Array<{
    source_id: string;
    source_name: string;
    region: string;
    last_scrape: string | null;
    last_status: string;
    total_documents: number;
    success_rate: number;
  }>;
  generatedAt: string;
}

// ============================================================================
// COLORS
// ============================================================================

const CHART_COLORS = ["#B45309", "#78716C", "#059669", "#0369A1", "#7C3AED", "#DB2777", "#EA580C"];

const changeTypeConfig = {
  new: { icon: TrendingUp, label: "New", color: "text-emerald-700", bg: "bg-emerald-50" },
  changed: { icon: Activity, label: "Updated", color: "text-amber-700", bg: "bg-amber-50" },
};

// ============================================================================
// EU HEAT MAP
// ============================================================================

// Simple SVG paths for European countries (simplified outlines)
const COUNTRY_PATHS: Record<string, { d: string; cx: number; cy: number }> = {
  UK: {
    d: "M85,95 L95,85 L100,95 L95,115 L85,125 L75,115 L75,100 Z",
    cx: 87,
    cy: 105,
  },
  Netherlands: {
    d: "M135,90 L150,88 L155,100 L145,108 L130,105 Z",
    cx: 143,
    cy: 98,
  },
  Germany: {
    d: "M145,108 L175,100 L190,115 L185,145 L160,155 L140,145 L135,120 Z",
    cx: 162,
    cy: 128,
  },
  Sweden: {
    d: "M175,30 L195,25 L205,50 L200,85 L185,90 L170,70 L165,45 Z",
    cx: 185,
    cy: 55,
  },
  Norway: {
    d: "M150,20 L175,30 L165,45 L170,70 L155,75 L145,55 L140,30 Z",
    cx: 155,
    cy: 48,
  },
  EU: {
    d: "M130,150 L170,145 L200,160 L210,190 L190,210 L150,215 L120,200 L115,170 Z",
    cx: 162,
    cy: 180,
  },
};

function getHeatMapColor(value: number, maxValue: number): string {
  if (maxValue === 0) return "#E7E5E4"; // stone-200
  const intensity = value / maxValue;
  // Gradient from stone-200 → amber-200 → amber-500 → amber-700
  if (intensity === 0) return "#E7E5E4";
  if (intensity < 0.25) return "#FDE68A"; // amber-200
  if (intensity < 0.5) return "#FBBF24"; // amber-400
  if (intensity < 0.75) return "#F59E0B"; // amber-500
  return "#B45309"; // amber-700
}

function EuropeHeatMap({ regionData }: { regionData: DashboardData["charts"]["regionActivity"] }) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Create a map of region -> data
  const regionMap = new Map(regionData.map((r) => [r.region, r]));
  const maxNewCount = Math.max(...regionData.map((r) => r.new_count), 1);

  return (
    <div className="relative">
      <svg viewBox="0 0 300 240" className="w-full h-auto max-h-[200px]">
        {/* Background */}
        <rect x="0" y="0" width="300" height="240" fill="#FDFBF7" />

        {/* Water/Sea background */}
        <rect x="0" y="0" width="300" height="240" fill="#F5F5F4" rx="4" />

        {/* Countries */}
        {Object.entries(COUNTRY_PATHS).map(([region, path]) => {
          const data = regionMap.get(region);
          const newCount = data?.new_count || 0;
          const color = getHeatMapColor(newCount, maxNewCount);
          const isHovered = hoveredRegion === region;

          return (
            <g key={region}>
              <path
                d={path.d}
                fill={color}
                stroke={isHovered ? "#78716C" : "#A8A29E"}
                strokeWidth={isHovered ? 2 : 1}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredRegion(region)}
                onMouseLeave={() => setHoveredRegion(null)}
              />
              {/* Country label */}
              <text
                x={path.cx}
                y={path.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[8px] font-medium fill-stone-700 pointer-events-none select-none"
              >
                {region}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredRegion && regionMap.get(hoveredRegion) && (
        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm border border-stone-200 rounded-lg px-3 py-2 shadow-sm">
          <p className="text-[11px] font-medium text-stone-800">{hoveredRegion}</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-stone-500">
              <span className="text-emerald-600 font-medium">{regionMap.get(hoveredRegion)?.new_count || 0}</span> new
            </p>
            <p className="text-[10px] text-stone-500">
              <span className="text-amber-600 font-medium">{regionMap.get(hoveredRegion)?.changed_count || 0}</span> updated
            </p>
            <p className="text-[10px] text-stone-500">
              <span className="font-medium">{regionMap.get(hoveredRegion)?.document_count || 0}</span> total
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-stone-200" />
          <span className="text-[9px] text-stone-400">No activity</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-amber-200" />
          <div className="w-3 h-2 rounded-sm bg-amber-400" />
          <div className="w-3 h-2 rounded-sm bg-amber-500" />
          <div className="w-3 h-2 rounded-sm bg-amber-700" />
          <span className="text-[9px] text-stone-400 ml-1">More activity</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DOCUMENT CARD
// ============================================================================

function DocumentCard({ item, index, featured = false }: {
  item: DashboardData["recentChanges"][0];
  index: number;
  featured?: boolean;
}) {
  const config = changeTypeConfig[item.change_type];
  const ChangeIcon = config.icon;

  if (featured) {
    return (
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="group relative"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className={`text-[11px] font-semibold tracking-[0.2em] uppercase ${config.color}`}>
            {config.label}
          </span>
          <span className="w-px h-3 bg-stone-300" />
          <span className="text-[11px] tracking-wide text-stone-500">{item.source_name}</span>
          <span className="w-px h-3 bg-stone-300" />
          <span className="text-[11px] tracking-wide text-stone-500">{item.region}</span>
        </div>

        <h2 className="font-serif text-[2rem] md:text-[2.5rem] leading-[1.15] font-medium text-stone-900 mb-5 tracking-[-0.02em]">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-800 transition-colors duration-300"
          >
            {item.title}
          </a>
        </h2>

        {item.topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {item.topics.map((topic) => (
              <span
                key={topic}
                className="px-3 py-1 text-[11px] font-medium tracking-wide uppercase bg-stone-100 text-stone-600 rounded"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-5 border-t border-stone-200">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${config.bg}`}>
              <ChangeIcon className={`w-3.5 h-3.5 ${config.color}`} />
              <span className={`text-[11px] ${config.color}`}>{config.label}</span>
            </div>
            {item.metadata?.date && (
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{item.metadata.date}</span>
              </div>
            )}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13px] font-medium text-amber-700 hover:text-amber-900 transition-colors group/link"
          >
            <span>View document</span>
            <ChevronRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="group py-6 border-b border-stone-200 last:border-b-0"
    >
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className={`text-[10px] font-semibold tracking-[0.15em] uppercase ${config.color}`}>
              {config.label}
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-[11px] text-stone-400">{item.source_name}</span>
            <span className="text-stone-300">·</span>
            <span className="text-[11px] text-stone-400">{item.region}</span>
            {item.metadata?.date && (
              <>
                <span className="text-stone-300">·</span>
                <span className="text-[11px] text-stone-400">{item.metadata.date}</span>
              </>
            )}
          </div>

          <h3 className="font-serif text-[1.25rem] md:text-[1.375rem] leading-[1.3] font-medium text-stone-900 mb-2 tracking-[-0.01em] group-hover:text-amber-800 transition-colors">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
          </h3>

          {item.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase bg-stone-100 text-stone-500 rounded"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>View</span>
            </a>
          </div>
        </div>

        <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded ${config.bg} flex-shrink-0`}>
          <ChangeIcon className={`w-3.5 h-3.5 ${config.color}`} />
        </div>
      </div>
    </motion.article>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtext
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subtext?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <Icon className="w-5 h-5 mx-auto mb-2 text-stone-400" />
      <p className="text-[2rem] md:text-[2.5rem] font-serif font-medium text-stone-900">{value}</p>
      <p className="text-[11px] tracking-[0.15em] uppercase text-stone-500">{label}</p>
      {subtext && <p className="text-[10px] text-stone-400 mt-1">{subtext}</p>}
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RenewableFuelsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("week");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing/renewable-fuels");
      if (!res.ok) throw new Error("Failed to fetch data");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Background refresh every 5 minutes
    const interval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const editionNumber = Math.floor((today.getTime() - new Date("2025-01-01").getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Paper texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 md:px-8">
        {/* Masthead */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="pt-12 md:pt-16 pb-8 border-b-2 border-stone-900"
        >
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] tracking-[0.3em] uppercase text-stone-500">
              Edition No. {editionNumber}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/briefing/7b9a3dfc-4de9-4bc2-82ee-89a4014f80a8/settings"
                className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all duration-200"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <button
                onClick={handleShare}
                className={`p-2 rounded-full transition-all duration-200 ${
                  copied
                    ? "bg-emerald-100 text-emerald-700"
                    : "hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="text-center mb-6">
            <h1
              className="text-[3rem] md:text-[4rem] font-serif font-bold tracking-[-0.03em] text-stone-900 leading-none"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Renewable Fuels
            </h1>
            <p className="text-[0.8125rem] tracking-[0.4em] uppercase text-stone-500 mt-2">
              Regulatory Intelligence Monitor
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-stone-500">
            <span>{formattedDate}</span>
            <span className="w-1 h-1 rounded-full bg-stone-300" />
            <span>EU & National Markets</span>
          </div>
        </motion.header>

        {/* Stats Banner */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                <p className="text-[0.9375rem] text-stone-500 italic">Gathering intelligence...</p>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <p className="text-[0.9375rem] text-red-700 text-center">{error}</p>
            </motion.div>
          ) : data ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="py-10 border-b border-stone-200"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <StatCard icon={FileText} label="Documents" value={data.stats.totalDocuments} />
                <StatCard
                  icon={TrendingUp}
                  label="New This Week"
                  value={data.stats.newThisWeek}
                />
                <StatCard
                  icon={Activity}
                  label="Changed"
                  value={data.stats.changedThisWeek}
                />
                <StatCard
                  icon={Globe}
                  label="Sources"
                  value={data.stats.activeSources}
                  subtext={data.stats.lastScrape ? `Updated ${new Date(data.stats.lastScrape).toLocaleDateString()}` : undefined}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Regional Activity Heat Map */}
        {data && data.charts.regionActivity.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="py-8 border-b border-stone-200"
          >
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-stone-500 mb-4">
              Regional Activity
            </p>
            <EuropeHeatMap regionData={data.charts.regionActivity} />
          </motion.section>
        )}

        {/* Executive Briefing */}
        {data && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="py-10 border-b border-stone-200"
          >
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-amber-700 mb-4">
              Executive Summary
            </p>
            <div className="font-serif text-[1.125rem] md:text-[1.25rem] leading-[1.7] text-stone-700" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {data.briefing.split("\n").map((line, i) => {
                if (line.startsWith("## ")) {
                  return <h3 key={i} className="text-[1rem] font-semibold mt-6 mb-3 text-stone-800 font-sans tracking-wide uppercase">{line.slice(3)}</h3>;
                }
                if (line.startsWith("### ")) {
                  return <h4 key={i} className="text-[0.9rem] font-medium mt-4 mb-2 text-stone-700 font-sans">{line.slice(4)}</h4>;
                }
                if (line.startsWith("- ")) {
                  return <li key={i} className="ml-4 mb-1 text-stone-600">{line.slice(2)}</li>;
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-semibold text-stone-800 font-sans">{line.slice(2, -2)}</p>;
                }
                if (line.trim()) {
                  return <p key={i} className="mb-3">{line}</p>;
                }
                return null;
              })}
            </div>
          </motion.section>
        )}

        {/* Charts Section */}
        {data && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="py-10 border-b border-stone-200"
          >
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-stone-500">
                Coverage Analysis
              </p>
              <div className="flex items-center gap-1 bg-stone-100 rounded-full p-0.5">
                {(["week", "month", "quarter"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-[11px] font-medium rounded-full transition-all duration-200 ${
                      period === p
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Sparkline */}
            {data.charts.timeline.length > 0 && (
              <div className="mb-8">
                <p className="text-[11px] font-medium tracking-wide text-stone-600 mb-3">Activity Timeline</p>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={data.charts.timeline} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="newGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="changedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B45309" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#B45309" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#A8A29E" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FDFBF7",
                        border: "1px solid #E7E5E4",
                        borderRadius: "4px",
                        fontSize: "11px",
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    />
                    <Area
                      type="monotone"
                      dataKey="new_count"
                      stroke="#059669"
                      strokeWidth={1.5}
                      fill="url(#newGradient)"
                      name="New"
                    />
                    <Area
                      type="monotone"
                      dataKey="changed_count"
                      stroke="#B45309"
                      strokeWidth={1.5}
                      fill="url(#changedGradient)"
                      name="Changed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="text-[10px] text-stone-500">New Documents</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-600" />
                    <span className="text-[10px] text-stone-500">Updated</span>
                  </div>
                </div>
              </div>
            )}

            {/* Topic Coverage */}
            <div>
              <p className="text-[11px] font-medium tracking-wide text-stone-600 mb-4">By Topic</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.charts.topicHeatmap} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#78716C" }} />
                  <YAxis
                    dataKey="topic_name"
                    type="category"
                    width={100}
                    tick={{ fontSize: 10, fill: "#78716C" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FDFBF7",
                      border: "1px solid #E7E5E4",
                      borderRadius: "4px",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="document_count" fill="#B45309" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}

        {/* Recent Documents Section */}
        <section className="py-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[11px] font-semibold tracking-[0.25em] uppercase text-stone-500">
              Recent Documents
            </h2>
            {data && (
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <Clock className="w-3 h-3" />
                <span>
                  Updated{" "}
                  {data.stats.lastScrape
                    ? new Date(data.stats.lastScrape).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "N/A"
                  }
                </span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="docs-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="py-6 border-b border-stone-200 animate-pulse">
                    <div className="h-3 w-20 bg-stone-200 rounded mb-3" />
                    <div className="h-6 w-3/4 bg-stone-200 rounded mb-2" />
                    <div className="h-4 w-full bg-stone-100 rounded mb-1" />
                    <div className="h-4 w-2/3 bg-stone-100 rounded" />
                  </div>
                ))}
              </motion.div>
            ) : data && data.recentChanges.length > 0 ? (
              <motion.div key="docs-list">
                {/* Featured document (first one) */}
                {data.recentChanges.length > 0 && (
                  <DocumentCard item={data.recentChanges[0]} index={0} featured />
                )}

                {/* Remaining documents */}
                {data.recentChanges.length > 1 && (
                  <div className="mt-10 pt-10 border-t border-stone-200">
                    <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400 mb-6">
                      More Updates
                    </p>
                    {data.recentChanges.slice(1, 8).map((item, index) => (
                      <DocumentCard key={item.id} item={item} index={index} />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : data && data.recentChanges.length === 0 ? (
              <motion.div
                key="no-docs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center"
              >
                <p
                  className="text-[1.25rem] font-serif italic text-stone-400 mb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  No new documents today
                </p>
                <p className="text-[0.875rem] text-stone-400">
                  Check back tomorrow for regulatory updates.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* Source Health Table */}
        {data && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="py-10 border-t border-stone-200"
          >
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-stone-500">
                Source Status
              </p>
              <Link
                href="/briefing/7b9a3dfc-4de9-4bc2-82ee-89a4014f80a8/settings"
                className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors"
              >
                <Settings className="w-3 h-3" />
                <span>Manage Sources</span>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="pb-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-stone-500">Source</th>
                    <th className="pb-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-stone-500">Region</th>
                    <th className="pb-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-stone-500">Status</th>
                    <th className="pb-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-stone-500 text-right">Docs</th>
                    <th className="pb-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-stone-500 text-right">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sourceHealth.map((source) => {
                    const isHealthy = source.success_rate >= 80;
                    const isWarning = source.success_rate >= 50 && source.success_rate < 80;
                    const statusLabel = isHealthy ? "Active" : isWarning ? "Warning" : "Failing";
                    const dotColor = isHealthy ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-500";
                    const textColor = isHealthy ? "text-emerald-700" : isWarning ? "text-amber-700" : "text-red-700";
                    const lastScrapeDate = source.last_scrape ? new Date(source.last_scrape) : null;
                    const lastScrapeRelative = lastScrapeDate
                      ? lastScrapeDate.getTime() > Date.now() - 86400000
                        ? "Today"
                        : lastScrapeDate.getTime() > Date.now() - 172800000
                        ? "Yesterday"
                        : lastScrapeDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "Never";

                    return (
                      <tr key={source.source_id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="text-[13px] font-medium text-stone-700">{source.source_name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-[13px] text-stone-500">{source.region}</td>
                        <td className="py-3">
                          <div className="flex flex-col">
                            <span className={`text-[11px] font-medium ${textColor}`}>
                              {statusLabel}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {lastScrapeRelative}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-[13px] text-stone-600 text-right">{source.total_documents}</td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="w-12 bg-stone-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${dotColor}`}
                                style={{ width: `${source.success_rate}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-stone-400 w-8">{source.success_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.section>
        )}

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="py-12 border-t-2 border-stone-900"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-stone-900 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white tracking-wider">RF</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-700">Powered by Mino</p>
                <p className="text-[10px] text-stone-400">Regulatory Web Intelligence</p>
              </div>
            </div>
            <p className="text-[10px] text-stone-400">
              © {new Date().getFullYear()} Renewable Fuels Monitor · ISCC, EU-Lex & National Sources
            </p>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}
