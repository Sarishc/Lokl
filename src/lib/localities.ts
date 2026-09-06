import { distanceKm } from './utils';

// The single system-owned source of truth for "where is this locality." Every
// coordinate anyone ever sees in this app — a user's profile, a listing — comes
// from this list or from a real device GPS fix, never from free text or a
// user-typed number. See docs/audit/FINDINGS.md LOKL-038/042 and the Step 5
// report's Task 2 write-up for why a curated list was chosen over geocoding,
// Places Autocomplete, or mandatory GPS.
//
// Coordinates here are the same ones already used for this app's seed/demo data
// (src/data/mock.ts, supabase/schema.sql) — this list formalizes data the product
// already depended on implicitly, rather than inventing a new one. Deliberately
// finite and single-city-launch-scoped: extend this list (and CITIES below) when
// launching in a new city, rather than accepting arbitrary text.
export interface LocalityOption {
  city: string;
  locality: string;
  lat: number;
  lng: number;
}

export const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'] as const;

export const LOCALITIES: LocalityOption[] = [
  { city: 'Bengaluru', locality: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { city: 'Bengaluru', locality: 'HSR Layout', lat: 12.9362, lng: 77.6205 },
  { city: 'Bengaluru', locality: 'Indiranagar', lat: 12.941, lng: 77.615 },
  { city: 'Bengaluru', locality: 'BTM Layout', lat: 12.928, lng: 77.61 },
  { city: 'Bengaluru', locality: 'Whitefield', lat: 12.9698, lng: 77.7499 },
  { city: 'Bengaluru', locality: 'Richmond Town', lat: 12.9716, lng: 77.5946 },
  { city: 'Mumbai', locality: 'Bandra West', lat: 19.1211, lng: 72.8362 },
  { city: 'Mumbai', locality: 'Andheri West', lat: 19.1345, lng: 72.8212 },
  { city: 'Mumbai', locality: 'Versova', lat: 19.1173, lng: 72.8465 },
  { city: 'Mumbai', locality: 'Juhu', lat: 19.1155, lng: 72.8382 },
  { city: 'Mumbai', locality: 'Powai', lat: 19.0646, lng: 72.837 },
  { city: 'Mumbai', locality: 'Lokhandwala', lat: 19.1251, lng: 72.8467 },
  { city: 'Delhi', locality: 'Hauz Khas', lat: 28.5494, lng: 77.2001 },
  { city: 'Delhi', locality: 'Green Park', lat: 28.5602, lng: 77.1944 },
  { city: 'Delhi', locality: 'Saket', lat: 28.5662, lng: 77.2144 },
  { city: 'Delhi', locality: 'Malviya Nagar', lat: 28.5609, lng: 77.1986 },
  { city: 'Delhi', locality: 'Greater Kailash', lat: 28.5355, lng: 77.242 },
  { city: 'Delhi', locality: 'Vasant Vihar', lat: 28.5744, lng: 77.1885 },
  { city: 'Hyderabad', locality: 'Jubilee Hills', lat: 17.4375, lng: 78.4483 },
  { city: 'Hyderabad', locality: 'Madhapur', lat: 17.4382, lng: 78.4411 },
  { city: 'Hyderabad', locality: 'Gachibowli', lat: 17.4448, lng: 78.3927 },
  { city: 'Hyderabad', locality: 'Financial District', lat: 17.4509, lng: 78.3837 },
  { city: 'Hyderabad', locality: 'Kondapur', lat: 17.4399, lng: 78.4005 },
  { city: 'Chennai', locality: 'T Nagar', lat: 13.0486, lng: 80.209 },
  { city: 'Chennai', locality: 'Nungambakkam', lat: 13.0399, lng: 80.2342 },
  { city: 'Chennai', locality: 'Mylapore', lat: 13.0604, lng: 80.2496 },
  { city: 'Pune', locality: 'Baner', lat: 18.559, lng: 73.7868 },
  { city: 'Pune', locality: 'Aundh', lat: 18.5672, lng: 73.7741 },
  { city: 'Pune', locality: 'Balewadi', lat: 18.5423, lng: 73.7921 },
  { city: 'Pune', locality: 'Wakad', lat: 18.5481, lng: 73.8071 },
  { city: 'Pune', locality: 'Kothrud', lat: 18.5311, lng: 73.8478 },
];

export function localitiesForCity(city: string): LocalityOption[] {
  return LOCALITIES.filter((option) => option.city === city);
}

export function findLocality(city: string, locality: string): LocalityOption | undefined {
  return LOCALITIES.find((option) => option.city === city && option.locality === locality);
}

// Used to turn a real GPS fix into a locality choice — the coordinate the app
// actually stores is always a locality centroid, on every entry point, so every
// stored coordinate carries the same (approximate) precision. This is what makes
// the "never claim more precision than the source supports" rule enforceable by
// construction rather than by remembering to round in every display call site.
export function nearestLocality(lat: number, lng: number): LocalityOption {
  return LOCALITIES.reduce((closest, option) =>
    distanceKm(lat, lng, option.lat, option.lng) < distanceKm(lat, lng, closest.lat, closest.lng) ? option : closest,
  );
}
