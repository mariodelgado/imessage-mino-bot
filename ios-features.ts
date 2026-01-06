/**
 * iOS-Native Features for iMessage Bot
 *
 * Rich media and Apple ecosystem integrations
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// 1. TEXT-TO-SPEECH VOICE MESSAGES
// ============================================================================

/**
 * Generate voice message using macOS `say` command
 * Returns path to audio file
 */
export async function generateVoiceMessage(
  text: string,
  voice: string = "Samantha" // Siri-like voice
): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}.aiff`);

  // Use macOS say command to generate audio
  // Voices: Samantha (Siri), Alex, Victoria, Karen (Australian), Daniel (British)
  await execAsync(`say -v "${voice}" -o "${tempPath}" "${text.replace(/"/g, '\\"')}"`);

  // Convert to m4a for better iMessage compatibility
  const m4aPath = tempPath.replace(".aiff", ".m4a");
  await execAsync(`afconvert -f m4af -d aac "${tempPath}" "${m4aPath}"`);

  // Clean up aiff
  fs.unlinkSync(tempPath);

  console.log(`🎙️ Generated voice message: ${m4aPath}`);
  return m4aPath;
}

// Available voices for variety
export const VOICES = {
  siri: "Samantha",
  british: "Daniel",
  australian: "Karen",
  indian: "Rishi",
  irish: "Moira",
};

// ============================================================================
// 2. LOCATION SHARING (Map Pins)
// ============================================================================

/**
 * Generate a location vCard that opens in Apple Maps
 * Returns path to .vcf file
 */
export function generateLocationCard(
  name: string,
  address: string,
  latitude: number,
  longitude: number,
  phone?: string,
  website?: string
): string {
  const vcf = `BEGIN:VCARD
VERSION:3.0
N:;${name};;;
FN:${name}
ORG:${name}
ADR;TYPE=WORK:;;${address};;;;
${phone ? `TEL;TYPE=WORK:${phone}` : ""}
${website ? `URL:${website}` : ""}
item1.X-ABADR:us
item1.X-APPLE-SUBLOCALITY:
item1.X-APPLE-SUBADMINISTRATIVEAREA:
GEO:${latitude};${longitude}
END:VCARD`;

  const tempPath = path.join(os.tmpdir(), `location-${Date.now()}.vcf`);
  fs.writeFileSync(tempPath, vcf.trim());

  console.log(`📍 Generated location card: ${name}`);
  return tempPath;
}

/**
 * Generate Apple Maps link
 */
export function generateMapsLink(
  query: string,
  latitude?: number,
  longitude?: number
): string {
  if (latitude && longitude) {
    return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(query)}`;
  }
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

// ============================================================================
// 3. CALENDAR EVENTS (.ics files)
// ============================================================================

interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  description?: string;
  url?: string;
  reminder?: number; // minutes before
}

/**
 * Generate .ics calendar file
 * Returns path to .ics file
 */
export function generateCalendarEvent(event: CalendarEvent): string {
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const endDate = event.endDate || new Date(event.startDate.getTime() + 60 * 60 * 1000); // 1 hour default
  const uid = `mino-${Date.now()}@imessage-bot`;

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//iMessage Mino Bot//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}`;

  if (event.location) {
    ics += `\nLOCATION:${event.location}`;
  }
  if (event.description) {
    ics += `\nDESCRIPTION:${event.description.replace(/\n/g, "\\n")}`;
  }
  if (event.url) {
    ics += `\nURL:${event.url}`;
  }
  if (event.reminder) {
    ics += `
BEGIN:VALARM
TRIGGER:-PT${event.reminder}M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM`;
  }

  ics += `
END:VEVENT
END:VCALENDAR`;

  const tempPath = path.join(os.tmpdir(), `event-${Date.now()}.ics`);
  fs.writeFileSync(tempPath, ics.trim());

  console.log(`📅 Generated calendar event: ${event.title}`);
  return tempPath;
}

// ============================================================================
// 4. CONTACT CARDS (vCards)
// ============================================================================

interface ContactInfo {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  note?: string;
}

/**
 * Generate contact vCard
 * Returns path to .vcf file
 */
export function generateContactCard(contact: ContactInfo): string {
  const [firstName, ...lastParts] = contact.name.split(" ");
  const lastName = lastParts.join(" ");

  let vcf = `BEGIN:VCARD
VERSION:3.0
N:${lastName};${firstName};;;
FN:${contact.name}`;

  if (contact.company) vcf += `\nORG:${contact.company}`;
  if (contact.phone) vcf += `\nTEL;TYPE=CELL:${contact.phone}`;
  if (contact.email) vcf += `\nEMAIL:${contact.email}`;
  if (contact.website) vcf += `\nURL:${contact.website}`;
  if (contact.address) vcf += `\nADR;TYPE=WORK:;;${contact.address};;;;`;
  if (contact.note) vcf += `\nNOTE:${contact.note}`;

  vcf += `\nEND:VCARD`;

  const tempPath = path.join(os.tmpdir(), `contact-${Date.now()}.vcf`);
  fs.writeFileSync(tempPath, vcf.trim());

  console.log(`👤 Generated contact card: ${contact.name}`);
  return tempPath;
}

// ============================================================================
// 5. SIRI SHORTCUTS
// ============================================================================

/**
 * Generate Siri Shortcut deep link
 * Opens Shortcuts app with a specific shortcut
 */
export function generateShortcutLink(shortcutName: string, input?: string): string {
  const base = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}`;
  if (input) {
    return `${base}&input=text&text=${encodeURIComponent(input)}`;
  }
  return base;
}

/**
 * Create a simple shortcut that can be imported
 * Returns path to .shortcut file
 */
export async function createShortcut(
  name: string,
  _actions: string[] // AppleScript-like actions
): Promise<string> {
  // Shortcuts are complex plist files - for now, provide deep links
  console.log(`⚠️ Shortcut creation requires Shortcuts app - use deep links instead`);
  return generateShortcutLink(name);
}

// ============================================================================
// 6. DEEP LINKS / APP CLIPS
// ============================================================================

/**
 * Common app deep links
 */
export const APP_LINKS = {
  // Apple Apps
  maps: (query: string) => `maps://?q=${encodeURIComponent(query)}`,
  music: (search: string) => `music://search?term=${encodeURIComponent(search)}`,
  podcasts: (search: string) => `podcasts://search?term=${encodeURIComponent(search)}`,
  appStore: (appId: string) => `itms-apps://apps.apple.com/app/id${appId}`,
  settings: (section?: string) => section ? `App-Prefs:${section}` : "App-Prefs:",
  wallet: () => "shoebox://",
  health: () => "x-apple-health://",

  // Third Party
  uber: (pickup?: string, dropoff?: string) => {
    let url = "uber://";
    if (dropoff) url += `?action=setPickup&dropoff[formatted_address]=${encodeURIComponent(dropoff)}`;
    return url;
  },
  lyft: (dest?: string) => dest ? `lyft://ridetype?id=lyft&destination[address]=${encodeURIComponent(dest)}` : "lyft://",
  yelp: (query: string) => `yelp:///search?terms=${encodeURIComponent(query)}`,
  openTable: (restaurantId: string) => `opentable://restaurant/${restaurantId}`,
  doordash: () => "doordash://",
  instacart: () => "instacart://",
  spotify: (search: string) => `spotify:search:${encodeURIComponent(search)}`,

  // Web fallbacks with app banner
  universal: (url: string) => url, // iOS will show "Open in App" banner
};

/**
 * Generate smart link that opens app if installed, web otherwise
 */
export function generateSmartLink(
  appScheme: string,
  webUrl: string,
  params?: Record<string, string>
): string {
  // Return web URL - iOS will handle app opening via universal links
  const url = new URL(webUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
}

// ============================================================================
// 7. HOMEKIT CONTROL
// ============================================================================

/**
 * HomeKit scene deep link
 * Opens Home app and optionally triggers a scene
 */
export function generateHomeKitLink(sceneName?: string): string {
  if (sceneName) {
    return `x-hm://scene/${encodeURIComponent(sceneName)}`;
  }
  return "x-hm://";
}

/**
 * Common HomeKit scenes
 */
export const HOME_SCENES = {
  goodMorning: () => generateHomeKitLink("Good Morning"),
  goodNight: () => generateHomeKitLink("Good Night"),
  leaveHome: () => generateHomeKitLink("I'm Leaving"),
  arriveHome: () => generateHomeKitLink("I'm Home"),
};

// ============================================================================
// 8. SCHEDULED MESSAGES (using launchd)
// ============================================================================

interface ScheduledMessage {
  to: string;
  text: string;
  sendAt: Date;
}

const scheduledMessages: Map<string, ScheduledMessage> = new Map();

/**
 * Schedule a message for later
 * Uses in-memory scheduling (for production, use a proper job queue)
 */
export function scheduleMessage(
  to: string,
  text: string,
  sendAt: Date
): string {
  const id = `sched-${Date.now()}`;
  scheduledMessages.set(id, { to, text, sendAt });

  const delay = sendAt.getTime() - Date.now();
  if (delay > 0) {
    setTimeout(() => {
      const msg = scheduledMessages.get(id);
      if (msg) {
        console.log(`⏰ Scheduled message ready: ${id}`);
        // The actual sending is handled by the main bot
        scheduledMessages.delete(id);
      }
    }, delay);
  }

  console.log(`⏰ Scheduled message for ${sendAt.toLocaleString()}`);
  return id;
}

/**
 * Get pending scheduled messages
 */
export function getPendingScheduled(): Map<string, ScheduledMessage> {
  return scheduledMessages;
}

/**
 * Cancel a scheduled message
 */
export function cancelScheduled(id: string): boolean {
  return scheduledMessages.delete(id);
}

// ============================================================================
// 9. TAPBACKS / REACTIONS (requires BlueBubbles)
// ============================================================================

export type TapbackType = "love" | "like" | "dislike" | "laugh" | "emphasize" | "question";

/**
 * Tapback codes for BlueBubbles API
 */
export const TAPBACK_CODES: Record<TapbackType, number> = {
  love: 2000,
  like: 2001,
  dislike: 2002,
  laugh: 2003,
  emphasize: 2004,
  question: 2005,
};

/**
 * Note: Tapbacks require BlueBubbles Private API
 * This is a placeholder for when BlueBubbles is fully configured
 */
export async function sendTapback(
  messageGuid: string,
  tapbackType: TapbackType,
  blueBubblesUrl?: string,
  password?: string
): Promise<boolean> {
  if (!blueBubblesUrl || !password) {
    console.log(`⚠️ Tapbacks require BlueBubbles Private API`);
    return false;
  }

  try {
    const response = await fetch(`${blueBubblesUrl}/api/v1/message/${messageGuid}/react`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password,
        reaction: TAPBACK_CODES[tapbackType],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Tapback failed:", error);
    return false;
  }
}

// ============================================================================
// 10. RICH LINK PREVIEWS
// ============================================================================

/**
 * Generate a rich link that will show a preview in iMessage
 * Note: The preview is generated by iMessage from the URL metadata
 */
export function generateRichLink(
  url: string,
  fallbackText?: string
): string {
  // iMessage automatically generates previews for URLs
  // Just return the URL - it will be rendered with preview
  return fallbackText ? `${fallbackText}\n${url}` : url;
}

// ============================================================================
// 11. PAYMENT REQUESTS (Apple Pay)
// ============================================================================

/**
 * Generate Apple Pay Cash request link
 * Note: Only works between Apple Pay users
 */
export function generatePaymentRequest(amount: number, note?: string): string {
  // Apple Pay Cash doesn't have a public URL scheme
  // Best we can do is format a message
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

  return note
    ? `💵 Payment request: ${formatted} - ${note}`
    : `💵 Payment request: ${formatted}`;
}

// ============================================================================
// 12. FOCUS MODE AWARENESS
// ============================================================================

/**
 * Check if it's likely quiet hours (basic heuristic)
 * For actual Focus mode detection, would need system APIs
 */
export function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 7; // 10pm - 7am
}

/**
 * Format message for quiet hours (shorter, less intrusive)
 */
export function formatForQuietHours(message: string): string {
  if (isQuietHours()) {
    // Truncate and soften the message
    const truncated = message.slice(0, 200);
    return truncated.length < message.length ? truncated + "..." : truncated;
  }
  return message;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  // Voice
  generateVoiceMessage,
  VOICES,

  // Location
  generateLocationCard,
  generateMapsLink,

  // Calendar
  generateCalendarEvent,

  // Contacts
  generateContactCard,

  // Shortcuts
  generateShortcutLink,

  // Deep Links
  APP_LINKS,
  generateSmartLink,

  // HomeKit
  generateHomeKitLink,
  HOME_SCENES,

  // Scheduling
  scheduleMessage,
  getPendingScheduled,
  cancelScheduled,

  // Tapbacks
  sendTapback,
  TAPBACK_CODES,

  // Rich Links
  generateRichLink,

  // Payments
  generatePaymentRequest,

  // Focus Mode
  isQuietHours,
  formatForQuietHours,
};
