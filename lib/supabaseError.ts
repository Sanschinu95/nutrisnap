/**
 * Uniform Supabase error logger — keeps `error.message`, `error.details`,
 * `error.hint` in one place so silent inserts/upserts stop hiding RLS or
 * constraint failures.
 *
 * Why it exists: 20% of DB calls were failing because errors were swallowed
 * inside `await supabase.from(...).insert(...)` calls with no `if (error)`
 * branch. Wrapping every call with logError makes the next regression visible.
 */

import type { PostgrestError } from '@supabase/supabase-js';

export function logSupabaseError(
  where: string,
  error: PostgrestError | { message?: string } | null | undefined,
): void {
  if (!error) return;
  const e = error as PostgrestError;
  console.warn(
    `[Supabase] ${where} failed: ${e.message ?? 'unknown'}`,
    e.details ? `details=${e.details}` : '',
    e.hint ? `hint=${e.hint}` : '',
    (e as { code?: string }).code ? `code=${(e as { code?: string }).code}` : '',
  );
}
