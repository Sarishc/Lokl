// Single source of truth for VITE_APP_MODE resolution. Every other module that needs
// to know the app mode imports APP_MODE/IS_MOCK_MODE from here rather than reading
// import.meta.env.VITE_APP_MODE directly, so there is exactly one place that can get
// the fail-fast semantics wrong.
//
// Mock mode is opt-in only. There is no default. An unset or misspelled VITE_APP_MODE
// throws at module load (which happens the moment any code imports this module, i.e.
// immediately on app start) rather than silently choosing a backend for the user.
export type AppMode = 'mock' | 'supabase';

const rawMode = import.meta.env.VITE_APP_MODE;

if (rawMode !== 'mock' && rawMode !== 'supabase') {
  throw new Error(
    `VITE_APP_MODE must be exactly "mock" or "supabase" (got: ${JSON.stringify(rawMode ?? null)}). ` +
      'There is no default — set it explicitly in your .env file or build environment.',
  );
}

export const APP_MODE: AppMode = rawMode;
export const IS_MOCK_MODE = APP_MODE === 'mock';
