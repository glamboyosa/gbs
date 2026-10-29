import assert from "node:assert/strict";
import test from "node:test";

import { claimItem, getClaims, isRateLimited, unclaimItem } from "./wishlist-claims.ts";

const itemIds = new Set(["casio-a168wg-9", "fujifilm-x100vi"]);

const makeStore = () => {
  const hashes = new Map<string, Map<string, unknown>>();
  const counters = new Map<string, number>();
  const hash = (key: string) => hashes.get(key) ?? hashes.set(key, new Map()).get(key)!;
  return {
    hgetall: async <T>(key: string) => (hashes.has(key) ? Object.fromEntries(hash(key)) as T : null),
    hget: async <T>(key: string, field: string) => (hash(key).get(field) as T | undefined) ?? null,
    hsetnx: async (key: string, field: string, value: unknown) => {
      if (hash(key).has(field)) return 0 as const;
      hash(key).set(field, value);
      return 1 as const;
    },
    hdel: async (key: string, ...fields: string[]) => fields.filter((field) => hash(key).delete(field)).length,
    hset: async (key: string, values: Record<string, unknown>) => {
      Object.entries(values).forEach(([field, value]) => hash(key).set(field, value));
      return Object.keys(values).length;
    },
    incr: async (key: string) => {
      counters.set(key, (counters.get(key) ?? 0) + 1);
      return counters.get(key)!;
    },
    expire: async () => 1 as const,
  };
};

test("the first person to claim an item keeps it", async () => {
  const store = makeStore();

  const first = await claimItem({ itemId: "casio-a168wg-9", name: "  Test   Person  ", itemIds }, store);
  const second = await claimItem({ itemId: "casio-a168wg-9", name: "Someone Else", itemIds }, store);

  assert.equal(first.status, "claimed");
  assert.deepEqual(second, { status: "taken" });
  assert.deepEqual(await getClaims(store), { "casio-a168wg-9": "Test Person" });
});

test("claims reject unknown items and empty or long names", async () => {
  const store = makeStore();

  assert.deepEqual(await claimItem({ itemId: "not-on-the-list", name: "Test Person", itemIds }, store), { status: "invalid" });
  assert.deepEqual(await claimItem({ itemId: "fujifilm-x100vi", name: "   ", itemIds }, store), { status: "invalid" });
  assert.deepEqual(await claimItem({ itemId: "fujifilm-x100vi", name: "x".repeat(41), itemIds }, store), { status: "invalid" });
  assert.deepEqual(await claimItem({ itemId: "fujifilm-x100vi", name: 42, itemIds }, store), { status: "invalid" });
  assert.deepEqual(await getClaims(store), {});
});

test("only the claimer's token can undo a claim", async () => {
  const store = makeStore();
  const claim = await claimItem({ itemId: "fujifilm-x100vi", name: "Test Person", itemIds }, store);
  assert.equal(claim.status, "claimed");
  const token = claim.status === "claimed" ? claim.token : "";

  assert.equal(await unclaimItem({ itemId: "fujifilm-x100vi", token: "wrong-token" }, store), "forbidden");
  assert.deepEqual(await getClaims(store), { "fujifilm-x100vi": "Test Person" });

  assert.equal(await unclaimItem({ itemId: "fujifilm-x100vi", token }, store), "unclaimed");
  assert.deepEqual(await getClaims(store), {});
});

test("Osa's test names save a claim that nobody else sees or is blocked by", async () => {
  const store = makeStore();

  const test = await claimItem({ itemId: "casio-a168wg-9", name: "TIMOTHY", itemIds }, store);
  assert.equal(test.status, "claimed");
  assert.equal((await claimItem({ itemId: "fujifilm-x100vi", name: "osa", itemIds }, store)).status, "claimed");
  assert.equal((await claimItem({ itemId: "fujifilm-x100vi", name: "Osa", itemIds }, store)).status, "claimed");
  assert.deepEqual(await getClaims(store), {});

  assert.equal((await claimItem({ itemId: "casio-a168wg-9", name: "Test Person", itemIds }, store)).status, "claimed");
  assert.deepEqual(await getClaims(store), { "casio-a168wg-9": "Test Person" });

  const token = test.status === "claimed" ? test.token : "";
  assert.equal(await unclaimItem({ itemId: "casio-a168wg-9", token }, store), "unclaimed");
  assert.deepEqual(await getClaims(store), { "casio-a168wg-9": "Test Person" });
});

test("each sender gets 20 claim requests an hour", async () => {
  const store = makeStore();
  const now = new Date("2026-11-01T10:15:00Z");

  for (let request = 0; request < 20; request += 1) assert.equal(await isRateLimited("203.0.113.7", store, now), false);
  assert.equal(await isRateLimited("203.0.113.7", store, now), true);
  assert.equal(await isRateLimited("203.0.113.8", store, now), false);
  assert.equal(await isRateLimited("203.0.113.7", store, new Date("2026-11-01T11:00:00Z")), false);
});

test("a Redis outage hides claims instead of failing the page", async () => {
  const store = { ...makeStore(), hgetall: async () => { throw new Error("Redis is down"); } };

  assert.deepEqual(await getClaims(store), {});
});

test("claims need Redis", async () => {
  assert.deepEqual(await getClaims(null), {});
  assert.deepEqual(await claimItem({ itemId: "casio-a168wg-9", name: "Test Person", itemIds }, null), { status: "unconfigured" });
});
