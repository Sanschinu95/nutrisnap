/**
 * Social store: friends, requests, leaderboards, referral status.
 *
 * All cross-user reads/writes go through the SECURITY DEFINER RPCs defined in
 * docs/migration_social.sql (scoped to auth.uid()), never raw table access —
 * so friends only ever see streak + consistency, never meals/calories/photos.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { logSupabaseError } from '@/lib/supabaseError';
import { useAuthStore } from '@/stores/auth.store';

export interface FriendProfile {
  friend_id: string;
  friend_code: string;
  name: string | null;
  current_streak: number | null;
  consistency_score: number | null;
  is_ghost_mode: boolean;
}

export interface FriendRequestRow {
  id: string;
  direction: 'incoming' | 'outgoing';
  other_user_id: string;
  other_name: string | null;
  other_code: string;
  status: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  friend_code: string;
  name: string | null;
  value: number;
  rank: number;
}

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

const REQUEST_STATUS_MESSAGES: Record<string, { success: boolean; message: string }> = {
  sent: { success: true, message: 'Request sent' },
  accepted_mutual: { success: true, message: "You're now friends!" },
  not_found: { success: false, message: 'No user with that code. Check and try again.' },
  self: { success: false, message: "That's your own code!" },
  already_friends: { success: false, message: "You're already friends." },
  rate_limited: { success: false, message: "You've hit today's request limit. Try again tomorrow." },
  unauthenticated: { success: false, message: 'Please sign in to add friends.' },
};

const LEADERBOARD_TTL_MS = 60_000;

interface SocialState {
  friends: FriendProfile[];
  incomingRequests: FriendRequestRow[];
  outgoingRequests: FriendRequestRow[];
  friendsLoading: boolean;

  qualifiedReferralCount: number;
  pendingReferralCount: number;
  hasEarnedProReward: boolean;
  proRewardExpiresAt: string | null;

  streakLeaderboard: LeaderboardEntry[];
  consistencyLeaderboard: LeaderboardEntry[];
  leaderboardPeriod: LeaderboardPeriod;
  leaderboardLoadedAt: number;
}

interface SocialActions {
  loadFriendsData: () => Promise<void>;
  sendFriendRequest: (code: string) => Promise<{ success: boolean; message: string }>;
  respondToRequest: (requestId: string, accept: boolean) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  loadLeaderboards: (period: LeaderboardPeriod, force?: boolean) => Promise<void>;
  checkReferralStatus: () => Promise<void>;
  reset: () => void;
}

const initial: SocialState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  friendsLoading: false,
  qualifiedReferralCount: 0,
  pendingReferralCount: 0,
  hasEarnedProReward: false,
  proRewardExpiresAt: null,
  streakLeaderboard: [],
  consistencyLeaderboard: [],
  leaderboardPeriod: 'weekly',
  leaderboardLoadedAt: 0,
};

function uid(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useSocialStore = create<SocialState & SocialActions>((set, get) => ({
  ...initial,

  loadFriendsData: async () => {
    if (!uid()) return;
    set({ friendsLoading: true });
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        supabase.rpc('get_friends'),
        supabase.rpc('get_friend_requests'),
      ]);
      logSupabaseError('get_friends', friendsRes.error);
      logSupabaseError('get_friend_requests', requestsRes.error);

      const requests = (requestsRes.data ?? []) as FriendRequestRow[];
      set({
        friends: (friendsRes.data ?? []) as FriendProfile[],
        incomingRequests: requests.filter((r) => r.direction === 'incoming'),
        outgoingRequests: requests.filter((r) => r.direction === 'outgoing'),
        friendsLoading: false,
      });
    } catch (error) {
      console.warn('[Social] loadFriendsData failed:', error);
      set({ friendsLoading: false });
    }
    // Referral status is cheap and often changes alongside friends.
    get().checkReferralStatus();
  },

  sendFriendRequest: async (code: string) => {
    const cleaned = code.trim().toUpperCase();
    const { data, error } = await supabase.rpc('send_friend_request', { p_code: cleaned });
    if (error) {
      logSupabaseError('send_friend_request', error);
      return { success: false, message: 'Could not send the request. Try again.' };
    }
    const status = String(data ?? '');
    const mapped = REQUEST_STATUS_MESSAGES[status] ?? { success: false, message: 'Something went wrong.' };
    if (mapped.success) await get().loadFriendsData();
    return mapped;
  },

  respondToRequest: async (requestId: string, accept: boolean) => {
    // Optimistic: drop it from the incoming list immediately.
    const previous = get().incomingRequests;
    set({ incomingRequests: previous.filter((r) => r.id !== requestId) });
    const { error } = await supabase.rpc(accept ? 'accept_friend_request' : 'decline_friend_request', {
      p_request_id: requestId,
    });
    if (error) {
      logSupabaseError('respondToRequest', error);
      set({ incomingRequests: previous }); // rollback
      return;
    }
    if (accept) await get().loadFriendsData();
  },

  cancelRequest: async (requestId: string) => {
    const previous = get().outgoingRequests;
    set({ outgoingRequests: previous.filter((r) => r.id !== requestId) });
    const { error } = await supabase.rpc('cancel_friend_request', { p_request_id: requestId });
    if (error) {
      logSupabaseError('cancelRequest', error);
      set({ outgoingRequests: previous });
    }
  },

  removeFriend: async (friendId: string) => {
    const previous = get().friends;
    set({ friends: previous.filter((f) => f.friend_id !== friendId) });
    const { error } = await supabase.rpc('remove_friend', { p_friend_id: friendId });
    if (error) {
      logSupabaseError('removeFriend', error);
      set({ friends: previous });
    }
  },

  loadLeaderboards: async (period: LeaderboardPeriod, force = false) => {
    if (!uid()) return;
    const { leaderboardLoadedAt, leaderboardPeriod } = get();
    const fresh = Date.now() - leaderboardLoadedAt < LEADERBOARD_TTL_MS;
    if (!force && fresh && leaderboardPeriod === period) return;

    try {
      const [streakRes, consistencyRes] = await Promise.all([
        supabase.rpc('leaderboard_streak'),
        supabase.rpc('leaderboard_consistency', { p_period: period }),
      ]);
      logSupabaseError('leaderboard_streak', streakRes.error);
      logSupabaseError('leaderboard_consistency', consistencyRes.error);
      set({
        streakLeaderboard: (streakRes.data ?? []) as LeaderboardEntry[],
        consistencyLeaderboard: (consistencyRes.data ?? []) as LeaderboardEntry[],
        leaderboardPeriod: period,
        leaderboardLoadedAt: Date.now(),
      });
    } catch (error) {
      console.warn('[Social] loadLeaderboards failed:', error);
    }
  },

  checkReferralStatus: async () => {
    const userId = uid();
    if (!userId) return;
    try {
      // Beta approach: sweep this user's pending referrals on demand.
      await supabase.rpc('check_referral_qualifications_for_user', { p_user_id: userId });

      const [{ data: refs }, { data: rewards }] = await Promise.all([
        supabase.from('referrals').select('status').eq('referrer_id', userId),
        supabase
          .from('pro_rewards')
          .select('expires_at')
          .eq('user_id', userId)
          .eq('reason', 'referral_10_friends')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1),
      ]);

      const rows = (refs ?? []) as { status: string }[];
      set({
        qualifiedReferralCount: rows.filter((r) => r.status === 'qualified').length,
        pendingReferralCount: rows.filter((r) => r.status === 'pending').length,
        hasEarnedProReward: !!(rewards && rewards.length > 0),
        proRewardExpiresAt: rewards && rewards.length > 0 ? (rewards[0] as { expires_at: string }).expires_at : null,
      });
    } catch (error) {
      console.warn('[Social] checkReferralStatus failed:', error);
    }
  },

  reset: () => set({ ...initial }),
}));
