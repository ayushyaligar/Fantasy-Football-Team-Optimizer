// optimizer.js
// Responsible for analyzing a squad and suggesting transfers.

/**
 * Analyze the current team.
 *
 * @param {number[]} currentTeamIds - Array of 15 player IDs.
 * @param {Array<{id:number, name:string, position:string, team:string, price:number, score:number}>} allPlayers
 * @returns {{
 *   squad: Array,
 *   weakestPlayer: any | null,
 *   strongestPlayer: any | null
 * }}
 */
function analyzeCurrentTeam(currentTeamIds, allPlayers) {
  if (!Array.isArray(currentTeamIds) || !Array.isArray(allPlayers)) {
    return {
      squad: [],
      weakestPlayer: null,
      strongestPlayer: null,
    };
  }

  const playerById = new Map(allPlayers.map((p) => [p.id, p]));

  // Convert IDs to player objects, ignoring IDs that don't exist in allPlayers.
  const squad = currentTeamIds
    .map((id) => playerById.get(id))
    .filter((p) => !!p);

  if (!squad.length) {
    return {
      squad: [],
      weakestPlayer: null,
      strongestPlayer: null,
    };
  }

  // Sort ascending by score so the weakest is first.
  const sortedByScore = [...squad].sort((a, b) => a.score - b.score);

  const weakestPlayer = sortedByScore[0];
  const strongestPlayer = sortedByScore[sortedByScore.length - 1];

  return {
    squad,
    weakestPlayer,
    strongestPlayer,
  };
}

/**
 * Build a map of team name -> count of players in that team.
 */
function buildTeamCounts(players) {
  const counts = new Map();
  players.forEach((player) => {
    if (!player || !player.team) return;
    const current = counts.get(player.team) || 0;
    counts.set(player.team, current + 1);
  });
  return counts;
}

/**
 * Internal helper:
 * Suggest a single transfer for the *current* squad state.
 *
 * Enforces:
 * - Same position as the weakest player
 * - Affordability: candidate.price <= weakest.price + currentBudget
 * - Max 3 players per team (unless swapping within the same team)
 * - Positive score improvement
 *
 * Returns `null` when no beneficial transfer is available.
 */
function suggestSingleTransferForState(currentTeamIds, allPlayers, currentBudget) {
  const analysis = analyzeCurrentTeam(currentTeamIds, allPlayers);

  const weakestPlayer = analysis.weakestPlayer;
  const squad = analysis.squad || [];

  if (!weakestPlayer) {
    return null;
  }

  const currentIdsSet = new Set(currentTeamIds);
  const maxAffordablePrice = weakestPlayer.price + (currentBudget || 0);

  // Count players per team in the current squad.
  const teamCounts = buildTeamCounts(squad);

  const candidates = allPlayers
    .filter((p) => {
      if (!p) return false;
      // Same position
      if (p.position !== weakestPlayer.position) return false;
      // Not already owned
      if (currentIdsSet.has(p.id)) return false;
      // Affordable
      if (p.price > maxAffordablePrice) return false;

      // Enforce max 3 players per team.
      if (p.team) {
        const currentCount = teamCounts.get(p.team) || 0;
        const isSameTeamAsOut = p.team === weakestPlayer.team;
        // If bringing in from a different team, cannot exceed 3.
        if (!isSameTeamAsOut && currentCount >= 3) {
          return false;
        }
        // If same team as transferOut, count effectively stays the same (swap),
        // so it's always allowed from a team-count perspective.
      }

      return true;
    })
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return null;
  }

  const bestCandidate = candidates[0];
  const scoreImprovement = bestCandidate.score - weakestPlayer.score;

  if (scoreImprovement <= 0) {
    return null;
  }

  return {
    transferOut: weakestPlayer,
    transferIn: bestCandidate,
    scoreImprovement,
  };
}

/**
 * Suggest up to `transfersLeft` transfers, applied sequentially,
 * updating squad state and budget each time.
 *
 * @param {number[]} currentTeamIds
 * @param {Array<{id:number, name:string, position:string, team:string, price:number, score:number}>} allPlayers
 * @param {number} moneyInBank
 * @param {number} transfersLeft
 * @returns {{
 *   transfers: Array<{transferOut: any, transferIn: any, scoreImprovement: number}>,
 *   totalImprovement: number,
 *   remainingBudget: number
 * }}
 */
function suggestTransfers(currentTeamIds, allPlayers, moneyInBank, transfersLeft) {
  const workingTeamIds = Array.isArray(currentTeamIds)
    ? [...currentTeamIds]
    : [];
  let currentBudget = moneyInBank || 0;
  let remainingTransfers = Math.max(0, transfersLeft || 0);

  const transfers = [];
  let totalImprovement = 0;

  while (remainingTransfers > 0) {
    const suggestion = suggestSingleTransferForState(
      workingTeamIds,
      allPlayers,
      currentBudget
    );

    if (!suggestion) {
      break;
    }

    const { transferOut, transferIn, scoreImprovement } = suggestion;

    // Apply the transfer to the working team state.
    const indexToRemove = workingTeamIds.indexOf(transferOut.id);
    if (indexToRemove !== -1) {
      workingTeamIds.splice(indexToRemove, 1);
    }
    workingTeamIds.push(transferIn.id);

    // Update budget: sell then buy.
    currentBudget = currentBudget + transferOut.price - transferIn.price;

    transfers.push(suggestion);
    totalImprovement += scoreImprovement;
    remainingTransfers -= 1;
  }

  return {
    transfers,
    totalImprovement,
    remainingBudget: currentBudget,
  };
}

module.exports = {
  analyzeCurrentTeam,
  suggestTransfers,
};
