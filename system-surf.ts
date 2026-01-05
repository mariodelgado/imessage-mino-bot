/**
 * System.surf Integration
 *
 * Natural language Mac automation via system.surf API
 * Only enabled for Mario's phone number (+14156836861)
 */

// Configuration - will need to be set via environment
const SYSTEM_SURF_URL = process.env.SYSTEM_SURF_URL || "";
const SYSTEM_SURF_TOKEN = process.env.SYSTEM_SURF_TOKEN || "";

// Only Mario can use system.surf
const SYSTEM_SURF_USER = "+14156836861";

export interface SystemSurfAction {
  tool: string;
  args: Record<string, any>;
  success: boolean;
  result: string;
}

export interface SystemSurfResponse {
  message: string;
  actions?: SystemSurfAction[];
}

export interface SystemSurfSchedule {
  id: string;
  description: string;
  scheduledAt: string;
  cron?: string;
}

/**
 * Check if system.surf is configured
 */
export function isConfigured(): boolean {
  return !!(SYSTEM_SURF_URL && SYSTEM_SURF_TOKEN);
}

/**
 * Check if user is authorized for system.surf
 */
export function isAuthorized(phone: string): boolean {
  return phone === SYSTEM_SURF_USER;
}

/**
 * Send a chat message to system.surf
 */
export async function chat(message: string): Promise<SystemSurfResponse> {
  if (!isConfigured()) {
    throw new Error("System.surf not configured. Set SYSTEM_SURF_URL and SYSTEM_SURF_TOKEN.");
  }

  const response = await fetch(`${SYSTEM_SURF_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SYSTEM_SURF_TOKEN}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`System.surf error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Get scheduled tasks
 */
export async function getSchedules(): Promise<SystemSurfSchedule[]> {
  if (!isConfigured()) {
    throw new Error("System.surf not configured.");
  }

  const response = await fetch(`${SYSTEM_SURF_URL}/schedules`, {
    headers: {
      "Authorization": `Bearer ${SYSTEM_SURF_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get schedules: ${response.status}`);
  }

  const data = await response.json();
  return data.schedules || [];
}

/**
 * Delete a scheduled task
 */
export async function deleteSchedule(id: string): Promise<boolean> {
  if (!isConfigured()) {
    throw new Error("System.surf not configured.");
  }

  const response = await fetch(`${SYSTEM_SURF_URL}/schedules/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${SYSTEM_SURF_TOKEN}`,
    },
  });

  return response.ok;
}

/**
 * Reset conversation/state
 */
export async function reset(): Promise<boolean> {
  if (!isConfigured()) {
    throw new Error("System.surf not configured.");
  }

  const response = await fetch(`${SYSTEM_SURF_URL}/reset`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SYSTEM_SURF_TOKEN}`,
    },
  });

  return response.ok;
}

/**
 * Get current state (for debugging)
 */
export async function getState(): Promise<any> {
  if (!isConfigured()) {
    throw new Error("System.surf not configured.");
  }

  const response = await fetch(`${SYSTEM_SURF_URL}/state`, {
    headers: {
      "Authorization": `Bearer ${SYSTEM_SURF_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get state: ${response.status}`);
  }

  return response.json();
}

/**
 * Format a system.surf response for iMessage
 */
export function formatResponse(response: SystemSurfResponse): string {
  let output = response.message;

  if (response.actions && response.actions.length > 0) {
    const actionSummary = response.actions
      .map(a => {
        const status = a.success ? "✓" : "✗";
        return `${status} ${a.tool}: ${a.result || "done"}`;
      })
      .join("\n");

    output += `\n\n📍 Actions:\n${actionSummary}`;
  }

  return output;
}

/**
 * Format schedules list for iMessage
 */
export function formatSchedules(schedules: SystemSurfSchedule[]): string {
  if (schedules.length === 0) {
    return "📅 No scheduled tasks.\n\nSay something like \"remind me to call mom in 30 minutes\" to create one.";
  }

  let output = "📅 **Scheduled Tasks**\n\n";

  schedules.forEach((s, i) => {
    const time = new Date(s.scheduledAt).toLocaleString();
    output += `${i + 1}. ${s.description}\n`;
    output += `   ⏰ ${time}`;
    if (s.cron) {
      output += ` (recurring)`;
    }
    output += "\n\n";
  });

  output += "Say \"delete schedule N\" to remove one.";

  return output;
}

export default {
  isConfigured,
  isAuthorized,
  chat,
  getSchedules,
  deleteSchedule,
  reset,
  getState,
  formatResponse,
  formatSchedules,
};
