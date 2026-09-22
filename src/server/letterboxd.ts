import { Redis } from "@upstash/redis";

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

interface LetterboxdDiaryEntry {
  key: string;
  watchedYear: number;
}

/**
 * Extracts stable diary entry keys and watched years from Letterboxd's public RSS feed.
 */
const parseDiaryEntries = (feed: string): LetterboxdDiaryEntry[] => {
  return Array.from(feed.matchAll(/<item>([\s\S]*?)<\/item>/g)).flatMap(([, item]) => {
    const link = item.match(/<link>([^<]+)<\/link>/)?.[1];
    const watchedDate = item.match(/<letterboxd:watchedDate>((\d{4})-[^<]+)<\/letterboxd:watchedDate>/);
    return link && watchedDate ? [{ key: `${link}|${watchedDate[1]}`, watchedYear: Number(watchedDate[2]) }] : [];
  });
};

/**
 * Returns the current year's diary count and advances it from new RSS entries.
 */
export const getLetterboxdYearCount = async (): Promise<number> => {
  const response = await fetch(feedUrl, {
    cache: "no-store",
    headers: { Accept: "application/rss+xml" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Letterboxd RSS request failed with ${response.status}`);

  const currentYear = new Date().getFullYear();
  const entries = parseDiaryEntries(await response.text()).filter((entry) => entry.watchedYear === currentYear);
  if (!entries.length) return 0;

  const stored = await redis.get<LetterboxdCountState>(stateKey);
  const state = stored?.year === currentYear ? stored : currentYear === initialState.year ? initialState : null;
  if (!state) {
    const nextState = { year: currentYear, count: entries.length, latestEntryKey: entries[0].key };
    await redis.set(stateKey, nextState);
    return nextState.count;
  }

  const previousEntryIndex = entries.findIndex((entry) => entry.key === state.latestEntryKey);
  if (previousEntryIndex <= 0) return state.count;

  const nextState = {
    year: currentYear,
    count: state.count + previousEntryIndex,
    latestEntryKey: entries[0].key,
  };
  await redis.set(stateKey, nextState);
  return nextState.count;
};
