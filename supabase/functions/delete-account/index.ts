/**
 * Supabase Edge Function: delete-account
 *
 * Google Play requires that an in-app "delete account" fully removes the user,
 * including the auth record. The client can't do that (needs the service-role
 * key), so this function performs the complete, irreversible deletion:
 *
 *   1. Verify the caller's JWT → resolve their user id.
 *   2. Best-effort delete their Cloudinary images (food scans, profile,
 *      feedback) by folder prefix — needs CLOUDINARY_* secrets; skipped if
 *      unset so DB deletion still succeeds.
 *   3. De-identify rows we keep for ML (scan_feedback, training_data) by
 *      nulling the user reference.
 *   4. Delete the profiles row → cascades to meals, hydration, streaks, etc.
 *   5. Delete the auth.users row via the admin API.
 *
 * Returns 200 on success. The client then signs out locally.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { encode as b64encode } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonError(status: number, code: string) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function deleteCloudinaryFolder(cloud: string, auth: string, prefix: string) {
  // Deletes up to 100 resources under the prefix. Enough for a single user's
  // scans in the beta; failures are swallowed so they never block deletion.
  try {
    const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload?prefix=${encodeURIComponent(prefix)}`;
    await fetch(url, { method: 'DELETE', headers: { Authorization: auth } });
  } catch (e) {
    console.warn('cloudinary_delete_failed', prefix, e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED');

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonError(401, 'MISSING_TOKEN');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return jsonError(401, 'INVALID_TOKEN');
  const userId = userData.user.id;

  // 1) Cloudinary images (best effort; only if configured).
  const cloud = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const key = Deno.env.get('CLOUDINARY_API_KEY');
  const secret = Deno.env.get('CLOUDINARY_API_SECRET');
  if (cloud && key && secret) {
    const auth = `Basic ${b64encode(`${key}:${secret}`)}`;
    for (const folder of ['food-scans', 'profiles', 'feedback']) {
      await deleteCloudinaryFolder(cloud, auth, `nyurix/${folder}/${userId}`);
    }
  }

  // 2) De-identify retained ML rows (keep the data, drop the person).
  const anon1 = await admin.from('scan_feedback').update({ user_id: null }).eq('user_id', userId);
  if (anon1.error) console.warn('scan_feedback_anon_failed', anon1.error);
  const anon2 = await admin.from('training_data').update({ contributor_id: null }).eq('contributor_id', userId);
  if (anon2.error) console.warn('training_data_anon_failed', anon2.error);

  // 3) Delete the profile row → cascades to meals, hydration, streaks, etc.
  const delProfile = await admin.from('profiles').delete().eq('id', userId);
  if (delProfile.error) {
    console.error('profile_delete_failed', delProfile.error);
    return jsonError(500, 'DB_DELETE_FAILED');
  }

  // 4) Delete the auth user itself.
  const { error: authDelErr } = await admin.auth.admin.deleteUser(userId);
  if (authDelErr) {
    console.error('auth_delete_failed', authDelErr);
    return jsonError(500, 'AUTH_DELETE_FAILED');
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
});
