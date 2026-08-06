// ============================================================================
// MapsMock — Digital Twin Google Maps Platform
// ----------------------------------------------------------------------------
// Returns deterministic but realistic Brazilian coordinates. The National
// Simulator seeds this with the city database so distances are plausible.
// ============================================================================

import type {
  IMapsAdapter,
  GeoPoint,
  PlaceResult,
  NearbyQuery,
  DistanceMatrixEntry,
} from '../interfaces';
import { mulberry32, seedFromString, uniform, gaussian } from './_stats';

interface KnownCity {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

// A small built-in catalogue of Brazilian tourist cities.
const KNOWN_CITIES: KnownCity[] = [
  { name: 'Praia Grande', state: 'SP', lat: -24.0058, lng: -46.4028 },
  { name: 'Gramado', state: 'RS', lat: -29.3781, lng: -50.8702 },
  { name: 'Bonito', state: 'MS', lat: -21.1265, lng: -56.4850 },
  { name: 'Fernando de Noronha', state: 'PE', lat: -3.8511, lng: -32.4237 },
  { name: 'Florianópolis', state: 'SC', lat: -27.5949, lng: -48.5482 },
  { name: 'Campos do Jordão', state: 'SP', lat: -22.7297, lng: -45.5914 },
  { name: 'Jericoacoara', state: 'CE', lat: -2.7939, lng: -40.5047 },
  { name: 'Paraty', state: 'RJ', lat: -23.2203, lng: -44.7153 },
  { name: 'Arraial d\'Ajuda', state: 'BA', lat: -16.4867, lng: -39.0664 },
  { name: 'Búzios', state: 'RJ', lat: -22.7469, lng: -41.8822 },
  { name: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333 },
  { name: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729 },
  { name: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5014 },
  { name: 'Recife', state: 'PE', lat: -8.0476, lng: -34.8770 },
  { name: 'Fortaleza', state: 'CE', lat: -3.7319, lng: -38.5267 },
  { name: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177 },
  { name: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733 },
  { name: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345 },
  { name: 'Manaus', state: 'AM', lat: -3.1190, lng: -60.0217 },
  { name: 'Goiânia', state: 'GO', lat: -16.6869, lng: -49.2648 },
];

const PLACE_TYPES = ['tourist_attraction', 'restaurant', 'beach', 'hotel', 'shopping_mall', 'park'];

class MapsMock implements IMapsAdapter {
  async geocode(address: string): Promise<GeoPoint | undefined> {
    const seed = seedFromString(address);
    const rng = mulberry32(seed);
    // Try to find a known city in the address.
    const known = KNOWN_CITIES.find((c) => address.toLowerCase().includes(c.name.toLowerCase()));
    if (known) {
      return {
        lat: known.lat + gaussian(rng, 0, 0.01),
        lng: known.lng + gaussian(rng, 0, 0.01),
      };
    }
    // Otherwise, a random point in Brazil.
    return {
      lat: uniform(rng, -33.0, 5.0),
      lng: uniform(rng, -73.0, -34.0),
    };
  }

  async reverseGeocode(point: GeoPoint): Promise<{ address: string; city?: string; state?: string } | undefined> {
    // Find nearest known city.
    let nearest: KnownCity | undefined;
    let minDist = Infinity;
    for (const c of KNOWN_CITIES) {
      const dist = Math.hypot(c.lat - point.lat, c.lng - point.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = c;
      }
    }
    if (!nearest) return undefined;
    return {
      address: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`,
      city: nearest.name,
      state: nearest.state,
    };
  }

  async searchPlaces(query: string, opts?: { location?: GeoPoint; limit?: number }): Promise<PlaceResult[]> {
    const seed = seedFromString(query + JSON.stringify(opts?.location ?? {}));
    const rng = mulberry32(seed);
    const count = opts?.limit ?? 5;
    const center = opts?.location ?? { lat: -23.5505, lng: -46.6333 };
    const out: PlaceResult[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        placeId: `place_${i}_${Math.floor(rng() * 1e9)}`,
        name: `${query} ${i + 1}`,
        address: `Rua ${Math.floor(rng() * 9999)}, Centro`,
        location: {
          lat: center.lat + gaussian(rng, 0, 0.02),
          lng: center.lng + gaussian(rng, 0, 0.02),
        },
        types: [PLACE_TYPES[Math.floor(rng() * PLACE_TYPES.length)]],
        rating: Number(uniform(rng, 3.5, 5.0).toFixed(1)),
        userRatingsTotal: Math.floor(uniform(rng, 10, 5000)),
      });
    }
    return out;
  }

  async nearbySearch(query: NearbyQuery): Promise<PlaceResult[]> {
    return this.searchPlaces(query.keyword ?? query.type ?? 'nearby', {
      location: query.location,
      limit: query.limit ?? 10,
    });
  }

  async distanceMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<DistanceMatrixEntry[][]> {
    const out: DistanceMatrixEntry[][] = [];
    for (const o of origins) {
      const row: DistanceMatrixEntry[] = [];
      for (const d of destinations) {
        // Haversine.
        const R = 6371000;
        const toRad = (x: number) => (x * Math.PI) / 180;
        const dLat = toRad(d.lat - o.lat);
        const dLng = toRad(d.lng - o.lng);
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(o.lat)) * Math.cos(toRad(d.lat)) * Math.sin(dLng / 2) ** 2;
        const distanceMeters = Math.floor(2 * R * Math.asin(Math.sqrt(a)));
        // Assume avg speed 30 km/h in cities, 60 km/h on highways.
        const speedMs = distanceMeters > 50_000 ? 60 / 3.6 : 30 / 3.6;
        const durationSeconds = Math.floor(distanceMeters / speedMs);
        row.push({ origin: o, destination: d, distanceMeters, durationSeconds });
      }
      out.push(row);
    }
    return out;
  }

  isDigitalTwin(): boolean {
    return true;
  }
}

export const mapsMock = new MapsMock();
