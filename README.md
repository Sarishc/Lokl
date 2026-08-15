# Lokl

**Lokl** is a mobile-first hyperlocal buy & sell marketplace for India with a premium dark UI, neighbourhood-first discovery, listing posting flow, real-time chat, saved listings, notifications, moderation tooling, and a Supabase-ready backend.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- React Router v6
- Zustand
- TanStack React Query
- Framer Motion
- Supabase (Auth, PostgreSQL, Storage, Realtime)
- Google Maps JavaScript API
- Firebase Cloud Messaging scaffold
- Capacitor native wrapper scaffold for iOS and Android
- Razorpay Edge Function scaffold retained for future work; payments are intentionally out of the current product UI.

## What ships in this repo

- Full mobile-first web app
- Supabase SQL schema with indexes, RLS policies, triggers, and seed data
- 30 seeded listings across Bengaluru, Mumbai, Delhi, Hyderabad, Chennai, and Pune
- 5 seeded users and 3 seeded chats
- Mock mode for instant local demo with zero external credentials
- Supabase mode for production deployment
- Basic admin moderation route at `/admin`
- Capacitor iOS and Android project scaffolds for native store preparation

## App modes

### 1) Mock mode
Best for design review, product demos, and local development without external services.

```bash
VITE_APP_MODE=mock
```

- OTP works with `123456`
- Google sign-in is simulated locally with a mock Google profile
- All data is stored in browser localStorage
- Feed, posting, saved items, chat, notifications, profile editing, and admin tools are fully usable locally

### 2) Supabase mode
Best for real deployments.

```bash
VITE_APP_MODE=supabase
```

Set the environment variables in `.env` before running.

## Environment variables

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

### Required for Supabase mode

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Google OAuth does not require frontend secrets. Configure the Google provider in Supabase Auth with the OAuth client ID/secret, and add the Supabase callback URL to Google Cloud:

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

### Required for Google Maps

- `VITE_GOOGLE_MAPS_API_KEY`

### Required for OTP abuse prevention

- `VITE_HCAPTCHA_SITE_KEY`
- `VITE_REQUIRE_OTP_GUARD=true`

Enable Supabase Auth CAPTCHA protection in Auth > Settings > Bot and Abuse Protection with the hCaptcha secret key. The frontend only gets the site key.

### Required for image moderation

- `VITE_IMAGE_MODERATION_REQUIRED=true`

Set `GOOGLE_VISION_API_KEY` as a Supabase Edge Function secret, not in frontend hosting env.

### Required for push notifications

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

### Payment scaffolds

Payments are intentionally out of scope for the current app UI. The unused Razorpay Edge Functions can be deployed later with `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` once a paid flow is designed.

### Admin route

Admin access is not controlled by a client-side password. In Supabase mode, set `users.is_admin = true` for trusted moderators and rely on the RLS policies in `supabase/schema.sql`. Mock mode keeps a local demo unlock code, `123456`, for credential-free testing only.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npx tsc -b
npx oxlint src
npm run build
VITE_APP_MODE=mock npm run test:release
VITE_APP_MODE=mock npm run test:smoke
npm run preflight:production
```

`preflight:production` must pass before public launch. It intentionally fails when required production keys or safety gates are missing.

## Production setup

### 1) Create Supabase project

- Enable **Google Auth** in Supabase Auth and configure the Google OAuth client ID/secret
- Enable **Phone Auth** in Supabase Auth
- Configure SMS provider or Twilio-backed phone auth in Supabase
- Run `supabase/schema.sql` in SQL editor
- Create a public storage bucket for listing and avatar images
- Enable Realtime on `chats`, `messages`, and `notifications`

### 2) Deploy Edge Functions

```bash
supabase functions deploy otp-request-guard --no-verify-jwt
supabase functions deploy moderate-image
supabase functions deploy delete-account
```

Set function secrets:

```bash
supabase secrets set GOOGLE_VISION_API_KEY=xxx
```

### 3) Google Maps

Enable:

- Maps JavaScript API
- Geocoding API
- Places API

### 4) Firebase Cloud Messaging

- Create a Firebase web app
- Add your config to `.env`
- Firebase Messaging config is passed to `public/firebase-messaging-sw.js` from the same `VITE_FIREBASE_*` variables used by the app.

### 5) Vercel deploy

```bash
npm run build
```

Then import the project into Vercel and set the same environment variables there.

## Native preparation

Capacitor scaffolding is present:

```bash
npm run native:prepare
npm run cap:open:ios
npm run cap:open:android
```

Android debug and release bundle builds have been verified locally. Store submission still requires signing keys, final icons/splash screens, store metadata, production environment variables, and Play Console setup. iOS archive submission requires full Xcode to be installed and selected.

## Feature checklist

- Phone OTP auth
- Onboarding with avatar + location
- Home feed with locality + radius
- Category rail + filter chips
- Instant search + recent + trending
- List and map toggle
- Listing detail with gallery, seller card, similar items, save, share, report
- 5-step posting flow with draft persistence
- Real-time style chats, offers, image sharing, typing state, read receipts, mark sold
- User profile, edit profile, tabs, settings
- Wishlist page
- Notifications center
- Trust & safety reporting
- Admin moderation route

## Notes

- In mock mode, the app is fully interactive end to end and ideal for stakeholder review.
- In Supabase mode, the app expects the SQL schema to be installed and environment variables to be present.
- In Supabase mode, image uploads use Supabase Storage and call the deployed image-moderation Edge Function before upload.
- For exact distance queries in production, use a PostGIS RPC for radius search if you want server-side geospatial sorting at scale.

## Suggested next upgrades

- Add server-side image compression upload worker
- Replace prompt-based report and offer actions with bottom sheets
- Add multilingual copy packs for Hindi and other Indian languages
- Add order escrow / meetup confirmation flow
- Add recommendation ranking based on saves and chats
