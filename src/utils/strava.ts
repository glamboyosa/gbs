import type { StravaActivityStats, StravaActivityTotal, StravaSummary } from "@/types";

const emptyTotal: StravaActivityTotal = {
  count: 0,
  distance: 0,
  moving_time: 0,
  elevation_gain: 0,
};

/**
 * Combines Strava's recent run, ride and swim totals.
 *
 * @param {StravaActivityStats} stats - Four-week activity totals from Strava.
 * @param {string} athleteId - Configured Strava athlete ID.
 * @returns {StravaSummary} Combined public activity totals.
 */
export const summarizeStravaStats = (stats: StravaActivityStats, athleteId: string): StravaSummary => {
  const totals = [stats.recent_run_totals, stats.recent_ride_totals, stats.recent_swim_totals].map((total) => total ?? emptyTotal);

  return totals.reduce(
    (summary, total) => ({
      athleteId: summary.athleteId,
      activityCount: summary.activityCount + total.count,
      distanceKilometers: summary.distanceKilometers + total.distance / 1000,
      movingTimeSeconds: summary.movingTimeSeconds + total.moving_time,
      elevationMeters: summary.elevationMeters + total.elevation_gain,
    }),
    { athleteId, activityCount: 0, distanceKilometers: 0, movingTimeSeconds: 0, elevationMeters: 0 },
  );
};

/**
 * Formats seconds as compact hours and minutes.
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} Compact duration.
 */
export const formatMovingTime = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};
