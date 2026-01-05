/**
 * Notification Store - Manages push notification state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  registerForPushNotifications,
  scheduleMorningUpdate,
  cancelMorningUpdates,
  clearNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  PushToken,
} from "../services/notifications";

interface NotificationState {
  // Push token
  pushToken: PushToken | null;
  isRegistered: boolean;

  // Settings
  morningUpdatesEnabled: boolean;
  morningUpdateTime: { hour: number; minute: number };

  // Unread count
  unreadCount: number;

  // Actions
  registerPushToken: () => Promise<boolean>;
  setMorningUpdates: (
    enabled: boolean,
    time?: { hour: number; minute: number }
  ) => Promise<void>;
  incrementUnread: () => void;
  clearUnread: () => void;
  initialize: (
    onNotificationTapped: (data: Record<string, unknown>) => void
  ) => () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      pushToken: null,
      isRegistered: false,
      morningUpdatesEnabled: false,
      morningUpdateTime: { hour: 8, minute: 0 },
      unreadCount: 0,

      registerPushToken: async () => {
        const token = await registerForPushNotifications();
        if (token) {
          set({ pushToken: token, isRegistered: true });
          return true;
        }
        return false;
      },

      setMorningUpdates: async (enabled, time) => {
        const currentTime = time || get().morningUpdateTime;

        if (enabled) {
          await scheduleMorningUpdate(currentTime.hour, currentTime.minute);
        } else {
          await cancelMorningUpdates();
        }

        set({
          morningUpdatesEnabled: enabled,
          ...(time && { morningUpdateTime: time }),
        });
      },

      incrementUnread: () => {
        set((state) => ({ unreadCount: state.unreadCount + 1 }));
      },

      clearUnread: async () => {
        await clearNotifications();
        set({ unreadCount: 0 });
      },

      initialize: (onNotificationTapped) => {
        // Handle notifications received while app is foregrounded
        const receivedSub = addNotificationReceivedListener((notification) => {
          console.log("Notification received:", notification);
          get().incrementUnread();
        });

        // Handle notification taps
        const responseSub = addNotificationResponseListener((response) => {
          console.log("Notification tapped:", response);
          const data = response.notification.request.content
            .data as Record<string, unknown>;
          onNotificationTapped(data);
        });

        // Check if app was opened from notification
        getLastNotificationResponse().then((response) => {
          if (response) {
            const data = response.notification.request.content
              .data as Record<string, unknown>;
            onNotificationTapped(data);
          }
        });

        // Return cleanup function
        return () => {
          receivedSub.remove();
          responseSub.remove();
        };
      },
    }),
    {
      name: "mino-notifications",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pushToken: state.pushToken,
        isRegistered: state.isRegistered,
        morningUpdatesEnabled: state.morningUpdatesEnabled,
        morningUpdateTime: state.morningUpdateTime,
      }),
    }
  )
);
