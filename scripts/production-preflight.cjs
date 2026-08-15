const fs = require('fs');

const envPath = process.env.ENV_FILE || '.env.local';
const env = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined && value !== '') env[key] = value;
}

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_HCAPTCHA_SITE_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_VAPID_KEY',
];

const requiredTrue = [
  'VITE_REQUIRE_OTP_GUARD',
  'VITE_IMAGE_MODERATION_REQUIRED',
];

const missing = required.filter((key) => !env[key]);
const notTrue = requiredTrue.filter((key) => env[key] !== 'true');

if (env.VITE_APP_MODE !== 'supabase') {
  console.error('Production preflight failed: VITE_APP_MODE must be supabase.');
  process.exit(1);
}

if (missing.length || notTrue.length) {
  if (missing.length) console.error(`Missing required production env: ${missing.join(', ')}`);
  if (notTrue.length) console.error(`Required production gates must be true: ${notTrue.join(', ')}`);
  process.exit(1);
}

console.log('production preflight pass: required public env and safety gates are present');
