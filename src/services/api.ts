import { defaultSearchFilters, PAGE_SIZE } from '../lib/constants';
import { getLegalConsent, LEGAL_CONSENT_VERSION } from '../lib/legal';
import '../lib/app-mode'; // runtime fail-fast guard — see src/lib/app-mode.ts
import { supabase } from '../lib/supabase';
import { uid, fileToDataUrl } from '../lib/utils';
import { localDb } from './local-db';
import type {
  ChatThread,
  FeedFilters,
  FeedPage,
  Listing,
  ListingDraft,
  Message,
  NotificationItem,
  ReportItem,
  SearchFilters,
  SessionUser,
  UserProfile,
} from '../types';

const useMock = __IS_MOCK_MODE__;
const SUPABASE_SEARCH_LIMIT = 80;
const OTP_DEVICE_KEY = 'lokl-otp-device-id';
const OTP_ATTEMPTS_KEY = 'lokl-otp-attempts-v1';
const OTP_GUARD_REQUIRED = import.meta.env.VITE_REQUIRE_OTP_GUARD === 'true';
const IMAGE_MODERATION_REQUIRED = import.meta.env.VITE_IMAGE_MODERATION_REQUIRED === 'true';

export type DbChangeEvent = {
  table?: string;
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

async function getSupabaseSession(): Promise<SessionUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone ?? null,
    email: user.email ?? null,
    provider: user.app_metadata?.provider ? String(user.app_metadata.provider) : null,
  };
}

async function upsertUserProfileFromAuth() {
  if (!supabase) return null;
  const session = await getSupabaseSession();
  if (!session) return null;
  const { data: existing } = await supabase.from('users').select('*').eq('id', session.id).maybeSingle();
  if (existing) return existing as UserProfile;
  const { data: authData } = await supabase.auth.getUser();
  const metadata = authData.user?.user_metadata ?? {};
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : typeof metadata.picture === 'string' ? metadata.picture : '';
  const consent = getLegalConsent();
  const fallback: UserProfile = {
    id: session.id,
    phone: session.phone,
    full_name: '',
    avatar_url: avatarUrl,
    bio: '',
    location_lat: 12.9352,
    location_lng: 77.6245,
    locality: 'Koramangala',
    city: 'Bengaluru',
    is_verified: true,
    is_dealer: false,
    is_admin: false,
    is_banned: false,
    rating: 5,
    total_reviews: 0,
    listings_sold: 0,
    joined_at: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    blocked_user_ids: [],
    legal_consent_version: consent?.version ?? null,
    terms_accepted_at: consent?.acceptedAt ?? null,
    privacy_accepted_at: consent?.acceptedAt ?? null,
  };
  await supabase.from('users').upsert(fallback);
  return fallback;
}

function getOtpDeviceId() {
  let deviceId = localStorage.getItem(OTP_DEVICE_KEY);
  if (!deviceId) {
    deviceId = uid('device');
    localStorage.setItem(OTP_DEVICE_KEY, deviceId);
  }
  return deviceId;
}

async function hashPhone(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '');
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function enforceClientOtpThrottle(phone: string) {
  const now = Date.now();
  const phoneKey = phone.replace(/[^\d+]/g, '');
  const raw = localStorage.getItem(OTP_ATTEMPTS_KEY);
  const attempts = raw ? (JSON.parse(raw) as { phone: string; at: number }[]) : [];
  const recent = attempts.filter((attempt) => now - attempt.at < 60 * 60 * 1000);
  const samePhone = recent.filter((attempt) => attempt.phone === phoneKey);
  const last = samePhone.at(-1);
  if (last && now - last.at < 60 * 1000) throw new Error('Please wait a minute before requesting another OTP.');
  if (samePhone.length >= 5) throw new Error('Too many OTP requests for this phone. Try again later.');
  if (recent.length >= 12) throw new Error('Too many OTP requests from this device. Try again later.');
  localStorage.setItem(OTP_ATTEMPTS_KEY, JSON.stringify([...recent, { phone: phoneKey, at: now }]));
}

async function runOtpGuard(phone: string) {
  if (useMock || !supabase) return;
  const phoneHash = await hashPhone(phone);
  const deviceId = getOtpDeviceId();
  const { error } = await supabase.functions.invoke('otp-request-guard', {
    body: { phoneHash, deviceId },
  });
  if (error && OTP_GUARD_REQUIRED) throw error;
}

async function moderateImage(file: File, folder: string) {
  if (useMock || !supabase) return;
  const imageDataUrl = await fileToDataUrl(file);
  const { data, error } = await supabase.functions.invoke('moderate-image', {
    body: { imageDataUrl, folder, fileName: file.name, mimeType: file.type },
  });
  if (error) {
    if (IMAGE_MODERATION_REQUIRED) throw error;
    return;
  }
  const result = data as { decision?: 'allow' | 'flag' | 'block'; reason?: string } | null;
  if (result?.decision === 'block') throw new Error(result.reason || 'This image cannot be uploaded.');
}

function normalizeAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === 'phone_provider_disabled' || /unsupported phone provider/i.test(message)) {
    return new Error('Phone sign-in is not configured on Supabase yet. Enable Auth > Providers > Phone and connect an SMS provider before live OTP can work.');
  }
  if (code === 'sms_send_failed' || /twilio|sms.*failed|invalid from number|unverified/i.test(message)) {
    return new Error(`SMS delivery failed: ${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}

export const api = {
  mode: useMock ? 'mock' : 'supabase',

  async uploadImage(file: File, folder = 'listings') {
    if (useMock) return fileToDataUrl(file);
    await moderateImage(file, folder);
    const session = await getSupabaseSession();
    const ownerPath = session?.id ? `${session.id}/` : '';
    const filePath = `${folder}/${ownerPath}${uid('img')}-${file.name.replace(/\s+/g, '-')}`;
    const { error } = await supabase!.storage.from('lokl-media').upload(filePath, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase!.storage.from('lokl-media').getPublicUrl(filePath);
    return data.publicUrl;
  },

  subscribe(listener: (event?: DbChangeEvent) => void) {
    if (useMock) return localDb.subscribe(listener);
    const channel = supabase!
      .channel('lokl-db-events')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => listener({
        table: payload.table,
        eventType: payload.eventType,
        new: payload.new,
        old: payload.old,
      }))
      .subscribe();
    return () => void supabase?.removeChannel(channel);
  },

  async sendOtp(phone: string, captchaToken?: string) {
    if (useMock) return localDb.sendOtp(phone);
    enforceClientOtpThrottle(phone);
    await runOtpGuard(phone);
    const { error } = await supabase!.auth.signInWithOtp({ phone, options: captchaToken ? { captchaToken } : undefined });
    if (error) throw normalizeAuthError(error);
    return { success: true };
  },

  async verifyOtp(phone: string, otp: string) {
    if (useMock) return localDb.verifyOtp(phone, otp);
    const { error } = await supabase!.auth.verifyOtp({ phone, token: otp, type: 'sms' });
    if (error) throw normalizeAuthError(error);
    return upsertUserProfileFromAuth();
  },

  async signInWithGoogle() {
    if (useMock) return localDb.signInWithGoogle();
    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return null;
  },

  async logout() {
    if (useMock) return localDb.logout();
    const { error } = await supabase!.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    if (useMock) return localDb.getSession();
    return getSupabaseSession();
  },

  async getCurrentUser() {
    if (useMock) return localDb.getCurrentUser();
    const session = await getSupabaseSession();
    if (!session) return null;
    const { data } = await supabase!.from('users').select('*').eq('id', session.id).maybeSingle();
    return (data as UserProfile | null) ?? upsertUserProfileFromAuth();
  },

  async getUserById(id: string) {
    if (useMock) return localDb.getUserById(id);
    const { data } = await supabase!.from('users').select('*').eq('id', id).maybeSingle();
    return (data as UserProfile | null) ?? null;
  },

  async upsertProfile(input: Partial<UserProfile> & { id: string }) {
    if (useMock) return localDb.upsertProfile(input);
    const session = await getSupabaseSession();
    if (!session || session.id !== input.id) throw new Error('No active session found');
    const phone = input.phone === undefined ? session.phone : input.phone;
    const consent = getLegalConsent();
    const payload = {
      ...input,
      phone,
      legal_consent_version: input.legal_consent_version ?? consent?.version ?? LEGAL_CONSENT_VERSION,
      terms_accepted_at: input.terms_accepted_at ?? consent?.acceptedAt,
      privacy_accepted_at: input.privacy_accepted_at ?? consent?.acceptedAt,
      last_seen: new Date().toISOString(),
    };
    const { data, error } = await supabase!.from('users').upsert(payload).select('*').single();
    if (error) throw error;
    return data as UserProfile;
  },

  async getFeed(userLat: number, userLng: number, filters: FeedFilters, cursor = 0): Promise<FeedPage> {
    if (useMock) return localDb.getListingsFeed(userLat, userLng, filters, cursor);
    const { data, error } = await supabase!.rpc('search_listings_nearby', {
      user_lat: userLat,
      user_lng: userLng,
      radius_km: filters.radius,
      search_query: '',
      categories_filter: null,
      conditions_filter: null,
      min_price_filter: 0,
      max_price_filter: 999999999,
      sort_by_filter: 'newest',
      limit_count: PAGE_SIZE,
      offset_count: cursor,
      preset_filter: filters.preset,
    });
    if (error) throw error;
    const items = (data as Listing[]) ?? [];
    return { items, nextCursor: items.length === PAGE_SIZE ? cursor + PAGE_SIZE : null };
  },

  async searchListings(query: string, filters: SearchFilters = defaultSearchFilters, userLat = 12.9352, userLng = 77.6245) {
    if (useMock) return localDb.searchListings(query, filters, userLat, userLng);
    const { data, error } = await supabase!.rpc('search_listings_nearby', {
      user_lat: userLat,
      user_lng: userLng,
      radius_km: filters.radius,
      search_query: query.trim(),
      categories_filter: filters.categories.length ? filters.categories : null,
      conditions_filter: filters.conditions.length ? filters.conditions : null,
      min_price_filter: filters.minPrice,
      max_price_filter: filters.maxPrice,
      sort_by_filter: filters.sortBy,
      limit_count: SUPABASE_SEARCH_LIMIT,
      offset_count: 0,
      preset_filter: 'all',
    });
    if (error) throw error;
    return (data as Listing[]) ?? [];
  },

  saveRecentSearch(term: string) {
    if (useMock) return localDb.saveRecentSearch(term);
    const key = 'lokl-recent-searches';
    const current = JSON.parse(localStorage.getItem(key) || '[]') as string[];
    localStorage.setItem(key, JSON.stringify([term, ...current.filter((item) => item !== term)].slice(0, 6)));
  },

  getRecentSearches() {
    if (useMock) return localDb.getRecentSearches();
    return JSON.parse(localStorage.getItem('lokl-recent-searches') || '[]') as string[];
  },

  async getListing(id: string) {
    if (useMock) return localDb.getListing(id);
    const { data, error } = await supabase!.from('listings').select('*').eq('id', id).single();
    if (error) throw error;
    try {
      await supabase!.rpc('increment_listing_views', { listing_id_input: id });
    } catch {
      // no-op in case rpc is not installed yet
    }
    return data as Listing;
  },

  async getSimilarListings(listing: Listing) {
    if (useMock) return localDb.getSimilarListings(listing);
    const { data } = await supabase!
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .eq('category', listing.category)
      .neq('id', listing.id)
      .limit(8);
    return (data as Listing[]) ?? [];
  },

  async createListing(draft: Omit<ListingDraft, 'images'> & { uploadedImages: string[] }, sellerId: string) {
    if (useMock) return localDb.createListing(draft, sellerId);
    const payload = {
      seller_id: sellerId,
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
    };
    const { data, error } = await supabase!.from('listings').insert(payload).select('*').single();
    if (error) throw error;
    return data as Listing;
  },

  async updateListing(id: string, patch: Partial<Listing>) {
    if (useMock) return localDb.updateListing(id, patch);
    const { data, error } = await supabase!.from('listings').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data as Listing;
  },

  async deleteListing(id: string) {
    if (useMock) return localDb.deleteListing(id);
    const { error } = await supabase!.from('listings').update({ status: 'deleted' }).eq('id', id);
    if (error) throw error;
  },

  async toggleSave(userId: string, listingId: string) {
    if (useMock) return localDb.toggleSave(userId, listingId);
    const { data: existing, error: selectError } = await supabase!
      .from('saved_listings')
      .select('id')
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) {
      const { error } = await supabase!.from('saved_listings').delete().eq('id', existing.id);
      if (error) throw error;
      return false;
    }
    const { error } = await supabase!.from('saved_listings').insert({ user_id: userId, listing_id: listingId });
    if (error) throw error;
    return true;
  },

  async getSavedListingIds(userId: string) {
    if (useMock) return localDb.getSavedListingIds(userId);
    const { data, error } = await supabase!.from('saved_listings').select('listing_id').eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map((row) => row.listing_id as string);
  },

  async getSavedListings(userId: string) {
    if (useMock) return localDb.getSavedListings(userId);
    const { data, error } = await supabase!
      .from('saved_listings')
      .select('listing:listings(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? [])
      .map((row) => (row as { listing: Listing | Listing[] | null }).listing)
      .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []));
  },

  async getChats(userId: string) {
    if (useMock) return localDb.getChats(userId);
    const { data, error } = await supabase!
      .from('chats')
      .select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    return data as ChatThread[];
  },

  async getChat(chatId: string) {
    if (useMock) return localDb.getChat(chatId);
    const { data } = await supabase!.from('chats').select('*').eq('id', chatId).maybeSingle();
    return (data as ChatThread | null) ?? null;
  },

  async getOrCreateChat(listingId: string, buyerId: string) {
    if (useMock) return localDb.getOrCreateChat(listingId, buyerId);
    const listing = await this.getListing(listingId);
    if (!listing) throw new Error('Listing not found');
    if (listing.seller_id === buyerId) throw new Error('You cannot start a buyer chat on your own listing');
    const { data: existing, error: selectError } = await supabase!
      .from('chats')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .eq('seller_id', listing.seller_id)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) return existing as ChatThread;
    const { data, error } = await supabase!
      .from('chats')
      .insert({ listing_id: listingId, buyer_id: buyerId, seller_id: listing.seller_id, last_message: '', last_message_at: new Date().toISOString() })
      .select('*')
      .single();
    if (!error) return data as ChatThread;
    if (error.code !== '23505') throw error;
    const { data: raced, error: racedError } = await supabase!
      .from('chats')
      .select('*')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .eq('seller_id', listing.seller_id)
      .single();
    if (racedError) throw racedError;
    return raced as ChatThread;
  },

  async getMessages(chatId: string) {
    if (useMock) return localDb.getMessages(chatId);
    const { data, error } = await supabase!.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (error) throw error;
    return data as Message[];
  },

  async setTyping(chatId: string, userId: string | null) {
    if (useMock) return localDb.setTyping(chatId, userId);
    await supabase!.from('chats').update({ typing_user_id: userId }).eq('id', chatId);
  },

  async sendMessage(chatId: string, senderId: string, content: string, type: Message['type'] = 'text', offerAmount?: number) {
    if (useMock) return localDb.sendMessage(chatId, senderId, content, type, offerAmount);
    const { data, error } = await supabase!
      .from('messages')
      .insert({ chat_id: chatId, sender_id: senderId, content, type, offer_amount: offerAmount ?? null, offer_status: type === 'offer' ? 'pending' : null })
      .select('*')
      .single();
    if (error) throw error;
    return data as Message;
  },

  async updateOffer(messageId: string, offerStatus: 'accepted' | 'rejected') {
    if (useMock) return localDb.updateOffer(messageId, offerStatus);
    const { data, error } = await supabase!.from('messages').update({ offer_status: offerStatus }).eq('id', messageId).select('*').single();
    if (error) throw error;
    return data as Message;
  },

  async markChatRead(chatId: string, userId: string) {
    if (useMock) return localDb.markChatRead(chatId, userId);
    await supabase!.from('messages').update({ is_read: true }).eq('chat_id', chatId).neq('sender_id', userId);
  },

  async getNotifications(userId: string) {
    if (useMock) return localDb.getNotifications(userId);
    const { data } = await supabase!.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return (data as NotificationItem[]) ?? [];
  },

  async markAllNotificationsRead(userId: string) {
    if (useMock) return localDb.markAllNotificationsRead(userId);
    await supabase!.from('notifications').update({ is_read: true }).eq('user_id', userId);
  },

  async addNotification(notification: Omit<NotificationItem, 'id' | 'created_at'>) {
    if (useMock) return localDb.addNotification(notification);
    const current = await this.getCurrentUser();
    if (!current || current.id !== notification.user_id) throw new Error('Notifications are created by trusted server-side flows in Supabase mode.');
  },

  async createReport(report: Omit<ReportItem, 'id' | 'created_at' | 'status'>) {
    if (useMock) return localDb.createReport(report);
    const { data, error } = await supabase!.from('reports').insert(report).select('*').single();
    if (error) throw error;
    return data as ReportItem;
  },

  async getReports() {
    if (useMock) return localDb.getReports();
    const [{ data: reports }, { data: flags }] = await Promise.all([
      supabase!.from('reports').select('*').order('created_at', { ascending: false }),
      supabase!.from('moderation_flags').select('*').eq('status', 'pending').order('severity', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    const reportItems = ((reports as ReportItem[]) ?? []).map((report) => ({ ...report, source: 'user_report' as const, severity: 2 }));
    const flagItems = ((flags as {
      id: string;
      target_type: ReportItem['target_type'];
      listing_id: string | null;
      user_id: string | null;
      source: ReportItem['source'];
      reason: string;
      description: string;
      severity: number;
      status: ReportItem['status'];
      created_at: string;
    }[]) ?? []).map((flag) => ({
      id: flag.id,
      reporter_id: flag.user_id ?? '',
      listing_id: flag.listing_id,
      reported_user_id: flag.user_id,
      reason: flag.reason,
      description: flag.description,
      status: flag.status,
      created_at: flag.created_at,
      source: flag.source,
      severity: flag.severity,
      target_type: flag.target_type,
    }));
    return [...flagItems, ...reportItems].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || +new Date(b.created_at) - +new Date(a.created_at));
  },

  async banUser(userId: string) {
    if (useMock) return localDb.banUser(userId);
    await supabase!.from('users').update({ is_banned: true }).eq('id', userId);
    await supabase!.from('listings').update({ status: 'deleted' }).eq('seller_id', userId);
  },

  async getMyListings(userId: string, status?: Listing['status']) {
    if (useMock) return localDb.getMyListings(userId, status);
    let query = supabase!.from('listings').select('*').eq('seller_id', userId);
    if (status) query = query.eq('status', status);
    const { data } = await query.order('created_at', { ascending: false });
    return (data as Listing[]) ?? [];
  },

  async getReviewsForUser(userId: string) {
    if (useMock) return localDb.getReviewsForUser(userId);
    const { data } = await supabase!.from('reviews').select('*').eq('reviewed_id', userId).order('created_at', { ascending: false });
    return data ?? [];
  },

  async blockUser(userId: string, blockedUserId: string) {
    if (useMock) return localDb.blockUser(userId, blockedUserId);
    const me = await this.getCurrentUser();
    if (!me) return;
    const next = Array.from(new Set([...(me.blocked_user_ids ?? []), blockedUserId]));
    await supabase!.from('users').update({ blocked_user_ids: next }).eq('id', userId);
  },

  async deleteAccount(userId: string) {
    if (useMock) return localDb.deleteAccount(userId);
    const { error } = await supabase!.functions.invoke('delete-account', { body: { confirm: true } });
    if (error) throw error;
    await supabase!.auth.signOut();
  },
};
