// ============================================================================
// IMapsAdapter — contract for geolocation / maps (Google Maps Platform)
// ----------------------------------------------------------------------------
// Used by the Market Intelligence Cortex for geo-targeted campaigns and by
// the National Simulator to place pousadas on realistic coordinates.
// ============================================================================

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  location: GeoPoint;
  types: string[];
  rating?: number;
  userRatingsTotal?: number;
}

export interface NearbyQuery {
  location: GeoPoint;
  radiusMeters: number;
  /** e.g. 'tourist_attraction', 'restaurant', 'beach'. */
  type?: string;
  keyword?: string;
  limit?: number;
}

export interface DistanceMatrixEntry {
  origin: GeoPoint;
  destination: GeoPoint;
  distanceMeters: number;
  durationSeconds: number;
}

export interface IMapsAdapter {
  geocode(address: string): Promise<GeoPoint | undefined>;
  reverseGeocode(point: GeoPoint): Promise<{ address: string; city?: string; state?: string } | undefined>;
  searchPlaces(query: string, opts?: { location?: GeoPoint; limit?: number }): Promise<PlaceResult[]>;
  nearbySearch(query: NearbyQuery): Promise<PlaceResult[]>;
  distanceMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<DistanceMatrixEntry[][]>;
  isDigitalTwin(): boolean;
}
