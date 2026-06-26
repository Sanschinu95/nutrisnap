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

export async function deleteAccountData(
  userId: string,
  imageBucket = 'meal-images',
): Promise<void> {
  const { data: meals } = await supabase
    .from('meals')
    .select('image_url')
    .eq('user_id', userId)
    .not('image_url', 'is', null);

  // Supabase-storage cleanup. NutriSnap currently uploads scan images to
  // Cloudinary (res.cloudinary.com/...), so storage_paths will normally be
  // empty for current accounts — this is for any meals seeded from the legacy
  // Supabase Storage path. The Cloudinary admin API requires the API secret
  // (server-side only); cleaning those up is a TODO and would need a Supabase
  // edge function or backend job.
  const storagePaths = (meals ?? [])
    .map((meal) => meal.image_url)
    .filter((url): url is string => Boolean(url))
    .map((url) => {
      const marker = `/storage/v1/object/public/${imageBucket}/`;
      const index = url.indexOf(marker);
      return index >= 0 ? url.slice(index + marker.length) : null;
    })
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    await supabase.storage.from(imageBucket).remove(storagePaths);
  }

  // De-identifies scan_feedback (sets user_id = null) so we keep the rows for
  // model training without retaining personal data.
  await supabase.rpc('anonymize_scan_feedback_for_user', { target_user_id: userId });

  // De-identify the decoupled training_data rows the same way. The table's RLS
  // blocks direct user UPDATEs, so we call the SECURITY DEFINER RPC defined in
  // docs/migration_training_data.sql, which sets contributor_id = null for the
  // caller's own rows. Wrapped: failure here must not block account deletion.
  try {
    await supabase.rpc('nullify_training_for_self');
  } catch (e) {
    console.warn('nullify_training_for_self failed:', e);
  }

  // Cascades to meals → food_items, hydration_logs, streaks, vacation_periods,
  // consistency_scores via the ON DELETE CASCADE FKs in
  // docs/migration_v1_core_engine.sql. The auth.users row is NOT deleted here —
  // that requires the service role key and should be wired up server-side.
  // training_data is intentionally NOT cascaded — it has no FK and the rows
  // persist post-deletion in de-identified form for ML training.
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}
