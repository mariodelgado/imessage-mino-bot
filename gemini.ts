/**
 * Gemini Agentic Chain with iMessage Features
 *
 * Flow:
 * 1. Router - analyzes query, decides action
 * 2. Search Agent - Google Search grounding
 * 3. Mino Agent - browser automation
 * 4. Chat Agent - conversational responses with iMessage features
 */

import {
  VertexAI,
  FunctionDeclarationSchemaType,
  HarmCategory,
  HarmBlockThreshold,
  Content,
  GenerativeModel,
} from "@google-cloud/vertexai";
import { getUserByPhone, isNewUser, updateUserName } from "./db";

// Conversation history per contact
const conversationHistory = new Map<string, Content[]>();
const MAX_HISTORY = 20;

// Debug mode per contact
const debugMode = new Map<string, boolean>();

// Last Mino result per contact (for follow-up questions)
const lastMinoResult = new Map<string, { url: string; goal: string; data: any }>();

export function setLastMinoResult(contactId: string, url: string, goal: string, data: any) {
  lastMinoResult.set(contactId, { url, goal, data });
}

export function getLastMinoResult(contactId: string) {
  return lastMinoResult.get(contactId);
}

export function toggleDebug(contactId: string): boolean {
  const current = debugMode.get(contactId) || false;
  debugMode.set(contactId, !current);
  return !current;
}

export function isDebugEnabled(contactId: string): boolean {
  // Debug ON by default for now
  return debugMode.get(contactId) ?? true;
}

let vertexAI: VertexAI | null = null;

// ============================================================================
// TYPES
// ============================================================================

type ActionType = "chat" | "mino";

interface RouterDecision {
  action: ActionType;
  reasoning: string;
  searchQuery?: string;
  minoUrl?: string;
  minoGoal?: string;
}

export interface ChatResult {
  text: string;
  minoRequest?: {
    url: string;
    goal: string;
  };
  debugLog?: string;
}

// ============================================================================
// iMESSAGE FEATURES CONTEXT
// ============================================================================


// ============================================================================
// MODEL GETTERS
// ============================================================================

// Model to use across all agents
const GEMINI_MODEL = "gemini-2.5-flash";

function getRouterModel(): GenerativeModel {
  if (!vertexAI) throw new Error("Vertex AI not initialized");

  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
    },
  });
}

function getSearchModel(): GenerativeModel {
  if (!vertexAI) throw new Error("Vertex AI not initialized");

  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    },
  });
}

function getMinoModel(): GenerativeModel {
  if (!vertexAI) throw new Error("Vertex AI not initialized");

  const minoTool = {
    functionDeclarations: [{
      name: "browse_website",
      description: "Browse a website to extract data or perform actions",
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
          url: { type: FunctionDeclarationSchemaType.STRING, description: "Website URL" },
          goal: { type: FunctionDeclarationSchemaType.STRING, description: "What to do" },
        },
        required: ["url", "goal"],
      },
    }],
  };

  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [minoTool],
    generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
  });
}

function getChatModel(phone: string): GenerativeModel {
  if (!vertexAI) throw new Error("Vertex AI not initialized");

  const user = getUserByPhone(phone);
  const isNew = isNewUser(phone);

  let systemInstruction = `You are Mino, a friendly AI assistant on iMessage.
Keep responses concise (under 500 chars) - this is texting!
Be warm, personable. Match the user's energy.

`;

  if (isNew) {
    systemInstruction += `This is a NEW user! Introduce yourself warmly. Ask for their name.
Example: "Hey! 👋 I'm Mino, your AI assistant. I can answer questions, look up info, browse websites, and more. What's your name?"
`;
  } else if (user?.name) {
    systemInstruction += `User's name: ${user.name}. Address them by name naturally in your responses.\n`;
  }

  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    safetySettings: [{
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  });
}

// ============================================================================
// AGENT FUNCTIONS
// ============================================================================

async function routerAgent(phone: string, message: string, history: Content[]): Promise<RouterDecision> {
  const debug = isDebugEnabled(phone);
  if (debug) {
    console.log(`\n┌─────────────────────────────────────┐`);
    console.log(`│ 🐟 ROUTER → analyzing message...    │`);
    console.log(`└─────────────────────────────────────┘`);
  }

  const user = getUserByPhone(phone);
  const isNew = isNewUser(phone);
  const routerModel = getRouterModel();

  const prompt = `Analyze this message and decide the action.

USER: ${isNew ? "NEW" : user?.name || "returning"}
HISTORY: ${history.length} messages
MESSAGE: "${message}"

ACTIONS:
1. "chat" - ONLY for greetings, chitchat, name sharing, or questions you can answer from memory
2. "mino" - MUST use for ANY factual lookup: hours, prices, menus, availability, reservations, weather, news, restaurant info, product info, etc. Generate a SPECIFIC website URL (NOT google.com).

IMPORTANT: If the user asks for real-world data (hours, prices, what's open, recommendations), you MUST use "mino" with a direct URL to the source (e.g., yelp.com, opentable.com, the restaurant's website).

JSON response:
{
  "action": "chat" | "mino",
  "reasoning": "brief reason",
  "minoUrl": "direct URL to data source (NOT google.com)",
  "minoGoal": "what to extract from the page"
}`;

  try {
    const result = await routerModel.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(`🔀 Router raw response: ${text}`);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (debug) console.log(`   ↳ Decision: ${parsed.action.toUpperCase()} - ${parsed.reasoning}`);
      return parsed;
    }
    console.log(`⚠️ Router: No JSON found in response`);
  } catch (error) {
    console.error("Router error:", error);
  }

  // Default to mino for any data-like request
  const looksLikeDataRequest = /best|top|find|search|what|where|when|hours|price|menu|open|available/i.test(message);
  if (looksLikeDataRequest) {
    console.log(`🔀 Router fallback: treating as mino request`);
    return { action: "mino", reasoning: "data request fallback" };
  }

  return { action: "chat", reasoning: "fallback" };
}

async function searchAgent(query: string, phone: string): Promise<string> {
  const debug = isDebugEnabled(phone);
  if (debug) {
    console.log(`├─────────────────────────────────────┤`);
    console.log(`│ 🐟 SEARCH → grounding query...      │`);
    console.log(`│    "${query.substring(0, 30)}${query.length > 30 ? '...' : ''}"`)
    console.log(`├─────────────────────────────────────┤`);
  }

  const searchModel = getSearchModel();

  const prompt = `Search for: ${query}

Provide a brief, conversational summary (2-3 sentences max) as if texting a friend.`;

  try {
    const result = await searchModel.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (debug) console.log(`   ↳ Result: ${text.substring(0, 60)}...`);
    return text;
  } catch (error) {
    console.error("Search error:", error);
    return "Couldn't search right now, sorry!";
  }
}

async function minoAgent(message: string, phone: string): Promise<{ url: string; goal: string } | null> {
  const debug = isDebugEnabled(phone);
  if (debug) {
    console.log(`├─────────────────────────────────────┤`);
    console.log(`│ 🐟 MINO → planning browser task...  │`);
    console.log(`├─────────────────────────────────────┤`);
  }

  const minoModel = getMinoModel();

  try {
    const result = await minoModel.generateContent(
      `User wants: "${message}"\n\nCall browse_website with the best URL and goal.`
    );
    const parts = result.response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.functionCall?.name === "browse_website") {
        const args = part.functionCall.args as { url: string; goal: string };
        if (debug) {
          console.log(`   ↳ URL: ${args.url}`);
          console.log(`   ↳ Goal: ${args.goal}`);
        }
        return args;
      }
    }
  } catch (error) {
    console.error("Mino agent error:", error);
  }

  return null;
}

async function chatAgent(
  phone: string,
  message: string,
  history: Content[],
  searchResult?: string
): Promise<ChatResult> {
  const debug = isDebugEnabled(phone);
  if (debug) {
    console.log(`├─────────────────────────────────────┤`);
    console.log(`│ 🐟 CHAT → generating response...    │`);
    console.log(`└─────────────────────────────────────┘`);
  }

  const chatModel = getChatModel(phone);

  // Check for name sharing
  const nameMatch = message.match(/(?:i'm|im|i am|my name is|call me|it's|its)\s+([a-zA-Z]+)/i);
  if (nameMatch) {
    updateUserName(phone, nameMatch[1]);
    console.log(`📝 Saved name: ${nameMatch[1]}`);
  }

  const chat = chatModel.startChat({ history });

  let prompt = message;
  if (searchResult) {
    prompt = `[Search result: ${searchResult}]\n\nUser: ${message}\n\nRespond naturally with the info.`;
  }

  try {
    const result = await chat.sendMessage(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text: text || "Hmm, not sure what to say!" };
  } catch (error) {
    console.error("Chat error:", error);
    return { text: "Sorry, having a moment! Try again?" };
  }
}

// ============================================================================
// MAIN CHAT FUNCTION
// ============================================================================

export async function chat(contactId: string, message: string): Promise<ChatResult> {
  if (!vertexAI) {
    return { text: "❌ Not connected to Gemini. Check setup!" };
  }

  const debug = isDebugEnabled(contactId);
  let debugLog = "";

  try {
    let history = conversationHistory.get(contactId) || [];

    // Router decision
    if (debug) debugLog += "🐟 ROUTER → analyzing...\n";
    const decision = await routerAgent(contactId, message, history);
    if (debug) debugLog += `   ↳ ${decision.action.toUpperCase()}: ${decision.reasoning}\n`;

    let result: ChatResult;

    switch (decision.action) {
      case "mino": {
        if (debug) debugLog += "🐟 MINO → generating URL...\n";
        // Use router's URL/goal if provided, otherwise generate
        const minoParams = decision.minoUrl && decision.minoGoal
          ? { url: decision.minoUrl, goal: decision.minoGoal }
          : await minoAgent(message, contactId);

        if (minoParams) {
          if (debug) debugLog += `   ↳ URL: ${minoParams.url}\n   ↳ Goal: ${minoParams.goal}\n`;
          result = { text: "", minoRequest: minoParams };
        } else {
          if (debug) debugLog += "   ↳ No URL generated, falling back to chat\n";
          result = await chatAgent(contactId, message, history);
        }
        break;
      }

      default: {
        if (debug) debugLog += "🐟 CHAT → generating response...\n";
        result = await chatAgent(contactId, message, history);
      }
    }

    // Update history
    history.push({ role: "user", parts: [{ text: message }] });
    if (result.text) {
      history.push({ role: "model", parts: [{ text: result.text }] });
    }

    if (history.length > MAX_HISTORY * 2) {
      history = history.slice(-MAX_HISTORY * 2);
    }
    conversationHistory.set(contactId, history);

    // Attach debug log if enabled
    if (debug && debugLog) {
      result.debugLog = debugLog;
    }

    return result;

  } catch (error) {
    console.error("Chat chain error:", error);
    return { text: "Oops! Something went wrong. Try again?" };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

export function initGemini(apiKey: string) {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION || "us-central1";

  if (!projectId) {
    console.error("❌ GCP_PROJECT_ID not set");
    return;
  }

  try {
    vertexAI = new VertexAI({ project: projectId, location });
    console.log(`✅ Vertex AI initialized (${projectId})`);
  } catch (error) {
    console.error("❌ Vertex AI init failed:", error);
  }
}

export function addMinoResultToHistory(contactId: string, result: string) {
  let history = conversationHistory.get(contactId) || [];
  history.push({ role: "model", parts: [{ text: result }] });
  if (history.length > MAX_HISTORY * 2) {
    history = history.slice(-MAX_HISTORY * 2);
  }
  conversationHistory.set(contactId, history);
}

export function clearHistory(contactId: string) {
  conversationHistory.delete(contactId);
}

export function clearAllHistory() {
  conversationHistory.clear();
}
