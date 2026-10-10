import { Redis } from "@upstash/redis";

import { parseDiaryEntries } from "./letterboxd-feed";

const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL,
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
});

const feedUrl = "https://letterboxd.com/glamboyosa/rss/";
const stateKey = "letterboxd_year_count_v2";
const initialState: LetterboxdCountState = {
  year: 2026,
  count: 114,
  latestEntryKey: "https://letterboxd.com/glamboyosa/film/resident-evil-2026/|2026-09-18",
};

interface LetterboxdCountState {
  year: number;
  count: number;
  latestEntryKey: string;
}

export interface LetterboxdSummary {
  yearCount: number;
  latestFilm: {
    title: string;
    url: string;
  } | null;
}

/**
 * Returns the current year's diary count and latest film from Letterboxd's public RSS feed.
 */
export const getLetterboxdSummary = async (): Promise<LetterboxdSummary> => {
  const response = await fetch(feedUrl, {
    cache: "no-store",
    headers: { Accept: "application/rss+xml" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Letterboxd RSS request failed with ${response.status}`);

  const currentYear = new Date().getFullYear();
  const entries = parseDiaryEntries(await response.text()).filter((entry) => entry.watchedYear === currentYear);
  if (!entries.length) return { yearCount: 0, latestFilm: null };

  const latestFilm = { title: entries[0].title, url: entries[0].url };

  const stored = await redis.get<LetterboxdCountState>(stateKey);
  const state = stored?.year === currentYear ? stored : currentYear === initialState.year ? initialState : null;
  if (!state) {
    const nextState = { year: currentYear, count: entries.length, latestEntryKey: entries[0].key };
    await redis.set(stateKey, nextState);
    return { yearCount: nextState.count, latestFilm };
  }

  const previousEntryIndex = entries.findIndex((entry) => entry.key === state.latestEntryKey);
  if (previousEntryIndex <= 0) return { yearCount: state.count, latestFilm };

  const nextState = {
    year: currentYear,
    count: state.count + previousEntryIndex,
    latestEntryKey: entries[0].key,
  };
  await redis.set(stateKey, nextState);
  return { yearCount: nextState.count, latestFilm };
};
