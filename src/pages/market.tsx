import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowLeft, BellOff, Check, ChevronDown, ChevronRight, CircleAlert, Filter, Heart, ImagePlus, MapPinned, MessageCircle, MoreHorizontal, RefreshCcw, SearchX, Send, Share2, SlidersHorizontal, Sparkles, Store, WifiOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApproximateMap, ListingsMap } from '../components/maps';
import { Avatar, ChatRow, EmptyState, FallbackImage, GlassCard, ListingCard, NotificationBell, Page, Pill, PrimaryButton, SecondaryButton, SkeletonCard, StatChip } from '../components/common';
import { categoryIconFor, conditionIconFor } from '../lib/chip-icons';
import { categories, conditionOptions, defaultSearchFilters, listingFilterPresets, quickReplies, safetyTips, trendingSearchesByCity } from '../lib/constants';
import { ImagePicker } from '../lib/device';
import { clamp, cn, compressImage, currency, formatChatTime, groupDateLabel, timeAgo, vibrate } from '../lib/utils';
import { api } from '../services/api';
import { useAppStore } from '../store/app-store';
import type { FeedFilters, Listing, ListingCondition, Message, RadiusOption, SearchFilters, UserProfile } from '../types';

function ConfirmSheet({ title, body, confirmLabel, danger, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 px-4 backdrop-blur-sm">
      <div className="absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 rounded-t-[28px] border border-white/10 bg-[color:var(--color-ink)] p-4">
        <GlassCard className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-text-muted)]">{body}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
            <PrimaryButton className={danger ? 'bg-[color:var(--color-danger)] shadow-none' : undefined} onClick={onConfirm}>{confirmLabel}</PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ReportSheet({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: { reason: string; description: string }) => void }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/60 px-4 backdrop-blur-sm">
      <div className="absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 rounded-t-[28px] border border-white/10 bg-[color:var(--color-ink)] p-4">
        <GlassCard className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-semibold">Report listing</h3>
            <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">Tell us what needs review.</p>
          </div>
          <input value={reason} onChange={(event) => setReason(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" placeholder="Reason" autoFocus />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3" placeholder="Extra details (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
            <PrimaryButton onClick={() => onSubmit({ reason: reason.trim(), description: description.trim() })} disabled={!reason.trim()}>Submit report</PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function OfferSheet({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (amount: number) => void }) {
  const [amount, setAmount] = useState('');
  const parsedAmount = Number(amount);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 px-4 backdrop-blur-sm">
      <div className="absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 rounded-t-[28px] border border-white/10 bg-[color:var(--color-ink)] p-4">
        <GlassCard className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-semibold">Make an offer</h3>
            <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">Enter the amount you want to send to the seller.</p>
          </div>
          <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" placeholder="Offer amount in Rs" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
            <PrimaryButton onClick={() => onSubmit(parsedAmount)} disabled={!parsedAmount || parsedAmount <= 0}>Send offer</PrimaryButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function useUnreadNotifications(userId?: string) {
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: Boolean(userId),
    queryFn: () => api.getNotifications(userId!),
    refetchInterval: 5000,
  });
}

function LocationRadiusSheet({ user, radius, onChangeRadius, onClose }: { user: UserProfile; radius: RadiusOption; onChangeRadius: (radius: RadiusOption) => void; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="fixed inset-0 z-50 bg-black/60 px-4 backdrop-blur-sm">
      <motion.div
        initial={reduceMotion ? false : { y: '100%' }}
        animate={{ y: 0 }}
        exit={reduceMotion ? undefined : { y: '100%' }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
        className="surface-sheet absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 rounded-t-[28px] border p-4 shadow-[0_-18px_48px_rgba(0,0,0,0.38)]"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Nearby radius</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{user.locality}, {user.city}</p>
          </div>
          <button onClick={onClose} aria-label="Close location picker" className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5"><X size={18} /></button>
        </div>
        <div className="relative mb-5 h-36 overflow-hidden rounded-3xl border border-[color:var(--color-line)] bg-[color:var(--color-field)]">
          <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(255,248,232,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,248,232,0.06) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
          <motion.div
            className="absolute left-1/2 top-1/2 rounded-full border border-[color:var(--color-primary)]/50 bg-[color:var(--color-primary)]/10"
            animate={reduceMotion ? undefined : { scale: [1, 1.08, 1] }}
            transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: `${Math.min(120, 42 + Number(radius) * 3)}px`, height: `${Math.min(120, 42 + Number(radius) * 3)}px`, transform: 'translate(-50%, -50%)' }}
          />
          <div className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-[color:var(--color-primary)] text-[color:var(--color-ink)] shadow-[var(--shadow-accent)]"><MapPinned size={20} /></div>
          <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur">{radius} km preview</div>
        </div>
        <div className="rounded-3xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-semibold">Show listings within</span>
            <span className="rounded-full bg-[color:var(--color-primary)] px-3 py-1 font-bold text-[color:var(--color-ink)]">{radius} km</span>
          </div>
          <input aria-label="Radius" type="range" min={1} max={25} step={1} value={radius} onChange={(event) => onChangeRadius(Number(event.target.value) as RadiusOption)} className="w-full accent-[var(--color-primary)]" />
          <div className="mt-2 flex justify-between text-[11px] text-[color:var(--color-text-muted)]"><span>1 km</span><span>25 km</span></div>
        </div>
        <PrimaryButton className="mt-4 w-full" onClick={onClose}>Apply radius</PrimaryButton>
      </motion.div>
    </div>
  );
}

export function HomePage() {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const radius = useAppStore((state) => state.radius);
  const setRadius = useAppStore((state) => state.setRadius);
  const feedFilters = useAppStore((state) => state.feedFilters);
  const setFeedPreset = useAppStore((state) => state.setFeedPreset);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const notificationQuery = useUnreadNotifications(user?.id);
  const savedQuery = useQuery({ queryKey: ['saved-ids', user?.id], enabled: Boolean(user?.id), queryFn: () => api.getSavedListingIds(user!.id) });
  const { ref, inView } = useInView({ threshold: 0.2 });

  const feed = useInfiniteQuery({
    queryKey: ['feed', user?.id, feedFilters],
    enabled: Boolean(user?.locality),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getFeed(user!.location_lat, user!.location_lng, feedFilters, Number(pageParam)),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  useEffect(() => {
    if (inView && feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, [feed, inView]);

  const listings = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = notificationQuery.data?.filter((item) => !item.is_read).length ?? 0;

  const toggleSave = useMutation({
    mutationFn: (listingId: string) => api.toggleSave(user!.id, listingId),
    onSuccess: async (saved) => {
      vibrate();
      toast.success(saved ? 'Saved to wishlist' : 'Removed from saved');
      await queryClient.invalidateQueries({ queryKey: ['saved-ids', user?.id] });
    },
  });

  if (!user) return null;

  // A user with no known locality must be told so, not silently shown another
  // city's listings as though they were local — see docs/audit/FINDINGS.md
  // LOKL-031. `locality` is this app's "we know where you are" signal (see
  // src/services/api.ts upsertUserProfileFromAuth and src/pages/auth.tsx
  // OnboardingPage); an empty one means the user skipped or was denied location
  // during onboarding.
  if (!user.locality) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          title="We don't know your neighbourhood yet"
          body="Set your locality so we can show you listings near you, instead of guessing."
          icon={<MapPinned size={28} />}
          action={<PrimaryButton onClick={() => navigate('/onboarding')}>Set your location</PrimaryButton>}
        />
      </div>
    );
  }

  const runRefresh = async () => {
    setIsPullRefreshing(true);
    try {
      await feed.refetch();
    } finally {
      setIsPullRefreshing(false);
      setPullDistance(0);
      touchStartY.current = null;
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY <= 0) touchStartY.current = event.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null || window.scrollY > 0 || isPullRefreshing) return;
    const nextDistance = Math.max(0, ((event.touches[0]?.clientY ?? 0) - touchStartY.current) * 0.55);
    setPullDistance(Math.min(96, nextDistance));
  };
  const handleTouchEnd = () => {
    if (pullDistance > 68 && !isPullRefreshing) void runRefresh();
    else setPullDistance(0);
    touchStartY.current = null;
  };

  return (
    <Page
      title="Lokl"
      subtitle="Your neighbourhood marketplace"
      right={<NotificationBell count={unreadCount} />}
    >
      <div data-testid="home-feed-pull-zone" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <motion.div
        data-testid="pull-refresh-indicator"
        className="mx-auto mb-3 grid place-items-center overflow-hidden text-xs font-bold text-[color:var(--color-primary)]"
        animate={{ height: isPullRefreshing || pullDistance > 4 ? 44 : 0, opacity: isPullRefreshing || pullDistance > 4 ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }}
      >
        <motion.div animate={reduceMotion ? undefined : { rotate: isPullRefreshing ? 360 : pullDistance * 2 }} transition={isPullRefreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0 }}>
          <RefreshCcw size={20} />
        </motion.div>
        <span>{isPullRefreshing ? 'Refreshing nearby finds' : pullDistance > 68 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </motion.div>

      <button data-testid="location-radius-button" onClick={() => setShowLocationSheet(true)} className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/5 p-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">Current locality</div>
          <div className="mt-1 flex items-center gap-2 truncate text-sm font-semibold">{user.locality}, {user.city} <ChevronDown size={16} className="shrink-0 text-[color:var(--color-text-muted)]" /></div>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center rounded-2xl border border-white/10 bg-[color:var(--color-surface)] px-4 text-sm font-bold">{radius} km</span>
      </button>

      <motion.div
        className="mb-4 flex gap-3 overflow-x-auto pb-2"
        initial={reduceMotion ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.03 } } }}
      >
        {categories.map((category) => {
          const Icon = categoryIconFor(category);
          return (
            <motion.button
              key={category}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
              className="flex min-w-[88px] flex-col items-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] px-3 py-3 text-center text-xs font-semibold text-[color:var(--color-text-soft)] shadow-[0_10px_24px_rgba(0,0,0,0.2)] hover:border-[color:var(--color-line-strong)] hover:bg-[color:var(--color-field-strong)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--color-primary)]/18 text-[color:var(--color-primary)]">
                <Icon size={20} />
              </span>
              <span>{category}</span>
            </motion.button>
          );
        })}
      </motion.div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {listingFilterPresets.map((preset) => (
          <Pill key={preset.key} active={feedFilters.preset === preset.key} onClick={() => setFeedPreset(preset.key as FeedFilters['preset'])}>{preset.label}</Pill>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-[color:var(--color-text-muted)]">
        <span>{listings.length} items nearby</span>
        <button className="inline-flex items-center gap-2" onClick={() => feed.refetch()}><RefreshCcw size={15} /> Refresh</button>
      </div>

      {feed.isLoading ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      ) : feed.isError ? (
        <EmptyState title="Couldn’t load nearby listings" body="Check your connection and retry the feed for your locality." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => feed.refetch()}>Retry feed</PrimaryButton>} />
      ) : listings.length === 0 ? (
        <EmptyState title="Nothing nearby yet" body="Widen your radius or be the first to post in your locality." icon={<Store size={28} />} action={<PrimaryButton onClick={() => setRadius(10)}>Expand radius</PrimaryButton>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} saved={savedQuery.data?.includes(listing.id)} currentUser={user} onSave={(listingId) => toggleSave.mutate(listingId)} />)}
          </div>
          <div ref={ref} className="py-6 text-center text-sm text-[color:var(--color-text-muted)]">{feed.isFetchingNextPage ? 'Loading more listings...' : feed.hasNextPage ? 'Scroll for more' : 'You reached the end'}</div>
        </>
      )}
      </div>
      <AnimatePresence>{showLocationSheet ? <LocationRadiusSheet user={user} radius={radius} onChangeRadius={setRadius} onClose={() => setShowLocationSheet(false)} /> : null}</AnimatePresence>
    </Page>
  );
}

function SearchFilterSheet({ open, filters, onClose, onApply }: { open: boolean; filters: SearchFilters; onClose: () => void; onApply: (filters: SearchFilters) => void }) {
  const [localFilters, setLocalFilters] = useState(filters);
  useEffect(() => setLocalFilters(filters), [filters]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-[28px] border border-white/10 bg-[color:var(--color-ink)] p-4">
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Search filters</h3><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5"><X size={18} /></button></div>
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-sm text-[color:var(--color-text-muted)]">Categories</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = localFilters.categories.includes(category);
                return <Pill key={category} active={active} onClick={() => setLocalFilters((prev) => ({ ...prev, categories: active ? prev.categories.filter((item) => item !== category) : [...prev.categories, category] }))}>{category}</Pill>;
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-[color:var(--color-text-muted)]"><span>Price range</span><span>{currency(localFilters.minPrice)} - {currency(localFilters.maxPrice)}</span></div>
            <input type="range" min={0} max={500000} step={500} value={localFilters.maxPrice} onChange={(event) => setLocalFilters((prev) => ({ ...prev, maxPrice: Number(event.target.value) }))} className="w-full accent-[var(--color-primary)]" />
          </div>
          <div>
            <div className="mb-2 text-sm text-[color:var(--color-text-muted)]">Condition</div>
            <div className="grid grid-cols-2 gap-2">
              {(['New', 'Like New', 'Good', 'Fair'] as ListingCondition[]).map((condition) => {
                const active = localFilters.conditions.includes(condition);
                return <Pill key={condition} active={active} onClick={() => setLocalFilters((prev) => ({ ...prev, conditions: active ? prev.conditions.filter((item) => item !== condition) : [...prev.conditions, condition] }))}>{condition}</Pill>;
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-[color:var(--color-text-muted)]"><span>Distance</span><span>{localFilters.radius} km</span></div>
            <input type="range" min={1} max={25} step={1} value={localFilters.radius} onChange={(event) => setLocalFilters((prev) => ({ ...prev, radius: clamp(Number(event.target.value), 1, 25) as 1 | 2 | 5 | 10 | 25 }))} className="w-full accent-[var(--color-secondary)]" />
          </div>
          <div>
            <div className="mb-2 text-sm text-[color:var(--color-text-muted)]">Sort by</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['newest', 'Newest'],
                ['price-asc', 'Price low-high'],
                ['price-desc', 'Price high-low'],
                ['distance', 'Distance'],
              ].map(([key, label]) => <Pill key={key} active={localFilters.sortBy === key} onClick={() => setLocalFilters((prev) => ({ ...prev, sortBy: key as SearchFilters['sortBy'] }))}>{label}</Pill>)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton onClick={() => { setLocalFilters(defaultSearchFilters); onApply(defaultSearchFilters); }}>Reset</SecondaryButton>
            <PrimaryButton onClick={() => { onApply(localFilters); onClose(); }}>Apply filters</PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExplorePage() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const searchFilters = useAppStore((state) => state.searchFilters);
  const setSearchFilters = useAppStore((state) => state.setSearchFilters);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const recentSearches = api.getRecentSearches();

  const searchQuery = useQuery({
    queryKey: ['search', query, searchFilters, user?.id],
    enabled: Boolean(user?.locality),
    queryFn: () => api.searchListings(query, searchFilters, user!.location_lat, user!.location_lng),
  });

  const results = searchQuery.data ?? [];
  const trending = trendingSearchesByCity[user?.city || ''] || [];

  useEffect(() => {
    if (!query.trim()) return;
    const id = setTimeout(() => api.saveRecentSearch(query.trim()), 600);
    return () => clearTimeout(id);
  }, [query]);

  if (!user) return null;

  // Same rationale as HomePage — see docs/audit/FINDINGS.md LOKL-031. Search is
  // just as location-dependent (distance sort, trending-by-city) as the feed, so
  // it needs the same guard rather than silently searching from Koramangala.
  if (!user.locality) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          title="We don't know your neighbourhood yet"
          body="Set your locality so search and trending results are for your area, not a guess."
          icon={<MapPinned size={28} />}
          action={<PrimaryButton onClick={() => navigate('/onboarding')}>Set your location</PrimaryButton>}
        />
      </div>
    );
  }

  return (
    <Page title="Explore" subtitle="Search fast, then switch to map when you want a quick scan">
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search phones, chairs, books..." className="h-12 flex-1 bg-transparent outline-none placeholder:text-[color:var(--color-text-muted)]" />
        <button className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5" onClick={() => setShowFilters(true)}><Filter size={18} /></button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recentSearches.slice(0, 4).map((item) => <Pill key={item} onClick={() => setQuery(item)}>{item}</Pill>)}
        </div>
        <button onClick={() => setMapView((value) => !value)} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium">{mapView ? <SlidersHorizontal size={16} /> : <MapPinned size={16} />}{mapView ? 'List view' : 'Map view'}</button>
      </div>

      {!query && (
        <GlassCard className="mb-4 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-[color:var(--color-secondary)]" /> Trending in {user.city}</div>
          <div className="grid grid-cols-2 gap-2">
            {trending.slice(0, 2).map((term, index) => (
              <motion.button
                key={term}
                onClick={() => setQuery(term)}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className="rounded-3xl border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary)]/12 p-3 text-left shadow-[0_12px_26px_rgba(0,0,0,0.2)]"
              >
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[color:var(--color-primary)] text-[color:var(--color-ink)]"><Sparkles size={15} /></div>
                <div className="text-base font-bold">{term}</div>
                <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">#{index + 1} nearby search</div>
              </motion.button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {trending.slice(2).map((term) => <Pill key={term} onClick={() => setQuery(term)}>{term}</Pill>)}
          </div>
        </GlassCard>
      )}

      {searchQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      ) : searchQuery.isError ? (
        <EmptyState title="Couldn’t run search" body="Check your connection, then retry with the same filters." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => searchQuery.refetch()}>Retry search</PrimaryButton>} />
      ) : mapView ? (
        <div className="space-y-4">
          <ListingsMap listings={results} onSelect={setSelectedListing} />
          {selectedListing ? <ListingCard listing={selectedListing} currentUser={user} /> : <GlassCard className="p-4 text-sm text-[color:var(--color-text-muted)]">Tap a pin to preview the listing.</GlassCard>}
        </div>
      ) : results.length ? (
        <div className="grid grid-cols-2 gap-3">
          {results.map((listing) => <ListingCard key={listing.id} listing={listing} currentUser={user} />)}
        </div>
      ) : (
        <EmptyState title="No search matches" body="Try a wider radius, different price range or another category." icon={<SearchX size={28} />} action={<SecondaryButton onClick={() => setSearchFilters(defaultSearchFilters)}>Reset filters</SecondaryButton>} />
      )}

      <SearchFilterSheet open={showFilters} filters={searchFilters} onClose={() => setShowFilters(false)} onApply={setSearchFilters} />
    </Page>
  );
}

function ListingGallery({ images, title }: { images: string[]; title: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  return (
    <div className="overflow-hidden rounded-[28px]" ref={emblaRef}>
      <div className="flex">
        {images.map((src) => (
          <div key={src} className="min-w-0 flex-[0_0_100%]">
            <FallbackImage src={src} alt={title} label={title} className="h-[360px] w-full object-cover" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5">{images.map((_, index) => <span key={index} className={`h-2 rounded-full ${selected === index ? 'w-6 bg-white' : 'w-2 bg-white/30'}`} />)}</div>
    </div>
  );
}

export function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const [showReport, setShowReport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listingQuery = useQuery({ queryKey: ['listing', id], enabled: Boolean(id), queryFn: () => api.getListing(id!) });
  const listing = listingQuery.data;
  const sellerQuery = useQuery({ queryKey: ['seller', listing?.seller_id], enabled: Boolean(listing?.seller_id), queryFn: () => api.getUserById(listing!.seller_id) });
  const similarQuery = useQuery({ queryKey: ['similar', listing?.id], enabled: Boolean(listing), queryFn: () => api.getSimilarListings(listing!) });
  const savedQuery = useQuery({ queryKey: ['saved-ids', user?.id], enabled: Boolean(user?.id), queryFn: () => api.getSavedListingIds(user!.id) });

  const toggleSave = useMutation({ mutationFn: () => api.toggleSave(user!.id, listing!.id), onSuccess: async (saved) => { toast.success(saved ? 'Saved to wishlist' : 'Removed from wishlist'); await queryClient.invalidateQueries({ queryKey: ['saved-ids', user?.id] }); } });
  const deleteListing = useMutation({ mutationFn: () => api.deleteListing(listing!.id), onSuccess: () => { toast.success('Listing deleted'); navigate('/profile'); } });
  const reportMutation = useMutation({ mutationFn: (payload: { reason: string; description: string }) => api.createReport({ reporter_id: user!.id, listing_id: listing!.id, reported_user_id: listing!.seller_id, ...payload }), onSuccess: () => toast.success('Report submitted') });
  const startChat = useMutation({
    mutationFn: () => api.getOrCreateChat(listing!.id, user!.id),
    onSuccess: (chat) => navigate(`/chats/${chat.id}`),
    onError: (error: Error) => toast.error('Couldn’t open chat', { description: error.message || 'Check your connection and try again.' }),
  });

  if (listingQuery.isLoading) return <Page title="Loading listing"><SkeletonCard /></Page>;
  if (listingQuery.isError) return <Page title="Listing unavailable"><EmptyState title="Couldn’t load listing" body="Check your connection and try again." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => listingQuery.refetch()}>Retry listing</PrimaryButton>} /></Page>;
  if (!listing) return <Page title="Listing unavailable"><EmptyState title="Listing not found" body="It may have been sold or removed." icon={<SearchX size={28} />} /></Page>;
  const seller = sellerQuery.data;
  const isSeller = user?.id === listing.seller_id;
  const saved = savedQuery.data?.includes(listing.id);

  return (
    <div className="pb-28">
      <div className="relative">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="absolute left-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-2xl bg-black/45 text-white backdrop-blur"><ArrowLeft size={18} /></button>
        <ListingGallery images={listing.images} title={listing.title} />
      </div>
      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold">{currency(listing.price, listing.is_free)}</div>
            {listing.is_negotiable ? <span className="mt-2 inline-block rounded-full bg-[color:var(--color-secondary)]/15 px-3 py-1 text-xs font-semibold text-[color:var(--color-secondary)]">Negotiable</span> : null}
          </div>
          <button onClick={async () => { await navigator.clipboard.writeText(window.location.href); toast.success('Shareable link copied'); }} aria-label="Share listing" className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5"><Share2 size={18} /></button>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{listing.title}</h1>
        <div className="flex items-center gap-2 text-sm text-[color:var(--color-text-muted)]">
          <span>{listing.category}</span><span>•</span><span>{listing.condition}</span><span>•</span><span>{listing.views} views</span><span>•</span><span>{timeAgo(listing.created_at)}</span>
        </div>

        {seller ? (
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <Avatar user={seller} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><h3 className="truncate font-semibold">{seller.full_name}</h3>{seller.is_verified ? <span className="rounded-full bg-[color:var(--color-secondary)]/15 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-secondary)]">Verified</span> : null}</div>
                <div className="mt-1 text-sm text-[color:var(--color-text-muted)]">⭐ {seller.rating.toFixed(1)} · {seller.total_reviews} reviews · {seller.locality}</div>
              </div>
              <SecondaryButton onClick={() => navigate('/profile')}>View profile</SecondaryButton>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatChip label="Listings" value={String(similarQuery.data?.length ?? 0)} />
              <StatChip label="Member since" value={new Date(seller.joined_at).getFullYear()} />
              <StatChip label="Sold" value={seller.listings_sold} />
            </div>
          </GlassCard>
        ) : null}

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Description</h3><button className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5" aria-label="Report listing" onClick={() => setShowReport(true)}><MoreHorizontal size={18} /></button></div>
          <p className="text-sm leading-7 text-[color:var(--color-text-soft)]">{listing.description}</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MapPinned size={16} className="text-[color:var(--color-secondary)]" /> Approximate area · {listing.locality}</div>
          <ApproximateMap lat={listing.location_lat} lng={listing.location_lng} locality={listing.locality} />
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--color-warning)]"><CircleAlert size={16} /> Meet safely</div>
          <ul className="space-y-2 text-sm text-[color:var(--color-text-soft)]">{safetyTips.map((tip) => <li key={tip}>• {tip}</li>)}</ul>
        </GlassCard>

        {similarQuery.data?.length ? (
          <div>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Similar nearby</h3><ChevronRight size={18} className="text-[color:var(--color-text-muted)]" /></div>
            <div className="flex gap-3 overflow-x-auto pb-2">{similarQuery.data.map((item) => <div key={item.id} className="w-[220px] shrink-0"><ListingCard listing={item} currentUser={user} /></div>)}</div>
          </div>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex w-full max-w-md items-center gap-3 border border-white/10 bg-[color:var(--color-ink)]/95 px-4 py-4 backdrop-blur-xl">
        {!isSeller ? (
          <>
            <button onClick={() => toggleSave.mutate()} aria-label={saved ? 'Remove from wishlist' : 'Save listing'} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5"><Heart size={18} className={saved ? 'fill-[color:var(--color-danger)] text-[color:var(--color-danger)]' : ''} /></button>
            <PrimaryButton className="inline-flex flex-1 items-center justify-center gap-2" onClick={() => startChat.mutate()} disabled={startChat.isPending}><MessageCircle size={17} /> {startChat.isPending ? 'Opening chat...' : 'Chat with seller'}</PrimaryButton>
          </>
        ) : (
          <>
            <SecondaryButton className="flex-1" onClick={() => navigate('/sell', { state: { editId: listing.id } })}>Edit listing</SecondaryButton>
            <PrimaryButton className="flex-1 bg-[color:var(--color-danger)] shadow-none" onClick={() => setConfirmDelete(true)}>Delete</PrimaryButton>
          </>
        )}
      </div>
      {showReport ? <ReportSheet onCancel={() => setShowReport(false)} onSubmit={(payload) => { setShowReport(false); reportMutation.mutate(payload); }} /> : null}
      {confirmDelete ? <ConfirmSheet title="Delete listing?" body="This removes the listing from buyer feeds and search results." confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); deleteListing.mutate(); }} /> : null}
    </div>
  );
}

const sellSteps = ['Photos', 'Details', 'Price', 'Location', 'Review'] as const;

function StepPill({ step, current, label }: { step: number; current: number; label: string }) {
  const reduceMotion = useReducedMotion();
  const done = current > step;
  const active = current === step;
  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: active ? -1 : 0, scale: active ? 1.03 : 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={cn('flex min-h-10 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[10px] font-bold shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition-colors duration-200', active ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-ink)] shadow-[0_12px_24px_rgba(244,182,63,0.22)]' : done ? 'border-[color:var(--color-secondary)]/35 bg-[color:var(--color-secondary)]/18 text-[color:var(--color-secondary)]' : 'border-[color:var(--color-line)] bg-[color:var(--color-field)] text-[color:var(--color-text-muted)]')}
    >
      <motion.span
        animate={reduceMotion ? undefined : { rotate: done ? 360 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
        className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]', active ? 'bg-black/18' : done ? 'bg-[color:var(--color-secondary)]/14' : 'bg-white/6')}
      >
        {done ? <Check size={12} /> : step}
      </motion.span>
      <span className="truncate">{label}</span>
    </motion.div>
  );
}

function StepProgress({ current }: { current: number }) {
  const reduceMotion = useReducedMotion();
  const progress = ((current - 1) / (sellSteps.length - 1)) * 100;
  return (
    <div className="mb-4 space-y-3">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[color:var(--color-field)]">
        <motion.div
          className="h-full rounded-full bg-[color:var(--color-primary)] shadow-[0_0_18px_rgba(244,182,63,0.35)]"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sellSteps.map((label, index) => <StepPill key={label} step={index + 1} current={current} label={label} />)}
      </div>
    </div>
  );
}

export function SellPage() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const draft = useAppStore((state) => state.draft);
  const updateDraft = useAppStore((state) => state.updateDraft);
  const resetDraft = useAppStore((state) => state.resetDraft);
  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState(1);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const editId = (location.state as { editId?: string } | null)?.editId;
  const editListingQuery = useQuery({ queryKey: ['listing', editId], enabled: Boolean(editId), queryFn: () => api.getListing(editId!) });

  useEffect(() => {
    if (user && !draft.locality) updateDraft({ locality: user.locality, city: user.city, location_lat: user.location_lat, location_lng: user.location_lng });
  }, [draft.locality, updateDraft, user]);

  useEffect(() => {
    if (!editId || !editListingQuery.data || loadedEditId === editId) return;
    const listing = editListingQuery.data;
    updateDraft({
      uploadedImages: listing.images,
      title: listing.title,
      category: listing.category,
      condition: listing.condition,
      description: listing.description,
      price: listing.price,
      is_negotiable: listing.is_negotiable,
      is_free: listing.is_free,
      locality: listing.locality,
      city: listing.city,
      location_lat: listing.location_lat,
      location_lng: listing.location_lng,
    });
    setLoadedEditId(editId);
  }, [editId, editListingQuery.data, loadedEditId, updateDraft]);

  const saveListingMutation = useMutation({
    mutationFn: () => {
      const payload = { ...draft, uploadedImages: draft.uploadedImages };
      if (editId) {
        return api.updateListing(editId, {
          title: draft.title,
          description: draft.description,
          price: draft.is_free ? 0 : draft.price,
          is_negotiable: draft.is_negotiable,
          is_free: draft.is_free,
          category: draft.category,
          condition: draft.condition,
          images: draft.uploadedImages,
          location_lat: draft.location_lat,
          location_lng: draft.location_lng,
          locality: draft.locality,
          city: draft.city,
        });
      }
      return api.createListing(payload, user!.id);
    },
    onSuccess: async (listing) => {
      toast.success(editId ? 'Listing updated' : 'Listing posted', { description: editId ? `${listing.title} is up to date.` : `${listing.title} is now visible nearby.` });
      queryClient.setQueryData(['listing', listing.id], listing);
      resetDraft();
      await queryClient.invalidateQueries();
      navigate(`/listing/${listing.id}`);
    },
    onError: (error: Error) => toast.error(editId ? 'Couldn’t update listing' : 'Couldn’t post listing', { description: error.message || 'Check your connection and try again.' }),
  });

  if (!user) return null;
  if (editListingQuery.isLoading) return <Page title="Loading listing"><SkeletonCard /></Page>;
  if (editListingQuery.isError) return <Page title="Edit listing"><EmptyState title="Couldn’t load listing" body="Check your connection and retry editing this listing." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => editListingQuery.refetch()}>Retry edit</PrimaryButton>} /></Page>;

  const nextDisabled = (step === 1 && draft.uploadedImages.length === 0) || (step === 2 && (!draft.title || !draft.description)) || (step === 3 && !draft.is_free && draft.price <= 0);
  const validationHint =
    step === 1 && draft.uploadedImages.length === 0 ? 'Add at least one photo so buyers can judge the item quickly.' :
    step === 2 && (!draft.title || !draft.description) ? 'Add a title and description before pricing the listing.' :
    step === 3 && !draft.is_free && draft.price <= 0 ? 'Enter a price or mark the item as free.' :
    '';

  const goToStep = (nextStep: number) => {
    const boundedStep = clamp(nextStep, 1, sellSteps.length);
    setStepDirection(boundedStep > step ? 1 : -1);
    setStep(boundedStep);
  };

  return (
    <Page title={editId ? 'Edit listing' : 'Sell on Lokl'} subtitle={editId ? 'Update photos, price, location or description' : 'Post in minutes, reach neighbours instantly'} right={<button onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5"><X size={18} /></button>}>
      <StepProgress current={step} />
      <GlassCard className="min-h-[440px] overflow-hidden p-4 shadow-[0_22px_54px_rgba(0,0,0,0.42)]">
        <AnimatePresence mode="wait" custom={stepDirection}>
          <motion.div
            key={step}
            custom={stepDirection}
            initial={reduceMotion ? false : { opacity: 0, x: stepDirection * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: stepDirection * -18 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="space-y-4"
          >
        {step === 1 && (
          <div>
            <div className="text-sm text-[color:var(--color-text-muted)]">Upload up to 8 photos. We automatically compress every image below 500KB for faster loading.</div>
            <ImagePicker
              className="mt-4 flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 text-center"
              multiple
              limit={8 - draft.uploadedImages.length}
              onFiles={async (files) => {
                try {
                  const selected = files.slice(0, 8 - draft.uploadedImages.length);
                  const compressed = await Promise.all(selected.map(async (file) => api.uploadImage(await compressImage(file), 'listings')));
                  updateDraft({ uploadedImages: [...draft.uploadedImages, ...compressed].slice(0, 8) });
                } catch (error) {
                  toast.error('Couldn’t upload photos', { description: error instanceof Error ? error.message : 'Try a JPG or PNG image.' });
                }
              }}
              onDenied={(source) => toast.error(source === 'camera' ? 'Camera access denied' : 'Photo library access denied', { description: 'Allow access in Settings, or try the other option.' })}
              onError={(message) => toast.error('Couldn’t use that photo', { description: message })}
            >
              <ImagePlus className="mb-2 text-[color:var(--color-primary)]" size={34} />
              <div className="font-medium">Add photos from camera or gallery</div>
              <div className="mt-1 text-sm text-[color:var(--color-text-muted)]">First photo becomes your cover image.</div>
            </ImagePicker>
            {draft.uploadedImages.length ? <div className="mt-4 grid grid-cols-4 gap-2">{draft.uploadedImages.map((image, index) => <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl"><img src={image} alt="draft" className="h-full w-full object-cover" /><button onClick={() => updateDraft({ uploadedImages: draft.uploadedImages.filter((_, itemIndex) => itemIndex !== index) })} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60"><X size={14} /></button></div>)}</div> : null}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[color:var(--color-text-muted)]">Title</label>
              <input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="e.g. iPhone 13 mini 128GB" className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" />
            </div>
            <div>
              <label className="text-sm text-[color:var(--color-text-muted)]">Category</label>
              <motion.div
                className="mt-2 grid grid-cols-2 gap-2"
                initial={reduceMotion ? false : 'hidden'}
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.025 } } }}
              >
                {categories.map((category) => (
                  <motion.div key={category} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                    <Pill className="w-full justify-start px-3" icon={categoryIconFor(category)} active={draft.category === category} onClick={() => updateDraft({ category })}>{category}</Pill>
                  </motion.div>
                ))}
              </motion.div>
            </div>
            <div>
              <label className="text-sm text-[color:var(--color-text-muted)]">Condition</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {conditionOptions.map(({ label }) => <Pill key={label} className="w-full justify-start px-3" icon={conditionIconFor(label)} active={draft.condition === label} onClick={() => updateDraft({ condition: label })}>{label}</Pill>)}
              </div>
            </div>
            <div>
              <label className="text-sm text-[color:var(--color-text-muted)]">Description · {draft.description.length}/500</label>
              <textarea value={draft.description} maxLength={500} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="What makes it worth buying? Mention age, bill, pickup and condition." className="mt-2 min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[color:var(--color-text-muted)]">Price in ₹</label>
              <input type="number" value={draft.price} disabled={draft.is_free} onChange={(event) => updateDraft({ price: Number(event.target.value) })} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 disabled:opacity-50" placeholder="0" />
            </div>
            <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-4"><span>This is negotiable</span><input type="checkbox" checked={draft.is_negotiable} onChange={(event) => updateDraft({ is_negotiable: event.target.checked })} /></label>
            <label className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-4"><span>Offer for free</span><input type="checkbox" checked={draft.is_free} onChange={(event) => updateDraft({ is_free: event.target.checked, price: event.target.checked ? 0 : draft.price })} /></label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm text-[color:var(--color-text-muted)]">Locality</label><input value={draft.locality} onChange={(event) => updateDraft({ locality: event.target.value })} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" /></div>
              <div><label className="text-sm text-[color:var(--color-text-muted)]">City</label><input value={draft.city} onChange={(event) => updateDraft({ city: event.target.value })} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm text-[color:var(--color-text-muted)]">Latitude</label><input type="number" value={draft.location_lat} onChange={(event) => updateDraft({ location_lat: Number(event.target.value) })} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" /></div>
              <div><label className="text-sm text-[color:var(--color-text-muted)]">Longitude</label><input type="number" value={draft.location_lng} onChange={(event) => updateDraft({ location_lng: Number(event.target.value) })} className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" /></div>
            </div>
            <ApproximateMap lat={draft.location_lat} lng={draft.location_lng} locality={draft.locality} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/5">
              {draft.uploadedImages[0] ? <img src={draft.uploadedImages[0]} alt="preview" className="aspect-[4/3] w-full object-cover" /> : null}
              <div className="space-y-2 p-4">
                <div className="text-xl font-bold">{currency(draft.price, draft.is_free)}</div>
                <div className="text-lg font-semibold">{draft.title || 'Your listing title'}</div>
                <div className="text-sm text-[color:var(--color-text-muted)]">{draft.category} · {draft.condition} · {draft.locality}</div>
                <p className="text-sm leading-6 text-[color:var(--color-text-soft)]">{draft.description || 'Your description will appear here.'}</p>
              </div>
            </div>
            <PrimaryButton className="w-full" onClick={() => saveListingMutation.mutate()} disabled={saveListingMutation.isPending} isLoading={saveListingMutation.isPending}>{saveListingMutation.isPending ? (editId ? 'Saving listing...' : 'Posting listing...') : (editId ? 'Save listing' : 'Post listing')}</PrimaryButton>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </GlassCard>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={() => goToStep(step - 1)} disabled={step === 1}>Back</SecondaryButton>
        {step < 5 ? <PrimaryButton onClick={() => goToStep(step + 1)} disabled={nextDisabled}>Continue</PrimaryButton> : <SecondaryButton onClick={resetDraft}>Clear draft</SecondaryButton>}
      </div>
      {validationHint ? <p className="mt-3 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] px-4 py-3 text-sm text-[color:var(--color-text-muted)]">{validationHint}</p> : null}
    </Page>
  );
}

export function ChatsPage() {
  const user = useAppStore((state) => state.user);
  const chatQuery = useQuery({ queryKey: ['chats', user?.id], enabled: Boolean(user), queryFn: () => api.getChats(user!.id), refetchInterval: 3000 });
  const usersQuery = useQuery({ queryKey: ['current-user'], enabled: Boolean(user), queryFn: () => api.getCurrentUser() });
  const listingsQuery = useQuery({ queryKey: ['search', 'all-chats'], enabled: Boolean(user), queryFn: () => api.searchListings('', defaultSearchFilters, user!.location_lat, user!.location_lng) });

  if (!user) return null;
  const chats = chatQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const currentUser = usersQuery.data;

  return (
    <Page title="Chats" subtitle="Offers, negotiations and meetups in one place">
      {chatQuery.isLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div> : chatQuery.isError ? <EmptyState title="Couldn’t load chats" body="Check your connection and retry your inbox." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => chatQuery.refetch()}>Retry chats</PrimaryButton>} /> : chats.length ? <div className="space-y-3">{chats.map((thread) => {
        const otherId = thread.buyer_id === currentUser?.id ? thread.seller_id : thread.buyer_id;
        const otherUser = (usersQuery.data && otherId === usersQuery.data.id ? usersQuery.data : undefined) || useAppStore.getState().user || null;
        const listing = listings.find((item) => item.id === thread.listing_id) || { title: 'Listing', images: [''] } as Listing;
        return otherUser ? <ChatRow key={thread.id} thread={thread} otherUser={otherUser.id === currentUser?.id ? user : otherUser} listingTitle={listing.title} listingImage={listing.images[0]} unreadCount={thread.buyer_id === currentUser?.id ? thread.buyer_unread : thread.seller_unread} /> : null;
      })}</div> : <EmptyState title="No chats yet" body="Message a seller from any listing to start the conversation." icon={<MessageCircle size={28} />} />}
    </Page>
  );
}

export function ChatDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const [message, setMessage] = useState('');
  const [showOffer, setShowOffer] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chatQuery = useQuery({ queryKey: ['chat', id], enabled: Boolean(id), queryFn: () => api.getChat(id!) , refetchInterval: 2500});
  const messagesQuery = useQuery({ queryKey: ['messages', id], enabled: Boolean(id), queryFn: () => api.getMessages(id!), refetchInterval: 1200 });
  const chat = chatQuery.data;
  const otherUserId = chat && user ? (chat.buyer_id === user.id ? chat.seller_id : chat.buyer_id) : undefined;
  const listingQuery = useQuery({ queryKey: ['listing', chat?.listing_id], enabled: Boolean(chat?.listing_id), queryFn: () => api.getListing(chat!.listing_id) });
  const otherUserQuery = useQuery({ queryKey: ['other-user', otherUserId], enabled: Boolean(otherUserId), queryFn: () => api.getUserById(otherUserId!) });

  useEffect(() => {
    if (id && user) api.markChatRead(id, user.id);
  }, [id, user, messagesQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQuery.data?.length]);

  const sendMessage = useMutation({
    mutationFn: (payload: { content: string; type?: Message['type']; offerAmount?: number }) => {
      if (!chat || !user) throw new Error('Chat is not ready');
      return api.sendMessage(chat.id, user.id, payload.content, payload.type || 'text', payload.offerAmount);
    },
    onSuccess: async (sentMessage) => {
      setMessage('');
      queryClient.setQueryData<Message[]>(['messages', id], (current = []) => (
        current.some((item) => item.id === sentMessage.id) ? current : [...current, sentMessage]
      ));
      await queryClient.invalidateQueries({ queryKey: ['messages', id] });
      if (user) await queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
    },
    onError: (error: Error) => toast.error('Couldn’t send message', { description: error.message || 'Check your connection and try again.' }),
  });

  const updateOffer = useMutation({ mutationFn: ({ messageId, status }: { messageId: string; status: 'accepted' | 'rejected' }) => api.updateOffer(messageId, status), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['messages', id] }); } });

  if (!user) return null;
  if (chatQuery.isLoading) return <Page title="Loading chat"><SkeletonCard /></Page>;
  if (chatQuery.isError) return <Page title="Chat unavailable"><EmptyState title="Couldn’t load chat" body="Check your connection and try again." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => chatQuery.refetch()}>Retry chat</PrimaryButton>} /></Page>;
  if (!chat) return <Page title="Chat unavailable"><EmptyState title="Chat not found" body="This conversation may no longer be available." icon={<SearchX size={28} />} /></Page>;
  const messages = messagesQuery.data ?? [];

  const groupMap = new Map<string, Message[]>();
  messages.forEach((item) => {
    const label = groupDateLabel(item.created_at);
    groupMap.set(label, [...(groupMap.get(label) || []), item]);
  });

  const otherUser = otherUserQuery.data;
  const listing = listingQuery.data;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-20 border-b border-white/8 bg-[color:var(--color-ink)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5"><ArrowLeft size={18} /></button>
          {otherUser ? <Avatar user={otherUser} size={44} /> : null}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{otherUser?.full_name || 'Chat'}</div>
            <div className="text-xs text-[color:var(--color-text-muted)]">{chat.typing_user_id && chat.typing_user_id !== user.id ? 'Typing…' : listing?.title}</div>
          </div>
          {listing?.images?.[0] ? <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-12 w-12 rounded-2xl object-cover" /> : null}
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        {messagesQuery.isError ? <EmptyState title="Couldn’t load messages" body="Check your connection and retry this conversation." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => messagesQuery.refetch()}>Retry messages</PrimaryButton>} /> : null}
        {Array.from(groupMap.entries()).map(([label, grouped]) => (
          <div key={label}>
            <div className="mb-3 text-center text-xs text-[color:var(--color-text-muted)]">{label}</div>
            <div className="space-y-3">
              {grouped.map((item) => {
                const mine = item.sender_id === user.id;
                return (
                  <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-[22px] px-4 py-3 text-sm ${mine ? 'bg-[color:var(--color-primary)] text-[color:var(--color-ink)]' : 'bg-white/7 text-[color:var(--color-text-soft)]'}`}>
                      {item.type === 'offer' ? (
                        <div className="space-y-3">
                          <div className="text-xs uppercase tracking-[0.16em] opacity-70">Offer</div>
                          <div className="text-xl font-bold">{currency(item.offer_amount || 0)}</div>
                          <div className="text-xs opacity-80">Status: {item.offer_status}</div>
                          {!mine && item.offer_status === 'pending' ? <div className="grid grid-cols-2 gap-2"><SecondaryButton onClick={() => updateOffer.mutate({ messageId: item.id, status: 'rejected' })}>Reject</SecondaryButton><PrimaryButton onClick={() => updateOffer.mutate({ messageId: item.id, status: 'accepted' })}>Accept</PrimaryButton></div> : null}
                          {item.offer_status === 'accepted' ? <PrimaryButton className="w-full bg-[color:var(--color-secondary)] shadow-none" onClick={() => listing && api.updateListing(listing.id, { status: 'sold' }).then(() => toast.success(`Marked as sold${otherUser ? ` to ${otherUser.full_name}` : ''}`))}>Mark as Sold {otherUser ? `to ${otherUser.full_name}` : ''}</PrimaryButton> : null}
                        </div>
                      ) : item.type === 'image' ? (
                        <img src={item.content} alt="shared" loading="lazy" className="max-h-64 rounded-2xl object-cover" />
                      ) : (
                        <p>{item.content}</p>
                      )}
                      <div className={`mt-2 text-[11px] ${mine ? 'text-[color:var(--color-ink)] opacity-70' : 'text-[color:var(--color-text-muted)]'}`}>{formatChatTime(item.created_at)} {mine ? (item.is_read ? '✓✓' : '✓') : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {sendMessage.isPending ? (
          <div className="flex justify-end">
            <div className="max-w-[82%] rounded-[22px] bg-[color:var(--color-primary)]/70 px-4 py-3 text-sm text-[color:var(--color-ink)]">
              Sending…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 border-t border-white/8 bg-[color:var(--color-ink)]/95 px-4 py-3 backdrop-blur">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{quickReplies.map((reply) => <Pill key={reply} onClick={() => setMessage(reply.replace('[price]', String(listing?.price || '')))}>{reply.replace('[price]', String(listing?.price || ''))}</Pill>)}</div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <SecondaryButton onClick={() => setShowOffer(true)}>Make an Offer</SecondaryButton>
          <ImagePicker
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] px-4 text-sm font-semibold text-[color:var(--color-text-primary)] shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[color:var(--color-field-strong)] disabled:cursor-not-allowed disabled:opacity-45"
            onFiles={async ([file]) => {
              setImageUploading(true);
              try {
                const imageUrl = await api.uploadImage(await compressImage(file), 'chat-images');
                sendMessage.mutate({ content: imageUrl, type: 'image' });
              } catch (error) {
                toast.error('Couldn’t share image', { description: error instanceof Error ? error.message : 'Try a JPG or PNG image.' });
              } finally {
                setImageUploading(false);
              }
            }}
            onDenied={(source) => toast.error(source === 'camera' ? 'Camera access denied' : 'Photo library access denied', { description: 'Allow access in Settings, or try the other option.' })}
            onError={(message) => toast.error('Couldn’t use that photo', { description: message })}
          >
            {imageUploading ? 'Uploading...' : 'Share image'}
          </ImagePicker>
        </div>
        <div className="flex items-end gap-3">
          <textarea value={message} onChange={(event) => { setMessage(event.target.value); api.setTyping(chat.id, user.id); }} placeholder="Type a message" className="min-h-[48px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3" />
          <button onClick={() => sendMessage.mutate({ content: message })} aria-label="Send message" disabled={!message.trim() || sendMessage.isPending} className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--color-primary)] text-[color:var(--color-ink)] shadow-[var(--shadow-accent)] disabled:opacity-40"><Send size={18} /></button>
        </div>
        <div className="mt-2 text-right"><button onClick={() => { if (otherUser) api.blockUser(user.id, otherUser.id).then(() => toast.success('User blocked')); }} className="text-xs text-[color:var(--color-danger)]">Block user</button></div>
      </div>
      {showOffer ? <OfferSheet onCancel={() => setShowOffer(false)} onSubmit={(amount) => { setShowOffer(false); sendMessage.mutate({ content: 'Offer', type: 'offer', offerAmount: amount }); }} /> : null}
    </div>
  );
}

export function NotificationsPage() {
  const user = useAppStore((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({ queryKey: ['notifications', user?.id], enabled: Boolean(user?.id), queryFn: () => api.getNotifications(user!.id) });
  const markAll = useMutation({ mutationFn: () => api.markAllNotificationsRead(user!.id), onSuccess: async () => { toast.success('All notifications marked as read'); await queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] }); } });

  if (!user) return null;
  const notifications = notificationsQuery.data ?? [];

  return (
    <Page title="Notifications" subtitle="Offers, chats, price drops and trust signals" right={<button onClick={() => markAll.mutate()} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm">Mark all read</button>}>
      {notificationsQuery.isLoading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}</div> : notificationsQuery.isError ? <EmptyState title="Couldn’t load notifications" body="Check your connection and retry activity updates." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => notificationsQuery.refetch()}>Retry notifications</PrimaryButton>} /> : notifications.length ? <div className="space-y-3">{notifications.map((item) => <button key={item.id} onClick={() => { if (item.data.chatId) navigate(`/chats/${String(item.data.chatId)}`); else if (item.data.listingId) navigate(`/listing/${String(item.data.listingId)}`); }} className={`w-full rounded-2xl border p-4 text-left ${item.is_read ? 'border-white/8 bg-white/5' : 'border-[color:var(--color-primary)]/40 bg-[color:var(--color-primary)]/10'}`}><div className="flex items-center justify-between gap-3"><div className="font-semibold">{item.title}</div><div className="text-xs text-[color:var(--color-text-muted)]">{timeAgo(item.created_at)}</div></div><div className="mt-2 text-sm text-[color:var(--color-text-soft)]">{item.body}</div></button>)}</div> : <EmptyState title="All clear" body="Your neighbourhood activity will show up here after saves, offers, and chats." icon={<BellOff size={28} />} />}
    </Page>
  );
}
