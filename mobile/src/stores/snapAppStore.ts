/**
 * Snap App Store - Zustand store for Snap Apps state management
 *
 * Manages generated Snap Apps from Mino browser sessions,
 * saved apps library, and sharing functionality.
 *
 * Includes WebSocket sync for real-time updates from the backend.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// ============================================================================
// TYPES
// ============================================================================

export type SnapAppType =
  | 'price_comparison'
  | 'product_gallery'
  | 'article'
  | 'map_view'
  | 'availability'
  | 'code_block'
  | 'data_table'
  | 'smart_card';

export interface SnapAppInsight {
  icon: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral' | 'warning';
}

export interface SnapAppAction {
  label: string;
  icon: string;
  action: 'share' | 'save' | 'refresh' | 'open_url' | 'custom';
  url?: string;
}

export interface SnapApp {
  id: string;
  type: SnapAppType;
  title: string;
  subtitle?: string;
  timestamp: Date;
  sourceUrl?: string;
  shareUrl?: string;

  // Content varies by type
  data: Record<string, unknown>;

  // AI-generated insights
  insights: SnapAppInsight[];

  // Available actions
  actions: SnapAppAction[];

  // Metadata
  saved: boolean;
  viewed: boolean;
}

interface SnapAppState {
  // Recent Snap Apps (transient, from current/recent sessions)
  recentApps: SnapApp[];

  // Saved Snap Apps (persisted)
  savedApps: SnapApp[];

  // Currently focused app (for expanded view)
  focusedApp: SnapApp | null;

  // Actions
  addSnapApp: (app: Omit<SnapApp, 'id' | 'timestamp' | 'saved' | 'viewed'>) => void;
  saveApp: (appId: string) => void;
  unsaveApp: (appId: string) => void;
  deleteApp: (appId: string) => void;
  updateApp: (appId: string, updates: Partial<SnapApp>) => void;
  setFocusedApp: (app: SnapApp | null) => void;
  markViewed: (appId: string) => void;
  clearRecent: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useSnapAppStore = create<SnapAppState>()(
  persist(
    (set, get) => ({
      recentApps: [],
      savedApps: [],
      focusedApp: null,

      addSnapApp: (appData) => {
        const newApp: SnapApp = {
          ...appData,
          id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: new Date(),
          saved: false,
          viewed: false,
        };

        set((state) => ({
          recentApps: [newApp, ...state.recentApps].slice(0, 20), // Keep last 20
        }));
      },

      saveApp: (appId) => {
        const { recentApps, savedApps } = get();
        const app = recentApps.find((a) => a.id === appId) ||
                    savedApps.find((a) => a.id === appId);

        if (app && !app.saved) {
          const savedApp = { ...app, saved: true };

          set((state) => ({
            savedApps: [savedApp, ...state.savedApps],
            recentApps: state.recentApps.map((a) =>
              a.id === appId ? savedApp : a
            ),
          }));
        }
      },

      unsaveApp: (appId) => {
        set((state) => ({
          savedApps: state.savedApps.filter((a) => a.id !== appId),
          recentApps: state.recentApps.map((a) =>
            a.id === appId ? { ...a, saved: false } : a
          ),
        }));
      },

      deleteApp: (appId) => {
        set((state) => ({
          recentApps: state.recentApps.filter((a) => a.id !== appId),
          savedApps: state.savedApps.filter((a) => a.id !== appId),
          focusedApp: state.focusedApp?.id === appId ? null : state.focusedApp,
        }));
      },

      updateApp: (appId, updates) => {
        set((state) => ({
          recentApps: state.recentApps.map((a) =>
            a.id === appId ? { ...a, ...updates } : a
          ),
          savedApps: state.savedApps.map((a) =>
            a.id === appId ? { ...a, ...updates } : a
          ),
          focusedApp:
            state.focusedApp?.id === appId
              ? { ...state.focusedApp, ...updates }
              : state.focusedApp,
        }));
      },

      setFocusedApp: (app) => {
        set({ focusedApp: app });
      },

      markViewed: (appId) => {
        set((state) => ({
          recentApps: state.recentApps.map((a) =>
            a.id === appId ? { ...a, viewed: true } : a
          ),
          savedApps: state.savedApps.map((a) =>
            a.id === appId ? { ...a, viewed: true } : a
          ),
        }));
      },

      clearRecent: () => {
        set({ recentApps: [] });
      },
    }),
    {
      name: 'mino-snap-apps',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedApps: state.savedApps,
      }),
    }
  )
);

// ============================================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================================

export const MOCK_SNAP_APPS: Omit<SnapApp, 'id' | 'timestamp' | 'saved' | 'viewed'>[] = [
  {
    type: 'price_comparison',
    title: 'Tokyo Hotels Under $200',
    subtitle: '12 options found',
    sourceUrl: 'https://booking.com/tokyo',
    data: {
      items: [
        { name: 'Hotel Gracery Shinjuku', price: 142, rating: 4.5, image: 'hotel1' },
        { name: 'Shibuya Stream Excel', price: 189, rating: 4.7, image: 'hotel2' },
        { name: 'The Gate Hotel Asakusa', price: 175, rating: 4.6, image: 'hotel3' },
      ],
      currency: 'USD',
      checkIn: '2026-02-15',
      checkOut: '2026-02-18',
    },
    insights: [
      { icon: '📉', text: 'Prices 15% lower than last month', type: 'positive' },
      { icon: '⭐', text: 'Gracery has best value/rating ratio', type: 'neutral' },
    ],
    actions: [
      { label: 'Share', icon: '🔗', action: 'share' },
      { label: 'Save', icon: '📌', action: 'save' },
    ],
  },
  {
    type: 'product_gallery',
    title: 'Best Mechanical Keyboards 2026',
    subtitle: '8 top picks',
    sourceUrl: 'https://rtings.com/keyboards',
    data: {
      items: [
        { name: 'Keychron Q1 Pro', price: 199, score: 9.2, image: 'kb1' },
        { name: 'GMMK Pro', price: 169, score: 8.8, image: 'kb2' },
        { name: 'Mode Sixty-Five', price: 349, score: 9.5, image: 'kb3' },
      ],
    },
    insights: [
      { icon: '🎯', text: 'Q1 Pro offers best balance of features', type: 'positive' },
      { icon: '💰', text: 'GMMK Pro is best budget option', type: 'neutral' },
    ],
    actions: [
      { label: 'Share', icon: '🔗', action: 'share' },
      { label: 'Save', icon: '📌', action: 'save' },
    ],
  },
  {
    type: 'article',
    title: 'React Native Performance Tips',
    subtitle: 'From official docs',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    data: {
      summary: 'Key optimizations include using memo(), FlatList virtualization, and avoiding inline styles...',
      keyPoints: [
        'Use React.memo() for expensive components',
        'Implement getItemLayout in FlatList',
        'Move styles outside render',
      ],
    },
    insights: [
      { icon: '⚡', text: 'These tips can improve FPS by 40%', type: 'positive' },
    ],
    actions: [
      { label: 'Share', icon: '🔗', action: 'share' },
      { label: 'Open', icon: '🌐', action: 'open_url', url: 'https://reactnative.dev/docs/performance' },
    ],
  },
  {
    type: 'availability',
    title: 'Flight Prices: SFO → NRT',
    subtitle: 'Next 30 days',
    sourceUrl: 'https://google.com/flights',
    data: {
      origin: 'SFO',
      destination: 'NRT',
      dates: [
        { date: '2026-02-10', price: 892, available: true },
        { date: '2026-02-11', price: 945, available: true },
        { date: '2026-02-12', price: 1102, available: false },
        { date: '2026-02-13', price: 876, available: true },
        { date: '2026-02-14', price: 1245, available: true },
      ],
    },
    insights: [
      { icon: '✈️', text: 'Feb 13 has lowest fare this month', type: 'positive' },
      { icon: '⚠️', text: 'Valentines weekend prices 40% higher', type: 'warning' },
    ],
    actions: [
      { label: 'Share', icon: '🔗', action: 'share' },
      { label: 'Save', icon: '📌', action: 'save' },
      { label: 'Refresh', icon: '🔄', action: 'refresh' },
    ],
  },
];

// Initialize with mock data for development
export function initializeMockData() {
  const store = useSnapAppStore.getState();
  if (store.recentApps.length === 0) {
    MOCK_SNAP_APPS.forEach((app) => {
      store.addSnapApp(app);
    });
  }
}

// ============================================================================
// WEBSOCKET SYNC
// ============================================================================

// WebSocket message types from backend
interface MobileSyncMessage {
  type: 'CONNECTED' | 'SNAP_APP' | 'SNAP_APP_UPDATE' | 'SNAP_APP_DELETE' | 'PONG';
  payload?: unknown;
  timestamp: number;
}

// WebSocket connection state
let wsConnection: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;

/**
 * Initialize WebSocket sync for real-time Snap App updates from backend
 */
export function initSnapAppSync(phone: string, serverUrl: string = 'ws://localhost:8082'): WebSocket {
  // Clean up existing connection
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  const wsUrl = `${serverUrl}?phone=${encodeURIComponent(phone)}`;
  console.log(`📱 Connecting to Snap App sync: ${wsUrl}`);

  const ws = new WebSocket(wsUrl);
  wsConnection = ws;

  ws.onopen = () => {
    console.log('📱 Snap App sync connected');

    // Start ping interval for keep-alive
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 30000); // Ping every 30 seconds
  };

  ws.onmessage = (event) => {
    try {
      const message: MobileSyncMessage = JSON.parse(event.data as string);
      const store = useSnapAppStore.getState();

      switch (message.type) {
        case 'CONNECTED':
          console.log('📱 Snap App sync authenticated');
          break;

        case 'SNAP_APP':
          // New Snap App from backend
          if (message.payload) {
            const snapApp = message.payload as Omit<SnapApp, 'id' | 'timestamp' | 'saved' | 'viewed'>;
            store.addSnapApp(snapApp);

            // Haptic feedback for new card
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            console.log(`📱 Received new Snap App: ${snapApp.title}`);
          }
          break;

        case 'SNAP_APP_UPDATE':
          // Update existing Snap App
          if (message.payload) {
            const { id, updates } = message.payload as { id: string; updates: Partial<SnapApp> };
            store.updateApp(id, updates);
            console.log(`📱 Snap App updated: ${id}`);
          }
          break;

        case 'SNAP_APP_DELETE':
          // Delete Snap App
          if (message.payload) {
            const { id } = message.payload as { id: string };
            store.deleteApp(id);
            console.log(`📱 Snap App deleted: ${id}`);
          }
          break;

        case 'PONG':
          // Keep-alive response, no action needed
          break;

        default:
          console.log(`📱 Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error('📱 Failed to parse WebSocket message:', err);
    }
  };

  ws.onclose = (event) => {
    console.log(`📱 Snap App sync disconnected: ${event.code}`);

    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    // Reconnect after 5 seconds (unless intentionally closed)
    if (event.code !== 1000) {
      reconnectTimeout = setTimeout(() => {
        console.log('📱 Attempting to reconnect...');
        initSnapAppSync(phone, serverUrl);
      }, 5000);
    }
  };

  ws.onerror = (error) => {
    console.error('📱 Snap App sync error:', error);
  };

  return ws;
}

/**
 * Disconnect WebSocket sync
 */
export function disconnectSnapAppSync(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }

  if (wsConnection) {
    wsConnection.close(1000, 'User disconnect');
    wsConnection = null;
  }

  console.log('📱 Snap App sync disconnected');
}

/**
 * Check if WebSocket is connected
 */
export function isSnapAppSyncConnected(): boolean {
  return wsConnection !== null && wsConnection.readyState === WebSocket.OPEN;
}
