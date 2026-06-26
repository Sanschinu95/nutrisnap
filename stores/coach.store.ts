/**
 * Coach state: in-session chat history, daily question budget (resets at
 * local midnight), and the user's pinned-to-Home insight. AsyncStorage
 * persists the budget + pinned insight across launches; chat history is
 * intentionally in-memory only — the system prompt's 7-day data provides
 * continuity, not a saved conversation log.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action: string | null;
  timestamp: number;
}

export interface PinnedInsightState {
  text: string;
  fromMessageId: string;
  pinnedAt: number;
}

interface CoachState {
  messages: ChatMessage[];
  isLoading: boolean;
  questionsUsedToday: number;
  dailyLimit: number;
  lastResetDate: string; // YYYY-MM-DD local
  pinnedInsight: PinnedInsightState | null;
}

interface CoachActions {
  addMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
  incrementQuestionCount: () => void;
  canAskQuestion: () => boolean;
  getRemainingQuestions: () => number;
  pinInsight: (text: string, messageId: string) => void;
  unpinInsight: () => void;
  loadPersistedState: () => Promise<void>;
}

const DAILY_LIMIT = 5;
const STORAGE_KEY = 'nutrisnap_coach_state';

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function persist(state: CoachState): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        questionsUsedToday: state.questionsUsedToday,
        lastResetDate: state.lastResetDate,
        pinnedInsight: state.pinnedInsight,
      }),
    );
  } catch {
    // ignore — coach features should never break the app
  }
}

export const useCoachStore = create<CoachState & CoachActions>((set, get) => ({
  messages: [],
  isLoading: false,
  questionsUsedToday: 0,
  dailyLimit: DAILY_LIMIT,
  lastResetDate: todayLocal(),
  pinnedInsight: null,

  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg] }));
    persist(get());
  },

  setLoading: (loading) => set({ isLoading: loading }),

  clearChat: () => {
    set({ messages: [] });
  },

  incrementQuestionCount: () => {
    const today = todayLocal();
    set((state) =>
      state.lastResetDate !== today
        ? { questionsUsedToday: 1, lastResetDate: today }
        : { questionsUsedToday: state.questionsUsedToday + 1 },
    );
    persist(get());
  },

  canAskQuestion: () => {
    const today = todayLocal();
    const state = get();
    if (state.lastResetDate !== today) return true;
    return state.questionsUsedToday < state.dailyLimit;
  },

  getRemainingQuestions: () => {
    const today = todayLocal();
    const state = get();
    if (state.lastResetDate !== today) return state.dailyLimit;
    return Math.max(0, state.dailyLimit - state.questionsUsedToday);
  },

  pinInsight: (text, messageId) => {
    set({ pinnedInsight: { text, fromMessageId: messageId, pinnedAt: Date.now() } });
    persist(get());
  },

  unpinInsight: () => {
    set({ pinnedInsight: null });
    persist(get());
  },

  loadPersistedState: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CoachState>;
      const today = todayLocal();
      set({
        questionsUsedToday:
          parsed.lastResetDate === today ? (parsed.questionsUsedToday ?? 0) : 0,
        lastResetDate: today,
        pinnedInsight: parsed.pinnedInsight ?? null,
      });
    } catch {
      // ignore corrupt state
    }
  },
}));
