export type RotationCategory = "tops" | "bottoms" | "shoes" | "accessories" | "scent";

export type RotationItem = {
  name: string;
  brand: string;
  category: RotationCategory;
  image: string;
  href: string;
  note: string;
  price?: string;
  priceLabel?: string;
  featured?: boolean;
};

export type SpotifyTrackSummary = {
  isPlaying: boolean;
  title: string;
  artist: string;
  albumImageUrl: string;
  playedAt?: string;
};

export type StravaActivityTotal = {
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
};

export type StravaActivityStats = {
  recent_run_totals: StravaActivityTotal;
  recent_ride_totals: StravaActivityTotal;
  recent_swim_totals: StravaActivityTotal;
};

export type StravaToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export type StravaSummary = {
  athleteId: string;
  activityCount: number;
  distanceKilometers: number;
  movingTimeSeconds: number;
  elevationMeters: number;
};
