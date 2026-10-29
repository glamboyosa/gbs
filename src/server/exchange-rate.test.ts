import assert from "node:assert/strict";
import test from "node:test";

import { getUsdToNgnRate } from "./exchange-rate.ts";

const hour = 60 * 60 * 1000;
const now = new Date("2026-11-01T12:00:00Z");
const at = (offsetHours: number) => new Date(now.getTime() + offsetHours * hour);

const makeStore = () => {
  const values = new Map<string, unknown>();
  return {
    values,
    get: async <T>(key: string) => (values.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown) => {
      values.set(key, value);
      return "OK" as const;
    },
  };
};

const countingFetcher = (response: () => Promise<Response>) => {
  const fetcher = Object.assign(async () => {
    fetcher.calls += 1;
    return response();
  }, { calls: 0 });
  return fetcher;
};

const rateResponse = (rate: unknown) => async () => new Response(JSON.stringify({ result: "success", rates: { NGN: rate } }));
const offline = async (): Promise<Response> => { throw new Error("offline"); };

test("fetches the rate once and reuses it for six hours", async () => {
  const store = makeStore();
  const fetcher = countingFetcher(rateResponse(1346.2));

  assert.equal(await getUsdToNgnRate({ store, fetcher, now }), 1346.2);
  assert.equal(await getUsdToNgnRate({ store, fetcher, now: at(5.9) }), 1346.2);
  assert.equal(fetcher.calls, 1);

  await getUsdToNgnRate({ store, fetcher, now: at(6.1) });
  assert.equal(fetcher.calls, 2);
});

test("an outage keeps the last rate and waits an hour before retrying", async () => {
  const store = makeStore();
  await getUsdToNgnRate({ store, fetcher: rateResponse(1300), now });
  const fetcher = countingFetcher(offline);

  assert.equal(await getUsdToNgnRate({ store, fetcher, now: at(7) }), 1300);
  assert.equal(await getUsdToNgnRate({ store, fetcher, now: at(7.5) }), 1300);
  assert.equal(fetcher.calls, 1);

  assert.equal(await getUsdToNgnRate({ store, fetcher, now: at(8.1) }), 1300);
  assert.equal(fetcher.calls, 2);
});

test("ignores bad API responses and bad cached values", async () => {
  const store = makeStore();
  await getUsdToNgnRate({ store, fetcher: rateResponse(1300), now });
  assert.equal(await getUsdToNgnRate({ store, fetcher: rateResponse("1346"), now: at(7) }), 1300);
  assert.equal(await getUsdToNgnRate({ store, fetcher: rateResponse(-5), now: at(9) }), 1300);

  store.values.set("usd_ngn_rate_v2", { rate: "oops", fetchedAt: now.getTime(), checkedAt: now.getTime() });
  assert.equal(await getUsdToNgnRate({ store, fetcher: offline, now }), null);
});

test("stops showing a rate that is more than a week old", async () => {
  const store = makeStore();
  await getUsdToNgnRate({ store, fetcher: rateResponse(1300), now });

  assert.equal(await getUsdToNgnRate({ store, fetcher: offline, now: at(24 * 6) }), 1300);
  assert.equal(await getUsdToNgnRate({ store, fetcher: offline, now: at(24 * 8) }), null);
});

test("works without Redis", async () => {
  assert.equal(await getUsdToNgnRate({ store: null, fetcher: rateResponse(1346.2), now }), 1346.2);
  assert.equal(await getUsdToNgnRate({ store: null, fetcher: offline, now }), null);
});
