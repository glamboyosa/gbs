import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import { getValidToken } from "@/lib/utils";
import type { SpotifyTrackSummary } from "@/types";

const fallbackArt = "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36";

/**
 * Gets a short label for the time when Spotify played a track.
 *
 * @param {string | undefined} dateString - The ISO date from Spotify.
 * @returns {string} The short relative time label.
 */
const relativeTime = (dateString?: string) => {
  if (!dateString) return "Recently played";
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Played just now";
  if (seconds < 3600) return `Played ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `Played ${Math.floor(seconds / 3600)}h ago`;
  return `Played ${Math.floor(seconds / 86400)}d ago`;
};

/**
 * Gets the most recent track from Spotify.
 *
 * @param {string} token - The Spotify access token.
 * @returns {Promise<SpotifyTrackSummary | null>} The most recent track when one exists.
 */
const getLastPlayed = async (token: string): Promise<SpotifyTrackSummary | null> => {
  const response = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const item = data.items?.[0];
  if (!item?.track) return null;
  return {
    isPlaying: false,
    title: item.track.name ?? "",
    artist: item.track.artists?.[0]?.name ?? "",
    albumImageUrl: item.track.album?.images?.[0]?.url ?? fallbackArt,
    playedAt: item.played_at,
  };
};

/**
 * Gets the current track or falls back to the most recent track.
 *
 * @param {string | undefined} accessToken - The Spotify access token from the page cookie.
 * @returns {Promise<SpotifyTrackSummary | null>} The available Spotify track.
 */
const getSpotifyTrack = async (accessToken?: string): Promise<SpotifyTrackSummary | null> => {
  const token = accessToken || (await getValidToken());
  if (!token) return null;
  const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 204 || !response.ok) return getLastPlayed(token);
  const data = await response.json();
  if (!data.is_playing) return getLastPlayed(token);
  return {
    isPlaying: true,
    title: data.item?.name ?? "",
    artist: data.item?.artists?.[0]?.name ?? "",
    albumImageUrl: data.item?.album?.images?.[0]?.url ?? fallbackArt,
  };
};

export function NowPlaying({ accessToken }: { accessToken?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: song } = useSWR("spotify-now-playing", () => getSpotifyTrack(accessToken), {
    refreshInterval: 15000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  if (!song) {
    return (
      <div className="flex min-h-12 items-center gap-3 rounded-full bg-[#171616] px-3 pr-5 text-white shadow-sm">
        <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs" aria-hidden="true">♪</span>
        <span className="text-[11px] text-white/65">Spotify is taking a breather</span>
      </div>
    );
  }

  return (
    <motion.button
      layout
      type="button"
      aria-expanded={expanded}
      aria-label={`${song.isPlaying ? "Now playing" : relativeTime(song.playedAt)}: ${song.title} by ${song.artist}`}
      onClick={() => setExpanded((value) => !value)}
      className="group flex min-h-12 max-w-full cursor-pointer items-center gap-3 overflow-hidden border-0 bg-[#171616] p-2 pr-4 text-left text-white shadow-sm"
      style={{ borderRadius: expanded ? 18 : 999 }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      whileTap={{ scale: 0.96 }}
    >
      <motion.img
        layout
        src={song.albumImageUrl || fallbackArt}
        alt=""
        className="size-8 flex-none rounded-[10px] object-cover outline outline-1 -outline-offset-1 outline-white/10"
        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      />

      <AnimatePresence initial={false} mode="popLayout">
        {expanded ? (
          <motion.span
            key="details"
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="min-w-0 py-0.5"
          >
            <span className="block truncate text-[11px] font-medium">{song.title}</span>
            <span className="mt-0.5 block truncate text-[9px] text-white/55">
              {song.artist} · {song.isPlaying ? "Playing now" : relativeTime(song.playedAt)}
            </span>
          </motion.span>
        ) : (
          <motion.span
            key="compact"
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className="flex items-center gap-1"
          >
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className={`block w-[2px] rounded-full bg-[#d8ff52] ${song.isPlaying ? "animate-pulse" : ""}`}
                style={{ height: `${7 + bar * 2}px`, animationDelay: `${bar * 100}ms` }}
              />
            ))}
            <span className="ml-1 text-[10px] text-white/70">{song.isPlaying ? "Live" : "Recent"}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
