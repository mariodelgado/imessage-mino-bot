/**
 * On-Device LLM Service
 *
 * Provides offline AI capabilities using a lightweight on-device model.
 * Falls back to this when the WebSocket server is unavailable.
 *
 * Uses expo-llm (when available) or a pattern-based response system
 * for basic functionality without network connectivity.
 */

// Intent classification patterns
const INTENT_PATTERNS = {
  greeting: [
    /^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)/i,
    /^(what'?s?\s*up|sup|yo)/i,
  ],
  help: [
    /^(help|what\s*can\s*you\s*do|commands|capabilities)/i,
    /how\s*do\s*(i|you)/i,
  ],
  weather: [/weather|temperature|forecast|rain|sunny|cloudy/i],
  time: [/what\s*time|current\s*time|clock/i],
  date: [/what\s*day|today'?s?\s*date|current\s*date/i],
  browse: [
    /^(search|look\s*up|find|browse|google|open\s*website)/i,
    /(on\s*the\s*web|online|internet)/i,
  ],
  calculation: [/\d+\s*[\+\-\*\/\^]\s*\d+|calculate|compute|math/i],
  unknown: [],
};

// Response templates
const RESPONSES = {
  greeting: [
    "Hey! I'm running in offline mode right now. I can help with basic questions, but for browsing the web, I'll need the server connection.",
    "Hi there! I'm Mino, currently offline. I have limited capabilities, but I'll do my best to help!",
    "Hello! Running locally without server access. What can I help you with?",
  ],
  help: [
    "I'm Mino, your AI assistant! When connected to the server, I can:\n\n• Chat about any topic\n• Browse the web for you\n• Search for information\n• Complete tasks autonomously\n\nIn offline mode, I can handle basic questions and calculations.",
  ],
  weather: [
    "I'd love to check the weather, but I'm currently offline. Please connect to the server for real-time weather data.",
  ],
  time: [() => `It's currently ${new Date().toLocaleTimeString()}.`],
  date: [
    () =>
      `Today is ${new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`,
  ],
  browse: [
    "I can't browse the web in offline mode. Please check your connection to the Mino server.",
    "Web browsing requires server connectivity. Try reconnecting to use Mino's full capabilities.",
  ],
  calculation: [], // Handled specially
  unknown: [
    "I'm currently in offline mode with limited capabilities. For full functionality, please ensure you're connected to the Mino server.",
    "I don't have enough context to help with that offline. Try again when connected to the server.",
    "That's beyond my offline capabilities. The server would be able to help you better with that.",
  ],
};

// Simple calculator
function evaluateExpression(expression: string): string | null {
  try {
    // Extract numbers and operator
    const match = expression.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/\^])\s*(\d+(?:\.\d+)?)/);
    if (!match) return null;

    const [, num1, op, num2] = match;
    const a = parseFloat(num1);
    const b = parseFloat(num2);

    let result: number;
    switch (op) {
      case "+":
        result = a + b;
        break;
      case "-":
        result = a - b;
        break;
      case "*":
        result = a * b;
        break;
      case "/":
        result = b !== 0 ? a / b : NaN;
        break;
      case "^":
        result = Math.pow(a, b);
        break;
      default:
        return null;
    }

    if (isNaN(result)) return "Cannot divide by zero.";
    return `${a} ${op} ${b} = ${result}`;
  } catch {
    return null;
  }
}

// Classify intent from user message
function classifyIntent(message: string): keyof typeof INTENT_PATTERNS {
  const normalized = message.toLowerCase().trim();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (intent === "unknown") continue;

    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return intent as keyof typeof INTENT_PATTERNS;
      }
    }
  }

  return "unknown";
}

// Get random response from template
function getRandomResponse(responses: (string | (() => string))[]): string {
  if (responses.length === 0) return "";
  const response = responses[Math.floor(Math.random() * responses.length)];
  return typeof response === "function" ? response() : response;
}

// Main inference function
export async function generateResponse(message: string): Promise<string> {
  // Simulate processing time for natural feel
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

  const intent = classifyIntent(message);

  // Handle calculation specially
  if (intent === "calculation") {
    const result = evaluateExpression(message);
    if (result) return result;
  }

  // Get appropriate response
  const responseTemplates = RESPONSES[intent];
  if (responseTemplates && responseTemplates.length > 0) {
    return getRandomResponse(responseTemplates);
  }

  return getRandomResponse(RESPONSES.unknown);
}

// Check if on-device LLM is available
export function isOnDeviceLLMAvailable(): boolean {
  // In a real implementation, this would check for:
  // 1. expo-llm availability
  // 2. Downloaded model files
  // 3. Device capabilities (RAM, Neural Engine)
  // For now, return true as we have pattern-based fallback
  return true;
}

// Model info
export interface OnDeviceLLMInfo {
  available: boolean;
  modelName: string;
  capabilities: string[];
  limitations: string[];
}

export function getOnDeviceLLMInfo(): OnDeviceLLMInfo {
  return {
    available: true,
    modelName: "Mino Offline (Pattern-Based)",
    capabilities: [
      "Basic greetings and conversation",
      "Time and date queries",
      "Simple calculations",
      "Help and capability information",
    ],
    limitations: [
      "No web browsing",
      "No real-time data",
      "Limited context understanding",
      "No complex reasoning",
    ],
  };
}

// Export default service
export default {
  generateResponse,
  isOnDeviceLLMAvailable,
  getOnDeviceLLMInfo,
};
