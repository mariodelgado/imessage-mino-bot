"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Briefcase,
  RefreshCw,
  Target,
  Award,
  Zap,
  AlertTriangle,
  Share2,
  Check,
  Settings,
  MessageSquare,
  X,
  Clock,
  Bell,
  Send,
  Bot,
  Sparkles,
  Search,
  ChevronRight,
  Code2,
  RotateCcw,
} from "lucide-react";

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

interface InvestorPreferences {
  investorId: string;
  briefSchedule: {
    enabled: boolean;
    time: string;
    timezone: string;
    weekdaysOnly: boolean;
    daysOfWeek: number[];
  };
  notifications: {
    criticalAlerts: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
  };
  displayPreferences: {
    showAllNews: boolean;
    compactView: boolean;
    priorityThreshold: "all" | "high" | "critical";
  };
  updatedAt: Date;
  createdAt: Date;
}

interface MinoApiResponse {
  success: boolean;
  data?: {
    news: NewsItem[];
    fetchedAt: string;
    companiesTracked: number;
  };
  error?: string;
}

const INVESTOR_ID = "ece30471-dff9-448e-81f5-6f0286b00a34";

// ============================================================================
// PORTFOLIO DATA
// ============================================================================

const PORTFOLIO_DATA: PortfolioData = {
  "investor": {
    "name": "Ryan Koh",
    "firm": "ICONIQ Capital",
    "role": "Partner"
  },
  "summary": {
    "totalValue": "~$2.4B",
    "dayChange": 0,
    "totalCompanies": 10,
    "activeDeals": 5,
    "exits": 1,
    "boardSeats": 3
  },
  "companies": [
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
  ],
  "news": [],
  "lastUpdated": "Just now"
};

// ============================================================================
// JSON CARD BACK - Shows Mino API Response
// ============================================================================

function JsonCardBack({ minoResponse }: { minoResponse: MinoApiResponse | null }) {
  return (
    <div className="p-6 font-mono text-[11px] leading-relaxed overflow-auto h-full">
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="w-4 h-4 text-[#223D48]" />
        <span className="text-[10px] uppercase tracking-[0.15em] text-[#42515A]/60 font-sans">Mino API Response</span>
      </div>
      <pre className="text-[#42515A] whitespace-pre-wrap break-words">
        {minoResponse ? JSON.stringify(minoResponse, null, 2) : "Loading..."}
      </pre>
    </div>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: PortfolioCompany["status"] }) {
  const config = {
    active: { bg: "bg-[#223D48]/10", text: "text-[#223D48]", label: "Active" },
    acquired: { bg: "bg-[#DB3B31]/10", text: "text-[#DB3B31]", label: "Exit" },
    public: { bg: "bg-[#3D6A3D]/10", text: "text-[#3D6A3D]", label: "Public" },
    board: { bg: "bg-[#1C7BBB]/10", text: "text-[#1C7BBB]", label: "Board" },
  };

  const { bg, text, label } = config[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] rounded-sm ${bg} ${text}`}>
      {label}
    </span>
  );
}

// ============================================================================
// COMPANY ROW WITH INLINE NEWS
// ============================================================================

function CompanyRow({ company, news, index }: { company: PortfolioCompany; news: NewsItem[]; index: number }) {
  const companyNews = news.filter(n => n.company === company.name);
  const hasNews = companyNews.length > 0;
  const hasCritical = companyNews.some(n => n.priority === "critical");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group"
    >
      <div className={`py-4 border-b border-[#C6D2D9]/40 -mx-4 px-4 ${hasNews ? "bg-[#223D48]/[0.015]" : ""}`}>
        {/* Company Header Row */}
        <div className="flex items-center">
          {/* Company Name & Sector */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="font-serif text-[17px] text-[#09162F] tracking-[-0.01em]">{company.name}</h3>
              <StatusBadge status={company.status} />
              {company.needsAttention && (
                <AlertTriangle className="w-3.5 h-3.5 text-[#DB3B31]" />
              )}
              {hasCritical && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] rounded-sm text-[#DB3B31] bg-[#DB3B31]/10 animate-pulse">
                  Breaking
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#42515A] mt-0.5">
              {company.sector}
              {company.round && <span className="text-[#C6D2D9] mx-1.5">·</span>}
              {company.round}
            </p>
          </div>

          {/* Valuation */}
          <div className="w-28 text-right hidden sm:block">
            <p className="text-[11px] text-[#42515A]/60 uppercase tracking-[0.1em] mb-0.5">Valuation</p>
            <p className="font-mono text-[15px] text-[#09162F]">{company.valuation}</p>
          </div>

          {/* Invested */}
          <div className="w-24 text-right hidden md:block">
            <p className="text-[11px] text-[#42515A]/60 uppercase tracking-[0.1em] mb-0.5">Invested</p>
            <p className="font-mono text-[15px] text-[#42515A]">{company.invested}</p>
          </div>
        </div>

        {/* Inline News Items */}
        {hasNews && (
          <div className="mt-3 pl-0 space-y-2">
            {companyNews.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  item.priority === "critical" ? "bg-[#DB3B31] animate-pulse" :
                  item.priority === "high" ? "bg-[#F14731]" : "bg-[#223D48]"
                }`} />
                <div className="flex-1 min-w-0">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[13px] leading-snug hover:underline ${
                        item.priority === "critical" ? "text-[#09162F] font-medium" : "text-[#42515A]"
                      }`}
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className={`text-[13px] leading-snug ${
                      item.priority === "critical" ? "text-[#09162F] font-medium" : "text-[#42515A]"
                    }`}>
                      {item.title}
                    </span>
                  )}
                  <span className="text-[11px] text-[#42515A]/50 ml-2">{item.source} · {item.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// SETTINGS PANEL
// ============================================================================

function SettingsPanel({
  isOpen,
  onClose,
  preferences,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  preferences: InvestorPreferences | null;
  onSave: (prefs: Partial<InvestorPreferences>) => void;
}) {
  const [localPrefs, setLocalPrefs] = useState({
    briefEnabled: preferences?.briefSchedule?.enabled ?? true,
    briefTime: preferences?.briefSchedule?.time ?? "06:00",
    weekdaysOnly: preferences?.briefSchedule?.weekdaysOnly ?? false,
    criticalAlerts: preferences?.notifications?.criticalAlerts ?? true,
    dailyDigest: preferences?.notifications?.dailyDigest ?? true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        briefEnabled: preferences.briefSchedule.enabled,
        briefTime: preferences.briefSchedule.time,
        weekdaysOnly: preferences.briefSchedule.weekdaysOnly,
        criticalAlerts: preferences.notifications.criticalAlerts,
        dailyDigest: preferences.notifications.dailyDigest,
      });
    }
  }, [preferences]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      briefSchedule: {
        enabled: localPrefs.briefEnabled,
        time: localPrefs.briefTime,
        timezone: "America/Los_Angeles",
        weekdaysOnly: localPrefs.weekdaysOnly,
        daysOfWeek: localPrefs.weekdaysOnly ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6],
      },
      notifications: {
        criticalAlerts: localPrefs.criticalAlerts,
        dailyDigest: localPrefs.dailyDigest,
        weeklyReport: false,
      },
    });
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-[#FFFEFB] rounded-lg border border-[#C6D2D9]/40 shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#C6D2D9]/30">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#223D48]" />
            <h3 className="font-serif text-[18px] text-[#09162F]">Brief Settings</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#223D48]/5 transition-colors">
            <X className="w-4 h-4 text-[#42515A]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Schedule Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[#223D48]" />
              <span className="text-[12px] uppercase tracking-[0.1em] text-[#223D48] font-medium">Schedule</span>
            </div>

            <div className="space-y-4">
              {/* Enable Brief */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[14px] text-[#42515A]">Daily intelligence brief</span>
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${localPrefs.briefEnabled ? "bg-[#223D48]" : "bg-[#C6D2D9]"}`}
                  onClick={() => setLocalPrefs({ ...localPrefs, briefEnabled: !localPrefs.briefEnabled })}
                >
                  <div className={`w-4 h-4 m-1 rounded-full bg-white transition-transform ${localPrefs.briefEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </label>

              {/* Time */}
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-[#42515A]">Delivery time (PST)</span>
                <select
                  value={localPrefs.briefTime}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, briefTime: e.target.value })}
                  className="px-3 py-1.5 text-[14px] border border-[#C6D2D9]/60 rounded-md bg-white text-[#09162F] focus:outline-none focus:border-[#223D48]/40"
                >
                  <option value="05:00">5:00 AM</option>
                  <option value="06:00">6:00 AM</option>
                  <option value="07:00">7:00 AM</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                </select>
              </div>

              {/* Weekdays Only */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[14px] text-[#42515A]">Weekdays only</span>
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${localPrefs.weekdaysOnly ? "bg-[#223D48]" : "bg-[#C6D2D9]"}`}
                  onClick={() => setLocalPrefs({ ...localPrefs, weekdaysOnly: !localPrefs.weekdaysOnly })}
                >
                  <div className={`w-4 h-4 m-1 rounded-full bg-white transition-transform ${localPrefs.weekdaysOnly ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </label>
            </div>
          </div>

          {/* Notifications Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-[#223D48]" />
              <span className="text-[12px] uppercase tracking-[0.1em] text-[#223D48] font-medium">Notifications</span>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[14px] text-[#42515A]">Critical alerts (M&A, exits)</span>
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${localPrefs.criticalAlerts ? "bg-[#DB3B31]" : "bg-[#C6D2D9]"}`}
                  onClick={() => setLocalPrefs({ ...localPrefs, criticalAlerts: !localPrefs.criticalAlerts })}
                >
                  <div className={`w-4 h-4 m-1 rounded-full bg-white transition-transform ${localPrefs.criticalAlerts ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[14px] text-[#42515A]">Daily digest email</span>
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${localPrefs.dailyDigest ? "bg-[#223D48]" : "bg-[#C6D2D9]"}`}
                  onClick={() => setLocalPrefs({ ...localPrefs, dailyDigest: !localPrefs.dailyDigest })}
                >
                  <div className={`w-4 h-4 m-1 rounded-full bg-white transition-transform ${localPrefs.dailyDigest ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#C6D2D9]/30 bg-[#223D48]/[0.02]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-md bg-[#223D48] text-white text-[14px] font-medium hover:bg-[#223D48]/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// FEEDBACK PANEL
// ============================================================================

function FeedbackPanel({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: string, message: string) => void;
}) {
  const [feedbackType, setFeedbackType] = useState<"general" | "news_quality" | "feature" | "bug">("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    await onSubmit(feedbackType, message);
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setMessage("");
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-[#FFFEFB] rounded-lg border border-[#C6D2D9]/40 shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#C6D2D9]/30">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#223D48]" />
            <h3 className="font-serif text-[18px] text-[#09162F]">Send Feedback</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#223D48]/5 transition-colors">
            <X className="w-4 h-4 text-[#42515A]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#3D6A3D]/10 flex items-center justify-center">
                <Check className="w-6 h-6 text-[#3D6A3D]" />
              </div>
              <p className="text-[16px] text-[#09162F] font-medium">Thanks for your feedback!</p>
              <p className="text-[13px] text-[#42515A] mt-1">We&apos;ll use this to improve your brief.</p>
            </motion.div>
          ) : (
            <>
              {/* Feedback Type */}
              <div>
                <label className="text-[12px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-2 block">
                  Feedback Type
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: "general", label: "General" },
                    { value: "news_quality", label: "News Quality" },
                    { value: "feature", label: "Feature Request" },
                    { value: "bug", label: "Bug Report" },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setFeedbackType(type.value as typeof feedbackType)}
                      className={`px-3 py-1.5 rounded-md text-[13px] border transition-all ${
                        feedbackType === type.value
                          ? "bg-[#223D48] text-white border-[#223D48]"
                          : "bg-white text-[#42515A] border-[#C6D2D9]/60 hover:border-[#223D48]/30"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-[12px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-2 block">
                  Your Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  rows={4}
                  className="w-full px-4 py-3 text-[14px] border border-[#C6D2D9]/60 rounded-md bg-white text-[#09162F] placeholder:text-[#C6D2D9] focus:outline-none focus:border-[#223D48]/40 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="px-6 py-4 border-t border-[#C6D2D9]/30 bg-[#223D48]/[0.02]">
            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="w-full py-2.5 rounded-md bg-[#223D48] text-white text-[14px] font-medium hover:bg-[#223D48]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Sending..." : "Send Feedback"}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// CHAT PANEL - Mino Agent Interface
// ============================================================================

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: "search" | "create_app" | "settings" | "help" | "general";
  };
}

function ChatPanel({
  isOpen,
  onClose,
  investorId,
}: {
  isOpen: boolean;
  onClose: () => void;
  investorId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [canCreateSnapApp, setCanCreateSnapApp] = useState(false);
  const [searchCount, setSearchCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/investor/${investorId}/chat`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages || []);
        setCanCreateSnapApp(data.data.canCreateSnapApp);
        setSearchCount(data.data.searchCount || 0);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, [investorId]);

  // Load conversation history on mount
  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, loadHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/investor/${investorId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();

      if (data.success) {
        // Replace temp message and add response
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.data.response,
          timestamp: new Date(),
          metadata: { intent: data.data.intent },
        };
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          { ...tempUserMsg, id: `user-${Date.now()}` },
          assistantMsg,
        ]);
        setCanCreateSnapApp(data.data.canCreateSnapApp);
        setSearchCount(data.data.searchCount);
      }
    } catch (error) {
      console.error("Chat API error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Suggested prompts for new users
  const suggestions = [
    { icon: Search, text: "What's happening with Pinecone?" },
    { icon: TrendingUp, text: "Latest AI infrastructure news" },
    { icon: Target, text: "Competitive analysis for Sendbird" },
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#FFFEFB] w-full sm:max-w-lg sm:rounded-xl overflow-hidden shadow-2xl h-[85vh] sm:h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#C6D2D9]/30 bg-gradient-to-r from-[#223D48]/[0.03] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#223D48] to-[#1C7BBB] flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-[17px] text-[#09162F] leading-tight">Mino</h3>
              <p className="text-[11px] text-[#42515A]/60 uppercase tracking-[0.08em]">Portfolio Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {searchCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#3D6A3D]/10 text-[#3D6A3D]">
                <Sparkles className="w-3 h-3" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Snap Apps Unlocked</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-[#223D48]/5 transition-colors"
            >
              <X className="w-4 h-4 text-[#42515A]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-[#223D48] text-white"
                    : "bg-[#223D48]/[0.04] text-[#09162F] border border-[#C6D2D9]/30"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot className="w-3 h-3 text-[#1C7BBB]" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#1C7BBB]">Mino</span>
                  </div>
                )}
                <div className="text-[14px] leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                  {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </div>
              </div>
            </motion.div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-[#223D48]/[0.04] border border-[#C6D2D9]/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#223D48]/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[#223D48]/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[#223D48]/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[12px] text-[#42515A]/60">Searching...</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Suggestions for new users */}
          {messages.length <= 1 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="pt-4"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#42515A]/50 mb-3">Try asking</p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(s.text);
                      inputRef.current?.focus();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[#C6D2D9]/40 bg-white hover:bg-[#223D48]/[0.02] hover:border-[#223D48]/20 transition-all text-left group"
                  >
                    <s.icon className="w-4 h-4 text-[#42515A]/50 group-hover:text-[#223D48] transition-colors" />
                    <span className="text-[13px] text-[#42515A] group-hover:text-[#09162F] transition-colors">{s.text}</span>
                    <ChevronRight className="w-4 h-4 text-[#C6D2D9] group-hover:text-[#223D48]/50 ml-auto transition-colors" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#C6D2D9]/30 bg-white">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your portfolio..."
              className="flex-1 px-4 py-3 rounded-lg border border-[#C6D2D9]/60 bg-white text-[14px] text-[#09162F] placeholder:text-[#C6D2D9] focus:outline-none focus:border-[#223D48]/40 focus:ring-1 focus:ring-[#223D48]/20 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="p-3 rounded-lg bg-[#223D48] text-white hover:bg-[#223D48]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {!canCreateSnapApp && searchCount === 0 && (
            <p className="text-[11px] text-[#42515A]/50 mt-2 text-center">
              Search first to unlock Snap App creation
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${accent ? "border-[#223D48]/20 bg-[#223D48]/[0.03]" : "border-[#C6D2D9]/40 bg-white"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ? "text-[#223D48]" : "text-[#42515A]/60"}`} />
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#42515A]/60">{label}</span>
      </div>
      <p className={`text-[28px] font-light tracking-tight ${accent ? "text-[#223D48]" : "text-[#09162F]"}`}>{value}</p>
    </div>
  );
}

// ============================================================================
// DEEP INSIGHT GENERATORS
// ============================================================================

interface DeepInsight {
  type: "strategic" | "risk" | "opportunity" | "action" | "competitive";
  priority: "critical" | "high" | "medium";
  title: string;
  detail: string;
  companies: string[];
}

function generateDeepInsights(data: PortfolioData): DeepInsight[] {
  const insights: DeepInsight[] = [];
  const { companies, news } = data;

  // 1. ACQUISITION IMPLICATIONS - What does Statsig exit mean for portfolio?
  const statsigNews = news.find(n => n.company === "Statsig" && n.category === "exit");
  if (statsigNews) {
    const devToolsCompanies = companies.filter(c => c.sector === "DevTools" || c.sector === "AI/ML");
    if (devToolsCompanies.length > 1) {
      insights.push({
        type: "strategic",
        priority: "critical",
        title: "OpenAI Acquisition Creates AI DevTools Precedent",
        detail: `Statsig's $1.1B exit to OpenAI at ~50x revenue validates AI-native tooling valuations. This positions ${devToolsCompanies.filter(c => c.name !== "Statsig").map(c => c.name).join(", ")} as potential acquisition targets. OpenAI's infrastructure buildout signals appetite for more DevTools M&A.`,
        companies: devToolsCompanies.map(c => c.name),
      });
    }
  }

  // 2. COMPETITIVE THREAT ANALYSIS - Stream vs Sendbird
  const sendbirdNews = news.filter(n => n.company === "Sendbird" && n.category === "competitive");
  if (sendbirdNews.length > 0) {
    const sendbird = companies.find(c => c.name === "Sendbird");
    if (sendbird) {
      insights.push({
        type: "competitive",
        priority: "high",
        title: "Sendbird Faces Intensifying Competitive Pressure",
        detail: `Stream's direct comparison content signals aggressive market capture strategy. At ${sendbird.growth}% growth vs typical 30%+ for category leaders, Sendbird risks losing enterprise mindshare. Board should evaluate pricing defense and AI feature acceleration.`,
        companies: ["Sendbird"],
      });
    }
  }

  // 3. SALES TECH PORTFOLIO SYNERGY - Highspot + Reprise
  const highspot = companies.find(c => c.name === "Highspot");
  const reprise = companies.find(c => c.name === "Reprise");
  if (highspot && reprise) {
    const combinedGrowth = (highspot.growth + reprise.growth) / 2;
    insights.push({
      type: "opportunity",
      priority: "high",
      title: "Sales Tech Stack Opportunity: Highspot × Reprise",
      detail: `Combined ${combinedGrowth}% avg growth across sales enablement. Highspot's AI coaching + Reprise's demo automation = complete buyer experience platform. Explore co-sell motion or strategic integration to capture enterprise deals holistically.`,
      companies: ["Highspot", "Reprise"],
    });
  }

  // 4. AI/ML CONCENTRATION RISK
  const aiCompanies = companies.filter(c => c.sector === "AI/ML");
  if (aiCompanies.length >= 2) {
    const aiAllocation = (aiCompanies.length / companies.length) * 100;
    insights.push({
      type: "risk",
      priority: aiAllocation > 25 ? "high" : "medium",
      title: `${Math.round(aiAllocation)}% AI/ML Concentration`,
      detail: `${aiCompanies.map(c => c.name).join(", ")} represent significant sector exposure. While AI tailwinds are strong, a market correction or regulatory headwinds could impact multiple positions simultaneously. Consider diversification in next fund deployment.`,
      companies: aiCompanies.map(c => c.name),
    });
  }

  // 5. FINTECH UNDERPERFORMANCE PATTERN
  const fintechCompanies = companies.filter(c => c.sector === "Fintech");
  const underperformingFintech = fintechCompanies.filter(c => c.growth < 15);
  if (underperformingFintech.length > 0 && fintechCompanies.length > 1) {
    insights.push({
      type: "risk",
      priority: "high",
      title: "Fintech Sector Showing Weakness",
      detail: `${underperformingFintech.map(c => `${c.name} (${c.growth > 0 ? "+" : ""}${c.growth}%)`).join(", ")} lagging category benchmarks of 25%+. Rate environment and funding winter creating headwinds. Unit21's -8% particularly concerning—evaluate if fraud detection TAM is contracting.`,
      companies: fintechCompanies.map(c => c.name),
    });
  }

  // 6. PARTNERSHIP VELOCITY - Spotnana's GTM Acceleration
  const spotnanaNews = news.filter(n => n.company === "Spotnana");
  const partnershipNews = spotnanaNews.filter(n => n.category === "competitive" || n.title.toLowerCase().includes("partner"));
  if (partnershipNews.length >= 2) {
    const spotnana = companies.find(c => c.name === "Spotnana");
    insights.push({
      type: "opportunity",
      priority: "high",
      title: "Spotnana Partnership Velocity Signals Category Leadership",
      detail: `Booking.com deal + TMC Cloud launch in 30 days = aggressive enterprise GTM. At ${spotnana?.growth || 0}% growth with this partner density, Spotnana is positioning for category definition. Watch for follow-on opportunity as they likely raise to accelerate.`,
      companies: ["Spotnana"],
    });
  }

  // 7. BOARD SEAT ACTION ITEMS
  const boardCompanies = companies.filter(c => c.status === "board");
  const boardWithNews = boardCompanies.filter(bc =>
    news.some(n => n.company === bc.name && n.hoursAgo <= 72)
  );
  if (boardWithNews.length > 0) {
    insights.push({
      type: "action",
      priority: "high",
      title: "Board Meeting Prep Required",
      detail: `Recent developments at ${boardWithNews.map(c => c.name).join(", ")} warrant discussion. ${boardWithNews.map(c => {
        const companyNews = news.filter(n => n.company === c.name)[0];
        return companyNews ? `${c.name}: ${companyNews.title.slice(0, 60)}...` : "";
      }).filter(Boolean).join(" ")}`,
      companies: boardWithNews.map(c => c.name),
    });
  }

  // 8. PINECONE POTENTIAL EXIT - Critical Decision Point
  const pinecone = companies.find(c => c.name === "Pinecone");
  const pineconeExitNews = news.find(n => n.company === "Pinecone" && n.category === "exit");
  if (pinecone && pineconeExitNews) {
    insights.push({
      type: "strategic",
      priority: "critical",
      title: "Pinecone $2B+ Exit Opportunity Emerging",
      detail: `ICONIQ's $35M investment at $750M valuation now facing potential $2B+ exit. With 4.2% ownership, current position worth ~$84M+ at exit. Oracle, IBM, MongoDB, Snowflake circling. Notion loss accelerating sale timeline. Board decision required on exit timing vs hold for higher multiple.`,
      companies: ["Pinecone"],
    });
  } else if (pinecone && pinecone.growth > 50) {
    insights.push({
      type: "strategic",
      priority: "high",
      title: "Pinecone Riding AI Infrastructure Wave",
      detail: `${pinecone.growth}% growth positions Pinecone as the vector DB category leader. Recent Commvault partnership signals enterprise readiness. At $750M valuation, still early vs $3B+ potential in AI infrastructure picks-and-shovels play.`,
      companies: ["Pinecone"],
    });
  }

  // 9. GROWTH DISPARITY WARNING
  const sortedByGrowth = [...companies].sort((a, b) => b.growth - a.growth);
  const topGrowth = sortedByGrowth[0]?.growth || 0;
  const bottomGrowth = sortedByGrowth[sortedByGrowth.length - 1]?.growth || 0;
  const growthSpread = topGrowth - bottomGrowth;
  if (growthSpread > 100) {
    insights.push({
      type: "risk",
      priority: "medium",
      title: `${growthSpread}pt Growth Disparity Across Portfolio`,
      detail: `Spread from ${sortedByGrowth[0].name} (+${topGrowth}%) to ${sortedByGrowth[sortedByGrowth.length - 1].name} (${bottomGrowth}%) indicates portfolio bifurcation. Winners accelerating while laggards fall behind. Consider doubling down on momentum vs averaging down on distressed.`,
      companies: [sortedByGrowth[0].name, sortedByGrowth[sortedByGrowth.length - 1].name],
    });
  }

  // 10. EXIT MULTIPLE BENCHMARKING
  const exits = companies.filter(c => c.status === "acquired" || c.status === "public");
  if (exits.length > 0) {
    const activeHighGrowth = companies.filter(c => c.status === "active" && c.growth > 40);
    if (activeHighGrowth.length > 0) {
      insights.push({
        type: "opportunity",
        priority: "medium",
        title: "Exit Comparable Set Expanding",
        detail: `Statsig's 50x exit multiple sets benchmark for portfolio. ${activeHighGrowth.map(c => c.name).join(", ")} showing similar growth profiles—monitor for strategic interest. AI-native positioning commanding premium multiples in current M&A environment.`,
        companies: [...exits.map(c => c.name), ...activeHighGrowth.map(c => c.name)],
      });
    }
  }

  return insights.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============================================================================
// MORNING BRIEFING (Deep Intelligence Analysis)
// ============================================================================

function MorningBriefing({ data }: { data: PortfolioData }) {
  const firstName = data.investor.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Generate deep insights
  const deepInsights = generateDeepInsights(data);
  const criticalInsights = deepInsights.filter(i => i.priority === "critical");
  const strategicInsights = deepInsights.filter(i => i.type === "strategic" || i.type === "opportunity");
  const riskInsights = deepInsights.filter(i => i.type === "risk" || i.type === "competitive");
  const actionItems = deepInsights.filter(i => i.type === "action");

  // Core metrics
  const avgGrowth = Math.round(data.companies.reduce((sum, c) => sum + c.growth, 0) / data.companies.length);
  const positiveGrowthCount = data.companies.filter((c) => c.growth > 0).length;
  const healthScore = Math.round((positiveGrowthCount / data.companies.length) * 100);
  const recentNewsCount = data.news.filter((n) => n.hoursAgo <= 72).length;

  // Portfolio composition
  const sectorCounts = data.companies.reduce((acc, c) => {
    acc[c.sector] = (acc[c.sector] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);

  const typeConfig = {
    strategic: { color: "text-[#1C7BBB]", bg: "bg-[#1C7BBB]/[0.05]", border: "border-[#1C7BBB]/20", label: "Strategic" },
    opportunity: { color: "text-[#3D6A3D]", bg: "bg-[#3D6A3D]/[0.05]", border: "border-[#3D6A3D]/20", label: "Opportunity" },
    risk: { color: "text-[#F14731]", bg: "bg-[#F14731]/[0.05]", border: "border-[#F14731]/20", label: "Risk" },
    competitive: { color: "text-[#DB3B31]", bg: "bg-[#DB3B31]/[0.05]", border: "border-[#DB3B31]/20", label: "Competitive" },
    action: { color: "text-[#223D48]", bg: "bg-[#223D48]/[0.05]", border: "border-[#223D48]/20", label: "Action" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mb-10"
    >
      <div className="border border-[#C6D2D9]/40 rounded-lg overflow-hidden bg-gradient-to-br from-[#223D48]/[0.02] to-transparent">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#223D48]/[0.03] border-b border-[#C6D2D9]/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#DB3B31] animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[#223D48] font-medium">Intelligence Brief</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-sm bg-[#223D48]/10 text-[#223D48]">
              {deepInsights.length} Insights
            </span>
            <span className="text-[11px] text-[#42515A]/50">Powered by Mino</span>
          </div>
        </div>

        <div className="p-6">
          {/* Executive Summary */}
          <p className="font-serif text-[22px] leading-snug text-[#09162F] mb-2">
            {greeting}, {firstName}.
          </p>
          <p className="text-[15px] text-[#42515A] leading-relaxed mb-6">
            {criticalInsights.length > 0
              ? `${criticalInsights.length} critical development${criticalInsights.length > 1 ? "s" : ""} reshaping portfolio dynamics. `
              : ""}
            {strategicInsights.length > 0
              ? `${strategicInsights.length} strategic opportunit${strategicInsights.length > 1 ? "ies" : "y"} identified. `
              : ""}
            {riskInsights.length > 0
              ? `${riskInsights.length} risk${riskInsights.length > 1 ? "s" : ""} requiring attention.`
              : "Portfolio tracking within normal parameters."}
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-5 gap-3 mb-8">
            <div className="p-3 rounded-md bg-[#223D48]/[0.03] border border-[#C6D2D9]/30">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-1">Health</p>
              <p className={`text-[18px] font-light ${healthScore >= 70 ? "text-[#3D6A3D]" : healthScore >= 50 ? "text-[#223D48]" : "text-[#F14731]"}`}>
                {healthScore}%
              </p>
            </div>
            <div className="p-3 rounded-md bg-[#223D48]/[0.03] border border-[#C6D2D9]/30">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-1">Avg Growth</p>
              <p className={`text-[18px] font-light ${avgGrowth >= 0 ? "text-[#3D6A3D]" : "text-[#DB3B31]"}`}>
                {avgGrowth >= 0 ? "+" : ""}{avgGrowth}%
              </p>
            </div>
            <div className="p-3 rounded-md bg-[#223D48]/[0.03] border border-[#C6D2D9]/30">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-1">News (72h)</p>
              <p className="text-[18px] font-light text-[#223D48]">{recentNewsCount}</p>
            </div>
            <div className="p-3 rounded-md bg-[#223D48]/[0.03] border border-[#C6D2D9]/30">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-1">Sectors</p>
              <p className="text-[11px] font-medium text-[#223D48]">{topSectors.slice(0, 2).map(s => s[0]).join(", ")}</p>
            </div>
            <div className="p-3 rounded-md bg-[#223D48]/[0.03] border border-[#C6D2D9]/30">
              <p className="text-[10px] uppercase tracking-[0.1em] text-[#42515A]/60 mb-1">Board</p>
              <p className="text-[18px] font-light text-[#1C7BBB]">{data.summary.boardSeats}</p>
            </div>
          </div>

          {/* Deep Insights */}
          <div className="space-y-4">
            {/* Critical Insights First */}
            {criticalInsights.map((insight, i) => (
              <motion.div
                key={`critical-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                className="p-4 rounded-md bg-[#DB3B31]/[0.05] border border-[#DB3B31]/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#DB3B31] mt-2 shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-[#DB3B31]">Critical</span>
                      <span className="text-[10px] text-[#42515A]/50">·</span>
                      <span className="text-[10px] text-[#42515A]/50">{insight.companies.join(", ")}</span>
                    </div>
                    <p className="text-[14px] font-semibold text-[#09162F] mb-1">{insight.title}</p>
                    <p className="text-[13px] text-[#42515A] leading-relaxed">{insight.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Other High Priority Insights */}
            {deepInsights.filter(i => i.priority === "high" && !criticalInsights.includes(i)).slice(0, 4).map((insight, i) => {
              const config = typeConfig[insight.type];
              return (
                <motion.div
                  key={`high-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
                  className={`p-4 rounded-md ${config.bg} border ${config.border}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-1 h-1 rounded-full ${config.color.replace("text-", "bg-")} mt-2 shrink-0`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase tracking-[0.1em] font-semibold ${config.color}`}>{config.label}</span>
                        <span className="text-[10px] text-[#42515A]/50">·</span>
                        <span className="text-[10px] text-[#42515A]/50">{insight.companies.slice(0, 3).join(", ")}</span>
                      </div>
                      <p className="text-[14px] font-medium text-[#09162F] mb-1">{insight.title}</p>
                      <p className="text-[13px] text-[#42515A] leading-relaxed">{insight.detail}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Action Items Section */}
            {actionItems.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#C6D2D9]/30">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#223D48] font-medium mb-3">Action Required</p>
                {actionItems.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5 mb-2">
                    <div className="w-4 h-4 rounded border border-[#223D48]/30 mt-0.5 shrink-0" />
                    <p className="text-[13px] text-[#42515A]">
                      <span className="font-medium text-[#09162F]">{action.title}</span>
                      {" — "}
                      <span>{action.detail.slice(0, 100)}...</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Medium Priority Summary */}
            {deepInsights.filter(i => i.priority === "medium").length > 0 && (
              <div className="mt-4 p-3 rounded-md bg-[#C6D2D9]/10 border border-[#C6D2D9]/30">
                <p className="text-[12px] text-[#42515A]">
                  <span className="font-medium">+ {deepInsights.filter(i => i.priority === "medium").length} additional insights: </span>
                  {deepInsights.filter(i => i.priority === "medium").map(i => i.title).join(" · ")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RyanInvestorDashboard() {
  const [data, setData] = useState<PortfolioData>(PORTFOLIO_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [preferences, setPreferences] = useState<InvestorPreferences | null>(null);
  const [minoResponse, setMinoResponse] = useState<MinoApiResponse | null>(null);
  const [showJson, setShowJson] = useState(false);

  // Scroll progress tracking
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const fetchMinoNews = async () => {
    try {
      const response = await fetch("/api/cron/investor-news");
      const json: MinoApiResponse = await response.json();
      setMinoResponse(json);

      if (json.success && json.data?.news) {
        setData(prev => ({
          ...prev,
          news: json.data!.news,
          lastUpdated: json.data!.fetchedAt,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch news:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchMinoNews();
    // Fetch investor preferences
    fetch(`/api/investor/${INVESTOR_ID}/preferences`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPreferences(data.data);
        }
      })
      .catch(console.error);
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMinoNews();
    setIsRefreshing(false);
  };

  const handleSavePreferences = async (prefs: Partial<InvestorPreferences>) => {
    try {
      const res = await fetch(`/api/investor/${INVESTOR_ID}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  };

  const handleSubmitFeedback = async (type: string, message: string) => {
    try {
      await fetch(`/api/investor/${INVESTOR_ID}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message }),
      });
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#FFFEFB]" style={{ fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}>
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#223D48] via-[#1C7BBB] to-[#223D48] origin-left z-50"
        style={{ scaleX }}
      />

      {/* Noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />

      {/* Content */}
      <div className="relative max-w-[1160px] mx-auto px-5 md:px-6 lg:px-8 py-10 md:py-16">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-md bg-[#223D48] flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-white" />
                </div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#42515A]/60">Investor Dashboard</span>
              </div>
              <h1 className="font-serif text-[36px] md:text-[44px] tracking-[-0.02em] text-[#09162F] leading-none mb-2">
                {data.investor.name}
              </h1>
              <p className="text-[15px] text-[#42515A]">
                {data.investor.role} <span className="text-[#C6D2D9] mx-1">·</span> {data.investor.firm}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowJson(!showJson)}
                className={`p-2.5 rounded-md border transition-all duration-200 ${
                  showJson
                    ? "border-[#1C7BBB]/60 bg-[#1C7BBB]/10"
                    : "border-[#C6D2D9]/60 bg-white hover:bg-[#223D48]/[0.03] hover:border-[#223D48]/30"
                }`}
                title="View Mino API Response"
              >
                {showJson ? (
                  <RotateCcw className="w-4 h-4 text-[#1C7BBB]" />
                ) : (
                  <Code2 className="w-4 h-4 text-[#42515A]" />
                )}
              </button>
              <button
                onClick={() => setIsFeedbackOpen(true)}
                className="p-2.5 rounded-md border border-[#C6D2D9]/60 bg-white hover:bg-[#223D48]/[0.03] hover:border-[#223D48]/30 transition-all duration-200"
                title="Send feedback"
              >
                <MessageSquare className="w-4 h-4 text-[#42515A]" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-md border border-[#C6D2D9]/60 bg-white hover:bg-[#223D48]/[0.03] hover:border-[#223D48]/30 transition-all duration-200"
                title="Brief settings"
              >
                <Settings className="w-4 h-4 text-[#42515A]" />
              </button>
              <button
                onClick={handleShare}
                className={`p-2.5 rounded-md border transition-all duration-200 ${
                  copied
                    ? "border-[#3D6A3D]/60 bg-[#3D6A3D]/10"
                    : "border-[#C6D2D9]/60 bg-white hover:bg-[#223D48]/[0.03] hover:border-[#223D48]/30"
                }`}
                title="Copy link to clipboard"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#3D6A3D]" />
                ) : (
                  <Share2 className="w-4 h-4 text-[#42515A]" />
                )}
              </button>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-md border border-[#C6D2D9]/60 bg-white hover:bg-[#223D48]/[0.03] hover:border-[#223D48]/30 transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-[#42515A] ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* JSON View Panel */}
          {showJson && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <div className="border border-[#C6D2D9]/40 rounded-lg bg-white overflow-hidden max-h-[400px] overflow-y-auto">
                <JsonCardBack minoResponse={minoResponse} />
              </div>
            </motion.div>
          )}

          {/* Morning Briefing */}
          <MorningBriefing data={data} />

          {/* Portfolio Value Hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="border border-[#C6D2D9]/40 rounded-lg p-8 bg-white"
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#42515A]/60 mb-3">Total Portfolio Value</p>
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-serif text-[56px] md:text-[72px] tracking-[-0.03em] text-[#09162F] leading-none">
                {data.summary.totalValue}
              </span>
              {data.summary.dayChange !== 0 && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${data.summary.dayChange >= 0 ? "bg-[#3D6A3D]/10 text-[#3D6A3D]" : "bg-[#DB3B31]/10 text-[#DB3B31]"}`}>
                  {data.summary.dayChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-[15px] font-medium font-mono">{data.summary.dayChange >= 0 ? "+" : ""}{data.summary.dayChange}%</span>
                </div>
              )}
            </div>
            <p className="text-[13px] text-[#42515A]/50">Updated {data.lastUpdated}</p>
          </motion.div>
        </motion.header>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          <StatCard icon={Building2} label="Companies" value={data.summary.totalCompanies} accent />
          <StatCard icon={Zap} label="Active" value={data.summary.activeDeals} />
          <StatCard icon={Target} label="Exits" value={data.summary.exits} />
          <StatCard icon={Award} label="Board Seats" value={data.summary.boardSeats} />
        </motion.div>

        {/* Portfolio Companies */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-[22px] text-[#09162F]">Portfolio Companies</h2>
            <span className="text-[12px] text-[#42515A]/50 uppercase tracking-[0.1em]">{data.companies.length} total</span>
          </div>

          <div className="border border-[#C6D2D9]/40 rounded-lg bg-white px-4">
            {data.companies.map((company, index) => (
              <CompanyRow key={company.name} company={company} news={data.news} index={index} />
            ))}
          </div>
        </motion.section>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-[#C6D2D9]/30 flex items-center justify-between"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#42515A]/40">
            Powered by Mino
          </p>
          <p className="text-[11px] text-[#42515A]/40">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </motion.footer>
      </div>

      {/* Settings & Feedback Panels */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onSave={handleSavePreferences}
      />
      <FeedbackPanel
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onSubmit={handleSubmitFeedback}
      />
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        investorId={INVESTOR_ID}
      />

      {/* Floating Action Button - Mino Chat */}
      {!isChatOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#223D48] to-[#1C7BBB] shadow-lg shadow-[#223D48]/25 flex items-center justify-center hover:shadow-xl hover:shadow-[#223D48]/30 hover:scale-105 transition-all duration-200 z-40"
        >
          <Bot className="w-6 h-6 text-white" />
        </motion.button>
      )}
    </div>
  );
}
