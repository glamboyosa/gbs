export interface LetterboxdDiaryEntry {
  key: string;
  watchedYear: number;
  title: string;
  filmYear?: number;
  url: string;
}

const decodeXmlText = (value: string): string | null => {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  let valid = true;
  const decoded = value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/gi, (entity, code: string) => {
    const normalizedCode = code.toLowerCase();
    if (!normalizedCode.startsWith("#")) return entities[normalizedCode] ?? entity;

    const codePoint = normalizedCode.startsWith("#x")
      ? Number.parseInt(normalizedCode.slice(2), 16)
      : Number.parseInt(normalizedCode.slice(1), 10);
    if (codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      valid = false;
      return entity;
    }
    return String.fromCodePoint(codePoint);
  });

  return valid ? decoded : null;
};

const parseWatchedYear = (value: string): number | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? year
    : null;
};

export const parseDiaryEntries = (feed: string): LetterboxdDiaryEntry[] => {
  return Array.from(feed.matchAll(/<item>([\s\S]*?)<\/item>/g)).flatMap(([, item]) => {
    const url = item.match(/<link>([^<]+)<\/link>/)?.[1];
    const watchedDate = item.match(/<letterboxd:watchedDate>([^<]+)<\/letterboxd:watchedDate>/)?.[1];
    const watchedYear = watchedDate ? parseWatchedYear(watchedDate) : null;
    const encodedTitle = item.match(/<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/)?.[1];
    const title = encodedTitle ? decodeXmlText(encodedTitle) : null;
    const filmYearText = item.match(/<letterboxd:filmYear>(\d{4})<\/letterboxd:filmYear>/)?.[1];
    const filmYear = filmYearText && Number(filmYearText) > 0 ? Number(filmYearText) : undefined;

    return url && watchedDate && watchedYear !== null && title
      ? [{
          key: `${url}|${watchedDate}`,
          watchedYear,
          title,
          ...(filmYear ? { filmYear } : {}),
          url,
        }]
      : [];
  });
};
