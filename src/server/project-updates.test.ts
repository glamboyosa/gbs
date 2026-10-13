import assert from "node:assert/strict";
import test from "node:test";

import { getHomepageUpdate, getProjectUpdates, refreshProjectUpdates } from "./project-updates.ts";

const feed = (repo: string, sha: string, title: string, updated: string) => `
  <feed><entry>
    <id>tag:github.com,2008:Grit::Commit/${sha}</id>
    <link type="text/html" rel="alternate" href="https://github.com/glamboyosa/${repo}/commit/${sha}"/>
    <title>${title}</title><updated>${updated}</updated>
  </entry></feed>`;

const fixture = {
  docket: feed("docket", "a".repeat(40), "feat: Add document review", "2026-10-15T12:00:00Z"),
  conclave: feed("conclave", "b".repeat(40), "Update dependencies", "2026-10-15T13:00:00Z"),
  katalepsis: feed("katalepsis", "c".repeat(40), "&lt;Improve&gt; browser checks", "2026-10-15T14:00:00Z"),
};

const makeStore = () => {
  const values = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => (values.get(key) as T | undefined) ?? null,
    set: async (key: string, value: unknown, options?: { nx?: boolean }) => {
      if (options?.nx && values.has(key)) return null;
      values.set(key, value);
      return "OK";
    },
    del: async (key: string) => Number(values.delete(key)),
  };
};

test("first page visit refreshes stale updates and later visits use Redis", async () => {
  const store = makeStore();
  let modelCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    modelCalls += 1;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  const options = { fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" };
  assert.equal((await getProjectUpdates(store, options))[0].title, "Add document review");
  assert.equal((await getProjectUpdates(store, options))[0].title, "Add document review");
  assert.equal(modelCalls, 1);
});

test("a visit after an hour checks GitHub again without reclassifying old commits", async () => {
  const store = makeStore();
  let feedCalls = 0;
  let modelCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) {
      feedCalls += 1;
      return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    }
    modelCalls += 1;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  await getProjectUpdates(store, { fetcher, now: new Date("2026-10-15T15:00:00Z"), openRouterKey: "test-key" });
  await getProjectUpdates(store, { fetcher, now: new Date("2026-10-15T15:30:00Z"), openRouterKey: "test-key" });
  await getProjectUpdates(store, { fetcher, now: new Date("2026-10-15T16:01:00Z"), openRouterKey: "test-key" });
  assert.equal(feedCalls, 6);
  assert.equal(modelCalls, 1);
});

test("concurrent page visits share one refresh", async () => {
  const store = makeStore();
  let modelCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    modelCalls += 1;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  const options = { fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" };
  await Promise.all([getProjectUpdates(store, options), getProjectUpdates(store, options)]);
  assert.equal(modelCalls, 1);
});

test("a failed page refresh keeps the saved updates visible", async () => {
  const store = makeStore();
  const fetcher: typeof fetch = async () => new Response("unavailable", { status: 503 });

  const updates = await getProjectUpdates(store, { fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" });
  assert.equal(updates[0].reference, "v0.4.0");
  assert.equal(await store.get("project_updates_checked_v1"), null);
});

test("a failed page refresh can retry on the next visit", async () => {
  const store = makeStore();
  let fail = true;
  const fetcher: typeof fetch = async (input) => {
    if (fail) return new Response("unavailable", { status: 503 });
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  const options = { fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" };
  assert.equal((await getProjectUpdates(store, options))[0].reference, "v0.4.0");
  fail = false;
  assert.equal((await getProjectUpdates(store, options))[0].title, "Add document review");
});

test("cron and page refreshes share one model request", async () => {
  const store = makeStore();
  let modelCalls = 0;
  let startModel: () => void = () => {};
  let finishModel: () => void = () => {};
  const modelStarted = new Promise<void>((resolve) => { startModel = resolve; });
  const modelFinished = new Promise<void>((resolve) => { finishModel = resolve; });
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    modelCalls += 1;
    startModel();
    await modelFinished;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  const options = { fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" };
  const page = getProjectUpdates(store, options);
  await modelStarted;
  assert.equal(await refreshProjectUpdates({ ...options, store }), "busy");
  finishModel();
  await page;
  assert.equal(modelCalls, 1);
});

test("daily refresh publishes a selected public commit and keeps its source link", async () => {
  const store = makeStore();
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) {
      const repo = url.split("/")[4] as keyof typeof fixture;
      return new Response(fixture[repo], { status: 200 });
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  const result = await refreshProjectUpdates({
    store,
    fetcher,
    now: new Date("2026-10-15T22:00:00Z"),
    openRouterKey: "test-key",
  });

  assert.equal(result, "published");
  const updates = await getProjectUpdates(store);
  assert.equal(updates[0].project, "Docket");
  assert.equal(updates[0].title, "Add document review");
  assert.equal(updates[0].url, `https://github.com/glamboyosa/docket/commit/${"a".repeat(40)}`);
});

test("refresh publishes with the working OpenRouter selection model", async () => {
  const store = makeStore();
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    const request = JSON.parse(String(init?.body));
    const content = request.model === "openai/gpt-4.1-mini" ? JSON.stringify({ sha: "a".repeat(40) }) : "{}";
    return Response.json({ choices: [{ message: { content } }] });
  };

  const result = await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" });
  assert.equal(result, "published");
  assert.equal((await getProjectUpdates(store))[0].title, "Add document review");
});

test("invalid OpenRouter choice falls back to OpenAI without publishing an invented commit", async () => {
  const store = makeStore();
  const used: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    used.push(url);
    const sha = url.includes("openrouter") ? "not-in-feed" : "c".repeat(40);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha }) } }] });
  };

  const result = await refreshProjectUpdates({
    store,
    fetcher,
    now: new Date("2026-10-15T22:00:00Z"),
    openRouterKey: "test-key",
    openAIKey: "test-key",
  });

  assert.equal(result, "published");
  assert.equal(used.length, 2);
  assert.equal((await getProjectUpdates(store))[0].title, "<Improve> browser checks");
});

test("no noteworthy commit leaves the existing update in place", async () => {
  const store = makeStore();
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    return Response.json({ choices: [{ message: { content: '{"sha":null}' } }] });
  };

  assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" }), "unchanged");
  assert.equal((await getProjectUpdates(store))[0].reference, "v0.4.0");
});

test("an invalid repository feed does not advance the daily cursor", async () => {
  const store = makeStore();
  let modelCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("/conclave/")) return new Response("<html>Not an Atom feed</html>");
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    modelCalls += 1;
    return Response.json({ choices: [{ message: { content: '{"sha":null}' } }] });
  };

  await assert.rejects(refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" }));
  assert.equal(modelCalls, 0);
  assert.equal(await store.get("project_updates_checked_v1"), null);
});

test("refresh catches up with commits still in the feed after a missed week", async () => {
  const store = makeStore();
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha: "a".repeat(40) }) } }] });
  };

  assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-25T22:00:00Z"), openRouterKey: "test-key" }), "published");
  assert.equal((await getProjectUpdates(store))[0].project, "Docket");
});

test("homepage stops featuring an update after 14 calendar days while history keeps it", async () => {
  const history = await getProjectUpdates(null);
  const latest = history[0];

  assert.equal(getHomepageUpdate(history, new Date("2026-10-27T23:59:59Z")), latest);
  assert.equal(getHomepageUpdate(history, new Date("2026-10-28T00:00:00Z")), null);
  assert.equal(history[0], latest);
});
