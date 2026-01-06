# Mino Omni-Access Plan

## Goal
Enable access to Mino AI from any interface: DNS, SMS, Voice, iMessage, and Claude Code sessions.

---

## Phase 1: Vapi Voice Integration

### 1.1 Vapi Account Setup
- [ ] Sign up at vapi.ai
- [ ] Get API key
- [ ] Purchase or port phone number

### 1.2 Create Vapi Assistant
```json
{
  "name": "Mino Voice",
  "model": {
    "provider": "custom-llm",
    "url": "https://YOUR_ENDPOINT/v1/chat/completions",
    "model": "gemini-2.0-flash"
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "rachel"  // or use Sesame CSM when available
  },
  "firstMessage": "Hey, it's Mino. What's up?"
}
```

### 1.3 Create Gemini-to-OpenAI Adapter
File: `server/vapi-adapter.ts`

The adapter translates OpenAI chat completions format to Gemini:
```
Vapi (OpenAI format) → Adapter → Gemini API
```

### 1.4 Deploy Adapter
Options:
- Cloudflare Workers (free tier)
- Local with Tailscale Funnel
- Railway/Fly.io

### 1.5 Test
```bash
# Call your Vapi number
# "Hey Mino, what's the weather in Tokyo?"
```

---

## Phase 2: SMS Integration (Twilio)

### 2.1 Twilio Setup
- [ ] Twilio account with SMS-capable number
- [ ] Configure webhook URL

### 2.2 SMS Webhook Handler
File: `server/sms-handler.ts`

```typescript
// POST /sms/incoming
// Receives: { From, To, Body }
// Responds with TwiML containing AI response
```

### 2.3 Integration with Mino Core
- Reuse existing Gemini integration
- Add SMS-specific formatting (160 char awareness)

---

## Phase 3: Claude Code ↔ iMessage Bridge

### Architecture
```
iMessage → Mino Bot → Claude Code Session
    ↑                        ↓
    └────── Response ────────┘
```

### 3.1 Session Registry
File: `server/claude-sessions.ts`

Track active Claude Code sessions:
```typescript
interface ClaudeSession {
  id: string;           // UUID
  name: string;         // Human-friendly name
  cwd: string;          // Working directory
  pid?: number;         // Process ID if spawned by us
  lastActive: Date;
}
```

### 3.2 Message Router
File: `server/claude-bridge.ts`

Parse iMessage commands:
```
"@claude fix the login bug"           → Route to most recent session
"@claude:api-server check tests"      → Route to named session
"@sessions"                           → List active sessions
```

### 3.3 Execution Methods

**Option A: Spawn new session per message**
```bash
claude -p --resume SESSION_ID "user message"
```
- Simple, stateless
- Each message continues the session

**Option B: Named pipe / socket**
- More complex
- True real-time bidirectional

**Recommended: Option A** - simpler, reliable

### 3.4 iMessage Handler Update
File: `index.ts`

Add Claude Code routing:
```typescript
if (message.startsWith('@claude')) {
  const response = await routeToClaudeSession(message);
  await sendReply(response);
}
```

### 3.5 Session Discovery
Detect running sessions:
```bash
# List all Claude Code sessions
claude -r  # Interactive picker shows sessions
```

Or read from: `~/.claude/projects/*/sessions/`

---

## Phase 4: Unified Gateway

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    MINO GATEWAY                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│   │  DNS    │ │   SMS   │ │  Voice  │ │ iMessage│      │
│   │ :5454   │ │ Twilio  │ │  Vapi   │ │  macOS  │      │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘      │
│        │           │           │           │            │
│        └───────────┴─────┬─────┴───────────┘            │
│                          ▼                              │
│                  ┌───────────────┐                      │
│                  │  ROUTER       │                      │
│                  │               │                      │
│                  │ @claude → CC  │                      │
│                  │ @mino → AI    │                      │
│                  │ default → AI  │                      │
│                  └───────┬───────┘                      │
│                          │                              │
│           ┌──────────────┼──────────────┐               │
│           ▼              ▼              ▼               │
│   ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│   │  Gemini   │  │  Claude   │  │   Tools   │          │
│   │   API     │  │   Code    │  │  (search, │          │
│   │           │  │  Sessions │  │   calc)   │          │
│   └───────────┘  └───────────┘  └───────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Current State

| Layer | Status | Access Point |
|-------|--------|--------------|
| DNS | ✅ Running | `dig @100.98.37.43 -p 5454 "query" TXT` |
| iMessage | ✅ Running | Text the Mac's iMessage |
| SMS | ⬜ Not started | — |
| Voice | ⬜ Not started | — |
| Claude Bridge | ⬜ Not started | — |

---

## Next Steps

1. **Implement Claude Bridge** (Phase 3) - highest value, enables iMessage → Claude Code
2. **Add Vapi Voice** (Phase 1) - call your AI from any phone
3. **Add SMS** (Phase 2) - text from any phone

---

## Commands Reference (After Implementation)

### From iMessage
```
"hey mino what time is it in tokyo"     → Gemini AI
"@claude fix the bug in auth.ts"        → Claude Code
"@claude:api list recent commits"       → Specific CC session
"@sessions"                             → List CC sessions
```

### From Phone (Voice)
```
Call +1-XXX-XXX-XXXX
"Hey Mino, remind me to call mom"
```

### From Any Phone (SMS)
```
Text +1-XXX-XXX-XXXX
"what's 15% of 847"
```

### From Any Device (DNS)
```bash
dig @100.98.37.43 -p 5454 "hello" TXT
```
