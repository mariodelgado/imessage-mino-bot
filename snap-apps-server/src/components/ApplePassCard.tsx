"use client";

/**
 * Apple Pass Card - Snap App styled like an Apple Wallet/Passbook card
 *
 * Features:
 * - Glassmorphic design with backdrop blur and layered shadows
 * - Premium typography with careful spacing and weights
 * - Color-coded header strip by type
 * - Barcode-style element at bottom
 * - Refresh button that triggers Mino re-fetch
 * - Data persistence until new data arrives
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SnapApp, SnapAppType } from "@/types/snap-app";
import { SNAP_APP_TYPE_METADATA } from "@/types/snap-app";
import { ContentRenderer, InsightBadge } from "./SnapAppRenderer";

// ============================================================================
// PASS TYPE STYLING
// ============================================================================

const PASS_COLORS: Record<SnapAppType, { primary: string; secondary: string; accent: string }> = {
  price_comparison: { primary: "#00D4FF", secondary: "#0099CC", accent: "#00B8E6" },
  product_gallery: { primary: "#8B5CF6", secondary: "#7C3AED", accent: "#A78BFA" },
  article: { primary: "#F59E0B", secondary: "#D97706", accent: "#FBBF24" },
  map_view: { primary: "#10B981", secondary: "#059669", accent: "#34D399" },
  availability: { primary: "#EC4899", secondary: "#DB2777", accent: "#F472B6" },
  code_block: { primary: "#6366F1", secondary: "#4F46E5", accent: "#818CF8" },
  data_table: { primary: "#14B8A6", secondary: "#0D9488", accent: "#2DD4BF" },
  smart_card: { primary: "#F97316", secondary: "#EA580C", accent: "#FB923C" },
  pricing_health: { primary: "#EF4444", secondary: "#DC2626", accent: "#F87171" },
  investor_dashboard: { primary: "#1E40AF", secondary: "#1E3A8A", accent: "#3B82F6" },
};

const TYPE_ICONS: Record<SnapAppType, string> = {
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
// BARCODE COMPONENT (Visual element like Apple Pass)
// ============================================================================

function PassBarcode({ id, color }: { id: string; color: string }) {
  // Generate pseudo-random bar widths from ID
  const bars = id.split("").map((char, i) => {
    const width = ((char.charCodeAt(0) + i) % 4) + 1;
    return width;
  });

  return (
    <div className="flex items-center justify-center gap-[2px] h-12 px-4">
      {bars.slice(0, 30).map((width, i) => (
        <div
          key={i}
          className="h-full rounded-sm"
          style={{
            width: `${width * 2}px`,
            backgroundColor: i % 2 === 0 ? color : `${color}40`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// REFRESH BUTTON
// ============================================================================

interface RefreshButtonProps {
  onClick: () => void;
  isLoading: boolean;
  color: string;
}

function RefreshButton({ onClick, isLoading, color }: RefreshButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={isLoading}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all"
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <motion.span
        animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
        transition={isLoading ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
      >
        🔄
      </motion.span>
      {isLoading ? "Refreshing..." : "Refresh Data"}
    </motion.button>
  );
}

// ============================================================================
// LAST UPDATED INDICATOR
// ============================================================================

function LastUpdated({ date, isStale }: { date: Date; isStale: boolean }) {
  const timeAgo = getTimeAgo(date);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={isStale ? "text-amber-400" : "text-white/50"}>
        {isStale ? "⚠️" : "✓"} Updated {timeAgo}
      </span>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

// ============================================================================
// MAIN APPLE PASS CARD COMPONENT
// ============================================================================

interface ApplePassCardProps {
  app: SnapApp;
  onRefresh?: (newApp: SnapApp) => void;
}

export function ApplePassCard({ app, onRefresh }: ApplePassCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentApp, setCurrentApp] = useState(app);

  const colors = PASS_COLORS[currentApp.type] || PASS_COLORS.smart_card;
  const typeIcon = TYPE_ICONS[currentApp.type] || "✨";
  const typeMeta = SNAP_APP_TYPE_METADATA[currentApp.type];

  // Check if data is stale (more than 1 hour old)
  const isStale = new Date().getTime() - new Date(currentApp.updatedAt).getTime() > 3600000;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/snap-apps/${currentApp.id}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to refresh");
      }

      const result = await response.json();
      if (result.success && result.data) {
        setCurrentApp(result.data);
        onRefresh?.(result.data);
      } else {
        throw new Error(result.error || "No data received");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }, [currentApp.id, onRefresh]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-md mx-auto"
    >
      {/* Glassmorphic Card Container */}
      <div
        className="relative overflow-hidden rounded-[28px] backdrop-blur-xl"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.2) 100%)`,
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.1),
            0 0 0 1px ${colors.primary}15 inset,
            0 4px 6px -1px rgba(0,0,0,0.3),
            0 10px 20px -5px rgba(0,0,0,0.4),
            0 25px 50px -12px ${colors.primary}25,
            0 50px 100px -20px rgba(0,0,0,0.5)
          `,
        }}
      >
        {/* Header Strip - Like Apple Pass top bar */}
        <div
          className="relative h-28 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-20"
            style={{ backgroundColor: colors.accent }}
          />
          <div
            className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full opacity-15"
            style={{ backgroundColor: "#fff" }}
          />

          {/* Header Content */}
          <div className="relative z-10 p-5 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{typeIcon}</span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                    {typeMeta?.label || currentApp.type.replace("_", " ")}
                  </div>
                  <h1 className="text-lg font-bold text-white leading-tight">
                    {currentApp.title}
                  </h1>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {currentApp.viewCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/70 uppercase">views</div>
              </div>
            </div>

            {currentApp.subtitle && (
              <p className="text-sm text-white/80 truncate">{currentApp.subtitle}</p>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-5 space-y-5">
          {/* Content Renderer */}
          <div className="min-h-[120px]">
            <ContentRenderer type={currentApp.type} data={currentApp.data} />
          </div>

          {/* Insights */}
          {currentApp.insights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentApp.insights.map((insight, i) => (
                <InsightBadge key={i} insight={insight} index={i} />
              ))}
            </div>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div
            className="h-px w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${colors.primary}40, transparent)`,
            }}
          />

          {/* Footer with Refresh */}
          <div className="flex items-center justify-between">
            <LastUpdated date={currentApp.updatedAt} isStale={isStale} />
            <RefreshButton
              onClick={handleRefresh}
              isLoading={isRefreshing}
              color={colors.primary}
            />
          </div>
        </div>

        {/* Barcode Section - Like Apple Pass bottom */}
        <div
          className="py-4 mt-2"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${colors.primary}08 100%)`,
            borderTop: `1px dashed ${colors.primary}30`,
          }}
        >
          <PassBarcode id={currentApp.id} color={colors.primary} />
          <div className="text-center mt-2">
            <span className="text-[10px] text-white/30 font-mono tracking-wider">
              {currentApp.id.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Source URL Footer */}
        {currentApp.sourceUrl && (
          <div className="px-5 py-3 bg-black/30">
            <a
              href={currentApp.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/60 transition-colors truncate block"
            >
              📍 {new URL(currentApp.sourceUrl).hostname}
            </a>
          </div>
        )}
      </div>

      {/* Share indicator */}
      <div className="mt-4 text-center">
        <span className="text-xs text-white/30">
          {currentApp.shareCount > 0 && `Shared ${currentApp.shareCount} times • `}
          Powered by Mino
        </span>
      </div>
    </motion.div>
  );
}

export default ApplePassCard;
