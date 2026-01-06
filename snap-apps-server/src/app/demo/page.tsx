/**
 * Demo Page - Test ApplePassCard with mock data
 *
 * This page allows testing the glassmorphic UI without Vercel KV storage.
 * Access at: http://localhost:3001/demo
 */

"use client";

import { useState } from "react";
import { ApplePassCard } from "@/components/ApplePassCard";
import type { SnapApp, SnapAppType } from "@/types/snap-app";

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_SNAP_APPS: SnapApp[] = [
  // Price Comparison
  {
    id: "demo-price-001",
    type: "price_comparison",
    title: "MacBook Pro M4 Prices",
    subtitle: "Comparing across retailers",
    sourceUrl: "https://apple.com/shop/buy-mac/macbook-pro",
    data: {
      items: [
        { name: "Apple Store", price: 1999, url: "https://apple.com" },
        { name: "Amazon", price: 1849, url: "https://amazon.com" },
        { name: "Best Buy", price: 1899, url: "https://bestbuy.com" },
        { name: "B&H Photo", price: 1879, url: "https://bhphoto.com" },
      ],
    },
    insights: [
      { type: "positive", text: "Lowest: $1,849", icon: "💰" },
      { type: "positive", text: "Save up to 7%", icon: "📉" },
      { type: "neutral", text: "4 retailers compared", icon: "🏪" },
    ],
    actions: [
      { label: "Share", icon: "share", action: "share" },
      { label: "Refresh", icon: "refresh", action: "refresh" },
    ],
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 1800000),
    viewCount: 142,
    shareCount: 8,
    isPublic: true,
  },

  // Product Gallery
  {
    id: "demo-gallery-001",
    type: "product_gallery",
    title: "Coffee Beans",
    subtitle: "Philz Coffee seasonal selection",
    sourceUrl: "https://philzcoffee.com/collections/coffee",
    data: {
      items: [
        {
          name: "Winter Bliss",
          price: 19.99,
          image: "https://via.placeholder.com/200",
          available: true,
        },
        {
          name: "Tesora",
          price: 17.99,
          image: "https://via.placeholder.com/200",
          available: true,
        },
        {
          name: "Ether",
          price: 21.99,
          image: "https://via.placeholder.com/200",
          available: false,
        },
      ],
    },
    insights: [
      { type: "positive", text: "2 in stock", icon: "✅" },
      { type: "warning", text: "1 out of stock", icon: "⚠️" },
    ],
    actions: [],
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 600000),
    viewCount: 89,
    shareCount: 3,
    isPublic: true,
  },

  // Availability
  {
    id: "demo-avail-001",
    type: "availability",
    title: "Restaurant Reservations",
    subtitle: "The French Laundry",
    sourceUrl: "https://www.exploretock.com/thefrenchlaundry",
    data: {
      available: true,
      slots: [
        { date: "2025-01-10", times: ["6:00 PM", "8:30 PM"] },
        { date: "2025-01-11", times: ["5:30 PM"] },
        { date: "2025-01-12", times: [] },
      ],
    },
    insights: [
      { type: "positive", text: "3 slots available", icon: "📅" },
      { type: "warning", text: "Jan 12 fully booked", icon: "🔴" },
    ],
    actions: [],
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
    viewCount: 234,
    shareCount: 12,
    isPublic: true,
  },

  // Article Summary
  {
    id: "demo-article-001",
    type: "article",
    title: "AI in 2025",
    subtitle: "Key trends and predictions",
    sourceUrl: "https://example.com/article",
    data: {
      headline: "The Future of AI: What to Expect in 2025",
      author: "Tech Weekly",
      publishedAt: "2025-01-03",
      keyPoints: [
        "Multimodal AI becomes standard",
        "Agent-based systems gain traction",
        "On-device AI expands",
        "Regulation catches up",
      ],
      readTime: "5 min read",
    },
    insights: [
      { type: "neutral", text: "5 min read", icon: "📖" },
      { type: "positive", text: "4 key insights", icon: "💡" },
    ],
    actions: [],
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 86400000),
    viewCount: 567,
    shareCount: 45,
    isPublic: true,
  },

  // Data Table
  {
    id: "demo-table-001",
    type: "data_table",
    title: "Stock Watchlist",
    subtitle: "Tech sector overview",
    sourceUrl: "https://finance.yahoo.com",
    data: {
      columns: ["Symbol", "Price", "Change", "Volume"],
      rows: [
        ["AAPL", "$185.32", "+1.2%", "45.2M"],
        ["GOOGL", "$142.78", "-0.8%", "22.1M"],
        ["MSFT", "$378.91", "+0.4%", "18.7M"],
        ["NVDA", "$492.15", "+2.1%", "52.3M"],
      ],
    },
    insights: [
      { type: "positive", text: "3 stocks up", icon: "📈" },
      { type: "negative", text: "1 stock down", icon: "📉" },
    ],
    actions: [],
    createdAt: new Date(Date.now() - 300000),
    updatedAt: new Date(),
    viewCount: 892,
    shareCount: 23,
    isPublic: true,
  },

  // Pricing Health
  {
    id: "demo-health-001",
    type: "pricing_health",
    title: "Competitive Pricing",
    subtitle: "SaaS Market Analysis",
    sourceUrl: "https://example.com/pricing",
    data: {
      yourPrice: 29,
      competitorAvg: 35,
      marketRange: { min: 19, max: 49 },
      competitors: [
        { name: "Competitor A", price: 39 },
        { name: "Competitor B", price: 29 },
        { name: "Competitor C", price: 35 },
      ],
      healthScore: 85,
    },
    insights: [
      { type: "positive", text: "17% below avg", icon: "✨" },
      { type: "positive", text: "Health score: 85", icon: "❤️" },
    ],
    actions: [],
    createdAt: new Date(Date.now() - 43200000),
    updatedAt: new Date(Date.now() - 3600000),
    viewCount: 156,
    shareCount: 7,
    isPublic: true,
  },

  // Smart Card (generic)
  {
    id: "demo-smart-001",
    type: "smart_card",
    title: "Weather Forecast",
    subtitle: "San Francisco, CA",
    sourceUrl: "https://weather.gov",
    data: {
      current: { temp: 58, condition: "Partly Cloudy", humidity: 72 },
      forecast: [
        { day: "Today", high: 62, low: 52 },
        { day: "Tomorrow", high: 65, low: 54 },
        { day: "Wednesday", high: 61, low: 51 },
      ],
    },
    insights: [
      { type: "neutral", text: "58°F currently", icon: "🌤️" },
      { type: "positive", text: "Warming trend", icon: "📈" },
    ],
    actions: [],
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(),
    viewCount: 445,
    shareCount: 2,
    isPublic: true,
  },

  // Investor Dashboard - Ryan Koh @ ICONIQ Capital
  {
    id: "demo-investor-ryan-001",
    type: "investor_dashboard",
    title: "Ryan Koh's Portfolio",
    subtitle: "ICONIQ Capital · Daily Update",
    sourceUrl: "https://iconiqcapital.com",
    data: {
      portfolioValue: "$2.4B",
      dayChange: 1.8,
      updatedAt: new Date().toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      companies: [
        { name: "TinyFish", status: "active", metrics: { growth: 24 } },
        { name: "Statsig", status: "acquired", ticker: "→ OpenAI", metrics: { growth: 156 } },
        { name: "Adaptive ML", status: "active", metrics: { growth: 45 } },
        { name: "Pinecone", status: "active", metrics: { growth: 89 } },
        { name: "Groww", status: "public", ticker: "NSE: GROWW", metrics: { growth: 12 } },
        { name: "Spotnana", status: "board", metrics: { growth: 34 } },
        { name: "Unit21", status: "active", metrics: { growth: -8 } },
        { name: "Reprise", status: "active", metrics: { growth: 67 } },
        { name: "Highspot", status: "board", metrics: { growth: 23 } },
        { name: "Sendbird", status: "board", metrics: { growth: 15 } },
      ],
      news: [
        {
          company: "Statsig",
          title: "OpenAI Completes Statsig Acquisition, Integrates Feature Flagging",
          source: "TechCrunch",
          date: "2h ago",
          sentiment: "positive",
          summary: "OpenAI announced the successful completion of its Statsig acquisition, bringing advanced feature experimentation in-house.",
        },
        {
          company: "Pinecone",
          title: "Pinecone Launches Serverless 2.0 with 10x Performance Boost",
          source: "VentureBeat",
          date: "5h ago",
          sentiment: "positive",
          summary: "Vector database leader Pinecone unveils major upgrade with dramatic performance improvements for AI applications.",
        },
        {
          company: "Groww",
          title: "Groww Reports Strong Q3 with 45M Active Users",
          source: "Economic Times",
          date: "1d ago",
          sentiment: "positive",
          summary: "Indian investment platform continues rapid growth trajectory with record quarterly results.",
        },
        {
          company: "Unit21",
          title: "Unit21 Secures Major Banking Partnership",
          source: "Fintech Today",
          date: "1d ago",
          sentiment: "positive",
          summary: "Fraud detection startup signs multi-year deal with top-10 US bank.",
        },
        {
          company: "Highspot",
          title: "Highspot Expands European Operations",
          source: "Reuters",
          date: "2d ago",
          sentiment: "neutral",
          summary: "Sales enablement platform opens new offices in London and Frankfurt amid EMEA expansion.",
        },
      ],
    },
    insights: [
      { type: "positive", text: "8 companies growing", icon: "📈" },
      { type: "positive", text: "1 successful exit", icon: "🎯" },
      { type: "neutral", text: "3 board seats", icon: "🪑" },
    ],
    actions: [
      { label: "Share", icon: "share", action: "share" },
      { label: "Refresh", icon: "refresh", action: "refresh" },
    ],
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
    viewCount: 47,
    shareCount: 0,
    isPublic: false,
    creatorName: "Mino AI",
  },
];

// ============================================================================
// DEMO PAGE COMPONENT
// ============================================================================

export default function DemoPage() {
  const [selectedType, setSelectedType] = useState<SnapAppType | "all">("all");

  const filteredApps =
    selectedType === "all"
      ? MOCK_SNAP_APPS
      : MOCK_SNAP_APPS.filter((app) => app.type === selectedType);

  const types: (SnapAppType | "all")[] = [
    "all",
    "price_comparison",
    "product_gallery",
    "availability",
    "article",
    "data_table",
    "pricing_health",
    "smart_card",
    "investor_dashboard",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white mb-2">
            Snap Apps Demo
          </h1>
          <p className="text-white/60 text-sm mb-4">
            Testing glassmorphic Apple Pass card designs
          </p>

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedType === type
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {type === "all" ? "All Types" : type.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {filteredApps.map((app) => (
          <div key={app.id} className="mb-12">
            <div className="text-xs text-white/40 mb-2 font-mono">
              Type: {app.type} | ID: {app.id}
            </div>
            <ApplePassCard
              app={app}
              onRefresh={(newApp) => {
                console.log("Refresh callback:", newApp);
              }}
            />
          </div>
        ))}

        {filteredApps.length === 0 && (
          <div className="text-center py-12 text-white/50">
            No Snap Apps of this type
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-white/30 text-xs">
        Demo page for testing | Data is mock/static
      </div>
    </div>
  );
}
