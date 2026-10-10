import assert from "node:assert/strict";
import test from "node:test";

import { parseDiaryEntries } from "./letterboxd-feed.ts";

test("parses ordered Letterboxd diary entries", () => {
  const feed = `
    <rss xmlns:letterboxd="https://letterboxd.com">
      <channel>
        <item>
          <link>https://letterboxd.com/glamboyosa/film/digger-2026/</link>
          <letterboxd:watchedDate>2026-10-10</letterboxd:watchedDate>
          <letterboxd:filmTitle>Digger</letterboxd:filmTitle>
        </item>
        <item>
          <link>https://letterboxd.com/glamboyosa/film/dungeons-and-dragons-honor-among-thieves/</link>
          <letterboxd:watchedDate>2026-10-09</letterboxd:watchedDate>
          <letterboxd:filmTitle>Dungeons &amp; Dragons: Honor Among Thieves</letterboxd:filmTitle>
        </item>
      </channel>
    </rss>
  `;

  assert.deepEqual(parseDiaryEntries(feed), [
    {
      key: "https://letterboxd.com/glamboyosa/film/digger-2026/|2026-10-10",
      watchedYear: 2026,
      title: "Digger",
      url: "https://letterboxd.com/glamboyosa/film/digger-2026/",
    },
    {
      key: "https://letterboxd.com/glamboyosa/film/dungeons-and-dragons-honor-among-thieves/|2026-10-09",
      watchedYear: 2026,
      title: "Dungeons & Dragons: Honor Among Thieves",
      url: "https://letterboxd.com/glamboyosa/film/dungeons-and-dragons-honor-among-thieves/",
    },
  ]);
});

test("ignores RSS items without a watched date, title, or link", () => {
  const feed = `
    <item><link>https://letterboxd.com/glamboyosa/film/no-date/</link><letterboxd:filmTitle>No Date</letterboxd:filmTitle></item>
    <item><letterboxd:watchedDate>2026-10-10</letterboxd:watchedDate><letterboxd:filmTitle>No Link</letterboxd:filmTitle></item>
    <item><link>https://letterboxd.com/glamboyosa/film/no-title/</link><letterboxd:watchedDate>2026-10-10</letterboxd:watchedDate></item>
  `;

  assert.deepEqual(parseDiaryEntries(feed), []);
});

test("ignores entries with invalid dates or XML entities", () => {
  const feed = `
    <item>
      <link>https://letterboxd.com/glamboyosa/film/valid/</link>
      <letterboxd:watchedDate>2026-10-10</letterboxd:watchedDate>
      <letterboxd:filmTitle>Valid Film</letterboxd:filmTitle>
    </item>
    <item>
      <link>https://letterboxd.com/glamboyosa/film/invalid-date/</link>
      <letterboxd:watchedDate>2026-99-99</letterboxd:watchedDate>
      <letterboxd:filmTitle>Invalid Date</letterboxd:filmTitle>
    </item>
    <item>
      <link>https://letterboxd.com/glamboyosa/film/invalid-title/</link>
      <letterboxd:watchedDate>2026-10-09</letterboxd:watchedDate>
      <letterboxd:filmTitle>Invalid &#999999999; Title</letterboxd:filmTitle>
    </item>
  `;

  assert.deepEqual(parseDiaryEntries(feed), [
    {
      key: "https://letterboxd.com/glamboyosa/film/valid/|2026-10-10",
      watchedYear: 2026,
      title: "Valid Film",
      url: "https://letterboxd.com/glamboyosa/film/valid/",
    },
  ]);
});

test("decodes XML entities exactly once", () => {
  const feed = `
    <item>
      <link>https://letterboxd.com/glamboyosa/film/fish-and-chips/</link>
      <letterboxd:watchedDate>2026-10-10</letterboxd:watchedDate>
      <letterboxd:filmTitle>Fish &amp;amp; Chips</letterboxd:filmTitle>
    </item>
  `;

  assert.equal(parseDiaryEntries(feed)[0]?.title, "Fish &amp; Chips");
});
