/**
 * Authentication store using Zustand
 * MOCK version — no Supabase, always "logged in" for local testing
 */

import { create } from 'zustand';

/** Lightweight fake session so the rest of the app thinks we are authenticated */
const MOCK_USER_ID = 'local-mock-user-0001';

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 999999,
  token_type: 'bearer' as const,
  user: {
    id: MOCK_USER_ID,
    email: 'local@nutrisnap.dev',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { full_name: 'NutriSnap Tester' },
    created_at: new Date().toISOString(),
  },
} as any;

interface AuthState {
  session: any;
  user: any;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const MOCK_USER_ID_CONST = MOCK_USER_ID;

export const useAuthStore = create<AuthStore>((set) => ({
  // Start already "logged in"
  session: MOCK_SESSION,
  user: MOCK_SESSION.user,
  isLoading: false,
  isInitialized: true,
  error: null,

  initialize: async () => {
    // No-op – we're already initialized with mock data
    set({ isLoading: false, isInitialized: true, session: MOCK_SESSION, user: MOCK_SESSION.user });
  },

  signInWithGoogle: async () => ({ success: true }),
  signInWithEmail: async () => ({ success: true }),
  signUpWithEmail: async () => ({ success: true }),

  signOut: async () => {
    console.log('[mock] signOut called – staying logged in for testing');
  },

  clearError: () => set({ error: null }),
}));
