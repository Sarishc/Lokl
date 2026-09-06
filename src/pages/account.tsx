import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, FileText, Heart, ListPlus, LogOut, MessageSquareText, ShieldAlert, ShieldCheck, Star, Trash2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, EmptyState, GlassCard, ListingCard, Page, Pill, PrimaryButton, SecondaryButton, SkeletonCard } from '../components/common';
import { ImagePicker } from '../lib/device';
import { timeAgo } from '../lib/utils';
import { api } from '../services/api';
import { useAppStore } from '../store/app-store';

const MOCK_ADMIN_PASSWORD = '123456';

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

export function SavedPage() {
  const user = useAppStore((state) => state.user);
  const queryClient = useQueryClient();
  const savedQuery = useQuery({ queryKey: ['saved-listings', user?.id], enabled: Boolean(user?.id), queryFn: () => api.getSavedListings(user!.id) });
  const toggleSave = useMutation({ mutationFn: (listingId: string) => api.toggleSave(user!.id, listingId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['saved-listings', user?.id] }); await queryClient.invalidateQueries({ queryKey: ['saved-ids', user?.id] }); toast.success('Saved list updated'); } });

  if (!user) return null;

  return (
    <Page title="Wishlist" subtitle="Track favourites and watch price changes">
      {savedQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div>
      ) : savedQuery.isError ? (
        <EmptyState title="Couldn’t load wishlist" body="Check your connection and retry your saved listings." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => savedQuery.refetch()}>Retry wishlist</PrimaryButton>} />
      ) : savedQuery.data?.length ? (
        <div className="grid grid-cols-2 gap-3">{savedQuery.data.map((listing) => <ListingCard key={listing.id} listing={listing} currentUser={user} saved onSave={(id) => toggleSave.mutate(id)} />)}</div>
      ) : (
        <EmptyState title="No saved listings yet" body="Tap the heart on any listing to keep price drops and favourites here." icon={<Heart size={28} />} />
      )}
    </Page>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const [tab, setTab] = useState<'active' | 'sold' | 'reviews'>('active');
  const [editing, setEditing] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', bio: user?.bio || '', locality: user?.locality || '', avatar_url: user?.avatar_url || '' });

  const activeQuery = useQuery({ queryKey: ['my-listings', user?.id, 'active'], enabled: Boolean(user?.id), queryFn: () => api.getMyListings(user!.id, 'active') });
  const soldQuery = useQuery({ queryKey: ['my-listings', user?.id, 'sold'], enabled: Boolean(user?.id), queryFn: () => api.getMyListings(user!.id, 'sold') });
  const reviewsQuery = useQuery({ queryKey: ['reviews', user?.id], enabled: Boolean(user?.id), queryFn: () => api.getReviewsForUser(user!.id) });

  const saveProfile = useMutation({ mutationFn: () => api.upsertProfile({ id: user!.id, ...form, phone: form.phone.trim() || null }), onSuccess: async (profile) => { setUser(profile); setEditing(false); toast.success('Profile updated'); await queryClient.invalidateQueries(); } });
  const logoutMutation = useMutation({ mutationFn: () => api.logout(), onSuccess: () => { setUser(null); queryClient.clear(); navigate('/auth'); } });
  const deleteAccountMutation = useMutation({
    mutationFn: () => api.deleteAccount(user!.id),
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
      toast.success('Account deleted');
      navigate('/auth');
    },
    onError: (error: Error) => toast.error('Couldn’t delete account', { description: error.message || 'Try again or contact support.' }),
  });

  const activeListings = activeQuery.data ?? [];
  const soldListings = soldQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const list = tab === 'active' ? activeListings : tab === 'sold' ? soldListings : [];
  const currentListQuery = tab === 'active' ? activeQuery : soldQuery;

  if (!user) return null;

  return (
    <Page title="Profile" subtitle="Your trusted neighbourhood identity">
      <GlassCard className="space-y-4 p-4">
        <div className="flex items-start gap-4">
          {editing ? (
            <ImagePicker
              className="relative"
              inputClassName="absolute inset-0 opacity-0"
              onFiles={async ([file]) => { const uploaded = await api.uploadImage(file, 'avatars'); setForm((value) => ({ ...value, avatar_url: uploaded })); }}
              onDenied={(source) => toast.error(source === 'camera' ? 'Camera access denied' : 'Photo library access denied', { description: 'Allow access in Settings, or try the other option.' })}
              onError={(message) => toast.error('Couldn’t use that photo', { description: message })}
            >
              <Avatar user={{ ...user, avatar_url: form.avatar_url }} size={72} />
              <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[color:var(--color-primary)] text-white"><Camera size={14} /></span>
            </ImagePicker>
          ) : (
            <span className="relative">
              <Avatar user={user} size={72} />
              <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[color:var(--color-primary)] text-white"><Camera size={14} /></span>
            </span>
          )}
          <div className="min-w-0 flex-1">
            {editing ? <input value={form.full_name} onChange={(event) => setForm((value) => ({ ...value, full_name: event.target.value }))} className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4" /> : <div className="flex items-center gap-2 text-xl font-bold">{user.full_name}{user.is_verified ? <span className="rounded-full bg-[color:var(--color-secondary)]/15 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-secondary)]">Verified</span> : null}</div>}
            {editing ? <input value={form.locality} onChange={(event) => setForm((value) => ({ ...value, locality: event.target.value }))} className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4" /> : <div className="mt-1 text-sm text-[color:var(--color-text-muted)]">{user.locality}, {user.city}</div>}
            {editing ? <input value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4" placeholder="Phone number (optional)" /> : <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{user.phone || 'Phone not added yet'}</div>}
            <div className="mt-3 flex items-center gap-2 text-sm text-[color:var(--color-text-soft)]"><Star size={16} className="fill-[color:var(--color-warning)] text-[color:var(--color-warning)]" /> {user.rating.toFixed(1)} rating · {user.listings_sold} listings sold · Joined {new Date(user.joined_at).getFullYear()}</div>
          </div>
        </div>
        {editing ? <textarea value={form.bio} onChange={(event) => setForm((value) => ({ ...value, bio: event.target.value }))} className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3" /> : <p className="text-sm leading-6 text-[color:var(--color-text-soft)]">{user.bio || 'Add a short bio to make your profile feel more trustworthy.'}</p>}
        <div className="grid grid-cols-2 gap-3">{editing ? <><SecondaryButton onClick={() => { setEditing(false); setForm({ full_name: user.full_name, phone: user.phone || '', bio: user.bio, locality: user.locality, avatar_url: user.avatar_url }); }}>Cancel</SecondaryButton><PrimaryButton onClick={() => saveProfile.mutate()}>{saveProfile.isPending ? 'Saving...' : 'Save profile'}</PrimaryButton></> : <><SecondaryButton onClick={() => setEditing(true)}>Edit profile</SecondaryButton><PrimaryButton onClick={() => navigate('/saved')}>Open wishlist</PrimaryButton></>}</div>
      </GlassCard>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        <Pill active={tab === 'active'} onClick={() => setTab('active')}>Active Listings</Pill>
        <Pill active={tab === 'sold'} onClick={() => setTab('sold')}>Sold</Pill>
        <Pill active={tab === 'reviews'} onClick={() => setTab('reviews')}>Reviews</Pill>
      </div>

      <div className="mt-4 space-y-3">
        {tab === 'reviews' ? (
          reviewsQuery.isLoading ? <GlassCard className="skeleton-shimmer h-28" /> :
          reviewsQuery.isError ? <EmptyState title="Couldn’t load reviews" body="Check your connection and retry your trust profile." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => reviewsQuery.refetch()}>Retry reviews</PrimaryButton>} /> :
          reviews.length ? reviews.map((review) => <GlassCard key={review.id} className="p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold"><Star size={16} className="fill-[color:var(--color-warning)] text-[color:var(--color-warning)]" /> {review.rating}/5</div><div className="text-xs text-[color:var(--color-text-muted)]">{timeAgo(review.created_at)}</div></div><div className="mt-2 text-sm text-[color:var(--color-text-soft)]">{review.comment}</div></GlassCard>) : <EmptyState title="No reviews yet" body="Your reviews will appear after successful neighbourhood deals." icon={<MessageSquareText size={28} />} />
        ) : currentListQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}</div>
        ) : currentListQuery.isError ? (
          <EmptyState title="Couldn’t load listings" body="Check your connection and retry your profile listings." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => currentListQuery.refetch()}>Retry listings</PrimaryButton>} />
        ) : list.length ? (
          <div className="grid grid-cols-2 gap-3">{list.map((listing) => <ListingCard key={listing.id} listing={listing} currentUser={user} />)}</div>
        ) : (
          <EmptyState title={tab === 'active' ? 'No active listings' : 'Nothing sold yet'} body={tab === 'active' ? 'Tap Sell to post your first item.' : 'Mark sold items to build your trust profile.'} icon={tab === 'active' ? <ListPlus size={28} /> : <ShieldCheck size={28} />} action={tab === 'active' ? <PrimaryButton onClick={() => navigate('/sell')}>Post a listing</PrimaryButton> : undefined} />
        )}
      </div>

      <GlassCard className="mt-6 p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Link to="/terms" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-semibold"><FileText size={16} /> Terms</Link>
          <Link to="/privacy" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-semibold"><ShieldCheck size={16} /> Privacy</Link>
        </div>
        <button onClick={() => setConfirmLogout(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-danger)]"><LogOut size={16} /> Logout</button>
        <button onClick={() => setConfirmDelete(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-danger)]/40 bg-transparent px-4 py-3 text-sm font-semibold text-[color:var(--color-danger)]"><Trash2 size={16} /> Delete my account and data</button>
      </GlassCard>
      {confirmLogout ? <ConfirmSheet title="Log out?" body="You can sign back in any time with Google or phone OTP." confirmLabel="Log out" danger onCancel={() => setConfirmLogout(false)} onConfirm={() => { setConfirmLogout(false); logoutMutation.mutate(); }} /> : null}
      {confirmDelete ? <ConfirmSheet title="Delete account and data?" body="This removes your profile, listings, chats, saves, notifications and linked account data. This cannot be undone." confirmLabel={deleteAccountMutation.isPending ? 'Deleting...' : 'Delete'} danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); deleteAccountMutation.mutate(); }} /> : null}
    </Page>
  );
}

export function AdminPage() {
  const user = useAppStore((state) => state.user);
  const [authenticated, setAuthenticated] = useState(!__IS_MOCK_MODE__);
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<{ title: string; body: string; label: string; action: () => Promise<void> } | null>(null);
  const reportsQuery = useQuery({ queryKey: ['admin-reports'], enabled: authenticated, queryFn: () => api.getReports() });

  if (!__IS_MOCK_MODE__ && !user?.is_admin) {
    return (
      <Page title="Admin access" subtitle="Moderation is protected server-side">
        <GlassCard className="space-y-4 p-5">
          <div className="inline-flex rounded-2xl bg-[color:var(--color-danger)]/15 p-3 text-[color:var(--color-danger)]"><ShieldAlert /></div>
          <p className="text-sm leading-6 text-[color:var(--color-text-muted)]">Your profile is not marked as an admin. In production, this is enforced by Supabase RLS and cannot be unlocked from the browser bundle.</p>
        </GlassCard>
      </Page>
    );
  }

  if (__IS_MOCK_MODE__ && !authenticated) {
    return (
      <Page title="Admin access" subtitle="Basic moderation console">
        <GlassCard className="space-y-4 p-5">
          <div className="inline-flex rounded-2xl bg-[color:var(--color-danger)]/15 p-3 text-[color:var(--color-danger)]"><ShieldAlert /></div>
          <p className="text-sm leading-6 text-[color:var(--color-text-muted)]">Mock mode uses a local-only demo unlock. Supabase mode is gated by the user&apos;s RLS-protected admin role.</p>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4" placeholder="Admin password" />
          <PrimaryButton className="w-full" onClick={() => { if (password === MOCK_ADMIN_PASSWORD) setAuthenticated(true); else toast.error('Use 123456 in mock mode'); }}>Unlock admin</PrimaryButton>
        </GlassCard>
      </Page>
    );
  }

  const reports = reportsQuery.data ?? [];
  const sourceLabel = (source?: string) => source === 'auto_spam' ? 'Auto spam' : source === 'auto_image' ? 'Auto image' : 'User report';

  return (
    <Page title="Moderation queue" subtitle="Reports, bans and listing clean-up">
      {reportsQuery.isLoading ? <GlassCard className="skeleton-shimmer h-36" /> : reportsQuery.isError ? <EmptyState title="Couldn’t load reports" body="Check your connection and retry the moderation queue." icon={<WifiOff size={28} />} action={<PrimaryButton onClick={() => reportsQuery.refetch()}>Retry reports</PrimaryButton>} /> : reports.length ? <div className="space-y-3">{reports.map((report) => <GlassCard key={report.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{report.reason}</div><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-[color:var(--color-primary)]/15 px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--color-primary)]">{sourceLabel(report.source)}</span><span className="rounded-full bg-[color:var(--color-warning)]/15 px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--color-warning)]">Severity {report.severity ?? 2}</span></div></div><div className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--color-text-muted)]">{report.status}</div></div><div className="text-sm text-[color:var(--color-text-soft)]">{report.description || 'No extra description provided.'}</div><div className="grid grid-cols-2 gap-3"><SecondaryButton onClick={() => report.listing_id && setPendingAction({ title: 'Delete listing?', body: 'This hides the reported listing from the marketplace.', label: 'Delete', action: async () => { await api.deleteListing(report.listing_id!); toast.success('Listing deleted'); } })}>Delete listing</SecondaryButton><PrimaryButton className="bg-[color:var(--color-danger)] shadow-none" onClick={() => report.reported_user_id && setPendingAction({ title: 'Ban user?', body: 'The user will be restricted from posting listings or sending messages.', label: 'Ban user', action: async () => { await api.banUser(report.reported_user_id!); toast.success('User banned'); } })}>Ban user</PrimaryButton></div></GlassCard>)}</div> : <EmptyState title="Queue is empty" body="All reports and automated flags have been handled. New issues will land here by severity." icon={<ShieldCheck size={28} />} />}
      {pendingAction ? <ConfirmSheet title={pendingAction.title} body={pendingAction.body} confirmLabel={pendingAction.label} danger onCancel={() => setPendingAction(null)} onConfirm={() => { const action = pendingAction.action; setPendingAction(null); void action(); }} /> : null}
    </Page>
  );
}
