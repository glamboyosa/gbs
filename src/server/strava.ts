import { Redis } from "@upstash/redis";
import type { StravaActivityStats, StravaSummary, StravaToken } from "@/types";
import { summarizeStravaStats } from "@/utils/strava";

const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL,
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN,
});

const tokenKey = "strava_token";
const summaryKey = "strava_summary_v2";

/**
 * Creates the stored token from the initial credentials in the environment.
 *
 * @returns {Promise<StravaToken | null>} Stored token or null when setup is incomplete.
 */
const createInitialStravaToken = async (): Promise<StravaToken | null> => {
  if (!import.meta.env.STRAVA_REFRESH_TOKEN) return null;
  const initialToken = await refreshStravaToken({
    access_token: import.meta.env.STRAVA_ACCESS_TOKEN,
    refresh_token: import.meta.env.STRAVA_REFRESH_TOKEN,
    expires_at: 0,
  });
  return initialToken;
};

/**
 * Refreshes the Strava token and stores the latest rotating refresh token.
 *
 * @param {StravaToken} token - Current stored Strava token.
 * @returns {Promise<StravaToken>} Valid Strava token.
 */
const refreshStravaToken = async (token: StravaToken): Promise<StravaToken> => {
  const body = new URLSearchParams({
    client_id: import.meta.env.STRAVA_CLIENT_ID,
    client_secret: import.meta.env.STRAVA_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });
  const response = await fetch("https://www.strava.com/api/v3/oauth/token", { method: "POST", body });
  if (!response.ok) throw new Error(`Strava token refresh failed with ${response.status}`);
  const refreshed = await response.json();
  const nextToken: StravaToken = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
  };
  await redis.set(tokenKey, nextToken);
  return nextToken;
};

/**
 * Gets a valid stored Strava token.
 *
 * @returns {Promise<StravaToken | null>} Valid token or null before setup.
 */
const getStravaToken = async (): Promise<StravaToken | null> => {
  const storedToken = await redis.get<StravaToken>(tokenKey);
  if (!storedToken) return createInitialStravaToken();
  const refreshThreshold = Math.floor(Date.now() / 1000) + 3600;
  return storedToken.expires_at <= refreshThreshold ? refreshStravaToken(storedToken) : storedToken;
};

/**
 * Requests Strava activity totals with the specified access token.
 *
 * @param {string} athleteId - Configured Strava athlete ID.
 * @param {string} accessToken - Current Strava access token.
 * @returns {Promise<Response>} Strava API response.
 */
const fetchStravaStats = async (athleteId: string, accessToken: string): Promise<Response> => {
  return fetch(`https://www.strava.com/api/v3/athletes/${athleteId}/stats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
};

/**
 * Gets cached public Strava totals or refreshes them from the API.
 *
 * @returns {Promise<StravaSummary | null>} Four-week totals or null before setup.
 */
export const getStravaSummary = async (): Promise<StravaSummary | null> => {
  const cached = await redis.get<StravaSummary>(summaryKey);
  if (cached && typeof cached.athleteId === "string") return cached;
  const token = await getStravaToken();
  if (!token) return null;
  const athleteId = import.meta.env.STRAVA_ATHLETE_ID;
  if (!athleteId) return null;
  let response = await fetchStravaStats(athleteId, token.access_token);
  if (response.status === 401) {
    const refreshedToken = await refreshStravaToken(token);
    response = await fetchStravaStats(athleteId, refreshedToken.access_token);
  }
  if (!response.ok) throw new Error(`Strava stats request failed with ${response.status}`);
  const stats: StravaActivityStats = await response.json();
  const summary = summarizeStravaStats(stats, athleteId);
  await redis.set(summaryKey, summary, { ex: 900 });
  return summary;
};

/**
 * Stores credentials returned by the Strava authorization exchange.
 *
 * @param {StravaToken} token - New Strava token.
 * @returns {Promise<void>} Resolves after the token is stored.
 */
export const setStravaToken = async (token: StravaToken): Promise<void> => {
  await redis.set(tokenKey, token);
  await redis.del(summaryKey);
};
