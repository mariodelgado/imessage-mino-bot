/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Investor Chat API - Mino Agent Conversations
 *
 * Handles chat interactions with Mino for:
 * - Portfolio company searches/insights
 * - Snap App creation (gated behind first search)
 * - Settings management through natural language
 *
 * POST /api/investor/[id]/chat - Send a message
 * GET /api/investor/[id]/chat - Get conversation history
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getInvestorState,
  initializeInvestorState,
  addConversationMessage,
  recordInvestorSearch,
  recordSnapAppCreation,
  canCreateSnapApp,
  getInvestorPreferences,
  saveInvestorPreferences,
} from "@/lib/storage";

// Portfolio companies for context
const PORTFOLIO_COMPANIES = [
  "TinyFish", "Statsig", "Adaptive ML", "Pinecone", "Groww",
  "Spotnana", "Unit21", "Reprise", "Highspot", "Sendbird"
];

// Investor name mapping (in production, fetch from auth/database)
const INVESTOR_NAMES: Record<string, string> = {
  "f47ac10b-58cc-4372-a567-0e02b2c3d479": "Ryan Koh",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: {
    intent?: "search" | "create_app" | "settings" | "help" | "general";
    searchResults?: unknown;
    settingsChanged?: Record<string, unknown>;
    canCreateApp?: boolean;
  };
}

/**
 * GET - Retrieve conversation history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const investorName = INVESTOR_NAMES[id] || "Investor";

    // Get or initialize investor state
    let state = await getInvestorState(id);
    if (!state) {
      state = await initializeInvestorState(id, investorName);
    }

    return NextResponse.json({
      success: true,
      data: {
        messages: state.conversationHistory,
        stage: state.stage,
        canCreateSnapApp: canCreateSnapApp(state),
        searchCount: state.searchCount,
        snapAppCount: state.snapAppCount,
      },
    });
  } catch (error) {
    console.error("Failed to get chat history:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve conversation" },
      { status: 500 }
    );
  }
}

/**
 * POST - Send a message to Mino
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "AI service not configured" },
        { status: 500 }
      );
    }

    const investorName = INVESTOR_NAMES[id] || "Investor";
    const _firstName = investorName.split(" ")[0]; // Reserved for future personalization

    // Get or initialize state
    let state = await getInvestorState(id);
    if (!state) {
      state = await initializeInvestorState(id, investorName);
    }

    // Get preferences for settings context
    const preferences = await getInvestorPreferences(id);

    // Add user message to history
    await addConversationMessage(id, {
      role: "user",
      content: message,
    });

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    // Detect intent and generate response
    const intentPrompt = `You are Mino, a portfolio intelligence agent for ${investorName} at ICONIQ Capital.

Current user state:
- Stage: ${state.stage}
- Search count: ${state.searchCount}
- Can create Snap Apps: ${canCreateSnapApp(state)}
- Current preferences: ${JSON.stringify(preferences?.briefSchedule || {})}

Portfolio companies: ${PORTFOLIO_COMPANIES.join(", ")}

The user said: "${message}"

Analyze the intent and respond accordingly:

1. If they want to SEARCH/FIND INFO about companies, news, or market data:
   - Intent: "search"
   - Use Google Search to find relevant information
   - Provide concise, actionable insights

2. If they want to CREATE A SNAP APP (dashboard):
   - Intent: "create_app"
   - If searchCount is 0, gently redirect them to search first
   - Only allow if they've done at least one search

3. If they want to CHANGE SETTINGS (brief time, notifications, etc):
   - Intent: "settings"
   - Parse the requested setting change
   - Confirm the change

4. If they need HELP or general questions:
   - Intent: "help" or "general"
   - Be warm but professional, like a trusted advisor

IMPORTANT STYLE:
- Be concise and direct, like a senior analyst
- Use bullet points for multiple items
- No emojis
- Reference specific companies when relevant
- Sound like Bloomberg Terminal meets a trusted colleague

Respond with JSON:
{
  "intent": "search" | "create_app" | "settings" | "help" | "general",
  "response": "Your message to the user",
  "searchQuery": "If intent is search, the optimized search query",
  "settingsUpdate": { ... } // If intent is settings, the changes to make
}`;

    // Get intent and initial response
    const intentResult = await model.generateContent(intentPrompt);
    const intentText = intentResult.response.text();

    // Parse JSON from response
    const jsonMatch = intentText.match(/\{[\s\S]*\}/);
    let parsed: {
      intent: string;
      response: string;
      searchQuery?: string;
      settingsUpdate?: Record<string, unknown>;
    } = {
      intent: "general",
      response: "I'm here to help. What would you like to know about your portfolio?",
    };

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse intent JSON");
      }
    }

    let finalResponse = parsed.response;
    const metadata: ChatMessage["metadata"] = {
      intent: parsed.intent as NonNullable<ChatMessage["metadata"]>["intent"],
      canCreateApp: canCreateSnapApp(state),
    };

    // Handle search intent with Google Search grounding
    if (parsed.intent === "search" && parsed.searchQuery) {
      const searchModel = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      });

      const searchPrompt = `Search for recent information about: ${parsed.searchQuery}

Focus on:
- Recent news and developments (last 7 days)
- Market movements and competitive intelligence
- Key insights relevant for an investor

Portfolio context: ${PORTFOLIO_COMPANIES.join(", ")}

Provide a concise, bullet-pointed summary with sources. Be direct and analytical.`;

      const searchResult = await searchModel.generateContent({
        contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
        tools: [{ googleSearch: {} }],
      } as any);

      const searchResponse = searchResult.response.text();
      finalResponse = searchResponse;

      // Record the search
      await recordInvestorSearch(id, parsed.searchQuery);

      // Update state
      state = await getInvestorState(id);
      metadata.searchResults = { query: parsed.searchQuery };
      metadata.canCreateApp = state ? canCreateSnapApp(state) : false;

      // Add suggestion to create snap app if this was their first search
      if (state && state.searchCount === 1) {
        finalResponse += `\n\n---\n\nYou've completed your first search. You can now create **Snap Apps** - live dashboards that track insights like this automatically. Just say "create a snap app" when you're ready.`;
      }
    }

    // Handle snap app creation
    if (parsed.intent === "create_app") {
      if (!state || !canCreateSnapApp(state)) {
        finalResponse = `Before creating a Snap App, I'd like to understand what you're interested in tracking.\n\nTry searching for something first - for example:\n- "What's happening with Pinecone?"\n- "Latest AI infrastructure news"\n- "Competitive analysis for Sendbird"\n\nOnce I understand your interests, I can help you create a dashboard that updates automatically.`;
        metadata.intent = "general";
      } else {
        // They can create - provide guidance
        finalResponse = `Ready to create a Snap App from your recent searches.\n\n**What would you like to track?**\n\n• **Company Monitor** - Track news and developments for specific portfolio companies\n• **Competitive Intel** - Monitor competitors and market movements\n• **Deal Flow** - Track funding rounds and M&A in your sectors\n\nDescribe what you'd like, and I'll set it up.`;

        // Record snap app creation intent (actual creation handled separately)
        await recordSnapAppCreation(id);
      }
    }

    // Handle settings changes
    if (parsed.intent === "settings" && parsed.settingsUpdate) {
      const settingsToUpdate: Record<string, unknown> = {};

      // Parse common settings requests
      if (parsed.settingsUpdate.briefTime) {
        settingsToUpdate.briefSchedule = {
          ...preferences?.briefSchedule,
          time: parsed.settingsUpdate.briefTime,
        };
      }
      if (parsed.settingsUpdate.briefEnabled !== undefined) {
        settingsToUpdate.briefSchedule = {
          ...preferences?.briefSchedule,
          enabled: parsed.settingsUpdate.briefEnabled,
        };
      }
      if (parsed.settingsUpdate.criticalAlerts !== undefined) {
        settingsToUpdate.notifications = {
          ...preferences?.notifications,
          criticalAlerts: parsed.settingsUpdate.criticalAlerts,
        };
      }

      if (Object.keys(settingsToUpdate).length > 0) {
        await saveInvestorPreferences(id, settingsToUpdate as any);
        metadata.settingsChanged = settingsToUpdate;
      }
    }

    // Add assistant response to history
    await addConversationMessage(id, {
      role: "assistant",
      content: finalResponse,
      metadata,
    });

    // Get updated state
    const updatedState = await getInvestorState(id);

    return NextResponse.json({
      success: true,
      data: {
        response: finalResponse,
        intent: metadata.intent,
        canCreateSnapApp: updatedState ? canCreateSnapApp(updatedState) : false,
        searchCount: updatedState?.searchCount || 0,
        stage: updatedState?.stage || "new",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Chat failed",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
