/**
 * useAuthGate — convenience hook for gating write actions behind authentication.
 *
 * Usage:
 *   const { requireAuth } = useAuthGate();
 *   const handleSave = () => requireAuth(async () => { await saveMeal(); });
 *
 * If the user is already authenticated the action runs immediately.
 * If not, the auth-gate modal opens and the action is queued — it will
 * automatically replay once sign-in succeeds.
 */

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function useAuthGate() {
  const user = useAuthStore((s) => s.user);
  const openAuthGate = useAuthStore((s) => s.openAuthGate);

  /**
   * Wrap any Supabase-write action with this.
   * Authenticated → runs immediately.
   * Guest/unauthenticated → opens sign-in modal, queues the action.
   */
  const requireAuth = useCallback(
    (action: () => Promise<void>) => {
      if (user) {
        // Already authenticated — run the action directly
        action().catch((err) =>
          console.warn('Auth-gated action failed:', err),
        );
      } else {
        // Not authenticated — show the gate and queue the action
        openAuthGate(action);
      }
    },
    [user, openAuthGate],
  );

  return { requireAuth, isAuthenticated: !!user };
}
