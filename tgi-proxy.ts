/**
 * TGI-Compatible Proxy for Gemini
 *
 * Bridges dumbdns (expects TGI format) to Gemini API.
 * Allows DNS TXT queries to reach your AI agent from anywhere.
 *
 * Usage: GEMINI_API_KEY=xxx npx tsx tgi-proxy.ts [port]
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServer, IncomingMessage, ServerResponse } from "http";

const PORT = parseInt(process.env.TGI_PROXY_PORT || process.argv[2] || "8080");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// TGI request format (what dumbdns sends)
interface TGIRequest {
  inputs: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    stop?: string[];
    seed?: number;
  };
}

// TGI response format (what dumbdns expects)
interface TGIResponse {
  generated_text: string;
}

// System prompt for DNS queries
const SYSTEM_PROMPT = `You are Mino, a helpful AI assistant accessible via DNS TXT queries.
Keep responses VERY concise (under 200 chars ideal, max 255) since DNS TXT records are limited.
Be direct and helpful. Skip pleasantries.`;

/**
 * Parse TGI-format input string to extract user query
 * Format: <|system|>...<|user|>query
 */
function parseInput(input: string): string {
  // dumbdns format: <|system|>...<|user|>query
  const userMatch = input.match(/<\|user\|>(.*)$/s);
  if (userMatch) {
    return userMatch[1].trim();
  }

  // Fallback: just use the whole input
  return input.trim();
}

/**
 * Handle incoming TGI request
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    // Read request body
    const body = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", chunk => data += chunk);
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const tgiReq: TGIRequest = JSON.parse(body);
    const userQuery = parseInput(tgiReq.inputs);

    console.log(`📡 DNS Query: "${userQuery.slice(0, 50)}${userQuery.length > 50 ? "..." : ""}"`);

    // Call Gemini
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Understood. I'll keep responses concise for DNS." }] },
      ],
      generationConfig: {
        maxOutputTokens: tgiReq.parameters?.max_new_tokens || 100,
        temperature: tgiReq.parameters?.temperature || 0.7,
        topK: tgiReq.parameters?.top_k,
        topP: tgiReq.parameters?.top_p,
      },
    });

    const result = await chat.sendMessage(userQuery);
    let response = result.response.text();

    // Truncate if too long for DNS TXT (255 char limit)
    if (response.length > 250) {
      response = response.slice(0, 247) + "...";
    }

    console.log(`📤 Response: "${response.slice(0, 50)}${response.length > 50 ? "..." : ""}"`);

    const tgiRes: TGIResponse = { generated_text: response };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tgiRes));

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      generated_text: `Error: ${err.message.slice(0, 100)}`
    }));
  }
}

// Start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     TGI Proxy for Gemini                  ║
║                                           ║
║  🌐 Port: ${PORT}                            ║
║  🤖 Model: gemini-2.0-flash               ║
║  📡 Ready for dumbdns connections         ║
╚═══════════════════════════════════════════╝

Start dumbdns with:
  dumbdns -tgi-url http://localhost:${PORT}
`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏹️ Shutting down TGI proxy...");
  server.close();
  process.exit(0);
});
