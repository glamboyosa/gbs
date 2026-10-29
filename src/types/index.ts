import type { ImageMetadata } from "astro";

export type RotationCategory = "tops" | "bottoms" | "shoes" | "accessories" | "scent";

export type RotationItem = {
  name: string;
  brand: string;
  category: RotationCategory;
  image: ImageMetadata;
  href: string;
  note: string;
  price?: string;
  priceLabel?: string;
  featured?: boolean;
};

export type WishlistCategory = "watches" | "accessories" | "cameras" | "tech" | "games" | "clothing" | "shoes" | "scent" | "wellness" | "everyday";

export type WishlistItem = {
  /** Stable key for claims. Changing it drops the claim. */
  id: string;
  name: string;
  brand: string;
  category: WishlistCategory;
  /** Experiences have no product shot. */
  image?: ImageMetadata;
  href?: string;
  note: string;
  /** Lowest expected USD price. Affordability filters use this. */
  price: number;
  /** Upper USD bound when the price is a range. */
  priceTo?: number;
  /** Position in the current priorities list, 1 first. */
  priority?: number;
  dream?: boolean;
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

export type PlayStationToken = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type PlayStationSummary = {
  title: string;
  imageUrl: string | null;
  lastPlayedAt: string;
  platform: "PS4" | "PS5" | null;
};
