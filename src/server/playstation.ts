import { Redis } from "@upstash/redis";
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getRecentlyPlayedGames,
  type AuthTokensResponse,
} from "psn-api";

import type { PlayStationSummary, PlayStationToken } from "@/types";
import { parseLatestPlayedGame } from "./playstation-data";

const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL,
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
});

const tokenKey = "playstation_token_v1";
const tokenRefreshLockKey = "playstation_token_refresh_lock";
const summaryKey = "playstation_latest_game_v1";
const summaryMaxAgeSeconds = 21_600;
const tokenRefreshLockSeconds = 60;
const renewLockScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
  end
  return 0
`;
const releaseLockScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

type StoredSummary = {
  fetchedAt: number;
  game: PlayStationSummary;
};

const storeAuthTokens = async (tokens: AuthTokensResponse): Promise<PlayStationToken> => {
  const now = Math.floor(Date.now() / 1000);
  const storedToken: PlayStationToken = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: now + tokens.expiresIn,
    refreshTokenExpiresAt: now + tokens.refreshTokenExpiresIn,
  };
  await redis.set(tokenKey, storedToken);
  return storedToken;
};

const exchangeNpsso = async (npsso: string): Promise<PlayStationToken> => {
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  return storeAuthTokens(tokens);
};

/**
 * Exchanges an NPSSO without retaining it and stores the resulting renewable tokens in Redis.
 */
export const connectPlayStation = async (npsso: string): Promise<void> => {
  const value = npsso.trim();
  if (value.length < 32) throw new Error("Invalid NPSSO");
  await exchangeNpsso(value);
};

const getPlayStationToken = async (): Promise<PlayStationToken | null> => {
  const now = Math.floor(Date.now() / 1000);
  const storedToken = await redis.get<PlayStationToken>(tokenKey);
  if (storedToken?.accessToken && storedToken.accessTokenExpiresAt > now + 60) return storedToken;

  if (storedToken?.refreshToken && storedToken.refreshTokenExpiresAt > now + 60) {
    const lockId = crypto.randomUUID();
    const lock = await redis.set(tokenRefreshLockKey, lockId, { nx: true, ex: tokenRefreshLockSeconds });
    if (lock) {
      const renewal = setInterval(() => {
        void redis.eval<[string, number], number>(
          renewLockScript,
          [tokenRefreshLockKey],
          [lockId, tokenRefreshLockSeconds],
        ).catch(() => undefined);
      }, 20_000);

      try {
        const refreshed = await exchangeRefreshTokenForAuthTokens(storedToken.refreshToken);
        const stillOwned = await redis.eval<[string, number], number>(
          renewLockScript,
          [tokenRefreshLockKey],
          [lockId, tokenRefreshLockSeconds],
        );
        if (stillOwned !== 1) throw new Error("PlayStation token refresh lock was lost");
        return await storeAuthTokens(refreshed);
      } finally {
        clearInterval(renewal);
        await redis.eval<[string], number>(releaseLockScript, [tokenRefreshLockKey], [lockId]).catch(() => undefined);
      }
    }

    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const latestToken = await redis.get<PlayStationToken>(tokenKey);
      if (latestToken?.accessToken && latestToken.accessToken !== storedToken.accessToken) return latestToken;
    }
    throw new Error("PlayStation token refresh did not complete");
  }

  return null;
};

/**
 * Fetches the latest game from PlayStation and updates the durable cache.
 */
export const refreshPlayStationSummary = async (): Promise<PlayStationSummary> => {
  const now = Math.floor(Date.now() / 1000);
  const token = await getPlayStationToken();
  if (!token) throw new Error("PlayStation is not connected");
  const response = await getRecentlyPlayedGames(
    { accessToken: token.accessToken },
    { limit: 10, categories: ["ps4_game", "ps5_native_game"] },
  );
  const game = parseLatestPlayedGame(response);
  if (!game) throw new Error("PlayStation returned no recently played games");
  await redis.set(summaryKey, { fetchedAt: now, game } satisfies StoredSummary);
  return game;
};

/**
 * Returns a recently refreshed game or the last known game when PlayStation is unavailable.
 */
export const getPlayStationSummary = async (): Promise<PlayStationSummary | null> => {
  const cached = await redis.get<StoredSummary>(summaryKey);
  const now = Math.floor(Date.now() / 1000);
  if (cached?.game && cached.fetchedAt > now - summaryMaxAgeSeconds) return cached.game;

  try {
    return await refreshPlayStationSummary();
  } catch (error) {
    if (cached?.game) return cached.game;
    throw error;
  }
};
