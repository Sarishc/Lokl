import { createClient } from '@supabase/supabase-js';
import { APP_MODE } from './app-mode';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const hasSupabase = Boolean(supabase);

// VITE_APP_MODE=supabase is a promise to run against a real backend. If the client
// could not be constructed, that is a hard failure — never a silent downgrade to mock.
if (APP_MODE === 'supabase' && !hasSupabase) {
  throw new Error(
    'VITE_APP_MODE=supabase but the Supabase client could not be constructed — ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must both be set. Refusing to fall back to mock mode.',
  );
}
