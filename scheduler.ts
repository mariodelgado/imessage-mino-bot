/**
 * Scheduled Mino Alerts
 *
 * Allows users to set up recurring Mino automations
 * e.g., "Alert me every morning with the weather"
 * e.g., "Check if concert tickets are available every hour"
 */

import * as fs from "fs";
import * as path from "path";

// Scheduled alert structure
export interface ScheduledAlert {
  id: string;
  phone: string;
  name: string;
  url: string;
  goal: string;
  cronExpression: string;
  nextRun: Date;
  lastRun?: Date;
  lastResult?: string;
  lastResultHash?: string;  // For change detection
  enabled: boolean;
  createdAt: Date;
  notifyOnChangeOnly?: boolean;  // Only alert when data changes
}

// Pending alert setup (user is in the middle of creating one)
export interface PendingAlertSetup {
  phone: string;
  step: "url" | "goal" | "schedule" | "name";
  url?: string;
  goal?: string;
  schedule?: string;
  name?: string;
}

// Storage
const ALERTS_FILE = path.join(process.cwd(), "alerts.json");
const alerts: Map<string, ScheduledAlert> = new Map();
const pendingSetups: Map<string, PendingAlertSetup> = new Map();
const runningTimers: Map<string, NodeJS.Timeout> = new Map();

// Simple hash for change detection
function hashResult(result: string): string {
  let hash = 0;
  for (let i = 0; i < result.length; i++) {
    const chr = result.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(16);
}

// Check if result changed
export function hasResultChanged(alert: ScheduledAlert, newResult: string): boolean {
  const newHash = hashResult(newResult);
  const changed = alert.lastResultHash !== newHash;
  return changed;
}

// Get alerts that share the same run time for morning brief aggregation
export function getAlertsDueAt(phone: string, targetTime: Date): ScheduledAlert[] {
  const targetHour = targetTime.getHours();
  const targetMinute = targetTime.getMinutes();

  return getUserAlerts(phone).filter(alert => {
    if (!alert.enabled) return false;
    const alertHour = alert.nextRun.getHours();
    const alertMinute = alert.nextRun.getMinutes();
    return alertHour === targetHour && alertMinute === targetMinute;
  });
}

// Check if alert should be aggregated into morning brief
export function shouldAggregate(alert: ScheduledAlert): boolean {
  const hour = alert.nextRun.getHours();
  // Morning brief: aggregate all alerts between 6am-10am
  return hour >= 6 && hour < 10;
}

// Load alerts from file
export function loadAlerts(): void {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ALERTS_FILE, "utf-8"));
      for (const alert of data) {
        alert.nextRun = new Date(alert.nextRun);
        alert.createdAt = new Date(alert.createdAt);
        if (alert.lastRun) alert.lastRun = new Date(alert.lastRun);
        alerts.set(alert.id, alert);
      }
      console.log(`📅 Loaded ${alerts.size} scheduled alerts`);
    }
  } catch (err) {
    console.error("Failed to load alerts:", err);
  }
}

// Save alerts to file
function saveAlerts(): void {
  try {
    const data = Array.from(alerts.values());
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to save alerts:", err);
  }
}

// Parse natural language schedule
export function parseSchedule(input: string): { cron: string; description: string } | null {
  const inputLower = input.toLowerCase().trim();

  // Common patterns
  const patterns: Array<{ regex: RegExp; cron: string; desc: string }> = [
    // Every X minutes
    { regex: /every\s*(\d+)\s*min/, cron: "*/$1 * * * *", desc: "every $1 minutes" },

    // Every X hours
    { regex: /every\s*(\d+)\s*hour/, cron: "0 */$1 * * *", desc: "every $1 hours" },
    { regex: /hourly/, cron: "0 * * * *", desc: "every hour" },

    // Daily at specific time
    { regex: /(?:every\s*)?(?:day|daily)\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, cron: "CUSTOM_DAILY", desc: "daily" },
    { regex: /every\s*morning/, cron: "0 8 * * *", desc: "every morning at 8am" },
    { regex: /every\s*evening/, cron: "0 18 * * *", desc: "every evening at 6pm" },
    { regex: /every\s*night/, cron: "0 21 * * *", desc: "every night at 9pm" },

    // Weekly
    { regex: /every\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, cron: "CUSTOM_WEEKLY", desc: "weekly" },
    { regex: /weekly/, cron: "0 9 * * 1", desc: "weekly on Monday at 9am" },

    // Specific intervals
    { regex: /every\s*15\s*min/, cron: "*/15 * * * *", desc: "every 15 minutes" },
    { regex: /every\s*30\s*min/, cron: "*/30 * * * *", desc: "every 30 minutes" },
    { regex: /twice\s*(?:a\s*)?day/, cron: "0 9,18 * * *", desc: "twice a day (9am & 6pm)" },
  ];

  for (const pattern of patterns) {
    const match = inputLower.match(pattern.regex);
    if (match) {
      let cron = pattern.cron;
      let desc = pattern.desc;

      // Handle custom daily
      if (cron === "CUSTOM_DAILY" && match[1]) {
        let hour = parseInt(match[1]);
        const minute = match[2] ? parseInt(match[2]) : 0;
        const ampm = match[3]?.toLowerCase();

        if (ampm === "pm" && hour < 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;

        cron = `${minute} ${hour} * * *`;
        desc = `daily at ${hour}:${minute.toString().padStart(2, "0")}`;
      }

      // Handle custom weekly
      if (cron === "CUSTOM_WEEKLY" && match[1]) {
        const days: Record<string, number> = {
          sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
          thursday: 4, friday: 5, saturday: 6
        };
        const dayNum = days[match[1].toLowerCase()];
        cron = `0 9 * * ${dayNum}`;
        desc = `every ${match[1]} at 9am`;
      }

      // Replace placeholders
      if (match[1] && cron.includes("$1")) {
        cron = cron.replace("$1", match[1]);
        desc = desc.replace("$1", match[1]);
      }

      return { cron, description: desc };
    }
  }

  return null;
}

// Calculate next run time from cron expression
function getNextRunTime(cronExpr: string): Date {
  const parts = cronExpr.split(" ");
  const minute = parts[0];
  const hour = parts[1];
  const now = new Date();
  const next = new Date(now);

  // Simple implementation for common patterns
  if (minute.startsWith("*/")) {
    const interval = parseInt(minute.slice(2));
    const currentMinute = now.getMinutes();
    const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
    next.setMinutes(nextMinute % 60);
    next.setSeconds(0);
    if (nextMinute >= 60) next.setHours(next.getHours() + 1);
  } else if (hour.startsWith("*/")) {
    const interval = parseInt(hour.slice(2));
    next.setMinutes(parseInt(minute) || 0);
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
    next.setHours(nextHour % 24);
    next.setSeconds(0);
    if (nextHour >= 24) next.setDate(next.getDate() + 1);
  } else {
    // Specific time
    next.setMinutes(parseInt(minute) || 0);
    next.setHours(parseInt(hour) || 0);
    next.setSeconds(0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

// Create a new alert
export function createAlert(
  phone: string,
  name: string,
  url: string,
  goal: string,
  cronExpression: string
): ScheduledAlert {
  const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const alert: ScheduledAlert = {
    id,
    phone,
    name,
    url,
    goal,
    cronExpression,
    nextRun: getNextRunTime(cronExpression),
    enabled: true,
    createdAt: new Date(),
  };

  alerts.set(id, alert);
  saveAlerts();

  return alert;
}

// Get alerts for a user
export function getUserAlerts(phone: string): ScheduledAlert[] {
  return Array.from(alerts.values()).filter(a => a.phone === phone);
}

// Get all enabled alerts
export function getEnabledAlerts(): ScheduledAlert[] {
  return Array.from(alerts.values()).filter(a => a.enabled);
}

// Delete an alert
export function deleteAlert(id: string): boolean {
  const timer = runningTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    runningTimers.delete(id);
  }

  const deleted = alerts.delete(id);
  if (deleted) saveAlerts();
  return deleted;
}

// Toggle alert enabled/disabled
export function toggleAlert(id: string): boolean | null {
  const alert = alerts.get(id);
  if (!alert) return null;

  alert.enabled = !alert.enabled;
  if (alert.enabled) {
    alert.nextRun = getNextRunTime(alert.cronExpression);
  }
  saveAlerts();
  return alert.enabled;
}

// Update alert after run (returns true if changed)
export function updateAlertAfterRun(id: string, result: string): { changed: boolean; alert: ScheduledAlert | null } {
  const alert = alerts.get(id);
  if (!alert) return { changed: false, alert: null };

  const newHash = hashResult(result);
  const changed = alert.lastResultHash !== newHash;

  alert.lastRun = new Date();
  alert.lastResult = result;
  alert.lastResultHash = newHash;
  alert.nextRun = getNextRunTime(alert.cronExpression);
  saveAlerts();

  return { changed, alert };
}

// Pending setup management
export function startAlertSetup(phone: string): void {
  pendingSetups.set(phone, { phone, step: "url" });
}

export function getPendingSetup(phone: string): PendingAlertSetup | undefined {
  return pendingSetups.get(phone);
}

export function updatePendingSetup(phone: string, updates: Partial<PendingAlertSetup>): PendingAlertSetup | undefined {
  const setup = pendingSetups.get(phone);
  if (!setup) return undefined;

  Object.assign(setup, updates);
  return setup;
}

export function clearPendingSetup(phone: string): void {
  pendingSetups.delete(phone);
}

// Format alert for display
export function formatAlert(alert: ScheduledAlert, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : "";
  const status = alert.enabled ? "✅" : "⏸️";
  const nextRun = alert.nextRun.toLocaleString();

  return `${prefix}${status} ${alert.name}
   📍 ${new URL(alert.url).hostname}
   🎯 ${alert.goal.slice(0, 50)}${alert.goal.length > 50 ? "..." : ""}
   ⏰ Next: ${nextRun}`;
}

// Format schedule options for user
export function getScheduleOptions(): string {
  return `⏰ When should I check?

Examples:
• "every hour"
• "every 30 min"
• "every morning"
• "daily at 9am"
• "every Monday"
• "twice a day"

Just tell me when!`;
}

// Scheduler runner - to be called from index.ts
let schedulerCallback: ((alert: ScheduledAlert) => Promise<void>) | null = null;
let morningBriefCallback: ((phone: string, alerts: ScheduledAlert[]) => Promise<void>) | null = null;

// Track which phones have had their morning brief sent today
const morningBriefsSent = new Map<string, string>();  // phone -> date string

export function setSchedulerCallback(callback: (alert: ScheduledAlert) => Promise<void>): void {
  schedulerCallback = callback;
}

export function setMorningBriefCallback(callback: (phone: string, alerts: ScheduledAlert[]) => Promise<void>): void {
  morningBriefCallback = callback;
}

export function startScheduler(): void {
  loadAlerts();

  // Check every minute for alerts to run
  setInterval(async () => {
    const now = new Date();
    const today = now.toDateString();
    const hour = now.getHours();

    // Group morning alerts by phone for morning brief (6am-10am)
    if (hour >= 6 && hour < 10 && morningBriefCallback) {
      const morningAlerts = getEnabledAlerts().filter(a => {
        const alertHour = a.nextRun.getHours();
        return alertHour >= 6 && alertHour < 10 && a.nextRun <= now;
      });

      // Group by phone
      const byPhone = new Map<string, ScheduledAlert[]>();
      for (const alert of morningAlerts) {
        const existing = byPhone.get(alert.phone) || [];
        existing.push(alert);
        byPhone.set(alert.phone, existing);
      }

      // Send morning briefs (one per phone per day)
      for (const [phone, alerts] of byPhone) {
        const lastBrief = morningBriefsSent.get(phone);
        if (lastBrief !== today && alerts.length > 0) {
          morningBriefsSent.set(phone, today);
          console.log(`☀️ Sending morning brief to ${phone} (${alerts.length} alerts)`);

          try {
            await morningBriefCallback(phone, alerts);
          } catch (err) {
            console.error(`Morning brief failed for ${phone}:`, err);
          }
        }
      }
    }

    // Run individual alerts (non-morning or if no morning brief callback)
    for (const alert of getEnabledAlerts()) {
      if (alert.nextRun <= now && schedulerCallback) {
        // Skip morning alerts if we're doing morning briefs
        if (morningBriefCallback && shouldAggregate(alert)) {
          continue;  // Already handled by morning brief
        }

        console.log(`⏰ Running scheduled alert: ${alert.name}`);

        try {
          await schedulerCallback(alert);
        } catch (err) {
          console.error(`Alert ${alert.id} failed:`, err);
        }
      }
    }
  }, 60000); // Check every minute

  console.log(`⏰ Scheduler started`);
}

export default {
  loadAlerts,
  createAlert,
  setMorningBriefCallback,
  getUserAlerts,
  getEnabledAlerts,
  deleteAlert,
  toggleAlert,
  updateAlertAfterRun,
  parseSchedule,
  startAlertSetup,
  getPendingSetup,
  updatePendingSetup,
  clearPendingSetup,
  formatAlert,
  getScheduleOptions,
  setSchedulerCallback,
  startScheduler,
};
