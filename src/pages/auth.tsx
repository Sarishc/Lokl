import { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronLeft, CheckCircle2, MapPin, MessageCircleMore, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Page, GlassCard, LocalityPicker, PrimaryButton, SecondaryButton } from '../components/common';
import { APP_NAME, DEFAULT_PHONE_CODE, TAGLINE } from '../lib/constants';
import { getLegalConsent, LEGAL_CONSENT_VERSION, recordLegalConsent } from '../lib/legal';
import { nearestLocality } from '../lib/localities';
import { getCurrentLocation, ImagePicker } from '../lib/device';
import { vibrate } from '../lib/utils';
import { api } from '../services/api';
import { useAppStore } from '../store/app-store';

const floatingListings = [
  { title: 'Camera kit', detail: '850 m', price: '₹12k', icon: Camera, className: 'left-1 top-8' },
  { title: 'Quick chat', detail: 'Trusted reply', price: '2m', icon: MessageCircleMore, className: 'right-0 top-[6.8rem]' },
  { title: 'Home find', detail: 'Verified', price: 'Live', icon: PackageCheck, className: 'bottom-6 left-8' },
];

export function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useAppStore((state) => state.setUser);
  const reduceMotion = useReducedMotion();
  const resendCooldownSeconds = __IS_MOCK_MODE__ ? 30 : 60;
  const [phone, setPhone] = useState(`${DEFAULT_PHONE_CODE}`);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(resendCooldownSeconds);
  const [legalAccepted, setLegalAccepted] = useState(Boolean(getLegalConsent()));
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const captchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined;

  useEffect(() => {
    if (!otpSent || timer <= 0) return;
    const id = window.setTimeout(() => setTimer((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [otpSent, timer]);

  const sendOtp = useMutation({
    mutationFn: () => {
      recordLegalConsent();
      return api.sendOtp(phone, captchaToken);
    },
    onSuccess: () => {
      setOtpSent(true);
      setTimer(resendCooldownSeconds);
      setCaptchaToken(undefined);
      toast.success('OTP sent', { description: __IS_MOCK_MODE__ ? 'Use 123456 to continue in demo mode.' : 'Check your SMS inbox.' });
    },
    onError: (error: Error) => toast.error('Couldn’t send OTP', { description: error.message || 'Check the phone number and try again.' }),
  });

  const verifyOtp = useMutation({
    mutationFn: () => api.verifyOtp(phone, otp),
    onSuccess: async (user) => {
      vibrate([12, 10, 12]);
      const profile = await api.getCurrentUser();
      setUser(profile);
      await queryClient.invalidateQueries();
      if (user?.full_name || profile?.full_name) navigate('/');
      else navigate('/onboarding');
    },
    onError: (error: Error) => toast.error('Couldn’t verify OTP', { description: error.message || 'Check the code and try again.' }),
  });

  const googleSignIn = useMutation({
    mutationFn: () => {
      recordLegalConsent();
      return api.signInWithGoogle();
    },
    onSuccess: async (profile) => {
      if (!profile) return;
      vibrate(12);
      setUser(profile);
      await queryClient.invalidateQueries();
      navigate(profile.full_name ? '/' : '/onboarding');
    },
    onError: (error: Error) => toast.error('Couldn’t continue with Google', { description: error.message || 'Check Google sign-in configuration and try again.' }),
  });

  const captchaReady = !captchaSiteKey || Boolean(captchaToken);
  const canContinue = useMemo(() => phone.length >= 13 && legalAccepted && captchaReady, [captchaReady, legalAccepted, phone]);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="auth-screen px-4 pb-6 pt-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.9rem] font-bold leading-tight text-[color:var(--color-text-primary)]">{APP_NAME}</h1>
          <p className="text-muted mt-1 text-sm leading-5">{TAGLINE}</p>
        </div>
        <div className="auth-live-pill" aria-label="Secure local marketplace">
          <Sparkles size={15} />
          <span>Live</span>
        </div>
      </div>

      <AuthWelcomeMotion />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: reduceMotion ? 0 : 0.14, duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassCard className="auth-login-card overflow-hidden p-6">
          <div className="mb-4 inline-flex rounded-2xl bg-[color:var(--color-primary)]/20 p-3 text-[color:var(--color-primary)]"><ShieldCheck /></div>
          <h2 className="font-display text-2xl font-semibold">Enter Lokl securely</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-muted)]">Use Google today or phone OTP when SMS is available. Both keep accounts trusted.</p>

          <button
            type="button"
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white px-4 text-sm font-extrabold text-[#1f1f1f] shadow-[0_14px_30px_rgba(0,0,0,0.25)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => googleSignIn.mutate()}
            disabled={!legalAccepted || googleSignIn.isPending}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full border border-black/10 font-display text-base leading-none text-[#4285f4]">G</span>
            {googleSignIn.isPending ? 'Opening Google...' : 'Continue with Google'}
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span className="h-px flex-1 bg-white/10" />
            <span>or phone OTP</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <label className="block text-sm text-[color:var(--color-text-muted)]">Phone number</label>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98XXXXXXXX" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-white outline-none ring-0 transition focus:border-[color:var(--color-line-strong)] focus:bg-white/8 placeholder:text-[color:var(--color-text-muted)]" />

          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-3 text-sm leading-5 text-[color:var(--color-text-soft)]">
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(event) => setLegalAccepted(event.target.checked)}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span>
              I agree to Lokl&apos;s draft <Link to="/terms" className="font-semibold text-[color:var(--color-primary)]">Terms</Link> and <Link to="/privacy" className="font-semibold text-[color:var(--color-primary)]">Privacy Policy</Link>. Version {LEGAL_CONSENT_VERSION} needs human legal review before public launch.
            </span>
          </label>

          {captchaSiteKey ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-white p-2">
              <HCaptcha sitekey={captchaSiteKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(undefined)} onError={() => setCaptchaToken(undefined)} />
            </div>
          ) : (
            !__IS_MOCK_MODE__ ? <p className="mt-3 text-xs leading-5 text-[color:var(--color-warning)]">CAPTCHA site key is not configured locally. Enable Supabase CAPTCHA protection and set VITE_HCAPTCHA_SITE_KEY before public signup.</p> : null
          )}

          {!otpSent ? (
            <PrimaryButton className="mt-6 w-full" onClick={() => sendOtp.mutate()} disabled={!canContinue || sendOtp.isPending}>
              {sendOtp.isPending ? 'Sending OTP...' : 'Send OTP'}
            </PrimaryButton>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm text-[color:var(--color-text-muted)]">6-digit OTP</label>
                <input maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="123456" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-lg tracking-[0.35em] text-white outline-none placeholder:text-[color:var(--color-text-muted)]" />
              </div>
              <PrimaryButton className="w-full" onClick={() => verifyOtp.mutate()} disabled={otp.length !== 6 || verifyOtp.isPending}>
                {verifyOtp.isPending ? 'Verifying...' : 'Verify & enter Lokl'}
              </PrimaryButton>
              <div className="flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
                <span>Didn’t receive it?</span>
                <button className="font-medium text-[color:var(--color-primary)] disabled:text-[color:var(--color-text-muted)]" disabled={timer > 0} onClick={() => sendOtp.mutate()}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

function AuthWelcomeMotion() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="auth-welcome-stage" aria-label="Welcome to Lokl">
      <div className="auth-signal-grid" aria-hidden="true" />
      <motion.div
        className="auth-signal-sweep"
        aria-hidden="true"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
      />
      <div className="auth-ring auth-ring-outer" aria-hidden="true" />
      <div className="auth-ring auth-ring-inner" aria-hidden="true" />

      <motion.div
        className="auth-trust-core"
        animate={reduceMotion ? undefined : { y: [0, -4, 0], scale: [1, 1.015, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="auth-trust-icon">
          <ShieldCheck size={24} />
        </div>
        <span>Lokl trust</span>
      </motion.div>

      {floatingListings.map((item, index) => (
        <motion.div
          key={item.title}
          className={`auth-floating-card ${item.className}`}
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.92 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, index % 2 === 0 ? -7 : 7, 0], scale: 1 }}
          transition={{
            opacity: { delay: 0.16 + index * 0.08, duration: 0.32 },
            y: { delay: index * 0.12, duration: 4.4 + index * 0.4, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: 0.32 },
          }}
        >
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)]">
            <item.icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-[color:var(--color-text-primary)]">{item.title}</div>
            <div className="truncate text-[10px] text-[color:var(--color-text-muted)]">{item.detail}</div>
          </div>
          <span className="rounded-full bg-[color:var(--color-primary)] px-2 py-1 text-[10px] font-black text-[color:var(--color-ink)]">{item.price}</span>
        </motion.div>
      ))}

      <motion.div
        className="auth-verified-strip"
        aria-hidden="true"
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.42, duration: reduceMotion ? 0 : 0.38 }}
      >
        <CheckCircle2 size={15} />
        <span>Verified neighbours, faster deals</span>
      </motion.div>
    </section>
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar_url || '');
  const [phone, setPhone] = useState(user?.phone || '');
  // Deliberately not defaulted to Koramangala/Bengaluru — an untouched onboarding
  // form must submit "we don't know," not a fake real place. See
  // docs/audit/FINDINGS.md LOKL-031/038/042 and the Step 5 report's Task 2/3
  // write-up. locality/city/coords are always set together, from the picker or
  // from a real GPS fix snapped to its nearest known locality — never from free
  // text, so a label and its coordinates can never disagree.
  const [locality, setLocality] = useState(user?.locality || '');
  const [city, setCity] = useState(user?.city || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    user?.location_lat != null && user?.location_lng != null ? { lat: user.location_lat, lng: user.location_lng } : null,
  );
  const [detecting, setDetecting] = useState(false);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const result = await getCurrentLocation();
      if (result.status === 'granted') {
        const nearest = nearestLocality(result.latitude, result.longitude);
        setCity(nearest.city);
        setLocality(nearest.locality);
        setCoords({ lat: nearest.lat, lng: nearest.lng });
        toast.success('Location detected', { description: `Set to ${nearest.locality}, ${nearest.city} — your nearest known locality.` });
      } else if (result.status === 'denied') {
        toast.error('Location access denied', { description: 'You can try again, or just choose your locality below.' });
      } else if (result.status === 'denied-permanently') {
        toast.error('Location access is turned off for Lokl', { description: 'Enable it for Lokl in your device Settings, or choose your locality below.' });
      } else if (result.status === 'disabled') {
        toast.error('Location services are off', { description: 'Turn on location services for this device in Settings, or choose your locality below.' });
      } else if (result.status === 'timeout') {
        toast.error('Couldn’t get a location fix in time', { description: 'Try again, or choose your locality below.' });
      } else {
        toast.error('Couldn’t detect location', { description: result.message || 'Choose your locality below.' });
      }
    } finally {
      setDetecting(false);
    }
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No session found');
      return api.upsertProfile({
        id: user.id,
        full_name: fullName,
        phone: phone.trim() || null,
        bio,
        avatar_url: avatar,
        locality,
        city,
        location_lat: coords?.lat ?? null,
        location_lng: coords?.lng ?? null,
        is_verified: true,
      });
    },
    onSuccess: async (profile) => {
      setUser(profile);
      await queryClient.invalidateQueries();
      toast.success('Welcome to Lokl');
      navigate('/');
    },
    onError: (error: Error) => toast.error('Couldn’t save profile', { description: error.message || 'Check the details and try again.' }),
  });

  return (
    <Page title="Complete your profile" subtitle="Set up your trusted neighbourhood identity" right={<button onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5"><ChevronLeft size={18} /></button>}>
      <GlassCard className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <ImagePicker
            className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-[28px] border border-dashed border-white/15 bg-white/5"
            onFiles={async ([file]) => setAvatar(await api.uploadImage(file, 'avatars'))}
            onDenied={(source) => toast.error(source === 'camera' ? 'Camera access denied' : 'Photo library access denied', { description: 'Allow access in Settings, or try the other option.' })}
            onError={(message) => toast.error('Couldn’t use that photo', { description: message })}
          >
            {avatar ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" /> : <Camera className="text-[color:var(--color-text-muted)]" />}
          </ImagePicker>
          <div>
            <h3 className="font-semibold">Upload profile photo</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">A real face boosts trust and replies.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[color:var(--color-text-muted)]">Full name</label>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" placeholder="Your full name" />
          </div>
          <div>
            <label className="text-sm text-[color:var(--color-text-muted)]">Phone number <span className="text-[color:var(--color-text-muted)]/70">(optional)</span></label>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" placeholder="+91 98XXXXXXXX" />
          </div>
          <div>
            <label className="text-sm text-[color:var(--color-text-muted)]">Bio</label>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="mt-2 min-h-[88px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3" placeholder="Tell your neighbours what you usually sell" />
          </div>
          <LocalityPicker
            city={city}
            locality={locality}
            onChange={(option) => { setCity(option.city); setLocality(option.locality); setCoords({ lat: option.lat, lng: option.lng }); }}
          />
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MapPin size={16} className="text-[color:var(--color-secondary)]" /> Use current location</div>
          <p className="text-sm text-[color:var(--color-text-muted)]">Detect your nearest known locality automatically, or choose one above.</p>
          <SecondaryButton className="mt-3" onClick={detectLocation} disabled={detecting}>{detecting ? 'Detecting…' : 'Detect location'}</SecondaryButton>
        </div>

        <PrimaryButton className="w-full" onClick={() => saveProfile.mutate()} disabled={!fullName.trim() || !locality.trim() || !city.trim() || saveProfile.isPending}>
          {saveProfile.isPending ? 'Saving profile...' : 'Finish onboarding'}
        </PrimaryButton>
      </GlassCard>
    </Page>
  );
}
