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
  swig: feed("swig", "d".repeat(40), "Add queue metrics", "2026-10-15T14:30:00Z"),
  ore: feed("ore", "e".repeat(40), "Add stream recovery", "2026-10-15T14:40:00Z"),
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
  assert.equal(feedCalls, 10);
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
  assert.equal(await store.get("project_updates_checked_v2"), null);
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

for (const repo of ["swig", "ore"] as const) {
  test(`daily refresh can publish a ${repo} commit`, async () => {
    const store = makeStore();
    const sha = repo === "swig" ? "d".repeat(40) : "e".repeat(40);
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
      assert.match(String(init?.body), new RegExp(sha));
      return Response.json({ choices: [{ message: { content: JSON.stringify({ sha }) } }] });
    };

    assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" }), "published");
    const update = (await getProjectUpdates(store))[0];
    assert.equal(update.project, repo === "swig" ? "Swig" : "Ore");
    assert.equal(update.url, `https://github.com/glamboyosa/${repo}/commit/${sha}`);
    assert.equal(getHomepageUpdate([update], new Date("2026-10-15T22:00:00Z"))?.url, update.url);
  });
}

test("new repositories are checked even when the previous feed cursor is newer", async () => {
  const store = makeStore();
  await store.set("project_updates_checked_v1", "2026-10-15T15:00:00Z");
  const sha = "d".repeat(40);
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(fixture[url.split("/")[4] as keyof typeof fixture]);
    const request = JSON.parse(String(init?.body));
    const candidates = JSON.parse(request.messages[1].content) as { project: string }[];
    assert.deepEqual(candidates.map((candidate) => candidate.project), ["Ore", "Swig"]);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha }) } }] });
  };

  assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-15T22:00:00Z"), openRouterKey: "test-key" }), "published");
  assert.equal((await getProjectUpdates(store))[0].project, "Swig");
});

test("long Atom subjects become a concise headline while keeping the selected commit", async () => {
  const store = makeStore();
  const sha = "c".repeat(40);
  const fullTitle = "Spell out how agent checks are enforced and list more guarantees on the landing page";
  const atom = feed("katalepsis", sha, "Spell out how agent checks are enforced and list more guarantees on t…", "2026-10-19T09:20:35Z")
    .replace("</entry>", `<content type="html">&lt;pre&gt;${fullTitle}&lt;/pre&gt;</content></entry>`);
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith(".atom")) return new Response(url.includes("/katalepsis/") ? atom : "<feed></feed>");
    const request = JSON.parse(String(init?.body));
    assert.match(request.messages[1].content, new RegExp(fullTitle));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha, headline: "Explain agent checks and site guarantees" }) } }] });
  };

  assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-19T22:00:00Z"), openRouterKey: "test-key" }), "published");
  const history = await getProjectUpdates(store);
  assert.equal(history[0].title, "Explain agent checks and site guarantees");
  assert.equal(getHomepageUpdate(history, new Date("2026-10-19T22:00:00Z"))?.title, "Explain agent checks and site guarantees");
  assert.equal(history[0].url, `https://github.com/glamboyosa/katalepsis/commit/${sha}`);
});

test("already-saved Atom ellipses display as complete headlines", async () => {
  const store = makeStore();
  await store.set("project_updates_checked_v2", "2026-10-19T09:30:00Z");
  await store.set("project_updates_v1", [{
    date: "2026-10-19",
    dateLabel: "19 Oct 2026",
    project: "Katalepsis",
    reference: "8f02425",
    title: "Spell out how agent checks are enforced and list more guarantees on t…",
    url: "https://github.com/glamboyosa/katalepsis/commit/8f02425",
    linkText: "Commit",
  }]);

  const history = await getProjectUpdates(store, { now: new Date("2026-10-19T09:45:00Z") });
  assert.equal(history[0].title, "Spell out how agent checks are enforced");
  assert.equal(getHomepageUpdate(history, new Date("2026-10-19T09:45:00Z"))?.title, "Spell out how agent checks are enforced");
});

test("cached ellipses without a complete clause use a safe fallback", async () => {
  const store = makeStore();
  await store.set("project_updates_checked_v2", "2026-10-19T09:30:00Z");
  await store.set("project_updates_v1", [{
    date: "2026-10-19",
    dateLabel: "19 Oct 2026",
    project: "Katalepsis",
    reference: "8f02425",
    title: "Add a setting that lets users control browser checks across all pro…",
    url: "https://github.com/glamboyosa/katalepsis/commit/8f02425",
    linkText: "Commit",
  }]);

  const history = await getProjectUpdates(store, { now: new Date("2026-10-19T09:45:00Z") });
  assert.equal(history[0].title, "Katalepsis update");
});

test("a long full Atom subject remains eligible for summarization", async () => {
  const store = makeStore();
  const sha = "e".repeat(40);
  const fullTitle = `Explain how agent checks are enforced and ${"list the visible guarantees ".repeat(9)}`.trim();
  const atom = feed("katalepsis", sha, "Explain how agent checks are enforced and list the visible guara…", "2026-10-19T09:20:35Z")
    .replace("</entry>", `<content type="html">&lt;pre&gt;${fullTitle}&lt;/pre&gt;</content></entry>`);
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input).endsWith(".atom")) return new Response(String(input).includes("/katalepsis/") ? atom : "<feed></feed>");
    assert.match(String(init?.body), /list the visible guarantees/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ sha, headline: "Explain agent checks and visible guarantees" }) } }] });
  };

  assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-19T22:00:00Z"), openRouterKey: "test-key" }), "published");
  assert.equal((await getProjectUpdates(store))[0].title, "Explain agent checks and visible guarantees");
});

test("invalid AI headlines fall back to a complete clause", async () => {
  const store = makeStore();
  const sha = "d".repeat(40);
  const fetcher: typeof fetch = async (input) => String(input).endsWith(".atom")
    ? new Response(String(input).includes("/katalepsis/")
      ? feed("katalepsis", sha, "Spell out how agent checks are enforced and list more guarantees on t…", "2026-10-19T09:20:35Z")
      : "<feed></feed>")
    : Response.json({ choices: [{ message: { content: JSON.stringify({ sha, headline: "t…" }) } }] });

  assert.equal(await refreshProjectUpdates({ store, fetcher, now: new Date("2026-10-19T22:00:00Z"), openRouterKey: "test-key" }), "published");
  assert.equal((await getProjectUpdates(store))[0].title, "Spell out how agent checks are enforced");
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
  assert.equal(await store.get("project_updates_checked_v2"), null);
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
