import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

async function removeFolder(admin: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  const paths = (data ?? []).filter((item) => !item.name.endsWith('/')).map((item) => `${prefix}/${item.name}`);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Function is not configured' }, 500);

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== true) return jsonResponse({ error: 'Deletion confirmation required' }, 400);

  const authHeader = req.headers.get('Authorization') || '';
  const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = userData.user.id;

  await Promise.all([
    removeFolder(admin, 'lokl-media', `avatars/${userId}`),
    removeFolder(admin, 'lokl-media', `listings/${userId}`),
    removeFolder(admin, 'lokl-media', `chat-images/${userId}`),
  ]);

  await admin.from('users').delete().eq('id', userId);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);
  if (deleteError) return jsonResponse({ error: deleteError.message }, 500);

  return jsonResponse({ ok: true });
});
