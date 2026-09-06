import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appMode = env.VITE_APP_MODE;

  // Fails the build (not just the running app) the moment VITE_APP_MODE is missing,
  // misspelled, or promises a Supabase backend it can't actually reach. A build that
  // completes is the artifact that ends up on a user's device, so this has to run
  // before that artifact exists, not after — see docs/audit/FINDINGS.md LOKL-008.
  if (appMode !== 'mock' && appMode !== 'supabase') {
    throw new Error(
      `[lokl] VITE_APP_MODE must be exactly "mock" or "supabase" (got: ${JSON.stringify(appMode ?? null)}). ` +
        'There is no default — refusing to build.',
    );
  }
  if (appMode === 'supabase' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error(
      '[lokl] VITE_APP_MODE=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set. ' +
        'Refusing to build a production bundle without real Supabase credentials.',
    );
  }

  return {
    // A true compile-time literal (not an imported const — Rollup/esbuild don't fold
    // exported-const chains across module boundaries) so that every `if (__IS_MOCK_MODE__)`
    // branch is statically eliminable in a supabase-mode build. See LOKL-004/017 and
    // src/vite-env.d.ts.
    define: {
      __IS_MOCK_MODE__: JSON.stringify(appMode === 'mock'),
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('@tanstack')) return 'vendor-query';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
    server: {
      port: 3000,
    },
  };
});
