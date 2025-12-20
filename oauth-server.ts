/**
 * OAuth callback server for Mino authentication
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { getUserByMinoState, setMinoApiKey } from "./db";
import crypto from "crypto";

const PORT = process.env.OAUTH_PORT || 3456;
const CALLBACK_HOST = process.env.CALLBACK_HOST || `http://localhost:${PORT}`;
const MINO_OAUTH_URL = "https://mcp.mino.ai/oauth/authorize";

// Callback for when a user successfully connects Mino
let onMinoConnected: ((phone: string) => void) | null = null;

export function setMinoConnectedCallback(callback: (phone: string) => void) {
  onMinoConnected = callback;
}

// Generate OAuth URL for a user
export function generateMinoOAuthUrl(phone: string, state: string): string {
  const params = new URLSearchParams({
    redirect_uri: `${CALLBACK_HOST}/mino/callback`,
    state: state,
    response_type: "token",
  });

  return `${MINO_OAUTH_URL}?${params.toString()}`;
}

// Generate a unique state token
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Handle incoming HTTP requests
function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Mino OAuth callback
  if (url.pathname === "/mino/callback") {
    const state = url.searchParams.get("state");
    const apiKey = url.searchParams.get("api_key") || url.searchParams.get("token");
    const error = url.searchParams.get("error");

    if (error) {
      console.error(`[OAuth] Error from Mino: ${error}`);
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Connection Failed</h1>
            <p>Error: ${error}</p>
            <p>Please try again via iMessage.</p>
          </body>
        </html>
      `);
      return;
    }

    if (!state) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Invalid Request</h1>
            <p>Missing state parameter. Please start the connection process from iMessage.</p>
          </body>
        </html>
      `);
      return;
    }

    // Look up user by state
    const user = getUserByMinoState(state);

    if (!user) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Session Expired</h1>
            <p>This link has expired or was already used.</p>
            <p>Please request a new connection link via iMessage.</p>
          </body>
        </html>
      `);
      return;
    }

    if (!apiKey) {
      // If no API key in URL, show a page that captures it from fragment (for token in hash)
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head>
            <script>
              // Check for token in URL fragment (hash)
              const hash = window.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const token = params.get('api_key') || params.get('token') || params.get('access_token');

              if (token) {
                // Redirect to callback with token as query param
                window.location.href = '/mino/callback?state=${state}&api_key=' + encodeURIComponent(token);
              } else {
                document.body.innerHTML = '<h1>Connection Failed</h1><p>No API key received. Please try again.</p>';
              }
            </script>
          </head>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Connecting...</h1>
            <p>Please wait while we complete the connection.</p>
          </body>
        </html>
      `);
      return;
    }

    // Save the API key
    setMinoApiKey(user.phone, apiKey);
    console.log(`[OAuth] Mino connected for ${user.phone}`);

    // Notify the callback
    if (onMinoConnected) {
      onMinoConnected(user.phone);
    }

    // Success page
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✅ Connected!</h1>
          <p>Your Mino account is now linked.</p>
          <p>You can close this window and return to iMessage.</p>
          <p style="margin-top: 40px; color: #666;">I'll send you a confirmation message.</p>
        </body>
      </html>
    `);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

// Start the OAuth server
export function startOAuthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);

    server.listen(PORT, () => {
      console.log(`[OAuth] Server listening on port ${PORT}`);
      console.log(`[OAuth] Callback URL: ${CALLBACK_HOST}/mino/callback`);
      resolve();
    });

    server.on("error", (err) => {
      console.error("[OAuth] Server error:", err);
      reject(err);
    });
  });
}
