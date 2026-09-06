import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { AppShell, GlassCard, PrimaryButton } from './components/common';
import { initPushNotifications } from './lib/firebase';
import { api } from './services/api';
import { useAppStore } from './store/app-store';

const AuthPage = lazy(() => import('./pages/auth').then((module) => ({ default: module.AuthPage })));
const OnboardingPage = lazy(() => import('./pages/auth').then((module) => ({ default: module.OnboardingPage })));
const HomePage = lazy(() => import('./pages/market').then((module) => ({ default: module.HomePage })));
const ExplorePage = lazy(() => import('./pages/market').then((module) => ({ default: module.ExplorePage })));
const ListingDetailPage = lazy(() => import('./pages/market').then((module) => ({ default: module.ListingDetailPage })));
const SellPage = lazy(() => import('./pages/market').then((module) => ({ default: module.SellPage })));
const ChatsPage = lazy(() => import('./pages/market').then((module) => ({ default: module.ChatsPage })));
const ChatDetailPage = lazy(() => import('./pages/market').then((module) => ({ default: module.ChatDetailPage })));
const NotificationsPage = lazy(() => import('./pages/market').then((module) => ({ default: module.NotificationsPage })));
const SavedPage = lazy(() => import('./pages/account').then((module) => ({ default: module.SavedPage })));
const ProfilePage = lazy(() => import('./pages/account').then((module) => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import('./pages/account').then((module) => ({ default: module.AdminPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/legal').then((module) => ({ default: module.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/legal').then((module) => ({ default: module.TermsPage })));

function RouteGuards({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: () => api.getSession() });
  const profileQuery = useQuery({
    queryKey: ['current-user'],
    enabled: Boolean(sessionQuery.data) && !user,
    queryFn: () => api.getCurrentUser(),
  });

  useEffect(() => {
    if (profileQuery.isSuccess) setUser(profileQuery.data ?? null);
  }, [profileQuery.data, profileQuery.isSuccess, setUser]);

  const effectiveUser = user ?? profileQuery.data ?? null;

  if (sessionQuery.isLoading || (sessionQuery.data && !effectiveUser && profileQuery.isLoading)) {
    return <div className="px-4 pt-6"><GlassCard className="animate-pulse p-10">&nbsp;</GlassCard></div>;
  }

  const publicPaths = ['/auth', '/onboarding', '/account-restricted', '/privacy', '/terms'];
  const isPublic = publicPaths.some((path) => location.pathname.startsWith(path));

  if (!sessionQuery.data && !isPublic) return <Navigate to="/auth" replace />;
  if (effectiveUser?.is_banned && location.pathname !== '/account-restricted') return <Navigate to="/account-restricted" replace />;
  if (sessionQuery.data && !effectiveUser && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (effectiveUser && !effectiveUser.full_name && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (effectiveUser && location.pathname === '/auth') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function BootstrappedApp() {
  const queryClient = useQueryClient();
  const setUser = useAppStore((state) => state.setUser);

  useEffect(() => {
    api.getCurrentUser().then((user) => setUser(user));
    api.initNativeGoogleOAuthListener(() => {
      void api.getCurrentUser().then((user) => setUser(user));
      void queryClient.invalidateQueries();
    });
    const unsubscribe = api.subscribe((event) => {
      if (!event?.table) {
        void queryClient.invalidateQueries();
        return;
      }
      const next = event.new ?? event.old ?? {};
      switch (event.table) {
        case 'listings':
          void queryClient.invalidateQueries({ queryKey: ['feed'] });
          void queryClient.invalidateQueries({ queryKey: ['search'] });
          if (next.id) void queryClient.invalidateQueries({ queryKey: ['listing', next.id] });
          if (next.seller_id) void queryClient.invalidateQueries({ queryKey: ['my-listings', next.seller_id] });
          break;
        case 'messages':
          if (next.chat_id) void queryClient.invalidateQueries({ queryKey: ['messages', next.chat_id] });
          break;
        case 'chats':
          if (next.buyer_id) void queryClient.invalidateQueries({ queryKey: ['chats', next.buyer_id] });
          if (next.seller_id) void queryClient.invalidateQueries({ queryKey: ['chats', next.seller_id] });
          if (next.id) void queryClient.invalidateQueries({ queryKey: ['chat', next.id] });
          break;
        case 'notifications':
          if (next.user_id) void queryClient.invalidateQueries({ queryKey: ['notifications', next.user_id] });
          break;
        case 'users':
          if (next.id) void queryClient.invalidateQueries({ queryKey: ['seller', next.id] });
          void api.getCurrentUser().then((user) => setUser(user));
          break;
        case 'reports':
          void queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
          break;
        default:
          break;
      }
    });
    initPushNotifications((payload) => {
      toast.info(payload.notification?.title || 'Lokl notification', { description: payload.notification?.body });
      const userId = useAppStore.getState().user?.id;
      if (userId) void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    }).then((token) => { if (token) toast.success('Push notifications enabled'); });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [queryClient, setUser]);

  return (
    <BrowserRouter>
      <RouteGuards>
        <AppShell>
          <AnimatedRoutes />
        </AppShell>
      </RouteGuards>
      <Toaster position="top-center" richColors theme="dark" />
    </BrowserRouter>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteLoading />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/account-restricted" element={<AccountRestricted />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
          <Route path="/sell" element={<SellPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:id" element={<ChatDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function RouteLoading() {
  return <div className="px-4 pt-6"><GlassCard className="skeleton-shimmer h-40" /></div>;
}

function AccountRestricted() {
  const setUser = useAppStore((state) => state.setUser);
  return (
    <div className="px-4 pt-8">
      <GlassCard className="space-y-4 p-6 text-center">
        <h2 className="text-2xl font-bold">Account restricted</h2>
        <p className="text-sm leading-6 text-[color:var(--color-text-muted)]">This account can no longer post listings or send messages. Contact Lokl support if this looks wrong.</p>
        <PrimaryButton className="w-full bg-[color:var(--color-danger)] text-white shadow-none" onClick={() => { void api.logout().then(() => { setUser(null); window.location.assign('/auth'); }); }}>Log out</PrimaryButton>
      </GlassCard>
    </div>
  );
}

function NotFound() {
  return (
    <div className="px-4 pt-8">
      <GlassCard className="p-6 text-center">
        <h2 className="text-2xl font-bold">Page not found</h2>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">That neighbourhood lane doesn’t exist yet.</p>
        <PrimaryButton className="mt-5" onClick={() => window.location.assign('/')}>Go home</PrimaryButton>
      </GlassCard>
    </div>
  );
}

export default BootstrappedApp;
