/**
 * Coach state: in-session chat history, daily question budget (resets at
 * local midnight), and the user's pinned-to-Home insights (max 3).
 * AsyncStorage persists the budget, pinned insights, and the last 20
 * conversation messages — all keyed per user so accounts don't leak state.
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

const MAX_PINS = 3;
const MAX_HISTORY = 20;

interface CoachState {
  messages: ChatMessage[];
  isLoading: boolean;
  questionsUsedToday: number;
  dailyLimit: number;
  lastResetDate: string;
  pinnedInsights: PinnedInsightState[];
  /** Saved messages from last session, surfaced as "Continue last conversation". */
  savedConversation: ChatMessage[];
  currentUserId: string | null;
}

interface CoachActions {
  addMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  clearChat: () => void;
  incrementQuestionCount: () => void;
  canAskQuestion: () => boolean;
  getRemainingQuestions: () => number;
  pinInsight: (text: string, messageId: string) => boolean;
  unpinInsight: (messageId: string) => void;
  unpinAll: () => void;
  /** Restore the saved conversation into the active messages list. */
  resumeSavedConversation: () => void;
  /** Discard the saved conversation. */
  dismissSavedConversation: () => void;
  loadPersistedState: (userId: string | null) => Promise<void>;
  /** Clear all in-memory state (called on sign-out). */
  resetAll: () => void;
}

const DAILY_LIMIT = 5;
const STORAGE_PREFIX = 'nutrisnap_coach_state';

function storageKeyFor(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : `${STORAGE_PREFIX}_anon`;
}

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface PersistedShape {
  questionsUsedToday?: number;
  lastResetDate?: string;
  pinnedInsights?: PinnedInsightState[];
  savedConversation?: ChatMessage[];
}

async function persist(userId: string | null, state: CoachState): Promise<void> {
  try {
    const payload: PersistedShape = {
      questionsUsedToday: state.questionsUsedToday,
      lastResetDate: state.lastResetDate,
      pinnedInsights: state.pinnedInsights,
      savedConversation: state.messages.slice(-MAX_HISTORY),
    };
    await AsyncStorage.setItem(storageKeyFor(userId), JSON.stringify(payload));
  } catch {
    // Coach features should never break the app.
  }
}

const initialState: CoachState = {
  messages: [],
  isLoading: false,
  questionsUsedToday: 0,
  dailyLimit: DAILY_LIMIT,
  lastResetDate: todayLocal(),
  pinnedInsights: [],
  savedConversation: [],
  currentUserId: null,
};

export const useCoachStore = create<CoachState & CoachActions>((set, get) => ({
  ...initialState,

  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg] }));
    persist(get().currentUserId, get());
  },

  setLoading: (loading) => set({ isLoading: loading }),

  clearChat: () => {
    set({ messages: [] });
    persist(get().currentUserId, get());
  },

  incrementQuestionCount: () => {
    const today = todayLocal();
    set((state) =>
      state.lastResetDate !== today
        ? { questionsUsedToday: 1, lastResetDate: today }
        : { questionsUsedToday: state.questionsUsedToday + 1 },
    );
    persist(get().currentUserId, get());
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
    const current = get().pinnedInsights;
    if (current.find((p) => p.fromMessageId === messageId)) return false;
    if (current.length >= MAX_PINS) return false;
    const next: PinnedInsightState = {
      text,
      fromMessageId: messageId,
      pinnedAt: Date.now(),
    };
    set({ pinnedInsights: [next, ...current] });
    persist(get().currentUserId, get());
    return true;
  },

  unpinInsight: (messageId) => {
    set({
      pinnedInsights: get().pinnedInsights.filter(
        (p) => p.fromMessageId !== messageId,
      ),
    });
    persist(get().currentUserId, get());
  },

  unpinAll: () => {
    set({ pinnedInsights: [] });
    persist(get().currentUserId, get());
  },

  resumeSavedConversation: () => {
    set({
      messages: get().savedConversation,
      savedConversation: [],
    });
    persist(get().currentUserId, get());
  },

  dismissSavedConversation: () => {
    set({ savedConversation: [] });
    persist(get().currentUserId, get());
  },

  loadPersistedState: async (userId) => {
    // Always reset volatile state when the user identity changes.
    if (get().currentUserId !== userId) {
      set({
        ...initialState,
        currentUserId: userId,
        lastResetDate: todayLocal(),
      });
    }
    try {
      const raw = await AsyncStorage.getItem(storageKeyFor(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedShape;
      const today = todayLocal();
      set({
        questionsUsedToday:
          parsed.lastResetDate === today ? (parsed.questionsUsedToday ?? 0) : 0,
        lastResetDate: today,
        pinnedInsights: parsed.pinnedInsights ?? [],
        savedConversation: parsed.savedConversation ?? [],
        currentUserId: userId,
      });
    } catch {
      // Corrupt state — keep the reset defaults.
    }
  },

  resetAll: () => {
    set({ ...initialState });
  },
}));
