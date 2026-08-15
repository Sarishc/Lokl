import { addDays } from 'date-fns';
import { initialMockDb } from '../data/mock';
import { LISTING_EXPIRY_DAYS, PAGE_SIZE, defaultSearchFilters } from '../lib/constants';
import { distanceKm, uid } from '../lib/utils';
import type {
  AppDatabase,
  ChatThread,
  FeedFilters,
  FeedPage,
  Listing,
  ListingDraft,
  Message,
  NotificationItem,
  RadiusOption,
  ReportItem,
  SearchFilters,
  SessionUser,
  UserProfile,
} from '../types';

const DB_KEY = 'lokl-mock-db-v1';
const listeners = new Set<() => void>();

function listingModeration(input: { title: string; description: string }, db: AppDatabase, sellerId: string, currentId?: string) {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const reasons: string[] = [];
  if (/send\s+money\s+first|advance\s+payment|pay\s+before|western\s+union|crypto|whatsapp|telegram|click\s+this\s+link|bit\.ly|tinyurl|http(s)?:\/\//i.test(text)) reasons.push('Possible scam or off-platform payment language');
  if (/\+?\d[\d\s-]{8,}\d/.test(text)) reasons.push('Phone number embedded in listing text');
  if (db.listings.some((listing) => listing.seller_id === sellerId && listing.id !== currentId && listing.status === 'active' && listing.title.toLowerCase() === input.title.toLowerCase() && listing.description.toLowerCase() === input.description.toLowerCase())) reasons.push('Repeated identical listing');
  return {
    moderation_status: reasons.length ? 'flagged' as const : 'clear' as const,
    moderation_reason: reasons.join('; ') || null,
    moderation_severity: reasons.some((reason) => reason.includes('scam')) ? 4 : reasons.length ? 3 : 0,
  };
}

function addModerationFlag(db: AppDatabase, listing: Listing) {
  if (listing.moderation_status !== 'flagged' || !listing.moderation_reason) return;
  db.reports.unshift({
    id: uid('auto_flag'),
    reporter_id: listing.seller_id,
    listing_id: listing.id,
    reported_user_id: listing.seller_id,
    reason: listing.moderation_reason,
    description: 'Automated first-line moderation flag. Human review required before taking permanent action.',
    status: 'pending',
    created_at: new Date().toISOString(),
    source: 'auto_spam',
    severity: listing.moderation_severity ?? 3,
    target_type: 'listing',
  });
}

function readDb(): AppDatabase {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    localStorage.setItem(DB_KEY, JSON.stringify(initialMockDb));
    return structuredClone(initialMockDb);
  }
  return JSON.parse(raw) as AppDatabase;
}

function writeDb(next: AppDatabase) {
  localStorage.setItem(DB_KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

function currentUser(db: AppDatabase) {
  return db.session ? db.users.find((user) => user.id === db.session?.id) ?? null : null;
}

export const localDb = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  reset() {
    writeDb(structuredClone(initialMockDb));
  },

  getSession(): SessionUser | null {
    return readDb().session;
  },

  setSession(session: SessionUser | null) {
    const db = readDb();
    db.session = session;
    writeDb(db);
  },

  async sendOtp(_phone: string) {
    return { success: true };
  },

  async verifyOtp(phone: string, otp: string) {
    if (otp !== '123456') throw new Error('Use 123456 in mock mode.');
    const db = readDb();
    let user = db.users.find((item) => item.phone === phone) ?? null;
    if (!user) {
      user = {
        id: uid('user'),
        phone,
        full_name: '',
        avatar_url: '',
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
      };
      db.users.unshift(user);
    }
    db.session = { id: user.id, phone: user.phone };
    writeDb(db);
    return user;
  },

  async signInWithGoogle() {
    const db = readDb();
    let user = db.users.find((item) => item.id === 'mock-google-user') ?? null;
    if (!user) {
      user = {
        id: 'mock-google-user',
        phone: null,
        full_name: '',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
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
      };
      db.users.unshift(user);
    }
    db.session = { id: user.id, phone: user.phone, email: 'google.user@example.com', provider: 'google' };
    writeDb(db);
    return user;
  },

  async logout() {
    const db = readDb();
    db.session = null;
    writeDb(db);
  },

  async upsertProfile(input: Partial<UserProfile> & { id: string }) {
    const db = readDb();
    const index = db.users.findIndex((user) => user.id === input.id);
    if (index === -1) throw new Error('User not found');
    db.users[index] = { ...db.users[index], ...input, last_seen: new Date().toISOString() };
    writeDb(db);
    return db.users[index];
  },

  getCurrentUser() {
    const db = readDb();
    return currentUser(db);
  },

  getUserById(id: string) {
    return readDb().users.find((user) => user.id === id) ?? null;
  },

  getSavedListingIds(userId: string) {
    return readDb().saved_listings.filter((entry) => entry.user_id === userId).map((entry) => entry.listing_id);
  },

  toggleSave(userId: string, listingId: string) {
    const db = readDb();
    const existing = db.saved_listings.find((entry) => entry.user_id === userId && entry.listing_id === listingId);
    if (existing) {
      db.saved_listings = db.saved_listings.filter((entry) => entry.id !== existing.id);
    } else {
      db.saved_listings.unshift({ id: uid('saved'), user_id: userId, listing_id: listingId, created_at: new Date().toISOString() });
    }
    writeDb(db);
    return !existing;
  },

  getListingsFeed(userLat: number, userLng: number, filters: FeedFilters, cursor = 0): FeedPage {
    const db = readDb();
    const items = db.listings
      .filter((listing) => listing.status === 'active' && distanceKm(userLat, userLng, listing.location_lat, listing.location_lng) <= filters.radius)
      .filter((listing) => {
        switch (filters.preset) {
          case 'under500': return listing.price <= 500;
          case 'under2000': return listing.price <= 2000;
          case 'under10000': return listing.price <= 10000;
          case 'free': return listing.is_free;
          case 'urgent': return listing.is_urgent;
          case 'negotiable': return listing.is_negotiable;
          default: return true;
        }
      })
      .sort((a, b) => distanceKm(userLat, userLng, a.location_lat, a.location_lng) - distanceKm(userLat, userLng, b.location_lat, b.location_lng));

    return {
      items: items.slice(cursor, cursor + PAGE_SIZE),
      nextCursor: cursor + PAGE_SIZE < items.length ? cursor + PAGE_SIZE : null,
    };
  },

  searchListings(query: string, filters: SearchFilters = defaultSearchFilters, userLat = 12.9352, userLng = 77.6245) {
    const db = readDb();
    const normalized = query.trim().toLowerCase();
    const results = db.listings
      .filter((listing) => listing.status === 'active')
      .filter((listing) => !normalized || `${listing.title} ${listing.description} ${listing.category} ${listing.locality}`.toLowerCase().includes(normalized))
      .filter((listing) => !filters.categories.length || filters.categories.includes(listing.category))
      .filter((listing) => listing.price >= filters.minPrice && listing.price <= filters.maxPrice)
      .filter((listing) => !filters.conditions.length || filters.conditions.includes(listing.condition))
      .filter((listing) => distanceKm(userLat, userLng, listing.location_lat, listing.location_lng) <= filters.radius);

    const sorted = [...results].sort((a, b) => {
      if (filters.sortBy === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
      if (filters.sortBy === 'price-asc') return a.price - b.price;
      if (filters.sortBy === 'price-desc') return b.price - a.price;
      return distanceKm(userLat, userLng, a.location_lat, a.location_lng) - distanceKm(userLat, userLng, b.location_lat, b.location_lng);
    });

    return sorted;
  },

  saveRecentSearch(term: string) {
    const db = readDb();
    db.recent_searches = [term, ...db.recent_searches.filter((entry) => entry !== term)].slice(0, 6);
    writeDb(db);
  },

  getRecentSearches() {
    return readDb().recent_searches;
  },

  getListing(id: string) {
    const db = readDb();
    const listing = db.listings.find((item) => item.id === id) ?? null;
    if (listing) {
      listing.views += 1;
      writeDb(db);
    }
    return listing;
  },

  getSimilarListings(listing: Listing) {
    return readDb().listings
      .filter((item) => item.id !== listing.id && item.category === listing.category && item.status === 'active')
      .slice(0, 8);
  },

  createListing(draft: Omit<ListingDraft, 'images'> & { uploadedImages: string[] }, sellerId: string) {
    const db = readDb();
    const listing: Listing = {
      id: uid('listing'),
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
      status: 'active',
      views: 0,
      is_urgent: false,
      is_featured: false,
      ...listingModeration(draft, db, sellerId),
      created_at: new Date().toISOString(),
      expires_at: addDays(new Date(), LISTING_EXPIRY_DAYS).toISOString(),
    };
    db.listings.unshift(listing);
    addModerationFlag(db, listing);
    writeDb(db);
    return listing;
  },

  updateListing(id: string, patch: Partial<Listing>) {
    const db = readDb();
    const index = db.listings.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('Listing not found');
    const next = { ...db.listings[index], ...patch };
    const moderation = listingModeration(next, db, next.seller_id, next.id);
    db.listings[index] = { ...next, ...moderation };
    addModerationFlag(db, db.listings[index]);
    writeDb(db);
    return db.listings[index];
  },

  deleteListing(id: string) {
    return this.updateListing(id, { status: 'deleted' });
  },

  getChats(userId: string) {
    const db = readDb();
    return db.chats
      .filter((chat) => chat.buyer_id === userId || chat.seller_id === userId)
      .sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
  },

  getChat(chatId: string) {
    return readDb().chats.find((chat) => chat.id === chatId) ?? null;
  },

  getOrCreateChat(listingId: string, buyerId: string) {
    const db = readDb();
    const listing = db.listings.find((item) => item.id === listingId && item.status === 'active');
    if (!listing) throw new Error('Listing not found');
    if (listing.seller_id === buyerId) throw new Error('You cannot start a buyer chat on your own listing');
    const existing = db.chats.find((chat) => chat.listing_id === listingId && chat.buyer_id === buyerId && chat.seller_id === listing.seller_id);
    if (existing) return existing;
    const chat: ChatThread = {
      id: uid('chat'),
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      last_message: '',
      last_message_at: new Date().toISOString(),
      buyer_unread: 0,
      seller_unread: 0,
      status: 'active',
      typing_user_id: null,
    };
    db.chats.unshift(chat);
    writeDb(db);
    return chat;
  },

  getMessages(chatId: string) {
    return readDb().messages.filter((message) => message.chat_id === chatId).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  },

  setTyping(chatId: string, userId: string | null) {
    const db = readDb();
    const chat = db.chats.find((item) => item.id === chatId);
    if (!chat) return;
    chat.typing_user_id = userId;
    writeDb(db);
  },

  sendMessage(chatId: string, senderId: string, content: string, type: Message['type'] = 'text', offerAmount?: number) {
    const db = readDb();
    const chat = db.chats.find((item) => item.id === chatId);
    if (!chat) throw new Error('Chat not found');
    const message: Message = {
      id: uid('message'),
      chat_id: chatId,
      sender_id: senderId,
      content,
      type,
      offer_amount: offerAmount,
      offer_status: type === 'offer' ? 'pending' : null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    db.messages.push(message);
    chat.last_message = type === 'offer' ? `Offer: ₹${offerAmount}` : content;
    chat.last_message_at = message.created_at;
    if (chat.buyer_id === senderId) chat.seller_unread += 1;
    if (chat.seller_id === senderId) chat.buyer_unread += 1;
    chat.typing_user_id = null;
    writeDb(db);
    return message;
  },

  updateOffer(messageId: string, offerStatus: 'accepted' | 'rejected') {
    const db = readDb();
    const message = db.messages.find((item) => item.id === messageId && item.type === 'offer');
    if (!message) throw new Error('Offer not found');
    message.offer_status = offerStatus;
    writeDb(db);
    return message;
  },

  markChatRead(chatId: string, userId: string) {
    const db = readDb();
    db.messages
      .filter((message) => message.chat_id === chatId && message.sender_id !== userId)
      .forEach((message) => { message.is_read = true; });
    const chat = db.chats.find((item) => item.id === chatId);
    if (chat) {
      if (chat.buyer_id === userId) chat.buyer_unread = 0;
      if (chat.seller_id === userId) chat.seller_unread = 0;
    }
    writeDb(db);
  },

  getNotifications(userId: string) {
    return readDb().notifications.filter((item) => item.user_id === userId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  },

  markAllNotificationsRead(userId: string) {
    const db = readDb();
    db.notifications.filter((item) => item.user_id === userId).forEach((item) => { item.is_read = true; });
    writeDb(db);
  },

  addNotification(notification: Omit<NotificationItem, 'id' | 'created_at'>) {
    const db = readDb();
    db.notifications.unshift({ ...notification, id: uid('notif'), created_at: new Date().toISOString() });
    writeDb(db);
  },

  getSavedListings(userId: string) {
    const db = readDb();
    const ids = db.saved_listings.filter((entry) => entry.user_id === userId).map((entry) => entry.listing_id);
    return db.listings.filter((listing) => ids.includes(listing.id));
  },

  createReport(report: Omit<ReportItem, 'id' | 'created_at' | 'status'>) {
    const db = readDb();
    const item: ReportItem = { ...report, id: uid('report'), created_at: new Date().toISOString(), status: 'pending' };
    db.reports.unshift(item);
    writeDb(db);
    return item;
  },

  getReports() {
    return readDb().reports;
  },

  banUser(userId: string) {
    const db = readDb();
    db.users = db.users.map((user) => (user.id === userId ? { ...user, is_banned: true } : user));
    db.listings = db.listings.map((listing) => (listing.seller_id === userId ? { ...listing, status: 'deleted' } : listing));
    writeDb(db);
  },

  getMyListings(userId: string, status?: Listing['status']) {
    return readDb().listings.filter((listing) => listing.seller_id === userId && (!status || listing.status === status));
  },

  getReviewsForUser(userId: string) {
    return readDb().reviews.filter((review) => review.reviewed_id === userId);
  },

  blockUser(userId: string, blockedUserId: string) {
    const db = readDb();
    const user = db.users.find((item) => item.id === userId);
    if (!user) return;
    user.blocked_user_ids = Array.from(new Set([...(user.blocked_user_ids ?? []), blockedUserId]));
    writeDb(db);
  },

  deleteAccount(userId: string) {
    const db = readDb();
    const listingIds = db.listings.filter((listing) => listing.seller_id === userId).map((listing) => listing.id);
    const chatIds = db.chats.filter((chat) => chat.buyer_id === userId || chat.seller_id === userId || listingIds.includes(chat.listing_id)).map((chat) => chat.id);
    db.users = db.users.filter((user) => user.id !== userId);
    db.listings = db.listings.filter((listing) => listing.seller_id !== userId);
    db.chats = db.chats.filter((chat) => !chatIds.includes(chat.id));
    db.messages = db.messages.filter((message) => !chatIds.includes(message.chat_id) && message.sender_id !== userId);
    db.reviews = db.reviews.filter((review) => review.reviewer_id !== userId && review.reviewed_id !== userId);
    db.saved_listings = db.saved_listings.filter((saved) => saved.user_id !== userId && !listingIds.includes(saved.listing_id));
    db.notifications = db.notifications.filter((notification) => notification.user_id !== userId);
    db.reports = db.reports.filter((report) => report.reporter_id !== userId && report.reported_user_id !== userId && !listingIds.includes(report.listing_id || ''));
    if (db.session?.id === userId) db.session = null;
    writeDb(db);
  },

  getRadiusAwareListingCount(userLat: number, userLng: number, radius: RadiusOption) {
    return readDb().listings.filter((listing) => distanceKm(userLat, userLng, listing.location_lat, listing.location_lng) <= radius).length;
  },
};
