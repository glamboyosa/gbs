import type { PlayStationSummary } from "@/types";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const normalizePlatform = (value: unknown): PlayStationSummary["platform"] => {
  if (value === "PS5") return "PS5";
  if (value === "ps4" || value === "PS4") return "PS4";
  return null;
};

/**
 * Validates the PlayStation response and selects the game with the newest play date.
 */
export const parseLatestPlayedGame = (payload: unknown): PlayStationSummary | null => {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const retrieve = payload.data.gameLibraryTitlesRetrieve;
  if (!isRecord(retrieve) || !Array.isArray(retrieve.games)) return null;

  const games = retrieve.games.flatMap((game): PlayStationSummary[] => {
    if (!isRecord(game) || typeof game.name !== "string" || typeof game.lastPlayedDateTime !== "string") return [];
    const timestamp = Date.parse(game.lastPlayedDateTime);
    if (!Number.isFinite(timestamp)) return [];
    const imageUrl = isRecord(game.image) && typeof game.image.url === "string" ? game.image.url : null;
    return [{
      title: game.name,
      imageUrl,
      lastPlayedAt: new Date(timestamp).toISOString(),
      platform: normalizePlatform(game.platform),
    }];
  });

  return games.sort((left, right) => Date.parse(right.lastPlayedAt) - Date.parse(left.lastPlayedAt))[0] ?? null;
};
