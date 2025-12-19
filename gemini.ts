/**
 * Gemini API Client with Mino function calling
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Conversation history per contact
const conversationHistory = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>();

// Max history to keep per contact
const MAX_HISTORY = 20;

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

// Mino tool definition for function calling
const minoTool = {
  functionDeclarations: [
    {
      name: "search_web",
      description: `Use this to search websites for real-time information. Call this when the user asks about:
- Current prices, products, deals, or availability
- Real-time data (weather, stocks, sports scores, news)
- Information that requires browsing a specific website
- Finding or comparing items on e-commerce sites
- Any question that needs up-to-date web data

Do NOT use for: general knowledge questions, opinions, coding help, math, or anything you can answer from training data.`,
      parameters: {
        type: "OBJECT" as const,
        properties: {
          url: {
            type: "STRING" as const,
            description: "The website URL to search (e.g., 'amazon.com', 'weather.com', 'espn.com')",
          },
          goal: {
            type: "STRING" as const,
            description: "What to find or do on the website (e.g., 'find cheapest iPhone 15', 'get NYC weather forecast')",
          },
        },
        required: ["url", "goal"],
      },
    },
  ],
};

export function initGemini(apiKey: string) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are a helpful AI assistant communicating via iMessage.

Keep responses concise (under 500 chars when possible) since this is a text message.
Use emojis sparingly but appropriately. Be direct and helpful.

You have access to a web search tool. Use it when the user needs:
- Real-time information (prices, weather, news, scores)
- Data from specific websites
- Product searches or comparisons
- Anything that requires current web data

For general knowledge questions you can answer from training, just respond directly.`,
    tools: [minoTool],
  });
}

export interface ChatResult {
  text: string;
  minoRequest?: {
    url: string;
    goal: string;
  };
}

export async function chat(contactId: string, message: string): Promise<ChatResult> {
  if (!model) {
    return { text: "❌ Gemini not initialized. Check API key." };
  }

  try {
    // Get or create conversation history for this contact
    let history = conversationHistory.get(contactId) || [];

    // Start chat with history
    const chatSession = model.startChat({
      history: history,
    });

    // Send message
    const result = await chatSession.sendMessage(message);
    const response = result.response;

    // Check if Gemini wants to call a function
    const functionCall = response.functionCalls()?.[0];

    if (functionCall && functionCall.name === "search_web") {
      const args = functionCall.args as { url: string; goal: string };

      // Update history with user message
      history.push({ role: "user", parts: [{ text: message }] });

      // Trim history if too long
      if (history.length > MAX_HISTORY * 2) {
        history = history.slice(-MAX_HISTORY * 2);
      }
      conversationHistory.set(contactId, history);

      return {
        text: "",
        minoRequest: {
          url: args.url,
          goal: args.goal,
        },
      };
    }

    // Regular text response
    let text = "";
    try {
      text = response.text();
    } catch {
      // No text response (shouldn't happen if no function call)
      text = "I'm not sure how to respond to that.";
    }

    // Update history
    history.push({ role: "user", parts: [{ text: message }] });
    history.push({ role: "model", parts: [{ text }] });

    // Trim history if too long
    if (history.length > MAX_HISTORY * 2) {
      history = history.slice(-MAX_HISTORY * 2);
    }

    conversationHistory.set(contactId, history);

    return { text };
  } catch (error) {
    console.error("Gemini error:", error);
    return { text: `❌ Gemini Error: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// Add Mino result to conversation history so Gemini knows what happened
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
