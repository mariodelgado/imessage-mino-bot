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
import userModel from "./user-model";
import mira from "./mira";

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
  // Debug OFF by default - user can enable with /debug
  return debugMode.get(contactId) ?? false;
}

let vertexAI: VertexAI | null = null;

// ============================================================================
// GUARDRAILS
// ============================================================================

interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  response?: string;
}

/**
 * Content guardrails to filter inappropriate requests
 * Returns a friendly deflection if content should be blocked
 */
export function checkGuardrails(message: string): GuardrailResult {
  const messageLower = message.toLowerCase();

  // Explicit content / sexual
  const sexualPatterns = [
    /\b(porn|xxx|nude|naked|sex|f[*u]ck|d[*i]ck|c[*o]ck|p[*u]ssy|ass(?:hole)?|tits?|boob|blowjob|handjob|masturbat|orgasm|erotic|horny|slutt?y?|whor[e]?|cum(?:shot)?)\b/i,
    /send\s*(?:me\s*)?(?:a\s*)?(?:nude|pic|photo|image)/i,
    /(?:role\s*play|pretend|act\s*as)\s*(?:my|a)\s*(?:girl|boy)friend/i,
  ];

  for (const pattern of sexualPatterns) {
    if (pattern.test(messageLower)) {
      return {
        blocked: true,
        reason: "sexual_content",
        response: "I'm not able to help with that kind of request. Is there something else I can help you with?",
      };
    }
  }

  // Violence / harmful
  const violencePatterns = [
    /\b(kill|murder|bomb|explod|attack|terroris|shoot(?:ing)?|stab|hurt|harm|weapon|gun|knife)\b.*\b(person|people|someone|human|child|school|crowd)/i,
    /how\s+to\s+(?:make|build|create)\s+(?:a\s+)?(?:bomb|weapon|poison|explosive)/i,
    /(?:want|going)\s+to\s+(?:kill|hurt|harm|attack)/i,
  ];

  for (const pattern of violencePatterns) {
    if (pattern.test(messageLower)) {
      return {
        blocked: true,
        reason: "violence",
        response: "I can't help with anything that could cause harm. If you're having a tough time, please reach out to a crisis helpline.",
      };
    }
  }

  // Illegal activities
  const illegalPatterns = [
    /how\s+to\s+(?:hack|steal|break\s+into|bypass)/i,
    /\b(drug\s*deal|sell\s*drugs?|buy\s*(?:cocaine|heroin|meth|fentanyl))\b/i,
    /\b(child\s*porn|cp|underage)\b/i,
    /how\s+to\s+(?:counterfeit|forge|fake)\s+(?:money|id|passport|document)/i,
  ];

  for (const pattern of illegalPatterns) {
    if (pattern.test(messageLower)) {
      return {
        blocked: true,
        reason: "illegal",
        response: "I'm not able to help with that. Let me know if there's something else I can assist with!",
      };
    }
  }

  // Self-harm
  const selfHarmPatterns = [
    /(?:want|going|plan(?:ning)?)\s+to\s+(?:kill|hurt|harm)\s+(?:my)?self/i,
    /\b(suicide|suicidal|end\s+my\s+life|cut\s+my(?:self)?)\b/i,
    /how\s+to\s+(?:kill|hurt)\s+myself/i,
  ];

  for (const pattern of selfHarmPatterns) {
    if (pattern.test(messageLower)) {
      return {
        blocked: true,
        reason: "self_harm",
        response: "I'm concerned about you. Please reach out to the 988 Suicide & Crisis Lifeline (call/text 988) or Crisis Text Line (text HOME to 741741). You matter. 💙",
      };
    }
  }

  // Harassment / doxxing
  const harassmentPatterns = [
    /(?:find|get|leak)\s+(?:someone'?s?|their)\s+(?:address|phone|personal\s+info)/i,
    /\b(dox|doxx|swat)\b/i,
    /stalk(?:ing)?\s+(?:someone|them|her|him)/i,
  ];

  for (const pattern of harassmentPatterns) {
    if (pattern.test(messageLower)) {
      return {
        blocked: true,
        reason: "harassment",
        response: "I can't help with finding personal information about others. Respecting privacy is important!",
      };
    }
  }

  // Jailbreak attempts
  const jailbreakPatterns = [
    /ignore\s+(?:your|all|previous)\s+(?:instructions|rules|guidelines)/i,
    /\bDAN\b.*\bdo\s+anything\s+now\b/i,
    /pretend\s+(?:you\s+)?(?:are|have)\s+no\s+(?:rules|restrictions|limits)/i,
    /(?:bypass|override|disable)\s+(?:your\s+)?(?:safety|content\s+filter|restrictions)/i,
  ];

  for (const pattern of jailbreakPatterns) {
    if (pattern.test(messageLower)) {
      return {
        blocked: true,
        reason: "jailbreak",
        response: "Nice try! 😄 I'm here to help with legit requests. What can I actually do for you?",
      };
    }
  }

  return { blocked: false };
}

// ============================================================================
// TYPES
// ============================================================================

type ActionType = "chat" | "mino" | "voice" | "remind" | "homekit" | "alert";

interface RouterDecision {
  action: ActionType;
  reasoning: string;
  searchQuery?: string;
  minoUrl?: string;
  minoGoal?: string;
  // For voice action
  voiceText?: string;
  // For remind action
  remindDelay?: string;
  remindMessage?: string;
  // For homekit action
  sceneName?: string;
  // For alert action
  alertUrl?: string;
  alertGoal?: string;
  alertSchedule?: string;
}

export interface ChatResult {
  text: string;
  action?: ActionType;
  minoRequest?: {
    url: string;
    goal: string;
  };
  voiceRequest?: {
    text: string;
  };
  remindRequest?: {
    delay: string;
    message: string;
  };
  homekitRequest?: {
    scene: string;
  };
  alertRequest?: {
    url: string;
    goal: string;
    schedule: string;
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
    tools: [{ googleSearch: {} } as any],
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

function getChatModel(phone: string, introductionAlreadySent: boolean = false): GenerativeModel {
  if (!vertexAI) throw new Error("Vertex AI not initialized");

  const user = getUserByPhone(phone);
  const isNew = isNewUser(phone);
  const messageCount = userModel.getOrCreateProfile(phone).totalMessages;

  // Get personalization context from user model
  const profile = userModel.getOrCreateProfile(phone);
  const userContext = userModel.getUserContext(phone);
  const responseLength = userModel.getPreferredResponseLength(phone);
  const useEmoji = userModel.shouldUseEmoji(phone);

  // Get MIRA memory context
  const miraContext = mira.getFormattedContext(phone);

  // Dynamic response length based on user preference
  const maxChars = responseLength === "brief" ? 200 : responseLength === "detailed" ? 800 : 500;

  // Core identity: Mino is Mario's AI assistant
  let systemInstruction = `You are Mino, Mario's AI assistant on iMessage.
You help people who text Mario by answering questions, browsing websites for info, and passing along messages.
Keep responses concise (under ${maxChars} chars) - this is texting!
`;

  // Add MIRA memory context if available
  if (miraContext) {
    systemInstruction += `\n${miraContext}\n`;
  }

  // Personalization based on user model
  if (profile.formalityScore < 0.4) {
    systemInstruction += `Be casual and friendly. Use informal language, contractions.\n`;
  } else if (profile.formalityScore > 0.7) {
    systemInstruction += `Be professional and clear. Use proper grammar.\n`;
  } else {
    systemInstruction += `Be warm and personable. Match the user's energy.\n`;
  }

  if (!useEmoji) {
    systemInstruction += `Avoid using emojis unless the user uses them first.\n`;
  }

  // Add user context (name, interests, etc.)
  if (userContext) {
    systemInstruction += `\n${userContext}\n`;
  }

  // Handle new vs. returning users
  if (isNew && !introductionAlreadySent) {
    // First contact - but introduction is handled by handleNewUserIntroduction() in index.ts
    // This branch is a fallback in case the introduction flow is bypassed
    systemInstruction += `\nThis is a NEW user contacting Mario's number for the first time.
Since you've already introduced yourself, focus on being helpful.
If they haven't shared their name yet, you can ask naturally.
`;
  } else if (isNew && messageCount <= 2) {
    // Very early in conversation - introduction was already sent via handleNewUserIntroduction
    systemInstruction += `\nThis user JUST met you. You've already introduced yourself as Mino (Mario's AI assistant).
Now focus on being helpful and answering their question.
If they haven't shared their name yet, you can ask naturally after helping them.
`;
  } else if (user?.name) {
    systemInstruction += `User's name: ${user.name}. Address them by name naturally in your responses.\n`;
  }

  // Dynamic temperature based on formality (more formal = more precise)
  const temperature = profile.formalityScore > 0.6 ? 0.5 : 0.8;

  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    safetySettings: [{
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }],
    generationConfig: {
      temperature,
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
2. "mino" - For ANY factual lookup: hours, prices, menus, availability, weather, news, etc. Generate a SPECIFIC website URL (NOT google.com).
3. "voice" - User wants a voice message/audio message (e.g., "say this in voice", "read this to me", "voice message")
4. "remind" - User wants a reminder in the future (e.g., "remind me in 5 minutes", "set a reminder for tomorrow")
5. "homekit" - User wants to control smart home (e.g., "turn on good night scene", "run morning routine")
6. "alert" - User wants to set up a recurring check/monitoring (e.g., "alert me when...", "notify me every morning")

IMPORTANT: If the user asks for real-world data (hours, prices, what's open, recommendations), you MUST use "mino" with a direct URL.

JSON response (include only relevant fields):
{
  "action": "chat" | "mino" | "voice" | "remind" | "homekit" | "alert",
  "reasoning": "brief reason",
  "minoUrl": "URL for mino action",
  "minoGoal": "what to extract",
  "voiceText": "text to speak for voice action",
  "remindDelay": "5m, 1h, 2d format for remind action",
  "remindMessage": "reminder message",
  "sceneName": "HomeKit scene name for homekit action",
  "alertUrl": "URL for alert action",
  "alertGoal": "what to check for alert",
  "alertSchedule": "every morning, hourly, etc"
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

export async function searchAgent(query: string, phone: string): Promise<string> {
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

// Extract HomeKit scene from natural language
function extractHomeKitScene(message: string): string | null {
  const scenes = [
    { pattern: /good\s*morning/i, scene: "Good Morning" },
    { pattern: /good\s*night/i, scene: "Good Night" },
    { pattern: /(?:i'?m\s+)?leav(?:e|ing)/i, scene: "I'm Leaving" },
    { pattern: /(?:i'?m\s+)?home/i, scene: "I'm Home" },
    { pattern: /movie\s*(?:time|night|mode)?/i, scene: "Movie Time" },
    { pattern: /dinner\s*(?:time|mode)?/i, scene: "Dinner Time" },
    { pattern: /bed\s*(?:time)?/i, scene: "Bedtime" },
    { pattern: /work\s*(?:mode|from\s*home)?/i, scene: "Work Mode" },
    { pattern: /relax(?:ation|ing)?/i, scene: "Relaxation" },
    { pattern: /party\s*(?:mode|time)?/i, scene: "Party Mode" },
  ];

  for (const { pattern, scene } of scenes) {
    if (pattern.test(message)) {
      return scene;
    }
  }

  // Try to extract any quoted scene name
  const quotedMatch = message.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Try to extract scene after keywords
  const keywordMatch = message.match(/(?:run|activate|turn\s*on|trigger)\s+(?:the\s+)?(.+?)(?:\s+scene)?$/i);
  if (keywordMatch) {
    return keywordMatch[1].trim();
  }

  return null;
}

// ============================================================================
// MAIN CHAT FUNCTION
// ============================================================================

export async function chat(contactId: string, message: string): Promise<ChatResult> {
  if (!vertexAI) {
    return { text: "❌ Not connected to Gemini. Check setup!" };
  }

  // Check guardrails first
  const guardrail = checkGuardrails(message);
  if (guardrail.blocked) {
    console.log(`🛡️ Guardrail blocked: ${guardrail.reason}`);
    return { text: guardrail.response || "I can't help with that." };
  }

  const debug = isDebugEnabled(contactId);
  let debugLog = "";

  // Process through MIRA (memory, tools, context)
  const miraResult = mira.processUserMessage(contactId, message, 0.5);
  if (miraResult.activated.length > 0) {
    if (debug) debugLog += `🧠 MIRA tools activated: ${miraResult.activated.map(t => t.name).join(", ")}\n`;
  }
  if (miraResult.expired.length > 0) {
    if (debug) debugLog += `🧠 MIRA tools expired: ${miraResult.expired.join(", ")}\n`;
  }

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
          result = { text: "", action: "mino", minoRequest: minoParams };
        } else {
          if (debug) debugLog += "   ↳ No URL generated, falling back to chat\n";
          result = await chatAgent(contactId, message, history);
        }
        break;
      }

      case "voice": {
        if (debug) debugLog += "🐟 VOICE → generating voice message...\n";
        const voiceText = decision.voiceText || message.replace(/(?:send|make|create)?\s*(?:a\s*)?voice\s*(?:message)?\s*(?:saying|that says|of)?\s*/i, "").trim();
        if (voiceText) {
          result = { text: "", action: "voice", voiceRequest: { text: voiceText } };
        } else {
          result = { text: "What would you like me to say in a voice message?", action: "chat" };
        }
        break;
      }

      case "remind": {
        if (debug) debugLog += "🐟 REMIND → setting reminder...\n";
        if (decision.remindDelay && decision.remindMessage) {
          result = {
            text: "",
            action: "remind",
            remindRequest: { delay: decision.remindDelay, message: decision.remindMessage }
          };
        } else {
          // Try to extract from message
          const remindMatch = message.match(/remind\s+(?:me\s+)?(?:in\s+)?(\d+)\s*(m|min|h|hour|d|day)s?\s+(?:to\s+)?(.+)/i);
          if (remindMatch) {
            const [, amount, unit, msg] = remindMatch;
            result = {
              text: "",
              action: "remind",
              remindRequest: { delay: `${amount}${unit[0]}`, message: msg }
            };
          } else {
            result = { text: "How long from now should I remind you, and what's the reminder?", action: "chat" };
          }
        }
        break;
      }

      case "homekit": {
        if (debug) debugLog += "🐟 HOMEKIT → triggering scene...\n";
        const scene = decision.sceneName || extractHomeKitScene(message);
        if (scene) {
          result = { text: "", action: "homekit", homekitRequest: { scene } };
        } else {
          result = { text: "Which HomeKit scene would you like to run? (e.g., Good Morning, Good Night, I'm Home)", action: "chat" };
        }
        break;
      }

      case "alert": {
        if (debug) debugLog += "🐟 ALERT → creating alert...\n";
        if (decision.alertUrl && decision.alertGoal && decision.alertSchedule) {
          result = {
            text: "",
            action: "alert",
            alertRequest: {
              url: decision.alertUrl,
              goal: decision.alertGoal,
              schedule: decision.alertSchedule
            }
          };
        } else {
          // Let the natural alert flow handle it
          result = { text: "", action: "alert" };
        }
        break;
      }

      default: {
        if (debug) debugLog += "🐟 CHAT → generating response...\n";
        result = await chatAgent(contactId, message, history);
        result.action = "chat";
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

    // Process assistant response through MIRA
    const toolsUsed: string[] = [];
    if (result.action === "mino") toolsUsed.push("mino_browser");
    if (result.action === "voice") toolsUsed.push("voice_message");
    if (result.action === "homekit") toolsUsed.push("homekit");
    if (result.action === "alert") toolsUsed.push("alert_monitor");
    mira.processAssistantResponse(contactId, result.text || "", toolsUsed);

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

export function initGemini(_apiKey: string) {
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
