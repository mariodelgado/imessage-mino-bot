/**
 * Snap App Types - Shared type definitions
 *
 * These types mirror the mobile app's SnapApp types but are
 * designed for server-side storage and public share links.
 */

import { z } from "zod";

// ============================================================================
// SNAP APP TYPES
// ============================================================================

export const SnapAppTypeSchema = z.enum([
  "price_comparison",
  "product_gallery",
  "article",
  "map_view",
  "availability",
  "code_block",
  "data_table",
  "smart_card",
  "pricing_health", // Apple Health-style competitive pricing dashboard
  "investor_dashboard", // Portfolio company news and updates for investors
]);

export type SnapAppType = z.infer<typeof SnapAppTypeSchema>;

export const SnapAppInsightTypeSchema = z.enum([
  "positive",
  "negative",
  "neutral",
  "warning",
]);

export type SnapAppInsightType = z.infer<typeof SnapAppInsightTypeSchema>;

// ============================================================================
// SNAP APP INSIGHT
// ============================================================================

export const SnapAppInsightSchema = z.object({
  icon: z.string(),
  text: z.string(),
  type: SnapAppInsightTypeSchema,
});

export type SnapAppInsight = z.infer<typeof SnapAppInsightSchema>;

// ============================================================================
// SNAP APP ACTION
// ============================================================================

export const SnapAppActionSchema = z.object({
  label: z.string(),
  icon: z.string(),
  action: z.enum(["share", "save", "refresh", "open_url", "custom"]),
  url: z.string().optional(),
});

export type SnapAppAction = z.infer<typeof SnapAppActionSchema>;

// ============================================================================
// SNAP APP (STORED)
// ============================================================================

export const SnapAppSchema = z.object({
  // Unique identifier (nanoid)
  id: z.string(),

  // Content type
  type: SnapAppTypeSchema,

  // Display info
  title: z.string(),
  subtitle: z.string().optional(),

  // URLs
  sourceUrl: z.string().optional(),
  shareUrl: z.string().optional(),

  // Type-specific data
  data: z.record(z.unknown()),

  // AI insights
  insights: z.array(SnapAppInsightSchema),

  // Actions
  actions: z.array(SnapAppActionSchema),

  // Creator info (for attribution)
  creatorId: z.string().optional(),
  creatorName: z.string().optional(),

  // Timestamps
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),

  // Metadata
  viewCount: z.number().default(0),
  shareCount: z.number().default(0),
  isPublic: z.boolean().default(true),

  // Automation (for scheduled refresh)
  scheduleId: z.string().optional(),
  lastRefreshedAt: z.coerce.date().optional(),
  refreshInterval: z.number().optional(), // in minutes
});

export type SnapApp = z.infer<typeof SnapAppSchema>;

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Create Snap App request
export const CreateSnapAppRequestSchema = z.object({
  type: SnapAppTypeSchema,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  sourceUrl: z.string().url().optional(),
  data: z.record(z.unknown()),
  insights: z.array(SnapAppInsightSchema).default([]),
  actions: z.array(SnapAppActionSchema).default([]),
  creatorId: z.string().optional(),
  creatorName: z.string().optional(),
  isPublic: z.boolean().default(true),
});

export type CreateSnapAppRequest = z.infer<typeof CreateSnapAppRequestSchema>;

// Update Snap App request
export const UpdateSnapAppRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(500).optional(),
  data: z.record(z.unknown()).optional(),
  insights: z.array(SnapAppInsightSchema).optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateSnapAppRequest = z.infer<typeof UpdateSnapAppRequestSchema>;

// Schedule request (for automation)
export const ScheduleSnapAppRequestSchema = z.object({
  snapAppId: z.string(),
  cronExpression: z.string().optional(), // e.g., "0 9 * * *" for 9am daily
  intervalMinutes: z.number().min(15).max(10080).optional(), // 15min to 1 week
  webhookUrl: z.string().url().optional(), // URL to call on refresh
});

export type ScheduleSnapAppRequest = z.infer<typeof ScheduleSnapAppRequestSchema>;

// Scheduled job record
export const ScheduledJobSchema = z.object({
  id: z.string(),
  snapAppId: z.string(),
  cronExpression: z.string().optional(),
  intervalMinutes: z.number().optional(),
  webhookUrl: z.string().optional(),
  lastRunAt: z.coerce.date().optional(),
  nextRunAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.coerce.date(),
});

export type ScheduledJob = z.infer<typeof ScheduledJobSchema>;

// API Response wrapper
export interface ApiResponse<T, M = PaginationMeta> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: M;
}

// Pagination meta for list endpoints
export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
}

// Refresh meta for refresh endpoints
export interface RefreshMeta {
  refreshedAt: string;
  dataChanged: boolean;
}

// ============================================================================
// TYPE METADATA
// ============================================================================

export const SNAP_APP_TYPE_METADATA: Record<
  SnapAppType,
  {
    icon: string;
    label: string;
    color: string;
    description: string;
  }
> = {
  price_comparison: {
    icon: "chart-bar",
    label: "Price Comparison",
    color: "#10B981",
    description: "Compare prices across multiple sources",
  },
  product_gallery: {
    icon: "shopping-bag",
    label: "Product Gallery",
    color: "#8B5CF6",
    description: "Visual product comparison grid",
  },
  article: {
    icon: "document-text",
    label: "Article Summary",
    color: "#3B82F6",
    description: "Key points extracted from articles",
  },
  map_view: {
    icon: "map",
    label: "Map View",
    color: "#F59E0B",
    description: "Geographic data visualization",
  },
  availability: {
    icon: "calendar",
    label: "Availability",
    color: "#EC4899",
    description: "Date/time availability tracker",
  },
  code_block: {
    icon: "code",
    label: "Code Block",
    color: "#6366F1",
    description: "Syntax-highlighted code snippets",
  },
  data_table: {
    icon: "table",
    label: "Data Table",
    color: "#14B8A6",
    description: "Interactive data tables",
  },
  smart_card: {
    icon: "sparkles",
    label: "Smart Card",
    color: "#00D4FF",
    description: "AI-generated smart summary",
  },
  pricing_health: {
    icon: "heart",
    label: "Pricing Health",
    color: "#FF2D55",
    description: "Apple Health-style competitive pricing dashboard",
  },
  investor_dashboard: {
    icon: "briefcase",
    label: "Investor Dashboard",
    color: "#1E40AF",
    description: "Portfolio company news and updates for investors",
  },
};
