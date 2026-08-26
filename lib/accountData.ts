import { supabase } from './supabase';

export interface AccountExport {
  profile: unknown;
  weights: unknown[];
  meals: unknown[];
  hydration_logs: unknown[];
  streak: unknown;
  exported_at: string;
}

export async function exportAccountData(userId: string): Promise<AccountExport> {
  const [profile, weights, meals, hydrationLogs, streak] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('weight_logs').select('*').eq('user_id', userId).order('logged_at', { ascending: true }),
    supabase.from('meals').select('*, food_items(*)').eq('user_id', userId).order('occurred_at_utc', { ascending: true }),
    supabase.from('hydration_logs').select('*').eq('user_id', userId).order('occurred_at_utc', { ascending: true }),
    supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (profile.error) throw profile.error;

  return {
    profile: profile.data,
    weights: weights.data ?? [],
    meals: meals.data ?? [],
    hydration_logs: hydrationLogs.data ?? [],
    streak: streak.data ?? null,
    exported_at: new Date().toISOString(),
  };
}

/**
 * Fully and irreversibly delete the user's account (Play-compliant).
 *
 * Runs server-side via the `delete-account` Edge Function, which deletes the
 * auth.users row (cascades to the profile → meals, hydration, streaks, …),
 * de-identifies retained ML rows, and removes their Cloudinary images. The
 * client only invokes it; the caller signs out afterwards.
 */
export async function deleteAccountData(_userId?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'delete-account',
    { body: {} },
  );
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw new Error(status === 401 ? 'auth_required' : `delete_failed_${status ?? 'unknown'}`);
  }
  if (!data?.ok) throw new Error('delete_failed');
}
