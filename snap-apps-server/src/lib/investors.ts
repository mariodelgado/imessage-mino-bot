// ============================================================================
// CENTRALIZED INVESTOR CONFIGURATION
// This file contains all investor data and is the single source of truth
// for investor profiles, portfolio companies, and preferences.
// ============================================================================

import { v4 as uuidv4 } from "uuid";

// ============================================================================
// TYPES
// ============================================================================

export interface PortfolioCompany {
  name: string;
  status: "active" | "acquired" | "public" | "board";
  ticker?: string;
  valuation?: string;
  growth?: number;
  sector: string;
  invested: string;
  ownership?: string;
  round?: string;
  needsAttention?: boolean;
}

export interface InvestorProfile {
  id: string;
  name: string;
  firstName: string;
  firm: string;
  role: string;
  phone: string;
  email?: string;
  companies: PortfolioCompany[];
  summary: {
    totalValue: string;
    dayChange: number;
    totalCompanies: number;
    activeDeals: number;
    exits: number;
    boardSeats: number;
  };
  preferences: {
    briefSchedule: {
      enabled: boolean;
      time: string; // HH:mm format
      timezone: string;
      weekdaysOnly: boolean;
      daysOfWeek: number[]; // 0-6, 0 = Sunday
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
  };
  createdAt: Date;
  updatedAt: Date;
  isOnboarded: boolean;
  onboardingStep?: "name" | "firm" | "companies" | "schedule" | "complete";
}

// Partial investor for onboarding flow
export interface PartialInvestor {
  id: string;
  phone: string;
  name?: string;
  firstName?: string;
  firm?: string;
  role?: string;
  companies?: PortfolioCompany[];
  onboardingStep: "name" | "firm" | "companies" | "schedule" | "complete";
  createdAt: Date;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_PREFERENCES: InvestorProfile["preferences"] = {
  briefSchedule: {
    enabled: true,
    time: "06:00",
    timezone: "America/Los_Angeles",
    weekdaysOnly: false,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  notifications: {
    criticalAlerts: true,
    dailyDigest: true,
    weeklyReport: false,
  },
  displayPreferences: {
    showAllNews: true,
    compactView: false,
    priorityThreshold: "all",
  },
};

export const DEFAULT_SUMMARY = {
  totalValue: "~$0",
  dayChange: 0,
  totalCompanies: 0,
  activeDeals: 0,
  exits: 0,
  boardSeats: 0,
};

// ============================================================================
// REGISTERED INVESTORS (PROTECTED - DO NOT MODIFY EXISTING ENTRIES)
// ============================================================================

const INVESTORS: Map<string, InvestorProfile> = new Map();

// Ryan Koh - ICONIQ Capital (PROTECTED - DO NOT MODIFY)
INVESTORS.set("ece30471-dff9-448e-81f5-6f0286b00a34", {
  id: "ece30471-dff9-448e-81f5-6f0286b00a34",
  name: "Ryan Koh",
  firstName: "Ryan",
  firm: "ICONIQ Capital",
  role: "Partner",
  phone: "+14156836861",
  companies: [
    { name: "TinyFish", status: "active", growth: 24, sector: "AI/ML", invested: "$15M", valuation: "$180M", round: "Series A" },
    { name: "Statsig", status: "acquired", ticker: "OpenAI", growth: 156, sector: "DevTools", invested: "$22M", valuation: "Acquired", round: "Series B" },
    { name: "Adaptive ML", status: "active", growth: 45, sector: "AI/ML", invested: "$18M", valuation: "$320M", round: "Series B" },
    { name: "Pinecone", status: "active", growth: 89, sector: "Infrastructure", invested: "$$35M", valuation: "$750M", ownership: "4.2%", round: "Series B" },
    { name: "Groww", status: "public", ticker: "NSE:GROWW", growth: 12, sector: "Fintech", invested: "$28M", valuation: "$3.2B", round: "Series C" },
    { name: "Spotnana", status: "board", growth: 34, sector: "Travel Tech", invested: "$40M", valuation: "$1.1B", ownership: "6.8%", round: "Series C", needsAttention: true },
    { name: "Unit21", status: "active", growth: -8, sector: "Fintech", invested: "$12M", valuation: "$280M", round: "Series B", needsAttention: true },
    { name: "Reprise", status: "active", growth: 67, sector: "Sales Tech", invested: "$8M", valuation: "$120M", round: "Series A" },
    { name: "Highspot", status: "board", growth: 23, sector: "Sales Tech", invested: "$45M", valuation: "$3.5B", ownership: "3.1%", round: "Series D" },
    { name: "Sendbird", status: "board", growth: 15, sector: "Communications", invested: "$25M", valuation: "$1.05B", ownership: "2.4%", round: "Series C" },
  ],
  summary: {
    totalValue: "~$2.4B",
    dayChange: 0,
    totalCompanies: 10,
    activeDeals: 5,
    exits: 1,
    boardSeats: 3,
  },
  preferences: DEFAULT_PREFERENCES,
  createdAt: new Date("2025-01-05"),
  updatedAt: new Date(),
  isOnboarded: true,
});

// ============================================================================
// INVESTOR MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get an investor by their ID
 */
export function getInvestor(id: string): InvestorProfile | undefined {
  return INVESTORS.get(id);
}

/**
 * Get an investor by their phone number
 */
export function getInvestorByPhone(phone: string): InvestorProfile | undefined {
  for (const investor of INVESTORS.values()) {
    if (investor.phone === phone) {
      return investor;
    }
  }
  return undefined;
}

/**
 * Get all registered investors
 */
export function getAllInvestors(): InvestorProfile[] {
  return Array.from(INVESTORS.values());
}

/**
 * Check if an investor exists
 */
export function investorExists(id: string): boolean {
  return INVESTORS.has(id);
}

/**
 * Create a new investor (for onboarding new users)
 * Returns the new investor's ID
 */
export function createInvestor(data: {
  phone: string;
  name?: string;
  firstName?: string;
  firm?: string;
  role?: string;
  email?: string;
}): InvestorProfile {
  const id = uuidv4();

  const investor: InvestorProfile = {
    id,
    name: data.name || "",
    firstName: data.firstName || data.name?.split(" ")[0] || "",
    firm: data.firm || "",
    role: data.role || "Investor",
    phone: data.phone,
    email: data.email,
    companies: [],
    summary: { ...DEFAULT_SUMMARY },
    preferences: { ...DEFAULT_PREFERENCES },
    createdAt: new Date(),
    updatedAt: new Date(),
    isOnboarded: false,
    onboardingStep: "name",
  };

  INVESTORS.set(id, investor);
  return investor;
}

/**
 * Update an investor's profile
 * IMPORTANT: This will NOT overwrite the entire investor, only merge the provided fields
 */
export function updateInvestor(
  id: string,
  updates: Partial<Omit<InvestorProfile, "id" | "createdAt">>
): InvestorProfile | undefined {
  const existing = INVESTORS.get(id);
  if (!existing) return undefined;

  const updated: InvestorProfile = {
    ...existing,
    ...updates,
    id: existing.id, // Preserve ID
    createdAt: existing.createdAt, // Preserve creation date
    updatedAt: new Date(),
    // Deep merge preferences if provided
    preferences: updates.preferences
      ? {
          ...existing.preferences,
          ...updates.preferences,
          briefSchedule: {
            ...existing.preferences.briefSchedule,
            ...(updates.preferences.briefSchedule || {}),
          },
          notifications: {
            ...existing.preferences.notifications,
            ...(updates.preferences.notifications || {}),
          },
          displayPreferences: {
            ...existing.preferences.displayPreferences,
            ...(updates.preferences.displayPreferences || {}),
          },
        }
      : existing.preferences,
    // Deep merge summary if provided
    summary: updates.summary
      ? { ...existing.summary, ...updates.summary }
      : existing.summary,
  };

  INVESTORS.set(id, updated);
  return updated;
}

/**
 * Add a company to an investor's portfolio
 */
export function addCompanyToInvestor(
  investorId: string,
  company: PortfolioCompany
): InvestorProfile | undefined {
  const investor = INVESTORS.get(investorId);
  if (!investor) return undefined;

  // Check if company already exists
  const existingIndex = investor.companies.findIndex(
    (c) => c.name.toLowerCase() === company.name.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Update existing company
    investor.companies[existingIndex] = company;
  } else {
    // Add new company
    investor.companies.push(company);
  }

  // Update summary counts
  investor.summary = {
    ...investor.summary,
    totalCompanies: investor.companies.length,
    activeDeals: investor.companies.filter((c) => c.status === "active").length,
    exits: investor.companies.filter(
      (c) => c.status === "acquired" || c.status === "public"
    ).length,
    boardSeats: investor.companies.filter((c) => c.status === "board").length,
  };

  investor.updatedAt = new Date();
  INVESTORS.set(investorId, investor);
  return investor;
}

/**
 * Update investor preferences
 */
export function updateInvestorPreferences(
  investorId: string,
  preferences: Partial<InvestorProfile["preferences"]>
): InvestorProfile | undefined {
  const investor = INVESTORS.get(investorId);
  if (!investor) return undefined;

  // Merge preferences manually to satisfy TypeScript
  const mergedPreferences: InvestorProfile["preferences"] = {
    briefSchedule: {
      ...investor.preferences.briefSchedule,
      ...(preferences.briefSchedule || {}),
    },
    notifications: {
      ...investor.preferences.notifications,
      ...(preferences.notifications || {}),
    },
    displayPreferences: {
      ...investor.preferences.displayPreferences,
      ...(preferences.displayPreferences || {}),
    },
  };

  return updateInvestor(investorId, { preferences: mergedPreferences });
}

/**
 * Complete investor onboarding
 */
export function completeOnboarding(investorId: string): InvestorProfile | undefined {
  return updateInvestor(investorId, {
    isOnboarded: true,
    onboardingStep: "complete",
  });
}

/**
 * Get company names for an investor (for news fetching)
 */
export function getInvestorCompanyNames(investorId: string): string[] {
  const investor = INVESTORS.get(investorId);
  if (!investor) return [];
  return investor.companies.map((c) => c.name);
}

/**
 * Get all company names across all investors (for bulk news fetching)
 */
export function getAllCompanyNames(): string[] {
  const companies = new Set<string>();
  for (const investor of INVESTORS.values()) {
    for (const company of investor.companies) {
      companies.add(company.name);
    }
  }
  return Array.from(companies);
}

// ============================================================================
// ONBOARDING QUESTION PROMPTS
// ============================================================================

export const ONBOARDING_PROMPTS = {
  name: "Welcome to Mino! I'm your portfolio intelligence assistant. To get started, what's your name?",
  firm: (firstName: string) =>
    `Nice to meet you, ${firstName}! What firm or fund are you with? (You can also say "independent" if you invest personally)`,
  role: (firstName: string, firm: string) =>
    `Got it - ${firm}. What's your role there? (e.g., Partner, Principal, Managing Director, Angel)`,
  companies: (firstName: string) =>
    `Great, ${firstName}! Now let's set up your portfolio. Tell me about a company you're tracking. You can say something like "I invested $5M in Acme Corp at Series A, they're in the DevTools space"`,
  moreCompanies: "Got it! Any other companies to add? (Say 'done' when you're finished)",
  schedule: (_firstName: string) =>
    `Perfect! Last step - when would you like your daily intelligence brief? I can send it every morning. What time works best? (e.g., "6am", "7:30 AM Pacific")`,
  complete: (firstName: string, dashboardUrl: string) =>
    `You're all set, ${firstName}! Your personalized portfolio dashboard is ready:\n\n${dashboardUrl}\n\nI'll send your first intelligence brief based on the schedule you set. You can text me anytime for updates.\n\nWelcome to Mino!`,
};

// ============================================================================
// SNAP APP TYPES (for future app creation)
// ============================================================================

export interface SnapApp {
  id: string;
  investorId: string;
  type: "portfolio" | "company_deep_dive" | "competitive_analysis" | "custom";
  name: string;
  description: string;
  url: string;
  createdAt: Date;
  config?: Record<string, unknown>;
}

// Store for Snap Apps (could move to database later)
const SNAP_APPS: Map<string, SnapApp[]> = new Map();

/**
 * Create a new Snap App for an investor
 */
export function createSnapApp(
  investorId: string,
  app: Omit<SnapApp, "id" | "investorId" | "createdAt">
): SnapApp {
  const snapApp: SnapApp = {
    id: uuidv4(),
    investorId,
    ...app,
    createdAt: new Date(),
  };

  const existing = SNAP_APPS.get(investorId) || [];
  existing.push(snapApp);
  SNAP_APPS.set(investorId, existing);

  return snapApp;
}

/**
 * Get all Snap Apps for an investor
 */
export function getInvestorSnapApps(investorId: string): SnapApp[] {
  return SNAP_APPS.get(investorId) || [];
}

/**
 * Get Snap App by ID
 */
export function getSnapApp(investorId: string, appId: string): SnapApp | undefined {
  const apps = SNAP_APPS.get(investorId) || [];
  return apps.find((a) => a.id === appId);
}
