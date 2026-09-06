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
        // Explicit, not relying on the default: native Google sign-in
        // (src/lib/device/oauth.ts) exchanges a PKCE code for a session via
        // exchangeCodeForSession(), which auth-js's own docs say only applies
        // "when flowType is set to pkce in client options." detectSessionInUrl
        // stays on for the unchanged web redirect flow — it's simply never
        // triggered by a native deep link, since that never navigates the
        // WebView to a URL containing tokens; the native path calls
        // exchangeCodeForSession explicitly instead. See the Step 4 report's
        // Task 2 write-up.
        flowType: 'pkce',
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
