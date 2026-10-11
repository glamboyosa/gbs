import assert from "node:assert/strict";
import test from "node:test";

import { parseLatestPlayedGame } from "./playstation-data.ts";

test("returns the most recently played valid game", () => {
  const result = parseLatestPlayedGame({
    data: {
      gameLibraryTitlesRetrieve: {
        games: [
          {
            name: "Older Game",
            image: { url: "https://example.com/older.png" },
            lastPlayedDateTime: "2026-10-08T08:00:00.000Z",
            platform: "PS5",
          },
          {
            name: "Newest Game",
            image: { url: "https://example.com/newest.png" },
            lastPlayedDateTime: "2026-10-10T20:30:00.000Z",
            platform: "ps4",
          },
        ],
      },
    },
  });

  assert.deepEqual(result, {
    title: "Newest Game",
    imageUrl: "https://example.com/newest.png",
    lastPlayedAt: "2026-10-10T20:30:00.000Z",
    platform: "PS4",
  });
});

test("ignores malformed games", () => {
  const result = parseLatestPlayedGame({
    data: {
      gameLibraryTitlesRetrieve: {
        games: [
          {
            name: "Missing Date",
            image: { url: "https://example.com/missing-date.png" },
            platform: "PS5",
          },
          {
            name: "Invalid Date",
            image: { url: "https://example.com/invalid-date.png" },
            lastPlayedDateTime: "not-a-date",
            platform: "PS5",
          },
        ],
      },
    },
  });

  assert.equal(result, null);
});

test("accepts a missing image without inventing one", () => {
  const result = parseLatestPlayedGame({
    data: {
      gameLibraryTitlesRetrieve: {
        games: [
          {
            name: "No Cover",
            image: {},
            lastPlayedDateTime: "2026-10-10T20:30:00.000Z",
            platform: "UNKNOWN",
          },
        ],
      },
    },
  });

  assert.deepEqual(result, {
    title: "No Cover",
    imageUrl: null,
    lastPlayedAt: "2026-10-10T20:30:00.000Z",
    platform: null,
  });
});
