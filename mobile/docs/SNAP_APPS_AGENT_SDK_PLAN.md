# Snap Apps + Claude Agent SDK Integration Plan

## Overview

This plan describes how to integrate the Claude Agent SDK to **intelligently generate Snap Apps** from Mino browser results. Instead of relying on simple JSON parsing, the Agent SDK enables:

1. **Intelligent Data Extraction** - Agents parse raw web data and extract structured, actionable insights
2. **Type Detection** - Agents determine the best Snap App type (price_comparison, product_gallery, article, etc.)
3. **Insight Generation** - Agents create helpful insights ("Prices 15% lower than last month")
4. **Action Planning** - Agents suggest relevant actions (share, save, open in app)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           iMessage Bot (Backend)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User Message → Router → Mino Browser → Raw Data                       │
│                                     ↓                                   │
│                        ┌────────────────────────┐                       │
│                        │   Claude Agent SDK     │                       │
│                        │   "Snap App Generator" │                       │
│                        └────────────────────────┘                       │
│                                     ↓                                   │
│                        ┌────────────────────────┐                       │
│                        │   Structured Snap App  │                       │
│                        │   {type, data, etc}    │                       │
│                        └────────────────────────┘                       │
│                                     ↓                                   │
│                        ┌────────────────────────┐                       │
│                        │   Push to Mobile App   │                       │
│                        │   via WebSocket/SSE    │                       │
│                        └────────────────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          Mobile App (Frontend)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  HomeScreen → SnapAppCard → Type-Specific Renderers                    │
│       ↑                                                                 │
│  snapAppStore (Zustand) ← WebSocket/SSE ← Backend                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend - Claude Agent SDK Integration

### 1.1 Install Agent SDK

```bash
npm install @anthropic-ai/claude-agent-sdk
```

> **Note**: The SDK was renamed from `@anthropic-ai/claude-code` to `@anthropic-ai/claude-agent-sdk` in late 2025.

### 1.2 Create Snap App Generator Agent

**File: `/snap-app-agent.ts`**

```typescript
import { Agent, Tool } from '@anthropic-ai/claude-agent-sdk';

// Define the Snap App schema
interface SnapAppSchema {
  type: 'price_comparison' | 'product_gallery' | 'article' | 'map_view' |
        'availability' | 'code_block' | 'data_table' | 'smart_card';
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
  insights: Array<{
    icon: string;
    text: string;
    type: 'positive' | 'negative' | 'neutral' | 'warning';
  }>;
  actions: Array<{
    label: string;
    icon: string;
    action: 'share' | 'save' | 'refresh' | 'open_url';
    url?: string;
  }>;
}

// Create the Snap App Generator agent
export const snapAppAgent = new Agent({
  name: 'snap-app-generator',
  systemPrompt: `You are a Snap App Generator. Your job is to transform raw web data into beautiful, interactive card formats.

Given raw data from a web page, you will:
1. DETECT the most appropriate card type based on the data structure
2. EXTRACT the most relevant information in a structured format
3. GENERATE helpful insights about the data
4. SUGGEST relevant actions the user can take

Card Types:
- price_comparison: For comparing prices across vendors/options
- product_gallery: For showcasing products with images, prices, ratings
- article: For summarizing articles with key points
- map_view: For location-based data with addresses
- availability: For date/time availability calendars
- code_block: For code snippets with syntax highlighting
- data_table: For tabular data comparisons
- smart_card: For any other structured data

Always generate at least 1-2 insights that provide VALUE to the user.
Insights should be actionable or informative (e.g., "Cheapest option saves $45", "Highly rated with 4.8 stars").`,

  tools: [
    new Tool({
      name: 'emit_snap_app',
      description: 'Output the generated Snap App',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['price_comparison', 'product_gallery', 'article', 'map_view', 'availability', 'code_block', 'data_table', 'smart_card'] },
          title: { type: 'string', description: 'Concise title (max 50 chars)' },
          subtitle: { type: 'string', description: 'Optional subtitle with count or context' },
          data: { type: 'object', description: 'Structured data for the card type' },
          insights: { type: 'array', items: { type: 'object' } },
          actions: { type: 'array', items: { type: 'object' } },
        },
        required: ['type', 'title', 'data', 'insights', 'actions'],
      },
    }),
  ],
});
```

### 1.3 Integrate Agent into Mino Pipeline

**Modify: `/index.ts` - `handleMinoRequest()`**

```typescript
import { snapAppAgent } from './snap-app-agent';
import { pushSnapAppToMobile } from './mobile-sync';

async function handleMinoRequest(request, sender) {
  // ... existing Mino automation code ...

  const result = await runMinoAutomation(apiKey, url, request.goal);
  const { text, data } = formatMinoForIMessage(result, url, request.goal);

  // NEW: Generate Snap App using Claude Agent
  if (data) {
    try {
      const snapApp = await snapAppAgent.run({
        input: `
          Source URL: ${url}
          User Goal: ${request.goal}
          Raw Data: ${JSON.stringify(data, null, 2)}

          Generate a Snap App from this data.
        `,
      });

      // Push to mobile app
      await pushSnapAppToMobile(sender, snapApp);

      console.log(`✨ Generated Snap App: ${snapApp.type} - ${snapApp.title}`);
    } catch (err) {
      console.error('Snap App generation failed:', err);
    }
  }

  // ... rest of existing code ...
}
```

---

## Phase 2: Real-time Sync to Mobile

### 2.1 WebSocket Server for Push Updates

**File: `/mobile-sync.ts`**

```typescript
import { WebSocket, WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8082 });
const clients = new Map<string, WebSocket>(); // phone -> ws

wss.on('connection', (ws, req) => {
  const phone = req.url?.split('phone=')[1];
  if (phone) {
    clients.set(phone, ws);
    console.log(`📱 Mobile connected: ${phone}`);
  }

  ws.on('close', () => {
    if (phone) clients.delete(phone);
  });
});

export async function pushSnapAppToMobile(phone: string, snapApp: SnapApp) {
  const ws = clients.get(phone);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'SNAP_APP',
      payload: snapApp,
    }));
    console.log(`📤 Pushed Snap App to ${phone}`);
  }
}
```

### 2.2 Mobile App WebSocket Client

**Modify: `/mobile/src/stores/snapAppStore.ts`**

```typescript
// Add WebSocket sync
export function initSnapAppSync(phone: string) {
  const ws = new WebSocket(`ws://localhost:8082?phone=${phone}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'SNAP_APP') {
      const store = useSnapAppStore.getState();
      store.addSnapApp(message.payload);

      // Haptic feedback on new card
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  ws.onclose = () => {
    // Reconnect after 5 seconds
    setTimeout(() => initSnapAppSync(phone), 5000);
  };

  return ws;
}
```

---

## Phase 3: Agent-Powered Features

### 3.1 Smart Insights Generator

The Agent SDK enables sophisticated insight generation:

```typescript
// Example insights the agent might generate:

// For price_comparison:
insights: [
  { icon: '📉', text: 'Prices 15% lower than last month', type: 'positive' },
  { icon: '⭐', text: 'Gracery has best value/rating ratio', type: 'neutral' },
]

// For availability:
insights: [
  { icon: '✈️', text: 'Feb 13 has lowest fare this month', type: 'positive' },
  { icon: '⚠️', text: 'Valentines weekend prices 40% higher', type: 'warning' },
]

// For article:
insights: [
  { icon: '⚡', text: 'These tips can improve FPS by 40%', type: 'positive' },
  { icon: '📖', text: '5 min read', type: 'neutral' },
]
```

### 3.2 Contextual Actions

The agent suggests relevant actions based on data type:

```typescript
// For product_gallery:
actions: [
  { label: 'Compare', icon: '📊', action: 'custom', handler: 'open_comparison' },
  { label: 'Add to Cart', icon: '🛒', action: 'open_url', url: 'https://...' },
]

// For map_view:
actions: [
  { label: 'Directions', icon: '🗺️', action: 'open_url', url: 'maps://...' },
  { label: 'Call', icon: '📞', action: 'open_url', url: 'tel:...' },
]
```

### 3.3 Multi-Card Generation

For complex queries, the agent can generate multiple cards:

```typescript
// User: "Compare flights from SFO to Tokyo"

// Agent generates:
[
  {
    type: 'availability',
    title: 'SFO → NRT Prices',
    subtitle: 'Next 30 days',
    data: { dates: [...] },
  },
  {
    type: 'price_comparison',
    title: 'Airlines Compared',
    subtitle: '6 airlines',
    data: { items: [...] },
  },
]
```

---

## Phase 4: Update Navigation

### 4.1 Add Home Tab to App.tsx

```typescript
// App.tsx
<Tab.Navigator>
  <Tab.Screen
    name="Home"
    component={HomeScreen}
    options={{
      tabBarIcon: ({ color }) => <HomeIcon color={color} />,
    }}
  />
  <Tab.Screen name="Chat" component={ChatScreen} />
  <Tab.Screen name="Browser" component={MinoBrowserScreen} />
  <Tab.Screen name="Settings" component={SettingsScreen} />
</Tab.Navigator>
```

---

## Implementation Checklist

### Backend
- [ ] Install Claude Agent SDK
- [ ] Create `snap-app-agent.ts`
- [ ] Create `mobile-sync.ts` WebSocket server
- [ ] Integrate agent into `handleMinoRequest()`
- [ ] Add type detection logic
- [ ] Add insight generation
- [ ] Add action suggestion

### Frontend (Mobile)
- [x] Create `snapAppStore.ts` (DONE)
- [x] Create `SnapAppCard.tsx` (DONE)
- [x] Create `HomeScreen.tsx` (DONE)
- [ ] Add WebSocket sync to store
- [ ] Update `App.tsx` navigation
- [ ] Export components from index
- [ ] Test end-to-end flow

### Testing
- [ ] Test with various data types (prices, products, articles)
- [ ] Test WebSocket reconnection
- [ ] Test haptic feedback on new cards
- [ ] Test card interactions (press, save, share)

---

## Benefits of Agent SDK Approach

1. **Intelligent Type Detection** - No hardcoded rules; the agent understands context
2. **Rich Insights** - Agents can analyze trends, compare values, spot anomalies
3. **Adaptive Actions** - Relevant actions based on data and user intent
4. **Natural Language Understanding** - Works with any Mino query
5. **Iterative Refinement** - Agent can be prompted to improve outputs

---

## Environment Variables Needed

```bash
# Add to .env
ANTHROPIC_API_KEY=sk-ant-...
MOBILE_WS_PORT=8082
```

---

## Future Enhancements

1. **Card Templates** - Pre-designed templates for common use cases
2. **User Preferences** - Learn which card types user prefers
3. **Collaborative Cards** - Share cards between users
4. **Card History** - Browse past generated cards
5. **Offline Support** - Cache cards for offline viewing
