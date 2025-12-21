/**
 * OAuth 2.1 Server for Mino MCP Authentication
 *
 * Implements OAuth 2.1 with PKCE (required by MCP spec):
 * 1. Generate authorization URL with code_challenge
 * 2. Handle callback with authorization code
 * 3. Exchange code for tokens
 * 4. Refresh tokens when expired
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import crypto from "crypto";
import {
  getUserByMinoState,
  setMinoApiKey,
  setMinoState,
  setMinoCodeVerifier,
  getMinoCodeVerifier,
  setMinoTokens,
  getMinoRefreshToken,
  getOrCreateUser,
} from "./db";

// Configuration
const PORT = process.env.OAUTH_PORT || 3456;
const CALLBACK_HOST = process.env.CALLBACK_HOST || `http://localhost:${PORT}`;

// Mino MCP OAuth endpoints
const MINO_MCP_BASE = "https://mcp.mino.ai";
const MINO_AUTHORIZE_URL = `${MINO_MCP_BASE}/oauth/authorize`;
const MINO_TOKEN_URL = `${MINO_MCP_BASE}/oauth/token`;
const MINO_CLIENT_ID = process.env.MINO_CLIENT_ID || "imessage-mino-bot";

// Callback for when a user successfully connects Mino
let onMinoConnected: ((phone: string) => void) | null = null;

export function setMinoConnectedCallback(callback: (phone: string) => void) {
  onMinoConnected = callback;
}

// ============================================================================
// PKCE Utilities (RFC 7636)
// ============================================================================

/**
 * Generate a cryptographically random code verifier
 * Must be 43-128 characters, URL-safe
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate code challenge from verifier using SHA-256 (S256 method)
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate a unique state token for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ============================================================================
// OAuth URL Generation
// ============================================================================

/**
 * Generate the OAuth authorization URL for a user
 * Stores state and code_verifier in database for callback validation
 */
export function generateMinoOAuthUrl(phone: string, state: string): string {
  // Ensure user exists
  getOrCreateUser(phone);

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store state and verifier for callback
  setMinoState(phone, state);
  setMinoCodeVerifier(phone, codeVerifier);

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: MINO_CLIENT_ID,
    redirect_uri: `${CALLBACK_HOST}/mino/callback`,
    response_type: "code",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "automation:run automation:read", // Request necessary scopes
  });

  console.log(`[OAuth] Generated auth URL for ${phone}`);
  console.log(`[OAuth] State: ${state}`);
  console.log(`[OAuth] Code verifier stored: ${codeVerifier.slice(0, 10)}...`);

  return `${MINO_AUTHORIZE_URL}?${params.toString()}`;
}

// ============================================================================
// Token Exchange
// ============================================================================

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: MINO_CLIENT_ID,
    code: code,
    redirect_uri: `${CALLBACK_HOST}/mino/callback`,
    code_verifier: codeVerifier,
  });

  console.log(`[OAuth] Exchanging code for tokens...`);

  const response = await fetch(MINO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OAuth] Token exchange failed: ${response.status} - ${errorText}`);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const tokens = (await response.json()) as TokenResponse;
  console.log(`[OAuth] Token exchange successful, expires in ${tokens.expires_in}s`);

  return tokens;
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(phone: string): Promise<string | null> {
  const refreshToken = getMinoRefreshToken(phone);
  if (!refreshToken) {
    console.log(`[OAuth] No refresh token for ${phone}`);
    return null;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: MINO_CLIENT_ID,
    refresh_token: refreshToken,
  });

  console.log(`[OAuth] Refreshing token for ${phone}...`);

  try {
    const response = await fetch(MINO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error(`[OAuth] Token refresh failed: ${response.status}`);
      return null;
    }

    const tokens = (await response.json()) as TokenResponse;
    setMinoTokens(phone, tokens.access_token, tokens.refresh_token || refreshToken, tokens.expires_in);

    console.log(`[OAuth] Token refreshed for ${phone}`);
    return tokens.access_token;
  } catch (error) {
    console.error(`[OAuth] Token refresh error:`, error);
    return null;
  }
}

// ============================================================================
// HTTP Request Handler
// ============================================================================

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Mino OAuth callback
  if (url.pathname === "/mino/callback") {
    await handleOAuthCallback(url, res);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
}

async function handleOAuthCallback(url: URL, res: ServerResponse) {
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error(`[OAuth] Error from Mino: ${error} - ${errorDescription}`);
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(renderErrorPage("Connection Failed", errorDescription || error));
    return;
  }

  // Validate state
  if (!state) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(renderErrorPage("Invalid Request", "Missing state parameter. Please start the connection process from iMessage."));
    return;
  }

  // Look up user by state
  const user = getUserByMinoState(state);
  if (!user) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(renderErrorPage("Session Expired", "This link has expired or was already used. Please request a new connection link via iMessage."));
    return;
  }

  // Handle authorization code flow
  if (code) {
    try {
      // Get the code verifier we stored earlier
      const codeVerifier = getMinoCodeVerifier(user.phone);
      if (!codeVerifier) {
        throw new Error("Code verifier not found - session may have expired");
      }

      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code, codeVerifier);

      // Store tokens
      setMinoTokens(
        user.phone,
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expires_in
      );

      // Also store as API key for backwards compatibility
      setMinoApiKey(user.phone, tokens.access_token);

      console.log(`[OAuth] Mino connected for ${user.phone}`);

      // Notify the callback
      if (onMinoConnected) {
        onMinoConnected(user.phone);
      }

      // Success page
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderSuccessPage());
      return;
    } catch (err) {
      console.error(`[OAuth] Token exchange error:`, err);
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(renderErrorPage("Connection Failed", "Failed to complete authentication. Please try again."));
      return;
    }
  }

  // Handle implicit flow (token in fragment) - fallback for legacy
  // If no code provided, show a page that captures token from fragment
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; background: #f5f5f7; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #1d1d1f; }
          p { color: #86868b; }
        </style>
        <script>
          // Check for token in URL fragment (hash) - implicit flow
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const token = params.get('access_token') || params.get('api_key') || params.get('token');

          if (token) {
            // Redirect to callback with token as query param
            window.location.href = '/mino/callback?state=${state}&api_key=' + encodeURIComponent(token);
          } else {
            // Check query params too
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.get('code') && !urlParams.get('api_key')) {
              document.body.innerHTML = '<div class="container"><h1>⚠️ Connection Failed</h1><p>No authorization received. Please try again from iMessage.</p></div>';
            }
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1>🔄 Connecting...</h1>
          <p>Please wait while we complete the connection.</p>
        </div>
      </body>
    </html>
  `);
}

// ============================================================================
// HTML Templates
// ============================================================================

function renderSuccessPage(): string {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; background: #f5f5f7; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #34c759; font-size: 48px; margin-bottom: 20px; }
          h2 { color: #1d1d1f; margin-bottom: 10px; }
          p { color: #86868b; }
          .close-hint { margin-top: 30px; padding: 15px; background: #f5f5f7; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅</h1>
          <h2>Connected!</h2>
          <p>Your Mino account is now linked to your iMessage assistant.</p>
          <div class="close-hint">
            <p>You can close this window and return to iMessage.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function renderErrorPage(title: string, message: string): string {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; background: #f5f5f7; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #ff3b30; font-size: 48px; margin-bottom: 20px; }
          h2 { color: #1d1d1f; margin-bottom: 10px; }
          p { color: #86868b; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌</h1>
          <h2>${title}</h2>
          <p>${message}</p>
          <p style="margin-top: 20px;">Please try again via iMessage.</p>
        </div>
      </body>
    </html>
  `;
}

// ============================================================================
// Server Start
// ============================================================================

export function startOAuthServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);

    server.listen(PORT, () => {
      console.log(`[OAuth] Server listening on port ${PORT}`);
      console.log(`[OAuth] Callback URL: ${CALLBACK_HOST}/mino/callback`);
      console.log(`[OAuth] Using MCP OAuth at: ${MINO_MCP_BASE}`);
      resolve();
    });

    server.on("error", (err: Error) => {
      console.error("[OAuth] Server error:", err);
      reject(err);
    });
  });
}
