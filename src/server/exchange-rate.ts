import { Redis } from "@upstash/redis";

type Store = Pick<Redis, "get" | "set">;
type CachedRate = { rate: number; fetchedAt: number; checkedAt: number };

const rateKey = "usd_ngn_rate_v2";
const rateEndpoint = "https://open.er-api.com/v6/latest/USD";
const hour = 60 * 60 * 1000;
// The API updates once a day, so a few hours of staleness is fine.
const refreshAfterMs = 6 * hour;
// After a failed refresh, wait before trying again so an outage doesn't slow every page view.
const retryAfterMs = hour;
// The naira moves too much to show a rate older than this.
const maxAgeMs = 7 * 24 * hour;

const configuredStore = (): Store | null => {
  const url = import.meta.env?.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env?.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
};

const isRate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

const readCache = async (store: Store | null): Promise<CachedRate | null> => {
  const value = await store?.get<Partial<CachedRate>>(rateKey).catch(() => null);
  return value && isRate(value.rate) && Number.isFinite(value.fetchedAt) && Number.isFinite(value.checkedAt) ? value as CachedRate : null;
};

/**
 * Returns naira per US dollar. The rate is cached for six hours, a failed refresh is retried after an hour,
 * and a rate older than a week is dropped, so the page hides naira prices rather than showing a wrong one.
 *
 * @param {object} options - Overrides for tests.
 * @param {Store | null} options.store - Redis, or null when it is not configured.
 * @param {typeof fetch} options.fetcher - The fetch implementation.
 * @param {Date} options.now - The current time.
 * @returns {Promise<number | null>} The rate, or null when none is recent enough.
 */
export const getUsdToNgnRate = async ({
  store = configuredStore(),
  fetcher = fetch,
  now = new Date(),
}: { store?: Store | null; fetcher?: typeof fetch; now?: Date } = {}): Promise<number | null> => {
  const time = now.getTime();
  const cached = await readCache(store);
  const usable = cached && time - cached.fetchedAt < maxAgeMs ? cached.rate : null;
  if (cached && (time - cached.fetchedAt < refreshAfterMs || time - cached.checkedAt < retryAfterMs)) return usable;

  const rate = await fetcher(rateEndpoint, { signal: AbortSignal.timeout(2000) })
    .then(async (response) => (response.ok ? (await response.json() as { rates?: { NGN?: unknown } }).rates?.NGN : null))
    .catch(() => null);

  if (isRate(rate)) {
    await store?.set(rateKey, { rate, fetchedAt: time, checkedAt: time }).catch(() => null);
    return rate;
  }
  if (cached) await store?.set(rateKey, { ...cached, checkedAt: time }).catch(() => null);
  return usable;
};
