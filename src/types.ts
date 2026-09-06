export type RadiusOption = 1 | 2 | 5 | 10 | 25;
export type AppMode = 'mock' | 'supabase';
export type ListingStatus = 'active' | 'sold' | 'reserved' | 'deleted';
export type ListingCondition = 'New' | 'Like New' | 'Good' | 'Fair';
export type MessageType = 'text' | 'image' | 'offer' | 'system';
export type OfferStatus = 'pending' | 'accepted' | 'rejected';
export type NotificationType =
  | 'new_message'
  | 'offer'
  | 'listing_sold'
  | 'review'
  | 'price_drop'
  | 'offer_accepted'
  | 'listing_view_milestone';

export interface UserProfile {
  id: string;
  phone: string | null;
  full_name: string;
  avatar_url: string;
  bio: string;
  // null means genuinely unknown — never a placeholder coordinate. See
  // docs/audit/FINDINGS.md LOKL-038/042 and src/lib/localities.ts. Always set
  // together with locality/city via the same trusted lookup, never independently.
  location_lat: number | null;
  location_lng: number | null;
  locality: string;
  city: string;
  is_verified: boolean;
  is_dealer: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  rating: number;
  total_reviews: number;
  listings_sold: number;
  joined_at: string;
  last_seen: string;
  blocked_user_ids?: string[];
  legal_consent_version?: string | null;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  is_negotiable: boolean;
  is_free: boolean;
  category: string;
  condition: ListingCondition;
  images: string[];
  location_lat: number;
  location_lng: number;
  locality: string;
  city: string;
  status: ListingStatus;
  views: number;
  is_urgent: boolean;
  is_featured: boolean;
  moderation_status?: 'clear' | 'flagged' | 'blocked';
  moderation_reason?: string | null;
  moderation_severity?: number;
  created_at: string;
  expires_at: string;
}

export interface ChatThread {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message: string;
  last_message_at: string;
  buyer_unread: number;
  seller_unread: number;
  status: 'active' | 'archived';
  typing_user_id?: string | null;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  offer_amount?: number | null;
  offer_status?: OfferStatus | null;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewed_id: string;
  listing_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface SavedListing {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ReportItem {
  id: string;
  reporter_id: string;
  listing_id?: string | null;
  reported_user_id?: string | null;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  source?: 'user_report' | 'auto_spam' | 'auto_image';
  severity?: number;
  target_type?: 'listing' | 'user' | 'image' | 'message';
}

export interface SearchFilters {
  categories: string[];
  minPrice: number;
  maxPrice: number;
  conditions: ListingCondition[];
  radius: RadiusOption;
  sortBy: 'newest' | 'price-asc' | 'price-desc' | 'distance';
}

export interface FeedFilters {
  preset: 'all' | 'under500' | 'under2000' | 'under10000' | 'free' | 'urgent' | 'negotiable';
  radius: RadiusOption;
}

export interface ListingDraft {
  images: File[];
  uploadedImages: string[];
  title: string;
  category: string;
  condition: ListingCondition;
  description: string;
  price: number;
  is_negotiable: boolean;
  is_free: boolean;
  locality: string;
  city: string;
  // null while the seller hasn't chosen a locality yet — see LocalityPicker.
  // Never null once a listing is actually submitted (enforced client-side by
  // disabling submission, and server-side by listings.location_lat/lng NOT NULL).
  location_lat: number | null;
  location_lng: number | null;
}

export interface SessionUser {
  id: string;
  phone: string | null;
  email?: string | null;
  provider?: string | null;
}

export interface AppDatabase {
  users: UserProfile[];
  listings: Listing[];
  chats: ChatThread[];
  messages: Message[];
  reviews: Review[];
  saved_listings: SavedListing[];
  notifications: NotificationItem[];
  reports: ReportItem[];
  session: SessionUser | null;
  recent_searches: string[];
}

export interface FeedPage {
  items: Listing[];
  nextCursor: number | null;
}
