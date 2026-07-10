// Shared constants for RescueRoute.
// DEFAULT_MAP_CENTER is the fallback coordinate used when a report has no
// resolvable location — never (0,0), which would drop a pin in the Gulf of Guinea.

export const DEFAULT_MAP_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_LAT ?? 40.7128),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_MAP_LNG ?? -74.006),
} as const;

export const DEFAULT_ZOOM = 12;

import type { StyleSpecification } from 'maplibre-gl';

// Free OpenStreetMap raster tiles served by the OSM community. No API key
// required. Usage policy: https://operations.osmfoundation.org/policies/tiles/
// — heavy/scraping use is not allowed; for production-scale traffic, swap in a
// hosted tile provider (Stadia Maps, MapTiler, etc.) or self-host a tile server.
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// In-memory rate-limit config (hackathon stand-in; Upstash Redis is the
// production recommendation for distributed rate limiting).
export const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60_000, // 10 requests per minute per IP
} as const;
