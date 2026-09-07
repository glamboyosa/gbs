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
