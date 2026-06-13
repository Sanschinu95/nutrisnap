/**
 * Authentication store using Zustand + Supabase
 * Handles sign-up, sign-in, sign-out, and session hydration
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Get existing session from AsyncStorage
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('Auth init error:', error.message);
      }

      set({
        session: session ?? null,
        user: session?.user ?? null,
        isLoading: false,
        isInitialized: true,
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session: session ?? null,
          user: session?.user ?? null,
        });
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
      set({
        session: null,
        user: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      set({ session: null, user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
