import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Function is not configured' }, 500);

  const { phoneHash, deviceId } = await req.json().catch(() => ({}));
  if (typeof phoneHash !== 'string' || phoneHash.length < 32 || typeof deviceId !== 'string' || deviceId.length < 8) {
    return jsonResponse({ error: 'Invalid request' }, 400);
  }

  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  const ipHash = forwardedFor ? await sha256(forwardedFor.split(',')[0]!.trim()) : null;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [phoneCount, deviceCount, ipCount] = await Promise.all([
    admin.from('otp_request_attempts').select('id', { count: 'exact', head: true }).eq('phone_hash', phoneHash).eq('allowed', true).gte('created_at', sinceHour),
    admin.from('otp_request_attempts').select('id', { count: 'exact', head: true }).eq('device_id', deviceId).eq('allowed', true).gte('created_at', sinceHour),
    ipHash ? admin.from('otp_request_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).eq('allowed', true).gte('created_at', sinceHour) : Promise.resolve({ count: 0 }),
  ]);

  const reason =
    (phoneCount.count ?? 0) >= 5 ? 'phone_hour_limit' :
    (deviceCount.count ?? 0) >= 12 ? 'device_hour_limit' :
    (ipCount.count ?? 0) >= 30 ? 'ip_hour_limit' :
    null;

  await admin.from('otp_request_attempts').insert({
    phone_hash: phoneHash,
    device_id: deviceId,
    ip_hash: ipHash,
    allowed: !reason,
    reason,
  });

  if (reason) return jsonResponse({ error: 'Too many OTP requests. Try again later.', reason }, 429);
  return jsonResponse({ ok: true });
});
