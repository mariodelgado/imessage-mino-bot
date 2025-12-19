/**
 * iMessage Mino Bot
 *
 * A personal AI assistant via iMessage with:
 * - Gemini 2.0 Flash with automatic web search
 * - Mino runs automatically when needed
 */

import { IMessageSDK, type Message } from "@photon-ai/imessage-kit";
import { runMinoAutomation, type MinoResult } from "./mino";
import { initGemini, chat, clearHistory, addMinoResultToHistory } from "./gemini";

// Load environment variables
const MINO_API_KEY = process.env.MINO_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const ALLOWED_CONTACTS = (process.env.ALLOWED_CONTACTS || "").split(",").filter(Boolean);

// Validate config
if (!MINO_API_KEY) {
  console.error("❌ MINO_API_KEY not set");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

// Initialize Gemini
initGemini(GEMINI_API_KEY);

// Initialize iMessage SDK
const iMessage = new IMessageSDK({
  debug: true,
});

// Help text
const HELP_TEXT = `🤖 iMessage AI Assistant

Just chat naturally! I use Gemini 2.0 Flash.

When you need real-time web info (prices, weather, news), I'll automatically search the web for you using Mino.

Commands:
/clear - Clear conversation history
/help - Show this message`;

// Format Mino results for iMessage (clean, visual)
function formatMinoForIMessage(result: MinoResult, url: string, goal: string): string {
  if (result.status === "error") {
    return `❌ Couldn't search ${url}\n${result.error}`;
  }

  let output = `🔍 ${goal}\n`;
  output += `━━━━━━━━━━━━━━━━\n`;

  if (result.result) {
    try {
      const parsed = JSON.parse(result.result);

      // Handle array results (lists of items)
      if (parsed.result && Array.isArray(parsed.result)) {
        parsed.result.slice(0, 5).forEach((item: any, i: number) => {
          if (typeof item === "string") {
            output += `${i + 1}. ${item}\n`;
          } else if (item.title || item.name) {
            output += `${i + 1}. ${item.title || item.name}`;
            if (item.price) output += ` - ${item.price}`;
            if (item.url) output += `\n   ${item.url}`;
            output += "\n";
          } else {
            output += `${i + 1}. ${JSON.stringify(item)}\n`;
          }
        });
        if (parsed.result.length > 5) {
          output += `\n+${parsed.result.length - 5} more results`;
        }
      }
      // Handle object results
      else if (typeof parsed === "object") {
        // Check for common patterns
        if (parsed.temperature || parsed.weather) {
          // Weather result
          if (parsed.temperature) output += `🌡️ ${parsed.temperature}\n`;
          if (parsed.weather || parsed.condition) output += `${parsed.weather || parsed.condition}\n`;
          if (parsed.humidity) output += `💧 Humidity: ${parsed.humidity}\n`;
          if (parsed.wind) output += `💨 Wind: ${parsed.wind}\n`;
        } else if (parsed.price || parsed.title) {
          // Product result
          if (parsed.title) output += `📦 ${parsed.title}\n`;
          if (parsed.price) output += `💰 ${parsed.price}\n`;
          if (parsed.rating) output += `⭐ ${parsed.rating}\n`;
          if (parsed.url) output += `🔗 ${parsed.url}\n`;
        } else {
          // Generic object - format nicely
          Object.entries(parsed).slice(0, 6).forEach(([key, value]) => {
            if (value && typeof value !== "object") {
              const emoji = getEmojiForKey(key);
              output += `${emoji} ${formatKey(key)}: ${value}\n`;
            }
          });
        }
      } else {
        output += parsed;
      }
    } catch {
      // Not JSON, just use the raw result
      // Truncate if too long for iMessage
      const maxLen = 800;
      if (result.result.length > maxLen) {
        output += result.result.slice(0, maxLen) + "...";
      } else {
        output += result.result;
      }
    }
  } else {
    output += "No results found.";
  }

  output += `\n━━━━━━━━━━━━━━━━\n`;
  output += `📍 ${url}`;

  return output;
}

// Helper to get emoji for common data keys
function getEmojiForKey(key: string): string {
  const emojiMap: Record<string, string> = {
    price: "💰",
    cost: "💰",
    title: "📦",
    name: "📝",
    rating: "⭐",
    score: "⭐",
    temperature: "🌡️",
    temp: "🌡️",
    weather: "🌤️",
    humidity: "💧",
    wind: "💨",
    date: "📅",
    time: "🕐",
    location: "📍",
    url: "🔗",
    link: "🔗",
    description: "📄",
    summary: "📄",
    stock: "📈",
    available: "✅",
    unavailable: "❌",
  };
  return emojiMap[key.toLowerCase()] || "•";
}

// Helper to format keys nicely
function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// Process incoming messages
async function handleMessage(message: Message) {
  const text = message.text?.trim();
  const sender = message.sender || "unknown";

  if (!text) return;

  // Security: check if sender is allowed (if configured)
  if (ALLOWED_CONTACTS.length > 0 && !ALLOWED_CONTACTS.includes(sender)) {
    console.log(`⚠️ Blocked message from unauthorized: ${sender}`);
    return;
  }

  console.log(`📨 From ${sender}: ${text}`);

  let response: string;

  try {
    // Route message
    if (text.toLowerCase() === "/help") {
      response = HELP_TEXT;
    } else if (text.toLowerCase() === "/clear") {
      clearHistory(sender);
      response = "🗑️ Conversation cleared!";
    } else {
      // Chat with Gemini - it decides if web search is needed
      const result = await chat(sender, text);

      if (result.minoRequest) {
        // Gemini wants to search the web - run Mino
        let url = result.minoRequest.url;
        const goal = result.minoRequest.goal;

        // Add protocol if missing
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }

        console.log(`🌐 Mino search: ${url} - ${goal}`);

        // Send "searching" message immediately
        await iMessage.send({
          to: sender,
          text: `🔍 Searching ${url.replace("https://", "").replace("http://", "")}...`,
        });

        // Run Mino
        const minoResult = await runMinoAutomation(MINO_API_KEY, url, goal);

        // Format result for iMessage
        response = formatMinoForIMessage(minoResult, url, goal);

        // Add to conversation history so Gemini knows what happened
        addMinoResultToHistory(sender, response);
      } else {
        // Regular text response from Gemini
        response = result.text || "🤔 I'm not sure how to respond to that.";
      }
    }
  } catch (error) {
    console.error("Error handling message:", error);
    response = `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }

  // Only send if we have a response
  if (!response) {
    console.log("No response to send");
    return;
  }

  // Send response
  try {
    await iMessage.send({
      to: sender,
      text: response,
    });
    console.log(`📤 Sent response to ${sender}`);
  } catch (error) {
    console.error("Failed to send response:", error);
  }
}

// Start watching for messages
async function main() {
  console.log(`
╔═══════════════════════════════════════════╗
║     iMessage AI Assistant                 ║
║                                           ║
║  🤖 Gemini 2.0 Flash                      ║
║  🌐 Auto web search with Mino             ║
║                                           ║
║  Just chat! Web searches run              ║
║  automatically when needed.               ║
╚═══════════════════════════════════════════╝
  `);

  if (ALLOWED_CONTACTS.length > 0) {
    console.log(`🔒 Allowed contacts: ${ALLOWED_CONTACTS.join(", ")}`);
  } else {
    console.log(`⚠️ No ALLOWED_CONTACTS set - responding to everyone!`);
  }

  console.log(`\n👀 Watching for new messages...\n`);

  // Watch for new messages
  await iMessage.startWatching({
    onNewMessage: handleMessage,
    onGroupMessage: handleMessage,
    onError: (error) => console.error("Watcher error:", error),
  });
}

main().catch(console.error);
