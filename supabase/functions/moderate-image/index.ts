import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const highRisk = new Set(['LIKELY', 'VERY_LIKELY']);

function stripDataUrl(value: string) {
  const marker = 'base64,';
  const index = value.indexOf(marker);
  return index === -1 ? value : value.slice(index + marker.length);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Function is not configured' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { imageDataUrl, folder, fileName, mimeType } = await req.json().catch(() => ({}));
  if (typeof imageDataUrl !== 'string' || !imageDataUrl) return jsonResponse({ error: 'Missing image' }, 400);
  if (!visionApiKey) return jsonResponse({ error: 'Image moderation is not configured' }, 503);

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: stripDataUrl(imageDataUrl) },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }],
      }],
    }),
  });

  if (!response.ok) return jsonResponse({ error: 'Image moderation provider failed' }, 502);
  const payload = await response.json();
  const annotation = payload?.responses?.[0]?.safeSearchAnnotation ?? {};
  const blocked = highRisk.has(annotation.adult) || highRisk.has(annotation.violence);
  const flagged = highRisk.has(annotation.racy) || highRisk.has(annotation.medical);
  const reason = blocked ? 'Explicit or violent image risk' : flagged ? 'Potentially sensitive image risk' : '';

  if (blocked || flagged) {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    await admin.from('moderation_flags').insert({
      target_type: 'image',
      user_id: userData.user.id,
      source: 'auto_image',
      reason,
      description: `Folder: ${folder || 'unknown'}, file: ${fileName || 'unknown'}, mime: ${mimeType || 'unknown'}`,
      severity: blocked ? 5 : 3,
    });
  }

  if (blocked) return jsonResponse({ decision: 'block', reason });
  if (flagged) return jsonResponse({ decision: 'flag', reason });
  return jsonResponse({ decision: 'allow' });
});
