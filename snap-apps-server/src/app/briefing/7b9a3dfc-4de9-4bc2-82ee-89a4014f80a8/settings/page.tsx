"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  ExternalLink,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ============================================================================
// TYPES
// ============================================================================

interface ScrapeHistoryItem {
  scraped_at: string;
  documents_found: number;
  documents_new: number;
  documents_changed: number;
  documents_removed: number;
  duration_ms: number;
  status: string;
  error?: string | null;
}

interface SourceWithHistory {
  id: string;
  name: string;
  url: string;
  type: string;
  region: string;
  scrapeHistory: ScrapeHistoryItem[];
  lastScrape: {
    at: string | null;
    status: string;
    documentsFound: number;
    duration: number;
    error?: string | null;
  };
  stats: {
    totalScrapes: number;
    successRate: number;
    avgDuration: number;
    lastSuccess: string | null;
    lastError: string | null;
  };
}

interface SourcesData {
  sources: SourceWithHistory[];
  summary: {
    totalSources: number;
    healthySources: number;
    warningSources: number;
    failingSources: number;
  };
  generatedAt: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// SOURCE CARD
// ============================================================================

function SourceCard({ source }: { source: SourceWithHistory }) {
  const [expanded, setExpanded] = useState(false);

  // Prepare chart data from scrape history
  const chartData = [...source.scrapeHistory]
    .reverse()
    .map((log) => ({
      date: new Date(log.scraped_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      docs: log.documents_found,
      duration: log.duration_ms / 1000,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-stone-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-4 bg-stone-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 mt-0.5 text-stone-400" />
            <div>
              <h3 className="font-medium text-stone-900">{source.name}</h3>
              <div className="flex items-center gap-2 mt-1 text-[12px] text-stone-500">
                <span>{source.region}</span>
                <span className="text-stone-300">|</span>
                <span className="capitalize">{source.type}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">Last Run</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <p className="text-[15px] font-medium text-stone-700">
                  {formatRelativeTime(source.lastScrape.at)}
                </p>
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-stone-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-stone-400" />
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-stone-200/50">
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Docs Found</p>
            <p className="font-medium text-stone-700">{source.lastScrape.documentsFound}</p>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Duration</p>
            <p className="font-medium text-stone-700">{formatDuration(source.lastScrape.duration)}</p>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wide">Total Runs</p>
            <p className="font-medium text-stone-700">{source.stats.totalScrapes}</p>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white border-t border-stone-200">
              {/* Source URL */}
              <div className="mb-4">
                <p className="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Source URL</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[13px] text-amber-700 hover:text-amber-900 transition-colors"
                >
                  <span className="truncate">{source.url}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-stone-50 rounded p-3">
                  <p className="text-[10px] text-stone-500 uppercase tracking-wide">Total Scrapes</p>
                  <p className="text-xl font-semibold text-stone-800">{source.stats.totalScrapes}</p>
                </div>
                <div className="bg-stone-50 rounded p-3">
                  <p className="text-[10px] text-stone-500 uppercase tracking-wide">Avg Duration</p>
                  <p className="text-xl font-semibold text-stone-800">{formatDuration(source.stats.avgDuration)}</p>
                </div>
              </div>

              {/* Activity Chart */}
              {chartData.length > 1 && (
                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wide mb-2">Scrape History</p>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#78716C" }}
                          tickLine={false}
                          axisLine={{ stroke: "#E7E5E4" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#78716C" }}
                          tickLine={false}
                          axisLine={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#FDFBF7",
                            border: "1px solid #E7E5E4",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="docs"
                          stroke="#B45309"
                          strokeWidth={2}
                          dot={{ fill: "#B45309", strokeWidth: 0, r: 3 }}
                          name="Documents"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Scrape History Table */}
              {source.scrapeHistory.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] text-stone-500 uppercase tracking-wide mb-2">Recent Runs</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-stone-200">
                          <th className="pb-2 font-medium text-stone-500">Time</th>
                          <th className="pb-2 font-medium text-stone-500 text-right">Found</th>
                          <th className="pb-2 font-medium text-stone-500 text-right">New</th>
                          <th className="pb-2 font-medium text-stone-500 text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {source.scrapeHistory.slice(0, 5).map((log, i) => (
                          <tr key={i} className="border-b border-stone-100">
                            <td className="py-2 text-stone-600">
                              {new Date(log.scraped_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-2 text-right text-stone-600">{log.documents_found}</td>
                            <td className="py-2 text-right text-emerald-600">+{log.documents_new}</td>
                            <td className="py-2 text-right text-stone-500">{formatDuration(log.duration_ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SettingsPage() {
  const [data, setData] = useState<SourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/briefing/renewable-fuels/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
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
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

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
        {/* Header */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="pt-8 pb-6 border-b border-stone-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/briefing/7b9a3dfc-4de9-4bc2-82ee-89a4014f80a8"
                className="p-2 -ml-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-serif font-bold text-stone-900">Source Management</h1>
                <p className="text-[13px] text-stone-500 mt-0.5">Monitor and manage data sources</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </motion.header>

        {/* Summary Stats */}
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
                <p className="text-[0.9375rem] text-stone-500 italic">Loading sources...</p>
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
              key="content"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Source List */}
              <div className="space-y-4 pb-12">
                <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-stone-500">
                  Data Sources
                </p>
                {data.sources.map((source) => (
                  <SourceCard key={source.id} source={source} />
                ))}
              </div>

              {/* Footer */}
              <div className="py-6 border-t border-stone-200 text-center">
                <p className="text-[11px] text-stone-400">
                  Last updated: {new Date(data.generatedAt).toLocaleString()}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
