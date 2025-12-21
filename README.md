# iMessage Mino Bot

A personal AI assistant via iMessage with:
- **Gemini 2.5 Flash** with agentic chain for natural language understanding
- **Mino** browser automation for real-time web data
- **iOS features** — location cards, calendar events, voice messages
- **Scheduled alerts** with change detection and morning briefs

## Setup

### Prerequisites
- macOS with iMessage configured
- Node.js 18+
- GCP project with Vertex AI enabled
- Mino API key (optional — users can connect their own)

### Environment Variables

Create a `.env` file:

```bash
# Required
GEMINI_API_KEY=your-gemini-api-key

# Optional
MINO_API_KEY=your-mino-api-key          # Default Mino key, or users connect via OAuth
GCP_PROJECT_ID=your-gcp-project         # For Imagen (image generation)
GCP_LOCATION=us-central1                # Vertex AI region
ALLOWED_CONTACTS=+1234567890,+0987654321  # Restrict to specific numbers (empty = everyone)
```

### Install & Run

```bash
npm install
npm start
```

### Development

```bash
npm run dev  # Watch mode with auto-reload
```

## Features

### Natural Language
Just text naturally:
- "What's on the menu at Philz?"
- "Alert me when Winter Bliss is available every morning"
- "Remind me in 5 minutes to check the oven"
- "Send a voice message saying hello"

### Commands (all also work via natural language)
- `/help` — Show help
- `/clear` — Reset conversation
- `/connect` — Link Mino account
- `/alerts` — View your alerts
- `/alert new` — Create monitoring alert
- `/voice [text]` — Send voice message
- `/remind 5m [msg]` — Quick reminder
- `/home [scene]` — Trigger HomeKit scene

### Alerts
Monitor any website and get notified on changes:
- "Set an alert for philzcoffee.com every morning"
- Change detection — only notifies when data changes
- Morning brief — aggregates multiple alerts into one message

### iOS Features
Automatically sends rich content:
- 📍 Location cards with map pins
- 📅 Calendar invites
- 👤 Contact cards
- 🎙️ Voice messages
- 🏠 HomeKit deep links

## Architecture

```
index.ts          — Main bot, message handling
gemini.ts         — Gemini API, agentic router
mino.ts           — Mino browser automation
scheduler.ts      — Cron-based alert scheduling
ios-features.ts   — iOS rich content generation
image-gen.ts      — Imagen for visual cards
oauth-server.ts   — Mino OAuth flow
db.ts             — SQLite user/message storage
```

## License

MIT
