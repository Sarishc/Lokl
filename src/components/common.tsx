import { useEffect, useState } from 'react';
import { Bell, Flame, Heart, Home as HomeIcon, LoaderCircle, MessageCircleMore, PackageOpen, Plus, Search, User } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import useEmblaCarousel from 'embla-carousel-react';
import { currency, distanceKm, formatChatTime, getInitials, hoursSince, timeAgo } from '../lib/utils';
import { cn } from '../lib/utils';
import { categoryIconFor, chipIconForLabel, type ChipIcon } from '../lib/chip-icons';
import type { Listing, UserProfile } from '../types';

type ActionButtonProps = HTMLMotionProps<'button'> & { isLoading?: boolean };

export function FallbackImage({ src, alt, className, label }: { src?: string; alt: string; className?: string; label?: string }) {
  const [failed, setFailed] = useState(!src);
  const Icon = label ? categoryIconFor(label) : PackageOpen;
  if (failed) {
    return (
      <div className={cn('grid place-items-center bg-[color:var(--color-surface-strong)] text-center text-[color:var(--color-text-muted)]', className)}>
        <div className="space-y-2 px-3">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--color-line-strong)] bg-[color:var(--color-primary)]/16 text-[color:var(--color-primary)] shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
            <Icon size={25} />
          </div>
          <div className="line-clamp-2 text-xs font-semibold">{label || alt}</div>
        </div>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const hideNav =
    ['/auth', '/onboarding', '/sell', '/account-restricted'].some((path) => location.pathname.startsWith(path)) ||
    location.pathname.startsWith('/listing/') ||
    /^\/chats\/[^/]+/.test(location.pathname);
  return (
    <div className="app-frame mx-auto min-h-screen w-full max-w-md text-[color:var(--color-text-primary)]">
      <main className={cn('pb-24', hideNav && 'pb-6')}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export function Page({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
      className="px-4 pt-4"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.8rem] font-bold leading-tight text-[color:var(--color-text-primary)]">{title}</h1>
          {subtitle ? <p className="text-muted mt-1 text-sm leading-5">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children as React.ReactNode}
    </motion.div>
  );
}

export function GlassCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn('surface-card rounded-2xl', className)}>{children}</div>;
}

export function PrimaryButton({ className, children, isLoading, ...props }: ActionButtonProps) {
  const reduceMotion = useReducedMotion();
  const { disabled, ...buttonProps } = props;
  return (
    <motion.button
      whileTap={reduceMotion || disabled || isLoading ? undefined : { scale: 0.97, y: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
      className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-primary)] px-4 text-sm font-bold text-[color:var(--color-ink)] shadow-[var(--shadow-accent)] transition hover:-translate-y-0.5 hover:brightness-105 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0', className)}
      disabled={disabled || isLoading}
      {...buttonProps}
    >
      {isLoading ? <LoaderCircle size={17} className="animate-spin" /> : null}
      {children as React.ReactNode}
    </motion.button>
  );
}

export function SecondaryButton({ className, children, ...props }: HTMLMotionProps<'button'>) {
  const reduceMotion = useReducedMotion();
  const { disabled, ...buttonProps } = props;
  return (
    <motion.button
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97, y: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
      className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] px-4 text-sm font-semibold text-[color:var(--color-text-primary)] shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[color:var(--color-field-strong)] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0', className)}
      disabled={disabled}
      {...buttonProps}
    >
      {children}
    </motion.button>
  );
}

export function Pill({ active, onClick, children, icon, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; icon?: ChipIcon; className?: string }) {
  const reduceMotion = useReducedMotion();
  const Icon = icon ?? chipIconForLabel(children);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      animate={reduceMotion ? undefined : { scale: active ? 1.03 : 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={cn('inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-200', active ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-ink)] shadow-[0_12px_24px_rgba(244,182,63,0.24)]' : 'border-[color:var(--color-line)] bg-[color:var(--color-field)] text-[color:var(--color-text-muted)] shadow-[0_8px_18px_rgba(0,0,0,0.18)] hover:border-[color:var(--color-line-strong)] hover:bg-[color:var(--color-field-strong)]', className)}
    >
      {Icon ? <Icon size={16} strokeWidth={active ? 2.6 : 2.1} className={cn('shrink-0 transition-colors duration-200', active ? 'text-[color:var(--color-ink)]' : 'text-[color:var(--color-primary)]')} /> : null}
      {children}
    </motion.button>
  );
}

export function StatChip({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] px-3 py-2 text-center"><div className="font-display text-base font-semibold">{value}</div><div className="text-muted text-xs">{label}</div></div>;
}

export function Avatar({ user, size = 44 }: { user: UserProfile; size?: number }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.full_name} className="rounded-2xl object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="grid place-items-center rounded-2xl bg-[color:var(--color-primary)] font-bold text-[color:var(--color-ink)]" style={{ width: size, height: size }}>
      {getInitials(user.full_name || 'L')}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <GlassCard className="mt-6 px-5 py-8 text-center">
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -5, 0], boxShadow: ['0 0 0 rgba(244,182,63,0)', '0 16px 32px rgba(244,182,63,0.12)', '0 0 0 rgba(244,182,63,0)'] }}
        transition={reduceMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-[color:var(--color-line-strong)] bg-[color:var(--color-field)] text-[color:var(--color-primary)]"
      >
        {icon || <PackageOpen size={28} />}
      </motion.div>
      <h3 className="font-display text-xl font-semibold text-[color:var(--color-text-primary)]">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-6">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </GlassCard>
  );
}

export function SkeletonCard() {
  return (
    <div className="surface-card overflow-hidden rounded-2xl p-0">
      <div className="skeleton-shimmer aspect-square" />
      <div className="space-y-3 p-3">
        <div className="skeleton-shimmer h-5 w-3/4 rounded-full" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded-full" />
        <div className="skeleton-shimmer h-3 w-full rounded-full" />
      </div>
    </div>
  );
}

export function ListingCard({ listing, saved, currentUser, onSave }: { listing: Listing; saved?: boolean; currentUser?: UserProfile | null; onSave?: (listingId: string) => void }) {
  const reduceMotion = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
  const [selectedImage, setSelectedImage] = useState(0);
  const distance = currentUser ? distanceKm(currentUser.location_lat, currentUser.location_lng, listing.location_lat, listing.location_lng) : null;
  const imageCount = listing.images.length;
  const isNew = hoursSince(listing.created_at) < 2;
  const isHot = listing.views >= 100;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedImage(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      <GlassCard className="overflow-hidden p-0">
        <div className="relative aspect-square overflow-hidden bg-[color:var(--color-field)]">
          <div className="h-full overflow-hidden" ref={emblaRef}>
            <div className="flex h-full">
              {(imageCount ? listing.images : ['']).map((src, index) => (
                <div key={`${listing.id}-${src || index}`} className="min-w-0 flex-[0_0_100%]">
                  <FallbackImage src={src} alt={listing.title} label={listing.category} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                </div>
              ))}
            </div>
          </div>
          <motion.button
            type="button"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSave?.(listing.id); }}
            whileTap={reduceMotion ? undefined : { scale: 0.82 }}
            animate={reduceMotion ? undefined : { scale: saved ? [1, 1.18, 1] : 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
            aria-label={saved ? 'Remove from wishlist' : 'Save listing'}
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur"
          >
            <Heart size={18} className={cn(saved && 'fill-[color:var(--color-danger)] text-[color:var(--color-danger)]')} />
          </motion.button>
          {(isNew || isHot) ? (
            <div className={cn('absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur', isNew ? 'border-[color:var(--color-secondary)]/20 bg-[color:var(--color-secondary)]/85 text-[color:var(--color-ink)]' : 'border-[color:var(--color-primary)]/30 bg-black/62 text-[color:var(--color-primary)]')}>
              {isHot ? <Flame size={12} /> : null}
              {isNew ? 'New' : 'Hot'}
            </div>
          ) : null}
          {imageCount > 1 ? (
            <div className="absolute bottom-[3.85rem] left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
              {listing.images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); emblaApi?.scrollTo(index); }}
                  aria-label={`Show image ${index + 1}`}
                  className={cn('h-1.5 rounded-full transition-all', selectedImage === index ? 'w-4 bg-white' : 'w-1.5 bg-white/45')}
                />
              ))}
            </div>
          ) : null}
          <div className="accent-ticket font-display absolute bottom-3 left-0 px-4 py-1.5 text-base font-bold">{currency(listing.price, listing.is_free)}</div>
          <div className="absolute bottom-3 right-3 rounded-full border border-[color:var(--color-line)] bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">{listing.condition}</div>
        </div>
        <div className="space-y-2 p-3">
          <div className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[color:var(--color-text-primary)]">{listing.title}</div>
          <div className="flex min-h-5 items-center gap-2">{listing.is_negotiable ? <span className="rounded-full bg-[color:var(--color-secondary)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--color-secondary)]">Negotiable</span> : <span className="text-muted text-[10px] font-medium">Firm price</span>}</div>
          <div className="text-muted space-y-1 text-xs">
            <div>{distance ? `${distance} km away` : listing.locality}</div>
            <div className="flex items-center justify-between gap-2"><span>{listing.locality}</span><span>{timeAgo(listing.created_at)}</span></div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

export function BottomNav() {
  const reduceMotion = useReducedMotion();
  const items = [
    { to: '/', icon: HomeIcon, label: 'Home' },
    { to: '/explore', icon: Search, label: 'Explore' },
    { to: '/sell', icon: Plus, label: 'Sell', highlight: true },
    { to: '/chats', icon: MessageCircleMore, label: 'Chats' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];
  return (
    <div className="surface-sheet fixed bottom-0 left-0 right-0 z-40 mx-auto flex w-full max-w-md items-center justify-around rounded-t-[28px] border px-3 py-3 backdrop-blur-xl">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('flex min-w-[56px] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition', item.highlight ? 'relative bg-[color:var(--color-primary)] text-[color:var(--color-ink)] shadow-[var(--shadow-accent)]' : isActive ? 'text-[color:var(--color-text-primary)]' : 'text-[color:var(--color-text-muted)]')}>
          {item.highlight && !reduceMotion ? <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-[color:var(--color-primary)]" animate={{ opacity: [0.25, 0, 0.25], scale: [1, 1.16, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} /> : null}
          <item.icon size={18} className="relative" />
          <span className="relative">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <Link to="/notifications" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-field)] text-[color:var(--color-text-primary)]">
      <Bell size={18} />
      {count > 0 ? <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--color-danger)] px-1 text-[10px] font-bold text-white">{count}</span> : null}
    </Link>
  );
}

export function ChatRow({ thread, otherUser, listingTitle, listingImage, unreadCount }: { thread: { id: string; last_message: string; last_message_at: string }; otherUser: UserProfile; listingTitle: string; listingImage: string; unreadCount: number }) {
  return (
    <Link to={`/chats/${thread.id}`} className="block">
      <GlassCard className="flex items-center gap-3 p-3">
        <FallbackImage src={listingImage} alt={listingTitle} label={listingTitle} className="h-14 w-14 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-semibold text-white">{otherUser.full_name}</div>
            <div className="text-muted font-utility text-[11px]">{formatChatTime(thread.last_message_at)}</div>
          </div>
          <div className="text-muted truncate text-xs">{listingTitle}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-soft truncate text-sm">{thread.last_message}</p>
            {unreadCount > 0 ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[color:var(--color-primary)] px-2 text-[11px] font-bold text-[color:var(--color-ink)]">{unreadCount}</span> : null}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
