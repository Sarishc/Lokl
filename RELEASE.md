# Lokl Release Checklist

Lokl is currently a Vite/React Progressive Web App with Capacitor native wrapper projects for iOS and Android. The web app can be verified locally in mock mode, and Android can build a debug APK plus release App Bundle locally. Public production launch and store submission are still blocked until the production environment, legal review, signing assets, store metadata, and iOS Xcode setup are complete.

## Verified In This Codebase

- Production build: `npm run build`
- Static checks: `npx tsc -b` and `npx oxlint src/`
- Mock-mode mobile release flow: `npm run test:release` while the app runs at `http://127.0.0.1:5173`
- Expanded mock smoke flow: `npm run test:smoke` covers legal pages, consent gate, mock Google auth, profile edit/avatar upload, admin queue, and account deletion
- Mock-mode Google release flow: `RELEASE_E2E_AUTH=google npm run test:release`
- Live Supabase release flow: `VITE_APP_MODE=supabase RELEASE_E2E_PHONE=<owned-test-phone> RELEASE_E2E_OTP=<test-otp> npm run test:release`
- PWA assets: manifest, service worker, offline page, app icons, Apple touch icon
- Supabase verification project: RLS enabled and table grants tightened to the authenticated client surface
- Supabase Auth Google provider: configure Auth > Providers > Google with the Google OAuth client ID/secret; register `https://<project-ref>.supabase.co/auth/v1/callback` in Google Cloud.
- Supabase Auth phone provider: configured with Twilio Verify for the verification project
- Supabase Auth OTP abuse prevention: app forwards CAPTCHA tokens, applies device/phone client throttles, includes the deployed `otp-request-guard` Edge Function for per-phone/per-device/per-IP hourly limits, and includes `check_otp_volume_anomaly()` for scheduled OTP volume monitoring. Production still requires enabling Auth > Settings > Bot and Abuse Protection in Supabase and setting the hCaptcha secret there.
- Supabase Auth email/password provider: disabled in the verification project because Lokl uses phone OTP, and leaked-password protection is Pro-plan gated.
- Supabase Storage: `lokl-media` image upload and public read verified through chat image and listing image release flows
- Legal consent: `/terms` and `/privacy` are linked from auth and profile, and signup/sign-in is gated by explicit consent. These are product-specific drafts only and need lawyer review before public launch.
- Account deletion: profile settings call the `delete-account` Edge Function, which removes user-scoped media folders, cascades public user data, and deletes the Supabase Auth identity.
- Automated moderation: listing insert/update has server-side posting caps and spam/scam flagging; the admin queue combines user reports with automated `moderation_flags` sorted by severity. Image uploads call the `moderate-image` Edge Function when deployed.
- Current real-SMS blocker: the Twilio account used for verification is still a trial account, so real SMS delivery to unverified recipients is blocked. Supabase test phone/OTP mapping was used for live Auth/RLS verification only.
- Current Supabase advisory blocker on Free plan: the leaked-password-protection advisor still reports generically even after disabling the unused email/password provider; Supabase documents the actual leaked-password toggle as Pro plan and above.
- Current production env blocker: `npm run preflight:production` fails until hCaptcha, Google Maps, Firebase push, and safety enforcement flags are set for the production deployment.
- Current native build status: Android builds locally. iOS cannot be archived on this machine until full Xcode is installed and selected instead of Command Line Tools.

## Production Cutover

1. Create a fresh Supabase project named `lokl-production`.
2. Run `supabase/schema.sql` against that project.
3. Enable Supabase Google auth and configure the production Google OAuth client ID/secret. Add the production Supabase callback URL in Google Cloud.
4. Enable Supabase phone auth with a paid production SMS provider and quota suitable for launch traffic. For Twilio, use a paid account with a valid Verify service or SMS-capable sender that can deliver to all launch countries.
5. Enable Supabase CAPTCHA protection under Auth > Settings > Bot and Abuse Protection. Use hCaptcha and set `VITE_HCAPTCHA_SITE_KEY` on the frontend.
6. Deploy Edge Functions: `otp-request-guard`, `moderate-image`, and `delete-account`. Set `GOOGLE_VISION_API_KEY` as a Supabase function secret before enforcing image moderation. Schedule `select public.check_otp_volume_anomaly();` every 15 minutes with `pg_cron` or an external scheduler.
7. Keep email/password auth disabled unless Lokl intentionally adds password login. If password login is added, enable Supabase Auth leaked-password protection after upgrading the Supabase organization/project to a plan that supports it.
8. Configure production storage policies and confirm the `lokl-media` bucket exists.
9. Set hosting env vars:
   - `VITE_APP_MODE=supabase`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_HCAPTCHA_SITE_KEY`
   - `VITE_REQUIRE_OTP_GUARD=true`
   - `VITE_IMAGE_MODERATION_REQUIRED=true`
   - Optional: `VITE_GOOGLE_MAPS_API_KEY`
10. Deploy `dist/` from `npm run build` to an HTTPS host.
11. Attach the final custom domain and verify HTTPS, redirects, and cache headers.

## PWA Launch QA

1. Run Lighthouse against the production URL and pass PWA, accessibility, best-practices, and performance checks.
2. Verify installability on Chrome Android and Safari iOS using the manifest and Apple touch icon.
3. Add user-facing "Add to Home Screen" guidance in onboarding or profile if analytics show low install conversion.
4. Run `RELEASE_E2E_AUTH=google npm run test:release` locally to cover the Google mock signup path.
5. Run `VITE_APP_MODE=supabase RELEASE_E2E_PHONE=<owned-test-phone> npm run test:release` against a live Supabase staging/production project. Enter the SMS code when prompted, or provide `RELEASE_E2E_OTP` if it is already known.
6. Manually verify live Google sign-in with a real Google account, confirming onboarding creates a profile row with `phone = null`.
7. Manually verify production OTP resend, failed OTP retry, image upload, listing post/edit/delete, chat, offer, report, logout, and sign-in.
8. Verify offline fallback by loading once, disabling network, and refreshing a route.
9. Verify CAPTCHA blocks OTP submission without a token and normal first-time OTP still succeeds after solving CAPTCHA.
10. Verify posting more than 8 listings in an hour is blocked server-side, while a normal first listing succeeds.
11. Verify a listing containing obvious scam/off-platform language lands in the admin queue as an automated flag.
12. Verify an image that Google Vision marks high-risk is blocked before upload when `VITE_IMAGE_MODERATION_REQUIRED=true`.

## Trust, Safety, And Legal Coverage

- Automated now: explicit legal consent gate, client OTP cooldown, deployed OTP Edge Function throttle, scheduled-callable OTP volume anomaly alerts, Supabase CAPTCHA token forwarding, server-side listing post caps, automated listing spam/scam flagging, Google Vision-backed image moderation hook, severity-sorted admin queue, and account deletion via Edge Function.
- Manual/admin still required: review automated flags, handle user reports, decide bans/deletions, monitor OTP volume and provider billing, configure Supabase dashboard Auth settings, deploy Edge Functions, and rotate/guard service secrets.
- Legal still required: the Terms and Privacy Policy are detailed drafts based on the current app data flows, but they are not legal advice and are not launch-final until reviewed by a qualified lawyer, especially for India DPDP consent, retention, grievance, deletion, and cross-border/data-processing requirements.

## Monitoring And Rollback

- Watch Supabase Auth, API, Storage, and Postgres logs during launch.
- Keep the previous deployed build available for immediate rollback.
- Keep Supabase migration SQL and environment variable changes documented.
- Rotate publishable/anon keys if any credential is exposed outside intended client use.

## Native App Scope

Native wrapper preparation has started with Capacitor:

- `capacitor.config.ts`
- `ios/`
- `android/`
- `npm run native:prepare`
- `npm run cap:open:ios`
- `npm run cap:open:android`
- Android debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Android release bundle: `android/app/build/outputs/bundle/release/app-release.aab`

Still required before App Store / Play Store submission:

1. Install and select full Xcode, then archive the iOS app.
2. Configure Apple bundle signing and Google Play signing.
3. Replace default Capacitor native icons/splash screens with final Lokl assets.
4. Configure native permissions, iOS privacy manifests, Android data safety, app screenshots, support URLs, age/content ratings, and TestFlight/internal testing.
5. Resolve production preflight blockers and run live Google/OTP/image-upload QA against the final production project.
