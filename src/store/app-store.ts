import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_RADIUS, defaultSearchFilters } from '../lib/constants';
import type { FeedFilters, ListingDraft, RadiusOption, SearchFilters, UserProfile } from '../types';

// Deliberately no locality/city/coordinate default here — see
// docs/audit/FINDINGS.md LOKL-042b. setUser (below) re-seeds these from the
// signed-in user's own profile immediately, and LocalityPicker auto-applies a
// real default the first time it renders with none set (src/components/common.tsx)
// — neither ever needs a fabricated real place to fall back to.
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
  locality: '',
  city: '',
  location_lat: null,
  location_lng: null,
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
      selectedLocality: '',
      draft: emptyDraft,
      setUser: (user) =>
        set(() => ({
          user,
          selectedLocality: user?.locality ?? '',
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
