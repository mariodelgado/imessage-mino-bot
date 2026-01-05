/**
 * Mino Store - Zustand store for Mino browser session state
 */

import { create } from "zustand";
import { MinoSession, MinoScreenshot, MinoAction } from "../types";

interface MinoState {
  session: MinoSession | null;
  latestScreenshot: MinoScreenshot | null;

  // Actions
  startSession: (id: string, url: string, goal: string) => void;
  addScreenshot: (base64: string) => void;
  addAction: (action: string, thought?: string) => void;
  setResult: (result: unknown) => void;
  setError: (error: string) => void;
  endSession: () => void;
}

export const useMinoStore = create<MinoState>((set, get) => ({
  session: null,
  latestScreenshot: null,

  startSession: (id, url, goal) => {
    set({
      session: {
        id,
        url,
        goal,
        status: "starting",
        screenshots: [],
        actions: [],
      },
      latestScreenshot: null,
    });
  },

  addScreenshot: (base64) => {
    const screenshot: MinoScreenshot = {
      timestamp: new Date(),
      base64,
    };

    set((state) => {
      if (!state.session) return state;

      return {
        session: {
          ...state.session,
          status: "active",
          screenshots: [...state.session.screenshots, screenshot],
        },
        latestScreenshot: screenshot,
      };
    });
  },

  addAction: (action, thought) => {
    const minoAction: MinoAction = {
      timestamp: new Date(),
      action,
      thought,
    };

    set((state) => {
      if (!state.session) return state;

      return {
        session: {
          ...state.session,
          actions: [...state.session.actions, minoAction],
        },
      };
    });
  },

  setResult: (result) => {
    set((state) => {
      if (!state.session) return state;

      return {
        session: {
          ...state.session,
          status: "completed",
          result,
        },
      };
    });
  },

  setError: (error) => {
    set((state) => {
      if (!state.session) return state;

      return {
        session: {
          ...state.session,
          status: "error",
          result: { error },
        },
      };
    });
  },

  endSession: () => {
    set({ session: null, latestScreenshot: null });
  },
}));
