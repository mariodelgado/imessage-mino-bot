/**
 * Settings Store - Zustand store for app settings
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, DEFAULT_SETTINGS } from "../types";

interface SettingsState extends AppSettings {
  // Actions
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  resetToDefaults: () => void;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Convenience setters
  setServerUrl: (url: string) => void;
  setOnDeviceLlmEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      updateSetting: (key, value) => {
        set((state) => ({
          ...state,
          [key]: value,
        }));
      },

      resetToDefaults: () => {
        set(DEFAULT_SETTINGS);
      },

      setSettings: (settings) => {
        set((state) => ({
          ...state,
          ...settings,
        }));
      },

      // Convenience setters
      setServerUrl: (url) => set({ serverUrl: url }),
      setOnDeviceLlmEnabled: (enabled) => set({ onDeviceLlmEnabled: enabled }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setHapticFeedbackEnabled: (enabled) => set({ hapticFeedback: enabled }),
    }),
    {
      name: "mino-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useSettingsStore;
