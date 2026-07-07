/**
 * Authentication store using Zustand + Supabase
 * Handles sign-up, sign-in, sign-out, session hydration,
 * and the auth-gate system for lazy sign-up flows.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useDailyStore } from './daily.store';
import { useCoachStore } from './coach.store';
import { useUserStore } from './user.store';
import { useActivityStore } from './activity.store';
import { useTreatDayStore } from './treatDay.store';
import { useStreakStore } from './streak.store';
import { useSocialStore } from './social.store';

type PendingAction = () => Promise<void>;

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  /** Whether the auth-gate modal is visible */
  showAuthGate: boolean;
  /** Action to replay after successful authentication */
  pendingAction: PendingAction | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
  /** Show the auth-gate modal and queue an action to replay after sign-in */
  openAuthGate: (action?: PendingAction) => void;
  /** Close the auth-gate modal and discard the pending action */
  closeAuthGate: () => void;
  /** Execute and clear the pending action (called after successful sign-in) */
  executePendingAction: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isInitialized: false,
  error: null,
  showAuthGate: false,
  pendingAction: null,

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Get existing session from AsyncStorage
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Auth init error:', error.message);
      }

      const initialUser = session?.user ?? null;
      set({
        session: session ?? null,
        user: initialUser,
        isLoading: false,
        isInitialized: true,
      });

      // Prime per-user stores for the initial session.
      if (initialUser) {
        useCoachStore.getState().loadPersistedState(initialUser.id);
      } else {
        useCoachStore.getState().resetAll();
      }

      // Listen for auth changes — when the user changes (sign-in, sign-out,
      // or account switch) reset volatile stores and re-hydrate for the new
      // identity so AsyncStorage state never leaks across accounts.
      supabase.auth.onAuthStateChange((event, nextSession) => {
        const prevUserId = get().user?.id ?? null;
        const nextUser = nextSession?.user ?? null;
        const nextUserId = nextUser?.id ?? null;

        set({
          session: nextSession ?? null,
          user: nextUser,
        });

        const userChanged = prevUserId !== nextUserId;
        const isSignOut = event === 'SIGNED_OUT' || !nextUserId;

        if (isSignOut) {
          useDailyStore.getState().reset();
          useUserStore.getState().reset();
          useCoachStore.getState().resetAll();
          useActivityStore.getState().reset();
          useTreatDayStore.getState().reset();
          useStreakStore.getState().reset();
          useSocialStore.getState().reset();
          return;
        }

        if (userChanged) {
          // Guest → signed-in "upgrade": prevUserId is null because guests have
          // no auth user. In that case DON'T reset the user store — its completed
          // guest profile is exactly what loadProfile() migrates to the new user
          // id, so the person isn't forced through onboarding a second time.
          const cameFromGuest = prevUserId === null;

          useDailyStore.getState().reset();
          useCoachStore.getState().resetAll();
          useActivityStore.getState().reset();
          useTreatDayStore.getState().reset();
          useStreakStore.getState().reset();
          useSocialStore.getState().reset();
          if (!cameFromGuest) {
            useUserStore.getState().reset();
          }
          // Re-load for new user (migrates the guest profile when present).
          useCoachStore.getState().loadPersistedState(nextUserId);
          useUserStore.getState().loadProfile();
          useDailyStore.getState().loadToday();
        }
      });
    } catch (error) {
      console.error('Auth initialization failed:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  signInWithGoogle: async (idToken: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({
        session: data.session,
        user: data.user,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign in failed';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      // Reset volatile stores immediately so the next account starts clean.
      useDailyStore.getState().reset();
      useUserStore.getState().reset();
      useCoachStore.getState().resetAll();
      set({
        session: null,
        user: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      useDailyStore.getState().reset();
      useUserStore.getState().reset();
      useCoachStore.getState().resetAll();
      set({ session: null, user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  openAuthGate: (action?: PendingAction) => {
    set({ showAuthGate: true, pendingAction: action ?? null });
  },

  closeAuthGate: () => {
    set({ showAuthGate: false, pendingAction: null });
  },

  executePendingAction: async () => {
    const { pendingAction } = get();
    if (pendingAction) {
      set({ pendingAction: null });
      try {
        await pendingAction();
      } catch (error) {
        console.warn('Pending action failed after auth:', error);
      }
    }
  },
}));
