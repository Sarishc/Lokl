import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { SupabaseClient } from '@supabase/supabase-js';

// Google returns 403 disallowed_useragent for OAuth requested inside any embedded
// WebView — this app's Capacitor WebView is exactly that on both platforms, which is
// why signInWithOAuth's default embedded-browser redirect (still used on web, where
// it's a real browser and this restriction doesn't apply) is dead on native. This
// module replaces it on native with: open the consent screen in the system browser
// (Custom Tabs / SFSafariViewController, a real browser Google will actually render),
// catch the redirect back via a custom URL scheme, and exchange the PKCE code for a
// session. See docs/audit/FINDINGS.md LOKL-006 and the Step 4 report's Task 1
// write-up for why this was chosen over the native Google Sign-In SDK alternative.
//
// This custom scheme is unrelated to capacitor.config.ts's server.iosScheme/
// androidScheme, which is the WebView's own origin and must never change (Step 1
// fixed it; changing it again would partition localStorage and log everyone out).
// This scheme only exists to catch a one-off OS-level redirect back into the app.
export const OAUTH_REDIRECT_URL = 'com.lokl.app://oauth-callback';

export type GoogleSignInResult =
  | { status: 'ok' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function extractCode(url: string): { code: string } | { error: string } {
  const params = new URL(url).searchParams;
  const code = params.get('code');
  if (code) return { code };
  return { error: params.get('error_description') || params.get('error') || 'Google did not return an authorization code.' };
}

async function completeExchange(supabase: SupabaseClient, url: string): Promise<GoogleSignInResult> {
  const parsed = extractCode(url);
  if ('error' in parsed) return { status: 'error', message: parsed.error };
  const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
  return error ? { status: 'error', message: error.message } : { status: 'ok' };
}

// Registered once at app boot (see src/App.tsx), independent of any specific sign-in
// button press. This is what makes the flow survive the app process being killed
// while the system browser is open: when the OS relaunches the app via the redirect
// URL, this is a fresh app boot with a launch URL, not a live listener callback — the
// original signInWithGoogleNative() call (and its promise) is gone, but this runs
// again on every boot and completes the session anyway. A no-op on web.
export function initNativeGoogleOAuthListener(supabase: SupabaseClient, onSessionChange: () => void) {
  if (!Capacitor.isNativePlatform()) return;

  App.getLaunchUrl().then((launch) => {
    if (launch?.url.startsWith(OAUTH_REDIRECT_URL)) {
      completeExchange(supabase, launch.url).then(() => onSessionChange());
    }
  });

  App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith(OAUTH_REDIRECT_URL)) return;
    completeExchange(supabase, url).then(() => onSessionChange());
  });
}

// The transient, per-button-press call. Its own listener is redundant with the
// global one above by design — both can safely observe the same event — this one
// only exists to resolve the UI's pending/error state for the common case where the
// app survives the round trip; the global listener is what guarantees the session
// itself gets completed even if this promise chain never resolves.
export async function signInWithGoogleNative(supabase: SupabaseClient): Promise<GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { status: 'error', message: error?.message ?? 'Could not start Google sign-in.' };

  return new Promise((resolve) => {
    let settled = false;
    let urlListenerHandle: { remove: () => void } | undefined;
    let resumeListenerHandle: { remove: () => void } | undefined;
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (result: GoogleSignInResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(cancelTimer);
      urlListenerHandle?.remove();
      resumeListenerHandle?.remove();
      Browser.close().catch(() => undefined);
      resolve(result);
    };

    App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith(OAUTH_REDIRECT_URL)) return;
      completeExchange(supabase, url).then(settle);
    }).then((handle) => {
      urlListenerHandle = handle;
    });

    // Best-effort cancellation detection: there is no direct "user closed the
    // system browser without finishing" event. Foregrounding the app again
    // (resume) without our redirect ever having arrived is the closest signal —
    // give the redirect a moment to still arrive first, since resume and
    // appUrlOpen can fire in either order for the success case too.
    App.addListener('resume', () => {
      cancelTimer = setTimeout(() => settle({ status: 'cancelled' }), 1_500);
    }).then((handle) => {
      resumeListenerHandle = handle;
    });

    Browser.open({ url: data.url }).catch((openError) => {
      settle({ status: 'error', message: openError instanceof Error ? openError.message : String(openError) });
    });
  });
}
