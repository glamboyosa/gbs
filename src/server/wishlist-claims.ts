import { Redis } from "@upstash/redis";

type Store = Pick<Redis, "hgetall" | "hget" | "hset" | "hsetnx" | "hdel" | "incr" | "expire">;
type StoredClaim = { name: string; token: string; claimedAt: string };

export type ClaimResult = { status: "claimed"; token: string } | { status: "taken" | "invalid" | "unconfigured" };
export type UnclaimResult = "unclaimed" | "forbidden" | "unconfigured";

const claimsKey = "wishlist_claims_v1";
// Osa tests the live flow under these names. Those claims are kept apart so the item stays open to everyone else.
const testClaimsKey = "wishlist_test_claims_v1";
const testNames = new Set(["timothy", "osa"]);
const maxNameLength = 40;
const rateLimitWindowSeconds = 60 * 60;
const rateLimitMax = 20;

export const configuredStore = (): Store | null => {
  const url = import.meta.env?.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env?.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
};

/**
 * Lists who claimed what, keyed by wishlist item id. Undo tokens never leave the server.
 *
 * @param {Store | null} store - Redis, or null when it is not configured.
 * @returns {Promise<Record<string, string>>} Claimer names by item id.
 */
export const getClaims = async (store: Store | null = configuredStore()): Promise<Record<string, string>> => {
  if (!store) return {};
  // A Redis outage hides claims rather than taking the page down; claiming still reports a taken item.
  const claims = await store.hgetall<Record<string, StoredClaim>>(claimsKey).catch(() => null);
  return Object.fromEntries(Object.entries(claims ?? {}).map(([itemId, claim]) => [itemId, claim.name]));
};

/**
 * Claims an item for a named person. The first claim wins, so two people can't buy the same gift.
 *
 * @param {object} input - The claim request.
 * @param {unknown} input.itemId - The wishlist item id from the request body.
 * @param {unknown} input.name - The claimer's name from the request body.
 * @param {ReadonlySet<string>} input.itemIds - Every real wishlist item id.
 * @param {Store | null} store - Redis, or null when it is not configured.
 * @returns {Promise<ClaimResult>} The outcome, with an undo token on success.
 */
export const claimItem = async (
  { itemId, name, itemIds }: { itemId: unknown; name: unknown; itemIds: ReadonlySet<string> },
  store: Store | null = configuredStore(),
): Promise<ClaimResult> => {
  if (typeof itemId !== "string" || !itemIds.has(itemId) || typeof name !== "string") return { status: "invalid" };
  const cleanName = name.replace(/\s+/g, " ").trim();
  if (!cleanName || cleanName.length > maxNameLength) return { status: "invalid" };
  if (!store) return { status: "unconfigured" };

  const token = crypto.randomUUID();
  const claim: StoredClaim = { name: cleanName, token, claimedAt: new Date().toISOString() };
  // Test claims overwrite each other so a retest from another device never reports the item as taken.
  if (testNames.has(cleanName.toLowerCase())) {
    await store.hset(testClaimsKey, { [itemId]: claim });
    return { status: "claimed", token };
  }
  const stored = await store.hsetnx(claimsKey, itemId, claim);
  return stored ? { status: "claimed", token } : { status: "taken" };
};

/**
 * Removes a claim, but only for the person holding its undo token.
 *
 * @param {object} input - The unclaim request.
 * @param {unknown} input.itemId - The wishlist item id from the request body.
 * @param {unknown} input.token - The undo token returned when the item was claimed.
 * @param {Store | null} store - Redis, or null when it is not configured.
 * @returns {Promise<UnclaimResult>} The outcome.
 */
export const unclaimItem = async (
  { itemId, token }: { itemId: unknown; token: unknown },
  store: Store | null = configuredStore(),
): Promise<UnclaimResult> => {
  if (!store) return "unconfigured";
  if (typeof itemId !== "string" || typeof token !== "string") return "forbidden";
  for (const key of [claimsKey, testClaimsKey]) {
    const claim = await store.hget<StoredClaim>(key, itemId);
    if (claim?.token === token) {
      await store.hdel(key, itemId);
      return "unclaimed";
    }
  }
  return "forbidden";
};

/**
 * Counts a claim or unclaim request against the sender's hourly allowance, so one person can't flood the list.
 *
 * @param {string} clientId - The sender's IP address.
 * @param {Store | null} store - Redis, or null when it is not configured.
 * @param {Date} now - The current time.
 * @returns {Promise<boolean>} Whether the sender is over the limit.
 */
export const isRateLimited = async (clientId: string, store: Store | null = configuredStore(), now = new Date()): Promise<boolean> => {
  if (!store) return false;
  const window = Math.floor(now.getTime() / 1000 / rateLimitWindowSeconds);
  const key = `wishlist_rate_v1:${clientId}:${window}`;
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, rateLimitWindowSeconds);
  return count > rateLimitMax;
};
