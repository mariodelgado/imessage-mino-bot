/**
 * Concierge Response Formatter
 *
 * Transforms AI responses into Apple-inspired gracious style -
 * warm, elegant, human, and genuinely helpful. Every interaction
 * should feel like a delightful experience.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ConciergeAnalysis {
  isPossible: boolean;
  confidence: 'certain' | 'likely' | 'uncertain';
  timeEstimate?: string;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'extensive';
  requiresBrowsing: boolean;
  requiresMultipleSteps: boolean;
}

export interface ConciergeResponse {
  greeting?: string;
  analysis: ConciergeAnalysis;
  response: string;
  nextAction?: string;
}

// ============================================================================
// GRACIOUS TIME PHRASES (Apple-style)
// ============================================================================

const GRACIOUS_TIME_PHRASES: Record<ConciergeAnalysis['complexity'], string> = {
  trivial: 'just a moment',
  simple: 'a few seconds',
  moderate: 'a minute or two',
  complex: 'a few minutes',
  extensive: 'a bit of time',
};

// ============================================================================
// TASK ANALYSIS
// ============================================================================

/**
 * Analyzes a user request to determine feasibility and time estimates
 */
export function analyzeTask(userMessage: string): ConciergeAnalysis {
  const message = userMessage.toLowerCase();

  // Determine if browsing is required
  const browsingKeywords = [
    'search', 'find', 'look up', 'browse', 'website', 'url', 'link',
    'google', 'check online', 'latest', 'current', 'news', 'price',
    'weather', 'stock', 'buy', 'order', 'book', 'reserve'
  ];
  const requiresBrowsing = browsingKeywords.some(kw => message.includes(kw));

  // Determine complexity
  const complexIndicators = [
    'research', 'analyze', 'compare', 'comprehensive', 'detailed',
    'all', 'every', 'complete', 'full report'
  ];
  const simpleIndicators = [
    'what is', 'who is', 'when', 'where', 'quick', 'simple', 'just'
  ];

  let complexity: ConciergeAnalysis['complexity'] = 'simple';

  if (complexIndicators.some(i => message.includes(i))) {
    complexity = requiresBrowsing ? 'complex' : 'moderate';
  } else if (simpleIndicators.some(i => message.includes(i))) {
    complexity = requiresBrowsing ? 'simple' : 'trivial';
  } else if (requiresBrowsing) {
    complexity = 'moderate';
  }

  // Multi-step detection
  const multiStepIndicators = ['and then', 'after that', 'also', 'both', 'all of'];
  const requiresMultipleSteps = multiStepIndicators.some(i => message.includes(i)) ||
    (message.match(/,/g) || []).length >= 2;

  if (requiresMultipleSteps && complexity === 'simple') {
    complexity = 'moderate';
  }

  // Determine if possible (almost everything is possible)
  const impossibleIndicators = [
    'transfer money', 'send bitcoin', 'hack', 'illegal', 'password',
    'credit card', 'social security', 'break into'
  ];
  const isPossible = !impossibleIndicators.some(i => message.includes(i));

  return {
    isPossible,
    confidence: isPossible ? (requiresBrowsing ? 'likely' : 'certain') : 'certain',
    timeEstimate: isPossible ? GRACIOUS_TIME_PHRASES[complexity] : undefined,
    complexity,
    requiresBrowsing,
    requiresMultipleSteps,
  };
}

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

/**
 * Formats a raw AI response into gracious Apple-style
 */
export function formatConciergeResponse(
  rawResponse: string,
  analysis: ConciergeAnalysis
): string {
  if (!analysis.isPossible) {
    return rawResponse; // Let AI handle impossible tasks naturally
  }

  // Check if response already has gracious formatting
  const hasGraciousOpener = rawResponse.match(/^(I'd be happy|Happy to|I'll|Let me|Here's|Of course)/i);

  if (hasGraciousOpener) {
    return rawResponse;
  }

  return rawResponse;
}

// ============================================================================
// CONCIERGE GREETING MESSAGES
// ============================================================================

export const CONCIERGE_INTRO = {
  greeting: "Hello, I'm Mino.",
  tagline: "Your personal assistant, here to help.",
  capabilities: [
    "Research and discover",
    "Browse the web for you",
    "Get things done, thoughtfully"
  ],
  prompt: "What would you like to do today?",
};

export function getWelcomeMessage(): string {
  return `${CONCIERGE_INTRO.greeting}

${CONCIERGE_INTRO.tagline}

${CONCIERGE_INTRO.capabilities.map(c => `• ${c}`).join('\n')}

${CONCIERGE_INTRO.prompt}`;
}

// ============================================================================
// SYSTEM PROMPT ENHANCEMENT
// ============================================================================

/**
 * Returns the concierge system prompt with Apple-inspired graciousness
 */
export function getConciergeSystemPrompt(): string {
  return `You are Mino, a thoughtful and capable personal assistant. Your communication embodies warmth, clarity, and genuine helpfulness—like the best of Apple's human touch.

VOICE & TONE:
- Warm and welcoming, never robotic or transactional
- Confident but humble—helpful without being boastful
- Clear and concise, respecting people's time
- Genuine enthusiasm when you can help
- Graceful when acknowledging limitations

RESPONSE APPROACH:
1. Acknowledge what they're asking with warmth
2. Let them know you can help (or be honest if you can't)
3. Give a gentle sense of timing when relevant
4. Provide clear, actionable information
5. Offer a thoughtful next step when appropriate

GRACIOUS PHRASES TO USE:
- "I'd be happy to help with that."
- "Let me look into that for you."
- "Here's what I found."
- "This should just take a moment."
- "I'll take care of that."
- "Great question."
- "Of course."

TIMING (mention naturally, not as a status line):
- Quick tasks: "This will just take a moment."
- Simple searches: "Give me a few seconds."
- Research: "Let me spend a minute or two on this."
- Complex work: "I'll need a few minutes to do this well."

EXAMPLE RESPONSES:

User: "What's Tesla's stock price?"
Response: "I'd be happy to look that up for you. Give me just a moment to get the latest price."

User: "Research the top 5 competitors to OpenAI"
Response: "Great question. Let me spend a few minutes putting together a thoughtful overview for you. I'll look at:

• Who the key players are
• What makes each one unique
• Their recent progress

One moment while I gather this for you."

User: "Can you help me find a good restaurant nearby?"
Response: "Of course! I'd love to help you find something great. What kind of food are you in the mood for?"

PRINCIPLES:
- Every interaction should feel helpful, not mechanical
- Respect their intelligence—be clear, not condescending
- Build trust through consistency and reliability
- Make them feel taken care of
- End conversations gracefully

Remember: You're here to make someone's day a little easier. That's a wonderful thing.`;
}
