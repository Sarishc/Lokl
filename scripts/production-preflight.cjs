const fs = require('fs');
const path = require('path');

// Mirrors Vite's own env-file precedence for `vite build` (mode "production"), so this
// script validates exactly the variables the production build will actually consume —
// not a different file it happens to read on its own. Precedence, lowest to highest:
// .env < .env.production < .env.local < .env.production.local < real process.env.
// See https://vitejs.dev/guide/env-and-mode.html and docs/audit/FINDINGS.md LOKL-009.
const ENV_FILES = ['.env', '.env.production', '.env.local', '.env.production.local'];

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return result;
}

const env = {};
for (const file of ENV_FILES) {
  Object.assign(env, parseEnvFile(path.resolve(process.cwd(), file)));
}
// Real environment variables always win — matches Vite's own loadEnv behavior, and is
// how this repo's documented workflow (e.g. `VITE_APP_MODE=mock npm run build`) works.
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined && value !== '') env[key] = value;
}

const appMode = env.VITE_APP_MODE;

if (appMode !== 'mock' && appMode !== 'supabase') {
  console.error(
    `Production preflight failed: VITE_APP_MODE must be exactly "mock" or "supabase" (got: ${JSON.stringify(appMode ?? null)}).`,
  );
  process.exit(1);
}

if (appMode === 'mock') {
  // A mock build has no production credentials to check — that's the point of mock
  // mode. vite.config.ts's own build-time gate (and src/lib/app-mode.ts at module
  // load) are what stop mock mode from being entered by accident; this script's job
  // for a mock build is just to confirm the mode itself is a deliberate, valid choice.
  console.log('production preflight pass: VITE_APP_MODE=mock — no production credentials required.');
  process.exit(0);
}

// appMode === 'supabase' from here on. Every VITE_* variable actually read anywhere in
// src/ for a supabase build — cross-checked against docs/audit/BASELINE.md's full
// import.meta.env.VITE_* inventory. Keep this list and that inventory in sync.
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_HCAPTCHA_SITE_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_VAPID_KEY',
];

const requiredTrue = ['VITE_REQUIRE_OTP_GUARD', 'VITE_IMAGE_MODERATION_REQUIRED'];

const missing = required.filter((key) => !env[key]);
const notTrue = requiredTrue.filter((key) => env[key] !== 'true');

if (missing.length || notTrue.length) {
  if (missing.length) console.error(`Missing required production env: ${missing.join(', ')}`);
  if (notTrue.length) console.error(`Required production gates must be true: ${notTrue.join(', ')}`);
  process.exit(1);
}

console.log('production preflight pass: required public env and safety gates are present for VITE_APP_MODE=supabase');
