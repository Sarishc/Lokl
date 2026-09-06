import type { ListingCondition, RadiusOption, SearchFilters } from '../types';
export { APP_MODE } from './app-mode';

export const APP_NAME = 'Lokl';
export const TAGLINE = 'Your neighbourhood marketplace';
export const DEFAULT_PHONE_CODE = '+91';
export const DEFAULT_CITY = 'Bengaluru';
export const DEFAULT_LOCALITY = 'Koramangala';
export const PAGE_SIZE = 20;
export const DEFAULT_RADIUS: RadiusOption = 5;
export const LISTING_EXPIRY_DAYS = 60;

export const categories = [
  'Mobiles',
  'Furniture',
  'Electronics',
  'Bikes',
  'Fashion',
  'Books',
  'Home Decor',
  'Appliances',
  'Jobs',
  'Services',
  'Sports',
  'Pets',
  'Kids',
  'Gaming',
  'Cars',
  'Property',
] as const;

export const conditionOptions: { label: ListingCondition; description: string }[] = [
  { label: 'New', description: 'Unused, sealed or almost untouched' },
  { label: 'Like New', description: 'Looks new, barely used' },
  { label: 'Good', description: 'Visible usage but works perfectly' },
  { label: 'Fair', description: 'Heavy usage, priced accordingly' },
];

export const radiusOptions: RadiusOption[] = [1, 2, 5, 10, 25];

export const defaultSearchFilters: SearchFilters = {
  categories: [],
  minPrice: 0,
  maxPrice: 500000,
  conditions: [],
  radius: DEFAULT_RADIUS,
  sortBy: 'distance',
};

export const quickReplies = [
  'Is this still available?',
  'Can you do ₹[price]?',
  'Where can we meet?',
];

export const listingFilterPresets = [
  { key: 'all', label: 'All' },
  { key: 'under500', label: 'Under ₹500' },
  { key: 'under2000', label: 'Under ₹2,000' },
  { key: 'under10000', label: 'Under ₹10,000' },
  { key: 'free', label: 'Free' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'negotiable', label: 'Negotiable' },
] as const;

export const safetyTips = [
  'Meet in a busy public place during daytime.',
  'Inspect the item before paying.',
  'Use in-app chat and avoid sharing unnecessary personal details.',
];

export const trendingSearchesByCity: Record<string, string[]> = {
  Bengaluru: ['iPhone 14', 'Study table', 'PS5', 'Scooter', 'Office chair'],
  Mumbai: ['AC', 'Sofa', 'MacBook', 'Dining table', 'Cycles'],
  Delhi: ['Fridge', 'Room heater', 'OnePlus', 'Wardrobe', 'Bike helmet'],
  Hyderabad: ['Gaming monitor', 'Mixer grinder', 'Poco', 'Bean bag', 'Car stereo'],
  Chennai: ['Bookshelf', 'Laptop stand', 'Air fryer', 'Temple decor', 'Bicycle'],
  Pune: ['Guitar', 'Scooty', 'Projector', 'Microwave', 'Hostel essentials'],
};
