/**
 * Chat Store - Zustand store for chat state management
 */

import { create } from "zustand";
import { ChatMessage, MessageStatus } from "../types";

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;

  // Actions
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessageStatus: (id: string, status: MessageStatus) => void;
  updateMessageContent: (id: string, content: string) => void;
  setTyping: (typing: boolean) => void;
  clearMessages: () => void;
}

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,

  addMessage: (message) => {
    const id = generateId();
    const fullMessage: ChatMessage = {
      ...message,
      id,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, fullMessage],
    }));

    return id;
  },

  updateMessageStatus: (id, status) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, status } : msg
      ),
    }));
  },

  updateMessageContent: (id, content) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      ),
    }));
  },

  setTyping: (typing) => {
    set({ isTyping: typing });
  },

  clearMessages: () => {
    set({ messages: [] });
  },
}));
