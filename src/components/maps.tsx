/// <reference types="google.maps" />
import { useEffect, useRef } from 'react';
import { GlassCard } from './common';
import type { Listing } from '../types';

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function cssToken(name: string) {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function Placeholder({ text }: { text: string }) {
  return (
    <GlassCard className="grid h-64 place-items-center px-6 text-center text-sm text-[color:var(--color-text-muted)]">
      <div>
        <div className="mb-2 text-3xl">🗺️</div>
        <p>{text}</p>
      </div>
    </GlassCard>
  );
}

export function ApproximateMap({ lat, lng, locality }: { lat: number; lng: number; locality: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!apiKey || !ref.current) return;
    let cancelled = false;
    void import('@googlemaps/js-api-loader').then(({ Loader }) => {
      const loader = new Loader({ apiKey, version: 'weekly' });
      return (loader as unknown as { importLibrary: (lib: string) => Promise<unknown> }).importLibrary('maps');
    }).then(() => {
      if (cancelled || !ref.current) return;
      const map = new google.maps.Map(ref.current, {
        center: { lat, lng },
        zoom: 14,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: cssToken('--map-geometry') }] },
          { elementType: 'labels.text.fill', stylers: [{ color: cssToken('--map-label') }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: cssToken('--map-road') }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: cssToken('--map-water') }] },
        ],
      });
      new google.maps.Circle({
        strokeColor: cssToken('--color-primary'),
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: cssToken('--color-primary'),
        fillOpacity: 0.2,
        map,
        center: { lat, lng },
        radius: 500,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (!apiKey) return <Placeholder text={`Approximate area for ${locality}. Add VITE_GOOGLE_MAPS_API_KEY to enable live Google Maps.`} />;
  return <div ref={ref} className="h-64 w-full overflow-hidden rounded-2xl" />;
}

export function ListingsMap({ listings, onSelect }: { listings: Listing[]; onSelect: (listing: Listing) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!apiKey || !ref.current || !listings.length) return;
    let cancelled = false;
    void Promise.all([import('@googlemaps/js-api-loader'), import('@googlemaps/markerclusterer')]).then(async ([{ Loader }, { MarkerClusterer }]) => {
      const loader = new Loader({ apiKey, version: 'weekly' });
      const typedLoader = loader as unknown as { importLibrary: (lib: string) => Promise<unknown> };
      await Promise.all([typedLoader.importLibrary('maps'), typedLoader.importLibrary('marker')]);
      if (cancelled || !ref.current) return;
      const center = { lat: listings[0].location_lat, lng: listings[0].location_lng };
      const map = new google.maps.Map(ref.current, {
        center,
        zoom: 11,
        disableDefaultUI: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: cssToken('--map-geometry') }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: cssToken('--map-road') }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: cssToken('--map-water') }] },
        ],
      });
      const markers = listings.map((listing) => {
        const marker = new google.maps.Marker({
          position: { lat: listing.location_lat, lng: listing.location_lng },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: cssToken('--color-primary'),
            fillOpacity: 1,
            strokeColor: cssToken('--map-marker-stroke'),
            strokeWeight: 2,
            scale: 8,
          },
        });
        marker.addListener('click', () => onSelect(listing));
        return marker;
      });
      new MarkerClusterer({ map, markers });
    });
    return () => {
      cancelled = true;
    };
  }, [listings, onSelect]);

  if (!apiKey) return <Placeholder text="Map view is ready. Add your Google Maps key to render clustered nearby pins." />;
  return <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-3xl" />;
}
