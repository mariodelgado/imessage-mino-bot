/**
 * iMessage Mino Bot
 *
 * A personal AI assistant via iMessage with:
 * - Gemini 3 Flash Preview with agentic chain
 * - Mino browser automation
 */

import { IMessageSDK, type Message } from "@photon-ai/imessage-kit";
import { runMinoAutomation, type MinoResult, type ProgressCallback } from "./mino";
import { initGemini, chat, clearHistory, addMinoResultToHistory, toggleDebug, setLastMinoResult, getLastMinoResult, checkGuardrails, type ChatResult } from "./gemini";
import { initImageGen, generateDataCard } from "./image-gen";
import ios from "./ios-features";
import scheduler, { type ScheduledAlert, hasResultChanged } from "./scheduler";
import { getOrCreateUser, storeMessage, updateUserName, setMinoState, getMinoApiKey, getMinoAccessToken, getMinoRefreshToken, needsMinoReauth } from "./db";
import { startOAuthServer, generateMinoOAuthUrl, generateState, setMinoConnectedCallback, refreshAccessToken } from "./oauth-server";
import userModel from "./user-model";
import security from "./security";

// Load environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MINO_API_KEY = process.env.MINO_API_KEY || "";
const ALLOWED_CONTACTS = (process.env.ALLOWED_CONTACTS || "").split(",").filter(Boolean);

// Validate config
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

if (!MINO_API_KEY) {
  console.warn("⚠️ MINO_API_KEY not set - users will need to connect their own Mino accounts");
}

// Initialize Gemini
initGemini(GEMINI_API_KEY);

// Initialize image generation
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "";
if (GCP_PROJECT_ID) {
  initImageGen(GCP_PROJECT_ID, process.env.GCP_LOCATION || "us-central1");
}

// Initialize iMessage SDK
const iMessage = new IMessageSDK({ debug: false });

// Help text
const HELP_TEXT = `🤖 Mino - Your AI Assistant

Chat naturally! I can:
• 🌐 Browse websites for real-time info
• ⏰ Set up recurring alerts
• 🎙️ Send voice messages
• 📍 Share locations & directions
• 📅 Create calendar events
• 🏠 Control HomeKit scenes

Commands:
/alert new - Create a monitoring alert
/alerts - View your alerts
/voice [text] - Voice message
/remind 5m [msg] - Quick reminder
/home [scene] - HomeKit scene
/connect - Link Mino account
/disconnect - Unlink Mino account
/status - Check your connection
/clear - Reset chat
/help - This menu`;

// Format Mino results for iMessage - returns { text, parsedData }
function formatMinoForIMessage(result: MinoResult, url: string, goal: string): { text: string; data: any } {
  const domain = new URL(url).hostname.replace("www.", "");

  if (result.status === "error") {
    return {
      text: `❌ Couldn't access ${domain}: ${result.error}`,
      data: null
    };
  }

  if (result.status === "running" || !result.result) {
    return {
      text: `🤔 ${domain} didn't return data. Try a different site?`,
      data: null
    };
  }

  let output = "";
  let parsedData: any = null;

  try {
    parsedData = JSON.parse(result.result);

    // Format based on data structure
    if (Array.isArray(parsedData)) {
      output = formatArray(parsedData);
    } else if (typeof parsedData === "object") {
      output = formatObject(parsedData);
    } else {
      output = String(parsedData).slice(0, 1000);
    }
  } catch {
    output = result.result.slice(0, 1000);
    parsedData = result.result;
  }

  if (!output.trim()) {
    return { text: `🤔 No useful data from ${domain}`, data: null };
  }

  return { text: output + `\n\n📍 ${domain}`, data: parsedData };
}

// Format array data nicely
function formatArray(arr: any[]): string {
  if (arr.length === 0) return "";

  return arr.slice(0, 10).map((item, i) => {
    if (typeof item === "string") return `${i + 1}. ${item}`;
    if (item.name || item.title) {
      let line = `${i + 1}. ${item.name || item.title}`;
      if (item.price) line += ` - ${item.price}`;
      if (item.rating) line += ` ⭐${item.rating}`;
      if (item.description) line += `\n   ${item.description.slice(0, 80)}`;
      return line;
    }
    // Show first few meaningful values
    const vals = Object.values(item).filter(v => v && typeof v !== "object").slice(0, 3);
    return vals.length ? `${i + 1}. ${vals.join(" | ")}` : null;
  }).filter(Boolean).join("\n") + (arr.length > 10 ? `\n\n+${arr.length - 10} more` : "");
}

// Format object data nicely with emojis
function formatObject(obj: any): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "";

  const categoryEmojis: Record<string, string> = {
    featured: "⭐",
    special: "✨",
    dark: "🌑",
    medium: "☕",
    light: "🌅",
    decaf: "😴",
    cold: "🧊",
    hot: "🔥",
    address: "📍",
    location: "📍",
    phone: "📞",
    hours: "🕐",
    price: "💰",
    default: "•",
  };

  const getEmoji = (key: string): string => {
    const keyLower = key.toLowerCase();
    for (const [keyword, emoji] of Object.entries(categoryEmojis)) {
      if (keyLower.includes(keyword)) return emoji;
    }
    return categoryEmojis.default;
  };

  return entries.slice(0, 10).map(([key, value]) => {
    const label = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
    const emoji = getEmoji(key);

    if (Array.isArray(value)) {
      const items = (value as any[]).slice(0, 6).map((item) => {
        if (typeof item === "string") return `  ${emoji} ${item}`;
        if (item.name || item.title) {
          let line = `  ${emoji} ${item.name || item.title}`;
          if (item.notes) line += ` - ${item.notes}`;
          if (item.type) line += ` (${item.type})`;
          return line;
        }
        const vals = Object.values(item).filter(v => v && typeof v !== "object").slice(0, 2);
        return vals.length ? `  ${emoji} ${vals.join(" - ")}` : null;
      }).filter(Boolean).join("\n");

      const more = (value as any[]).length > 6 ? `\n  ... +${(value as any[]).length - 6} more` : "";
      return `${label.toUpperCase()}\n${items}${more}`;
    } else if (value && typeof value === "object") {
      // Recursively format nested objects
      return `${emoji} ${label}: ${formatObject(value)}`;
    } else if (value) {
      return `${emoji} ${label}: ${value}`;
    }
    return null;
  }).filter(Boolean).join("\n\n");
}

// Error boundary wrapper for async functions
async function withErrorBoundary<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error(`❌ Error in ${context}:`, error);
    return fallback;
  }
}

// Process incoming messages
async function handleMessage(message: Message) {
  const text = message.text?.trim();
  const sender = message.sender || "unknown";

  if (!text) return;

  // Security check
  if (ALLOWED_CONTACTS.length > 0 && !ALLOWED_CONTACTS.includes(sender)) {
    console.log(`⚠️ Blocked: ${sender}`);
    return;
  }

  console.log(`📨 From ${sender}: ${text}`);

  // Security: Check lockout status
  const lockout = security.isLockedOut(sender);
  if (lockout.locked) {
    console.log(`🔒 User ${sender} is locked out`);
    const mins = Math.ceil((lockout.unlockIn || 0) / 60000);
    await iMessage.send(sender, `⚠️ Too many failed attempts. Try again in ${mins} minutes.`);
    return;
  }

  // Security: Rate limiting
  const rateLimit = security.checkRateLimit(sender);
  if (!rateLimit.allowed) {
    console.log(`⚡ Rate limit exceeded for ${sender}`);
    const secs = Math.ceil(rateLimit.resetIn / 1000);
    await iMessage.send(sender, `⏳ Slow down! Try again in ${secs} seconds.`);
    return;
  }

  // Security: Sanitize input
  const sanitizedText = security.sanitizeInput(text);

  // Security: Check for suspicious patterns
  if (security.detectSuspiciousInput(sanitizedText, sender)) {
    console.log(`🚨 Suspicious input detected from ${sender}`);
    // Don't reveal detection, just ignore
  }

  // Ensure user exists and track interaction
  const user = getOrCreateUser(sender);
  storeMessage(sender, "user", sanitizedText);
  userModel.trackInteraction(sender, sanitizedText);

  // Check guardrails early
  const guardrail = checkGuardrails(sanitizedText);
  if (guardrail.blocked) {
    console.log(`🛡️ Guardrail blocked: ${guardrail.reason}`);
    await iMessage.send(sender, guardrail.response || "I can't help with that.");
    return;
  }

  let response: ChatResult;

  try {
    // Route commands
    if (text.toLowerCase() === "/help") {
      await iMessage.send(sender, HELP_TEXT);
      return;
    } else if (text.toLowerCase() === "/clear") {
      clearHistory(sender);
      await iMessage.send(sender, "🗑️ Conversation cleared!");
      return;
    } else if (text.toLowerCase() === "/connect") {
      const state = generateState();
      setMinoState(sender, state);
      const oauthUrl = generateMinoOAuthUrl(sender, state);
      await iMessage.send(sender, `🔗 Connect your Mino account:\n${oauthUrl}`);
      return;
    } else if (text.toLowerCase() === "/disconnect") {
      // Import clearMinoAuth if not already
      const { clearMinoAuth } = await import("./db");
      clearMinoAuth(sender);
      security.logSecurityEvent(sender, "token_revoked", { reason: "user_disconnect" }, "info");
      await iMessage.send(sender, `✅ Mino account disconnected. Use /connect to link again.`);
      return;
    } else if (text.toLowerCase() === "/status") {
      const hasToken = await getValidMinoToken(sender);
      const profile = userModel.getOrCreateProfile(sender);
      const sessions = security.getActiveSessions(sender);

      let status = `📊 **Your Status**\n\n`;
      status += `👤 Name: ${profile.name || "Not set"}\n`;
      status += `🔗 Mino: ${hasToken ? "✅ Connected" : "❌ Not connected"}\n`;
      status += `💬 Messages: ${profile.totalMessages}\n`;
      status += `📅 Sessions: ${profile.totalSessions}\n`;

      if (sessions.length > 0) {
        status += `\n🔐 Active sessions: ${sessions.length}`;
      }

      await iMessage.send(sender, status);
      return;
    } else if (text.toLowerCase() === "/debug") {
      const enabled = toggleDebug(sender);
      await iMessage.send(sender, enabled ? "🐟 Debug mode ON" : "🔇 Debug mode OFF");
      return;
    } else if (text.toLowerCase().startsWith("/voice ")) {
      // Voice message command
      const voiceText = text.slice(7).trim();
      if (voiceText) {
        await iMessage.send(sender, "🎙️ Recording...");
        try {
          const audioPath = await ios.generateVoiceMessage(voiceText);
          await iMessage.sendFile(sender, audioPath);
        } catch (err) {
          await iMessage.send(sender, "❌ Voice generation failed");
        }
      }
      return;
    } else if (text.toLowerCase().startsWith("/remind ")) {
      // Schedule message: /remind 5m Check the oven
      const match = text.match(/\/remind\s+(\d+)(m|h|d)\s+(.+)/i);
      if (match) {
        const [, amount, unit, msg] = match;
        const multipliers: Record<string, number> = { m: 60000, h: 3600000, d: 86400000 };
        const delay = parseInt(amount) * multipliers[unit.toLowerCase()];
        const sendAt = new Date(Date.now() + delay);

        ios.scheduleMessage(sender, msg, sendAt);
        await iMessage.send(sender, `⏰ Reminder set for ${sendAt.toLocaleTimeString()}`);

        // Actually send when time comes
        setTimeout(async () => {
          await iMessage.send(sender, `⏰ Reminder: ${msg}`);
        }, delay);
      } else {
        await iMessage.send(sender, "Usage: /remind 5m Check the oven");
      }
      return;
    } else if (text.toLowerCase().startsWith("/home")) {
      // HomeKit scene: /home Good Night
      const sceneName = text.slice(5).trim();
      if (sceneName) {
        const link = ios.generateHomeKitLink(sceneName);
        await iMessage.send(sender, `🏠 Open to trigger "${sceneName}":\n${link}`);
      } else {
        await iMessage.send(sender, `🏠 HomeKit scenes:\n• /home Good Morning\n• /home Good Night\n• /home I'm Leaving\n• /home I'm Home`);
      }
      return;
    } else if (text.toLowerCase() === "/alert" || text.toLowerCase() === "/alerts") {
      // List alerts
      const userAlerts = scheduler.getUserAlerts(sender);
      if (userAlerts.length === 0) {
        await iMessage.send(sender, `📅 No alerts set up yet.\n\nSay "set up an alert" or "remind me to check [something] every [time]" to create one!`);
      } else {
        const list = userAlerts.map((a, i) => scheduler.formatAlert(a, i)).join("\n\n");
        await iMessage.send(sender, `📅 Your Alerts:\n\n${list}\n\nSay "delete alert 1" to remove one.`);
      }
      return;
    } else if (text.toLowerCase().startsWith("/alert new") || text.toLowerCase() === "/newalert") {
      // Start new alert setup
      scheduler.startAlertSetup(sender);
      await iMessage.send(sender, `📅 Let's set up an alert!\n\nWhat website should I check?\n(Send a URL or describe what you want to monitor)`);
      return;
    } else if (text.toLowerCase().match(/^(delete|remove|cancel)\s*alert\s*(\d+)/i)) {
      // Delete an alert
      const match = text.match(/(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        const userAlerts = scheduler.getUserAlerts(sender);
        if (index >= 0 && index < userAlerts.length) {
          const alert = userAlerts[index];
          scheduler.deleteAlert(alert.id);
          await iMessage.send(sender, `✅ Deleted alert: ${alert.name}`);
        } else {
          await iMessage.send(sender, `❌ Alert #${index + 1} not found`);
        }
      }
      return;
    }

    // Check if user is responding to image gen prompt
    if (await handleImageGenRequest(sender, text)) {
      return;
    }

    // Check if user is in alert setup flow
    const alertSetup = scheduler.getPendingSetup(sender);
    if (alertSetup) {
      console.log(`📝 User in alert setup, step: ${alertSetup.step}`);
      const handled = await handleAlertSetup(sender, text, alertSetup);
      console.log(`   ↳ handled: ${handled}`);
      if (handled) return;
    }

    // Detect natural language alert requests
    const alertMatch = detectAlertRequest(text);
    if (alertMatch) {
      await handleNaturalAlertRequest(sender, text, alertMatch);
      return;
    }

    // Chat with Gemini (agentic chain)
    response = await chat(sender, text);

    // Send debug log if enabled
    if (response.debugLog) {
      await iMessage.send(sender, response.debugLog);
    }

    // Handle different action types
    switch (response.action) {
      case "mino":
        if (response.minoRequest) {
          await handleMinoRequest(response.minoRequest, sender);
          return;
        }
        break;

      case "voice":
        if (response.voiceRequest) {
          await iMessage.send(sender, "🎙️ Recording...");
          try {
            const audioPath = await ios.generateVoiceMessage(response.voiceRequest.text);
            await iMessage.sendFile(sender, audioPath);
            console.log(`🎙️ Sent voice message`);
          } catch (err) {
            await iMessage.send(sender, "❌ Voice generation failed");
          }
          return;
        }
        break;

      case "remind":
        if (response.remindRequest) {
          const { delay, message: remindMsg } = response.remindRequest;
          const match = delay.match(/(\d+)(m|h|d)/i);
          if (match) {
            const [, amount, unit] = match;
            const multipliers: Record<string, number> = { m: 60000, h: 3600000, d: 86400000 };
            const delayMs = parseInt(amount) * multipliers[unit.toLowerCase()];
            const sendAt = new Date(Date.now() + delayMs);

            ios.scheduleMessage(sender, remindMsg, sendAt);
            await iMessage.send(sender, `⏰ Reminder set for ${sendAt.toLocaleTimeString()}: "${remindMsg}"`);

            setTimeout(async () => {
              await iMessage.send(sender, `⏰ Reminder: ${remindMsg}`);
            }, delayMs);
          }
          return;
        }
        break;

      case "homekit":
        if (response.homekitRequest) {
          const link = ios.generateHomeKitLink(response.homekitRequest.scene);
          await iMessage.send(sender, `🏠 Triggering "${response.homekitRequest.scene}":\n${link}`);
          return;
        }
        break;

      case "alert":
        // Let the natural alert detection handle this
        // (Already handled earlier in the message flow)
        break;
    }

    // Fallback: Handle Mino request without action type (backwards compat)
    if (response.minoRequest) {
      await handleMinoRequest(response.minoRequest, sender);
      return;
    }

    // Send text response
    if (response.text) {
      await iMessage.send(sender, response.text);
      storeMessage(sender, "assistant", response.text);
      console.log(`📤 Sent to ${sender}`);
    }

  } catch (error) {
    console.error("Error:", error);
    await iMessage.send(sender, `❌ Error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

// Get valid Mino API key/token for a user, refreshing if needed
async function getValidMinoToken(phone: string): Promise<string | null> {
  // First check for OAuth access token
  let accessToken = getMinoAccessToken(phone);
  if (accessToken) {
    return accessToken;
  }

  // Try to refresh if we have a refresh token
  const refreshToken = getMinoRefreshToken(phone);
  if (refreshToken) {
    console.log(`[Auth] Attempting token refresh for ${phone}`);
    accessToken = await refreshAccessToken(phone);
    if (accessToken) {
      return accessToken;
    }
  }

  // Fall back to legacy API key
  const legacyKey = getMinoApiKey(phone);
  if (legacyKey) {
    return legacyKey;
  }

  // Fall back to global API key
  if (MINO_API_KEY) {
    return MINO_API_KEY;
  }

  return null;
}

// Handle Mino browser automation
async function handleMinoRequest(request: { url: string; goal: string }, sender: string) {
  // Get valid token (with automatic refresh)
  const apiKey = await getValidMinoToken(sender);

  if (!apiKey) {
    const state = generateState();
    const oauthUrl = generateMinoOAuthUrl(sender, state);
    await iMessage.send(sender, `🔗 Connect Mino first:\n${oauthUrl}`);
    return;
  }

  let url = request.url;
  if (!url.startsWith("http")) url = `https://${url}`;

  // Security: Validate URL is safe to browse
  const urlCheck = security.isUrlSafe(url);
  if (!urlCheck.safe) {
    console.log(`🚫 Blocked unsafe URL: ${url} - ${urlCheck.reason}`);
    await iMessage.send(sender, `⚠️ I can't browse that URL: ${urlCheck.reason}`);
    return;
  }

  // Security: Mino-specific rate limit
  const minoLimit = security.checkMinoRateLimit(sender);
  if (!minoLimit.allowed) {
    const secs = Math.ceil(minoLimit.resetIn / 1000);
    await iMessage.send(sender, `⏳ Too many web requests. Try again in ${secs} seconds.`);
    return;
  }

  const domain = new URL(url).hostname.replace("www.", "");
  console.log(`🌐 Mino: ${url} - ${request.goal}`);

  // Better instant feedback based on what we're doing
  const friendlyGoal = request.goal.length > 40
    ? request.goal.slice(0, 40) + "..."
    : request.goal;
  await iMessage.send(sender, `🌐 Browsing ${domain}...\n📋 Looking for: ${friendlyGoal}\n\n⏱️ This usually takes ~30 seconds`);

  // Track when we last sent a progress update
  let lastUpdate = Date.now();
  const MIN_UPDATE_INTERVAL = 20000; // 20 seconds
  let updateCount = 0;

  const progressMessages = [
    "Loading page...",
    "Navigating content...",
    "Extracting data...",
    "Almost there...",
  ];

  // Progress callback to update user
  const onProgress: ProgressCallback = async (message) => {
    const now = Date.now();
    if (now - lastUpdate >= MIN_UPDATE_INTERVAL) {
      lastUpdate = now;
      updateCount++;
      const progressMsg = progressMessages[Math.min(updateCount - 1, progressMessages.length - 1)];
      try {
        await iMessage.send(sender, `⏳ ${progressMsg}`);
      } catch (err) {
        console.error("Failed to send progress:", err);
      }
    }
  };

  let result;
  try {
    result = await runMinoAutomation(apiKey, url, request.goal, onProgress);
    console.log(`📦 Mino raw result:`, JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Mino automation failed:", err);
    await iMessage.send(sender, `❌ Couldn't access ${domain}. The site might be down or blocking automation. Try again later?`);
    return;
  }

  // Format and store result
  const { text, data } = formatMinoForIMessage(result, url, request.goal);

  // Store for follow-up questions
  if (data) {
    setLastMinoResult(sender, url, request.goal, data);

    // Smart iOS feature detection based on data (with error boundary)
    await withErrorBoundary(
      () => sendSmartIOSFeatures(sender, data, request.goal, url),
      "sendSmartIOSFeatures"
    );
  }

  addMinoResultToHistory(sender, text);

  // Split long messages (iMessage works better with shorter messages)
  // Auto-voice for very long responses (500+ chars) for established users
  const profile = userModel.getOrCreateProfile(sender);
  const VOICE_THRESHOLD = 500;
  const shouldAutoVoice = text.length > VOICE_THRESHOLD && profile.totalMessages > 10;

  const MAX_MSG_LENGTH = 800;
  if (text.length > MAX_MSG_LENGTH) {
    const chunks = splitMessage(text, MAX_MSG_LENGTH);
    for (const chunk of chunks) {
      await iMessage.send(sender, chunk);
      // Small delay between messages
      await new Promise(r => setTimeout(r, 300));
    }
  } else {
    await iMessage.send(sender, text);
  }

  // Send voice version for long content
  if (shouldAutoVoice) {
    try {
      // Create a conversational voice summary
      const voiceText = `Here's what I found: ${text.slice(0, 300).replace(/[*#_`]/g, "")}. That's the quick summary.`;
      const voicePath = await ios.generateVoiceMessage(voiceText);
      await iMessage.sendFile(sender, voicePath);
      console.log(`🎙️ Auto-sent voice summary`);
    } catch (err) {
      console.error("Voice generation failed:", err);
      // Silently fail
    }
  }

  storeMessage(sender, "assistant", text);
  console.log(`📤 Sent Mino result to ${sender}`);

  // Proactive: suggest alerts for frequently checked sites
  await suggestAlertsForFrequentSites(sender);
}

// Proactively suggest alerts when user checks same site multiple times
async function suggestAlertsForFrequentSites(sender: string): Promise<void> {
  const sitesToSuggest = userModel.getSitesForAlertSuggestion(sender);

  for (const site of sitesToSuggest.slice(0, 1)) {  // Only suggest one at a time
    userModel.markAlertSuggested(sender, site.domain);
    await iMessage.send(
      sender,
      `💡 I noticed you check ${site.domain} often. Want me to set up an alert to notify you of changes automatically?`
    );
    break;  // One suggestion per interaction
  }
}

// Split message at natural break points
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const sections = text.split("\n\n");

  let current = "";
  for (const section of sections) {
    if (current.length + section.length + 2 > maxLength && current) {
      chunks.push(current.trim());
      current = section;
    } else {
      current += (current ? "\n\n" : "") + section;
    }
  }
  if (current) chunks.push(current.trim());

  return chunks;
}

// Pending image generation requests per user
const pendingImageGen = new Map<string, { data: any; goal: string }>();

// Smart iOS feature detection - sends appropriate rich content based on data
async function sendSmartIOSFeatures(sender: string, data: any, goal: string, url: string) {
  const goalLower = goal.toLowerCase();

  try {
    // 1. Location data - send map pin
    if (hasLocationData(data)) {
      const loc = extractLocation(data);
      if (loc && loc.address) {
        const locationCard = ios.generateLocationCard(
          loc.name,
          loc.address,
          loc.lat,
          loc.lng,
          loc.phone,
          loc.website || url
        );
        await iMessage.sendFile(sender, locationCard);
        console.log(`📍 Sent location card for ${loc.name}`);
      }
    }

    // 2. Event/reservation data - send calendar invite
    if (hasEventData(data, goalLower)) {
      const event = extractEvent(data, goalLower);
      if (event) {
        const calendarFile = ios.generateCalendarEvent(event);
        await iMessage.sendFile(sender, calendarFile);
        console.log(`📅 Sent calendar event`);
      }
    }

    // 3. Business/contact data - send vCard
    if (hasContactData(data) && goalLower.includes("contact")) {
      const contact = extractContact(data);
      if (contact) {
        const contactCard = ios.generateContactCard(contact);
        await iMessage.sendFile(sender, contactCard);
        console.log(`👤 Sent contact card`);
      }
    }

    // 4. Rich list data - Auto-generate visual card (no longer asking)
    const profile = userModel.getOrCreateProfile(sender);
    const cardStyle = detectCardStyle(data, goal);
    if (cardStyle && profile.totalMessages > 3) {  // Only after user is established
      try {
        const cardPath = await generateDataCard(data, goal, cardStyle);
        if (cardPath) {
          await iMessage.sendFile(sender, cardPath);
          console.log(`🎨 Auto-sent visual card for ${goal}`);
        }
      } catch (err) {
        console.error("Card generation failed:", err);
        // Silently fail - don't interrupt the flow
      }
    }

    // 5. Add relevant deep links
    const deepLink = generateRelevantDeepLink(data, goalLower, url);
    if (deepLink) {
      await iMessage.send(sender, deepLink);
    }

  } catch (err) {
    console.error("Smart feature error:", err);
  }
}

// Handle alert setup flow
async function handleAlertSetup(
  sender: string,
  text: string,
  setup: { phone: string; step: string; url?: string; goal?: string; schedule?: string; name?: string }
): Promise<boolean> {
  const textLower = text.toLowerCase().trim();

  // Allow cancellation
  if (textLower === "cancel" || textLower === "nevermind" || textLower === "stop") {
    scheduler.clearPendingSetup(sender);
    await iMessage.send(sender, "👍 Alert setup cancelled.");
    return true;
  }

  switch (setup.step) {
    case "url": {
      // User is providing URL or description
      let url = text.trim();
      let extractedGoal: string | undefined;
      let extractedSchedule: string | undefined;

      // Try to extract URL from text (e.g., "check philzcoffee.com every morning")
      const urlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/\S*)?/i);
      if (urlMatch) {
        const extractedUrl = urlMatch[0];
        url = extractedUrl.startsWith("http") ? extractedUrl : `https://${extractedUrl}`;

        // Also try to extract goal from the message
        const goalMatch = text.match(/(?:check|find|get|monitor|look for|availability of|if)\s+(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i);
        if (goalMatch) {
          extractedGoal = goalMatch[1].trim();
        }

        // Also check for schedule in the same message
        const schedulePatterns = [
          /every\s*(morning|evening|night|day|hour|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
          /every\s*(\d+)\s*(min|hour|day|week)/i,
          /daily\s*(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
          /hourly/i,
          /weekly/i,
        ];
        for (const pattern of schedulePatterns) {
          const match = text.match(pattern);
          if (match) {
            extractedSchedule = match[0];
            break;
          }
        }
      } else if (!url.startsWith("http")) {
        // No URL found, ask for one
        await iMessage.send(sender, `🔗 Please provide a URL to monitor, like:\nhttps://philzcoffee.com\n\nOr say "cancel" to stop.`);
        return true;
      }

      // Update with extracted info
      const updates: any = { url, step: extractedGoal ? (extractedSchedule ? "name" : "schedule") : "goal" };
      if (extractedGoal) updates.goal = extractedGoal;
      if (extractedSchedule) {
        const parsed = scheduler.parseSchedule(extractedSchedule);
        if (parsed) updates.schedule = parsed.cron;
      }

      scheduler.updatePendingSetup(sender, updates);

      // If we have everything, auto-create the alert
      const currentSetup = scheduler.getPendingSetup(sender);
      if (currentSetup?.url && currentSetup?.goal && currentSetup?.schedule) {
        const alertName = generateAlertName(currentSetup.goal, new URL(currentSetup.url).hostname);
        const alert = scheduler.createAlert(
          sender,
          alertName,
          currentSetup.url,
          currentSetup.goal,
          currentSetup.schedule
        );
        scheduler.clearPendingSetup(sender);
        await iMessage.send(sender, `✅ Alert created!\n\n${scheduler.formatAlert(alert)}\n\nI'll message you with updates. Say /alerts to manage.`);
        console.log(`📅 Created alert "${alertName}" for ${sender} (auto-created)`);
        return true;
      }

      // Otherwise, ask for the next missing piece
      const domain = new URL(url).hostname.replace("www.", "");
      if (!extractedGoal) {
        await iMessage.send(sender, `🔗 Got it! I'll check: ${domain}\n\nWhat should I look for?\n(e.g., "check if Winter Bliss is available")`);
      } else if (!updates.schedule) {
        await iMessage.send(sender, `🔗 Got it! I'll check ${domain} for "${extractedGoal}"\n\n${scheduler.getScheduleOptions()}`);
      } else {
        await iMessage.send(sender, `⏰ Almost there! Give this alert a short name:\n(e.g., "Winter Bliss check")`);
      }
      return true;
    }

    case "goal": {
      scheduler.updatePendingSetup(sender, { goal: text, step: "schedule" });
      await iMessage.send(sender, scheduler.getScheduleOptions());
      return true;
    }

    case "schedule": {
      const parsed = scheduler.parseSchedule(text);
      if (!parsed) {
        await iMessage.send(sender, `❓ I didn't understand that schedule.\n\nTry something like:\n• "every hour"\n• "daily at 9am"\n• "every 30 min"`);
        return true;
      }

      scheduler.updatePendingSetup(sender, { schedule: parsed.cron, step: "name" });
      await iMessage.send(sender, `⏰ Got it: ${parsed.description}\n\nGive this alert a short name:\n(e.g., "Ticket check", "Price monitor")`);
      return true;
    }

    case "name": {
      const updatedSetup = scheduler.getPendingSetup(sender);
      if (!updatedSetup?.url || !updatedSetup?.goal || !updatedSetup?.schedule) {
        scheduler.clearPendingSetup(sender);
        await iMessage.send(sender, "❌ Something went wrong. Try /alert new to start over.");
        return true;
      }

      // Create the alert
      const alert = scheduler.createAlert(
        sender,
        text.trim(),
        updatedSetup.url,
        updatedSetup.goal,
        updatedSetup.schedule
      );

      scheduler.clearPendingSetup(sender);

      await iMessage.send(sender, `✅ Alert created!\n\n${scheduler.formatAlert(alert)}\n\nI'll message you with updates. Say /alerts to manage.`);
      return true;
    }
  }

  return false;
}

// Run a scheduled alert with change detection
async function runScheduledAlert(alert: ScheduledAlert): Promise<void> {
  const apiKey = await getValidMinoToken(alert.phone);
  if (!apiKey) {
    console.log(`⚠️ No Mino API key for alert ${alert.id}`);
    return;
  }

  console.log(`⏰ Running alert: ${alert.name}`);

  try {
    const result = await runMinoAutomation(apiKey, alert.url, alert.goal);
    const { text, data } = formatMinoForIMessage(result, alert.url, alert.goal);

    // Check if result changed (returns { changed, alert })
    const { changed } = scheduler.updateAlertAfterRun(alert.id, text);

    // Only notify if data changed OR this is the first run
    if (changed || !alert.lastResult) {
      const changeIndicator = alert.lastResult
        ? "🆕 Change detected!\n\n"
        : "";
      await iMessage.send(alert.phone, `🔔 ${alert.name}\n\n${changeIndicator}${text}`);
      console.log(`📤 Sent alert result to ${alert.phone} (changed: ${changed})`);
    } else {
      console.log(`📤 Alert ${alert.name} - no change, skipping notification`);
    }

  } catch (err) {
    console.error(`Alert ${alert.id} failed:`, err);
    scheduler.updateAlertAfterRun(alert.id, `Error: ${err}`);
  }
}

// Check if user wants image generation
async function handleImageGenRequest(sender: string, text: string): Promise<boolean> {
  const pending = pendingImageGen.get(sender);
  if (!pending) return false;

  const textLower = text.toLowerCase().trim();
  if (textLower === "yes" || textLower === "card" || textLower === "y") {
    pendingImageGen.delete(sender);
    await iMessage.send(sender, "🎨 Generating visual card...");

    try {
      const cardStyle = detectCardStyle(pending.data, pending.goal);
      if (cardStyle) {
        const cardPath = await generateDataCard(pending.data, pending.goal, cardStyle);
        if (cardPath) {
          await iMessage.sendFile(sender, cardPath);
          console.log(`🎨 Sent visual card`);
        } else {
          await iMessage.send(sender, "Couldn't generate card, sorry!");
        }
      }
    } catch (err) {
      console.error("Card generation failed:", err);
      await iMessage.send(sender, "Card generation failed");
    }
    return true;
  } else if (textLower === "no" || textLower === "n" || textLower === "skip") {
    pendingImageGen.delete(sender);
    return true;
  }

  return false;
}

// Helper: Check if data has location info
function hasLocationData(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  const str = JSON.stringify(data).toLowerCase();
  return str.includes("address") || str.includes("location") ||
         str.includes("latitude") || str.includes("lat") ||
         str.includes("coordinates");
}

// Helper: Extract location from data
function extractLocation(data: any): { name: string; address: string; lat: number; lng: number; phone?: string; website?: string } | null {
  try {
    // Handle array - take first item
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return null;

    // Look for common location fields
    const name = item.name || item.title || item.business_name || "Location";
    const address = item.address || item.location || item.formatted_address || "";

    // Try to find coordinates
    let lat = item.latitude || item.lat || item.coordinates?.lat;
    let lng = item.longitude || item.lng || item.lon || item.coordinates?.lng;

    // If no coordinates but have address, we can still create a card
    if (!lat || !lng) {
      lat = 0;
      lng = 0;
    }

    if (!address && !lat) return null;

    return {
      name,
      address,
      lat,
      lng,
      phone: item.phone || item.phone_number,
      website: item.website || item.url,
    };
  } catch {
    return null;
  }
}

// Helper: Check if data has event/time info
function hasEventData(data: any, goal: string): boolean {
  const eventKeywords = ["reservation", "booking", "appointment", "event", "show", "concert", "movie"];
  if (eventKeywords.some(k => goal.includes(k))) return true;

  const str = JSON.stringify(data).toLowerCase();
  return str.includes("date") || str.includes("time") || str.includes("when");
}

// Helper: Extract event data
function extractEvent(data: any, goal: string): { title: string; startDate: Date; location?: string; description?: string } | null {
  try {
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return null;

    const title = item.title || item.name || item.event_name || goal;

    // Try to parse date
    let startDate: Date | null = null;
    const dateStr = item.date || item.datetime || item.start_time || item.when;
    if (dateStr) {
      startDate = new Date(dateStr);
      if (isNaN(startDate.getTime())) startDate = null;
    }

    // Default to tomorrow noon if no date found
    if (!startDate) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(12, 0, 0, 0);
    }

    return {
      title,
      startDate,
      location: item.location || item.address || item.venue,
      description: item.description || item.notes,
    };
  } catch {
    return null;
  }
}

// Helper: Check if data has contact info
function hasContactData(data: any): boolean {
  const str = JSON.stringify(data).toLowerCase();
  return str.includes("phone") || str.includes("email") || str.includes("contact");
}

// Helper: Extract contact data
function extractContact(data: any): { name: string; phone?: string; email?: string; company?: string; website?: string } | null {
  try {
    const item = Array.isArray(data) ? data[0] : data;
    if (!item) return null;

    return {
      name: item.name || item.business_name || item.title || "Contact",
      phone: item.phone || item.phone_number,
      email: item.email,
      company: item.company || item.business_name,
      website: item.website || item.url,
    };
  } catch {
    return null;
  }
}

// Helper: Generate relevant deep link
function generateRelevantDeepLink(data: any, goal: string, url: string): string | null {
  // Restaurant/food - Yelp or OpenTable
  if (goal.includes("restaurant") || goal.includes("food") || goal.includes("eat")) {
    const name = Array.isArray(data) ? data[0]?.name : data?.name;
    if (name) {
      return `🔗 Open in Yelp: ${ios.APP_LINKS.yelp(name)}`;
    }
  }

  // Directions
  if (goal.includes("direction") || goal.includes("how to get")) {
    const address = Array.isArray(data) ? data[0]?.address : data?.address;
    if (address) {
      return `🗺️ Get directions: ${ios.APP_LINKS.maps(address)}`;
    }
  }

  // Music
  if (goal.includes("music") || goal.includes("song") || goal.includes("album")) {
    const name = Array.isArray(data) ? data[0]?.name : data?.name;
    if (name) {
      return `🎵 Listen on Spotify: ${ios.APP_LINKS.spotify(name)}`;
    }
  }

  // Ride
  if (goal.includes("uber") || goal.includes("lyft") || goal.includes("ride")) {
    const address = Array.isArray(data) ? data[0]?.address : data?.address;
    return `🚗 Get a ride: ${ios.APP_LINKS.uber(undefined, address)}`;
  }

  return null;
}

// Detect the best card style for the data
function detectCardStyle(data: any, goal: string): "menu" | "list" | "info" | "comparison" | null {
  const goalLower = goal.toLowerCase();

  // Check for menu-like data
  if (goalLower.includes("menu") || goalLower.includes("food") || goalLower.includes("drink")) {
    return "menu";
  }

  // Check for comparison data
  if (goalLower.includes("compare") || goalLower.includes("vs") || goalLower.includes("difference")) {
    return "comparison";
  }

  // Check if data is a list/array with multiple items
  if (Array.isArray(data) && data.length >= 3) {
    return "list";
  }

  // Check for nested arrays (like categorized data)
  if (typeof data === "object" && Object.values(data).some(v => Array.isArray(v) && (v as any[]).length >= 3)) {
    return "list";
  }

  // For now, skip card generation for simple data
  return null;
}

// Smart goal extraction from natural language
function extractGoalFromText(text: string): string | undefined {
  const patterns = [
    // "availability of Winter Bliss on..."
    /availability\s+of\s+(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
    // "when Winter Bliss is available..."
    /when\s+(?:the\s+)?(.+?)\s+(?:is|are|becomes?)\s+available/i,
    // "if Winter Bliss is back..."
    /if\s+(?:the\s+)?(.+?)\s+(?:is|are)\s+(?:back|available|in stock)/i,
    // "check for Winter Bliss..."
    /check\s+(?:for\s+)?(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
    // "monitor Winter Bliss..."
    /monitor\s+(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
    // "notify me when Winter Bliss..."
    /notify\s+(?:me\s+)?(?:when|if)\s+(?:the\s+)?(.+?)\s+(?:is|are|becomes?)/i,
    // "alert me about Winter Bliss..."
    /alert\s+(?:me\s+)?(?:about|for|when)\s+(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
    // "track Winter Bliss..."
    /track\s+(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
    // "watch for Winter Bliss..."
    /watch\s+(?:for\s+)?(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
    // "let me know when/if..."
    /let\s+me\s+know\s+(?:when|if)\s+(?:the\s+)?(.+?)\s+(?:is|are|becomes?)/i,
    // "update me on Winter Bliss..."
    /update\s+me\s+(?:on|about)\s+(?:the\s+)?(.+?)(?:\s+(?:on|at|from|every|daily|weekly|hourly))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let goal = match[1].trim();
      // Clean up common words that might get captured
      goal = goal.replace(/\s+(on|at|from|every|daily|weekly|hourly).*$/i, "");
      // Clean up trailing punctuation
      goal = goal.replace(/[,.!?]+$/, "").trim();
      if (goal.length > 2) {
        return `Check availability of ${goal}`;
      }
    }
  }

  return undefined;
}

// Detect natural language alert requests
interface AlertMatch {
  type: "create" | "update";
  schedule?: string;
  hasSchedule: boolean;
}

function detectAlertRequest(text: string): AlertMatch | null {
  const textLower = text.toLowerCase();
  console.log(`🔍 Checking for alert keywords in: "${textLower.slice(0, 50)}..."`);

  // Keywords that suggest alert creation
  const alertKeywords = [
    "set an alert",
    "set up an alert",
    "create an alert",
    "alert me",
    "notify me",
    "update me",
    "remind me",
    "let me know",
    "check for me",
    "monitor",
    "keep me updated",
    "keep me posted",
  ];

  // Schedule keywords
  const schedulePatterns = [
    /every\s*(morning|evening|night|day|hour|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /every\s*(\d+)\s*(min|hour|day|week)/i,
    /daily\s*(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /at\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /twice\s*(?:a\s*)?day/i,
    /hourly/i,
    /weekly/i,
  ];

  // Check if message contains alert keywords
  const hasAlertKeyword = alertKeywords.some(keyword => textLower.includes(keyword));

  if (!hasAlertKeyword) {
    console.log(`   ↳ No alert keywords found`);
    return null;
  }

  console.log(`   ↳ Alert keyword found!`);
  // Check for schedule in the message
  let schedule: string | undefined;
  for (const pattern of schedulePatterns) {
    const match = text.match(pattern);
    if (match) {
      schedule = match[0];
      break;
    }
  }

  console.log(`   ↳ Schedule found: ${schedule || "none"}`);
  return {
    type: "create",
    schedule,
    hasSchedule: !!schedule,
  };
}

// Handle natural language alert creation
async function handleNaturalAlertRequest(
  sender: string,
  text: string,
  alertMatch: AlertMatch
): Promise<void> {
  console.log(`📅 Handling natural alert request from ${sender}`);
  console.log(`   ↳ alertMatch:`, JSON.stringify(alertMatch));

  // Get the last Mino result for context
  const lastResult = getLastMinoResult(sender);
  console.log(`   ↳ lastResult:`, lastResult ? `${lastResult.url}` : "none");

  // Try to extract URL from the text itself
  const urlMatch = text.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/\S*)?/i);
  let extractedUrl: string | undefined;
  let extractedGoal: string | undefined;

  if (urlMatch) {
    extractedUrl = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
    console.log(`   ↳ extractedUrl:`, extractedUrl);

    // Smarter goal extraction with multiple patterns
    extractedGoal = extractGoalFromText(text);
    if (extractedGoal) {
      console.log(`   ↳ extractedGoal:`, extractedGoal);
    }
  }

  // If user provided URL in their message, use that
  if (extractedUrl && alertMatch.schedule) {
    const domain = new URL(extractedUrl).hostname.replace("www.", "");
    const goal = extractedGoal || `Check ${domain}`;
    const scheduleInfo = scheduler.parseSchedule(alertMatch.schedule);

    if (scheduleInfo) {
      // Create the alert directly!
      const alertName = generateAlertName(goal, domain);
      const alert = scheduler.createAlert(
        sender,
        alertName,
        extractedUrl,
        goal,
        scheduleInfo.cron
      );

      await iMessage.send(sender, `✅ Alert created!\n\n${scheduler.formatAlert(alert)}\n\nI'll message you with updates. Say /alerts to manage.`);
      console.log(`📅 Created alert "${alertName}" for ${sender} (from natural language)`);
      return;
    }
  }

  // If we have URL but no schedule, start setup at schedule step
  if (extractedUrl) {
    const domain = new URL(extractedUrl).hostname.replace("www.", "");
    const goal = extractedGoal || `Check ${domain}`;

    scheduler.startAlertSetup(sender);
    scheduler.updatePendingSetup(sender, { url: extractedUrl, goal, step: "schedule" });
    await iMessage.send(sender, `📅 Got it! I'll monitor ${domain} for "${goal}"\n\n${scheduler.getScheduleOptions()}`);
    return;
  }

  if (!lastResult) {
    // No recent Mino result and no URL in message - ask what to monitor
    await iMessage.send(sender, `📅 I'd love to set up an alert for you!\n\nWhat would you like me to monitor?\n(Send a URL or describe what you want to check)`);
    scheduler.startAlertSetup(sender);
    if (alertMatch.schedule) {
      // Store the schedule they mentioned for later
      scheduler.updatePendingSetup(sender, { step: "url" });
    }
    return;
  }

  // We have context from the last Mino request
  const { url, goal, data } = lastResult;
  const domain = new URL(url).hostname.replace("www.", "");

  // Parse schedule if provided
  let scheduleInfo: { cron: string; description: string } | null = null;
  if (alertMatch.schedule) {
    scheduleInfo = scheduler.parseSchedule(alertMatch.schedule);
  }

  if (!scheduleInfo) {
    // Have URL/goal but need schedule
    await iMessage.send(sender, `📅 Got it! I'll monitor ${domain} for: "${goal.slice(0, 50)}${goal.length > 50 ? "..." : ""}"\n\n${scheduler.getScheduleOptions()}`);
    scheduler.startAlertSetup(sender);
    scheduler.updatePendingSetup(sender, { url, goal, step: "schedule" });
    return;
  }

  // We have everything - create the alert!
  const alertName = generateAlertName(goal, domain);
  const alert = scheduler.createAlert(
    sender,
    alertName,
    url,
    goal,
    scheduleInfo.cron
  );

  await iMessage.send(sender, `✅ Alert created!\n\n${scheduler.formatAlert(alert)}\n\nI'll message you with updates. Say /alerts to manage.`);
  console.log(`📅 Created alert "${alertName}" for ${sender}`);
}

// Generate a short alert name from the goal
function generateAlertName(goal: string, domain: string): string {
  // Common patterns to extract meaningful names
  const patterns = [
    /(?:check|find|get|look for|monitor)\s+(?:the\s+)?(.{3,30}?)(?:\s+(?:at|from|on)\s+|$)/i,
    /(?:holiday|seasonal|new|available)\s+(.{3,20})/i,
  ];

  for (const pattern of patterns) {
    const match = goal.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Capitalize first letter
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }

  // Fallback: use domain + first few words
  const words = goal.split(" ").slice(0, 3).join(" ");
  return `${domain}: ${words}`;
}

// Send aggregated morning brief
async function sendMorningBrief(phone: string, alerts: ScheduledAlert[]): Promise<void> {
  const profile = userModel.getOrCreateProfile(phone);
  const greeting = userModel.getPersonalizedGreeting(phone);

  console.log(`☀️ Generating morning brief for ${phone} (${alerts.length} alerts)`);

  // Run all alerts and collect results
  const results: Array<{ alert: ScheduledAlert; text: string; changed: boolean }> = [];

  for (const alert of alerts) {
    const apiKey = await getValidMinoToken(alert.phone);
    if (!apiKey) continue;

    try {
      const result = await runMinoAutomation(apiKey, alert.url, alert.goal);
      const { text } = formatMinoForIMessage(result, alert.url, alert.goal);
      const { changed } = scheduler.updateAlertAfterRun(alert.id, text);
      results.push({ alert, text, changed });
    } catch (err) {
      console.error(`Alert ${alert.name} failed:`, err);
      results.push({ alert, text: `❌ Error checking ${alert.name}`, changed: false });
    }
  }

  // Build the morning brief message
  let brief = `${greeting}\n\n☀️ **Your Morning Brief**\n\n`;

  // Highlight changes first
  const changedResults = results.filter(r => r.changed);
  const unchangedResults = results.filter(r => !r.changed);

  if (changedResults.length > 0) {
    brief += `🆕 **What's New:**\n`;
    for (const { alert, text } of changedResults) {
      const shortText = text.length > 150 ? text.slice(0, 150) + "..." : text;
      brief += `• **${alert.name}:** ${shortText}\n\n`;
    }
  }

  if (unchangedResults.length > 0) {
    brief += `📋 **No Changes:**\n`;
    for (const { alert } of unchangedResults) {
      brief += `• ${alert.name} — same as yesterday\n`;
    }
    brief += "\n";
  }

  // Add predictions based on user model
  const predictions = userModel.predictNextTopics(phone);
  if (predictions.length > 0) {
    brief += `\n💡 Might want to check: ${predictions.slice(0, 2).join(", ")}?`;
  }

  brief += `\n\n_Reply anytime if you need anything!_`;

  // Send the brief
  await iMessage.send(phone, brief);

  // If any alerts have long content, offer voice version
  const longResults = results.filter(r => r.text.length > 500);
  if (longResults.length > 0 && profile.totalMessages > 5) {
    await iMessage.send(phone, `🎙️ Want me to read the full ${longResults[0].alert.name} update as a voice message?`);
  }

  console.log(`✅ Sent morning brief to ${phone}`);
}

// Start the bot
async function main() {
  console.log(`
╔═══════════════════════════════════════════╗
║     iMessage AI Assistant                 ║
║                                           ║
║  🤖 Gemini 2.5 Flash (Agentic)            ║
║  🌐 Mino browser automation               ║
╚═══════════════════════════════════════════╝
  `);

  // Start OAuth server
  await startOAuthServer();

  // Start scheduler for alerts
  scheduler.setSchedulerCallback(runScheduledAlert);
  scheduler.setMorningBriefCallback(sendMorningBrief);
  scheduler.startScheduler();

  // Mino connection callback
  setMinoConnectedCallback(async (phone: string) => {
    try {
      await iMessage.send(phone, "✅ Mino connected! I can now browse websites for you.");
    } catch (error) {
      console.error(`Failed to send Mino confirmation:`, error);
    }
  });

  if (ALLOWED_CONTACTS.length > 0) {
    console.log(`🔒 Allowed: ${ALLOWED_CONTACTS.join(", ")}`);
  } else {
    console.log(`⚠️ No ALLOWED_CONTACTS - responding to everyone!`);
  }

  console.log(`\n👀 Watching for messages...\n`);

  // Watch for messages
  await iMessage.startWatching({
    onNewMessage: handleMessage,
    onGroupMessage: handleMessage,
    onError: (error) => console.error("Watcher error:", error),
  });

  // Notify on startup
  const NOTIFY_PHONE = "+14156836861";
  try {
    await iMessage.send(NOTIFY_PHONE, "🤖 Mino bot restarted and ready!");
    console.log(`✅ Sent startup notification to ${NOTIFY_PHONE}`);
  } catch (err) {
    console.error("Failed to send startup notification:", err);
  }
}

main().catch(console.error);
