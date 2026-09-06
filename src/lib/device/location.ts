import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Single call site for "where is the user" across web and native. Callers get a
// closed set of outcomes instead of a thrown error, because on native — unlike the
// old bare navigator.geolocation call this replaces — permission denial, a
// permanently-denied permission, and OS-level location services being off are all
// real, distinct states a user can be in, not edge cases. See
// docs/audit/FINDINGS.md LOKL-001/003 (this abstraction is what actually closes
// those findings) and the Step 2 report's Task 3 write-up for why each status
// exists and how it's detected.
export type LocationResult =
  | { status: 'granted'; latitude: number; longitude: number }
  | { status: 'denied' }
  | { status: 'denied-permanently' }
  | { status: 'disabled' }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

// Capacitor's documented native error codes (README.md "Error Codes" table) — these
// arrive as a string `code` on the thrown error object on iOS/Android.
const NATIVE_ERROR = 'OS-PLUG-GLOC-0002';
const NATIVE_DENIED = 'OS-PLUG-GLOC-0003';
const NATIVE_DISABLED = 'OS-PLUG-GLOC-0007';
const NATIVE_TIMEOUT = 'OS-PLUG-GLOC-0010';

function classifyError(error: unknown): LocationResult {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined;
  // Web: GeolocationPositionError.code is numeric (1=PERMISSION_DENIED,
  // 2=POSITION_UNAVAILABLE, 3=TIMEOUT) — see GeolocationWeb in
  // @capacitor/geolocation, which wraps navigator.geolocation directly.
  if (code === 1) return { status: 'denied' };
  if (code === 3) return { status: 'timeout' };
  if (code === 2) return { status: 'disabled' };
  if (code === NATIVE_DENIED) return { status: 'denied' };
  if (code === NATIVE_DISABLED) return { status: 'disabled' };
  if (code === NATIVE_TIMEOUT) return { status: 'timeout' };
  if (code === NATIVE_ERROR) return { status: 'error', message: 'Could not determine your location.' };
  const message = error instanceof Error ? error.message : String(error);
  return { status: 'error', message };
}

export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      // checkPermissions()/requestPermissions() both throw if OS location services
      // are off entirely — that's the "disabled" branch below, distinct from a
      // per-app permission denial.
      const status = await Geolocation.checkPermissions();
      if (status.location === 'denied') {
        // Neither iOS nor Android will show the system prompt again once a user
        // has already said no through it — checkPermissions() reporting 'denied'
        // directly (rather than 'prompt'/'prompt-with-rationale') means calling
        // requestPermissions() here would silently no-op and look like a hang.
        // Tell the user how to fix it instead.
        return { status: 'denied-permanently' };
      }
      if (status.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted') return { status: 'denied' };
      }
    }
    // enableHighAccuracy: false — this app only needs locality-level precision for
    // a radius-based feed (see LOKL-003's Android permission choice); requesting
    // less also means faster fixes and lower battery cost.
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10_000 });
    return { status: 'granted', latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch (error) {
    return classifyError(error);
  }
}
