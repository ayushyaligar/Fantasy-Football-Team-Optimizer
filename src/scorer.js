// scorer.js
// Responsible for converting raw player data into a single numeric score.

/**
 * Safely parses a numeric-like value (string or number).
 * Returns 0 when the value is null/undefined/NaN.
 */
function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Calculates a weighted score for a player based on:
 * - form
 * - points_per_game
 * - recent event_points
 * - ict_index
 * - total_points
 *
 * score =
 *   0.35 * form +
 *   0.25 * points_per_game +
   0.15 * recentTrend +
 *   0.15 * ict +
 *   0.10 * total_points
 */
function calculateScore(player) {
  if (!player || typeof player !== "object") {
    return 0;
  }

  const form = toNumber(player.form);
  const ppg = toNumber(player.points_per_game);
  const totalPoints = toNumber(player.total_points);
  const recentTrend = toNumber(player.event_points);
  const ict = toNumber(player.ict_index);

  const score =
    0.35 * form +
    0.25 * ppg +
    0.15 * recentTrend +
    0.15 * ict +
    0.1 * totalPoints;

  return score;
}

module.exports = {
  calculateScore,
};
