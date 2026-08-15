import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LOCALITY, DEFAULT_RADIUS, defaultSearchFilters } from '../lib/constants';
import type { FeedFilters, ListingDraft, RadiusOption, SearchFilters, UserProfile } from '../types';

const emptyDraft: ListingDraft = {
  images: [],
  uploadedImages: [],
  title: '',
  category: 'Mobiles',
  condition: 'Good',
  description: '',
  price: 0,
  is_negotiable: true,
  is_free: false,
  locality: 'Koramangala',
  city: 'Bengaluru',
  location_lat: 12.9352,
  location_lng: 77.6245,
};

interface AppState {
  user: UserProfile | null;
  radius: RadiusOption;
  feedFilters: FeedFilters;
  searchFilters: SearchFilters;
  selectedLocality: string;
  draft: ListingDraft;
  setUser: (user: UserProfile | null) => void;
  setRadius: (radius: RadiusOption) => void;
  setFeedPreset: (preset: FeedFilters['preset']) => void;
  setSearchFilters: (filters: SearchFilters) => void;
  setSelectedLocality: (locality: string) => void;
  updateDraft: (patch: Partial<ListingDraft>) => void;
  resetDraft: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      radius: DEFAULT_RADIUS,
      feedFilters: { preset: 'all', radius: DEFAULT_RADIUS },
      searchFilters: defaultSearchFilters,
      selectedLocality: DEFAULT_LOCALITY,
      draft: emptyDraft,
      setUser: (user) =>
        set(() => ({
          user,
          selectedLocality: user?.locality ?? DEFAULT_LOCALITY,
          draft: user
            ? {
                ...emptyDraft,
                locality: user.locality,
                city: user.city,
                location_lat: user.location_lat,
                location_lng: user.location_lng,
              }
            : emptyDraft,
        })),
      setRadius: (radius) => set((state) => ({ radius, feedFilters: { ...state.feedFilters, radius }, searchFilters: { ...state.searchFilters, radius } })),
      setFeedPreset: (preset) => set((state) => ({ feedFilters: { ...state.feedFilters, preset } })),
      setSearchFilters: (filters) => set(() => ({ searchFilters: filters })),
      setSelectedLocality: (selectedLocality) => set(() => ({ selectedLocality })),
      updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
      resetDraft: () => set(() => ({ draft: emptyDraft })),
    }),
    { name: 'lokl-app-store', partialize: (state) => ({ radius: state.radius, selectedLocality: state.selectedLocality, searchFilters: state.searchFilters, draft: state.draft }) },
  ),
);
