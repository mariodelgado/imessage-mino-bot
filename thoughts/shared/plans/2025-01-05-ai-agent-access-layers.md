# AI Agent Access Layers

Visual architecture for Mino's multi-channel access strategy.

---

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI AGENT ACCESS LAYERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 7: iMessage (Current)                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Rich text, images, reactions, typing indicators                   │   │
│  │ ✓ Conversation history, context                                     │   │
│  │ ✓ Apple ecosystem integration                                       │   │
│  │ ✗ Apple devices only                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                    │                                        │
│  LAYER 6: HTTP API (Potential)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • REST/GraphQL endpoint                                             │   │
│  │ • Full JSON payloads, no length limits                              │   │
│  │ • Auth tokens, rate limiting                                        │   │
│  │ • WebSocket for streaming                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                    │                                        │
│  LAYER 5: Voice/Phone (Potential)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Twilio Voice + Deepgram/Whisper STT                               │   │
│  │ • ElevenLabs/OpenAI TTS for responses                               │   │
│  │ • Call from any phone worldwide                                     │   │
│  │ • "Hey Mino, what's the weather?"                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                    │                                        │
│  LAYER 4: Email (Potential)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • IMAP polling or webhook (SendGrid/Postmark)                       │   │
│  │ • Long-form queries and responses                                   │   │
│  │ • Attachments (PDFs, images for analysis)                           │   │
│  │ • Async - doesn't need immediate response                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                    │                                        │
│  LAYER 3: Telegram/Signal (Potential)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Cross-platform (Android, iOS, Web, Desktop)                       │   │
│  │ • Bot API with webhooks                                             │   │
│  │ • Rich formatting, inline keyboards                                 │   │
│  │ • Groups, channels possible                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                    │                                        │
│  LAYER 2: SMS (Potential)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Twilio SMS webhook                                                │   │
│  │ • Works on any phone (dumb phones too)                              │   │
│  │ • 160 char segments, can chain                                      │   │
│  │ • Text "mino what time is it in tokyo" to +1-XXX-XXX-XXXX           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                    │                                        │
│  LAYER 1: DNS TXT (Current)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✓ Universal - works from any device with dig/nslookup               │   │
│  │ ✓ No app needed, no auth                                            │   │
│  │ ✓ Works through firewalls (UDP 53)                                  │   │
│  │ ✗ 255 char limit, stateless                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌──────────┐         ┌──────────┐         ┌──────────┐                  │
│    │   DNS    │────────▶│   TGI    │────────▶│  Gemini  │                  │
│    │ dumbdns  │         │  Proxy   │         │   API    │                  │
│    │ :5454    │◀────────│  :8080   │◀────────│          │                  │
│    └──────────┘         └──────────┘         └──────────┘                  │
│         │                                                                   │
│         │ Tailscale (100.98.37.43)                                         │
│         ▼                                                                   │
│    ┌──────────┐                                                            │
│    │ Any dig  │                                                            │
│    │ client   │                                                            │
│    └──────────┘                                                            │
│                                                                             │
│    ┌──────────┐         ┌──────────┐         ┌──────────┐                  │
│    │ iMessage │────────▶│  Mino    │────────▶│  Gemini  │                  │
│    │ (macOS)  │         │  Bot     │         │   API    │                  │
│    │          │◀────────│ index.ts │◀────────│          │                  │
│    └──────────┘         └──────────┘         └──────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Potential Unified Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           ┌─────────────────┐                               │
│                           │   MINO CORE     │                               │
│                           │                 │                               │
│                           │  • Gemini API   │                               │
│                           │  • MIRA Memory  │                               │
│                           │  • User Model   │                               │
│                           │  • Tools/Agents │                               │
│                           └────────┬────────┘                               │
│                                    │                                        │
│          ┌─────────────────────────┼─────────────────────────┐              │
│          │                         │                         │              │
│          ▼                         ▼                         ▼              │
│   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│   │   ADAPTER   │          │   ADAPTER   │          │   ADAPTER   │        │
│   │   Gateway   │          │   Gateway   │          │   Gateway   │        │
│   └──────┬──────┘          └──────┬──────┘          └──────┬──────┘        │
│          │                         │                         │              │
│    ┌─────┴─────┐            ┌─────┴─────┐            ┌─────┴─────┐         │
│    ▼           ▼            ▼           ▼            ▼           ▼         │
│ ┌─────┐    ┌─────┐      ┌─────┐    ┌─────┐      ┌─────┐    ┌─────┐        │
│ │ DNS │    │ SMS │      │Voice│    │Email│      │ TG  │    │iMsg │        │
│ └─────┘    └─────┘      └─────┘    └─────┘      └─────┘    └─────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Priority Matrix

| Layer    | Effort                    | Reach          | Use Case                            |
|----------|---------------------------|----------------|-------------------------------------|
| SMS      | Low (Twilio webhook)      | Any phone      | When you only have cell signal      |
| Voice    | Medium (Twilio + STT/TTS) | Any phone      | Hands-free, driving, accessibility  |
| Telegram | Low (Bot API)             | Cross-platform | Share with Android friends, groups  |
| HTTP API | Low                       | Developers     | Shortcuts, automation, integrations |
| Email    | Medium                    | Universal      | Long-form, async, attachments       |

---

## Current Implementation Status

| Layer | Status | Access Point |
|-------|--------|--------------|
| DNS | ✅ Running | `dig @100.98.37.43 -p 5454 "query" TXT` |
| iMessage | ✅ Running | Text the Mac's iMessage |
| Claude Bridge | ✅ Running | `/cc`, `@N message` via iMessage |
| SMS | ⬜ Not started | — |
| Voice | ⬜ Not started | — |
| Telegram | ⬜ Not started | — |
| HTTP API | ⬜ Not started | — |
| Email | ⬜ Not started | — |
