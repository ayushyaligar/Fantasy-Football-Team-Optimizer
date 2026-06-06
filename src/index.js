// index.js
// Entry point for running small tests as we build the optimizer step by step.
// STEP 3–8: fetch data, rank players, analyze a sample squad, and suggest transfers.

const { fetchFPLData } = require("./fetchFPL");
const { calculateScore } = require("./scorer");
const { analyzeCurrentTeam, suggestTransfers } = require("./optimizer");

async function main() {
  const { players, teams, positions } = await fetchFPLData();

  console.log(`Total players: ${players.length}`);
  console.log(`Total teams: ${teams.length}`);
  console.log(`Total positions: ${positions.length}`);

  if (!players.length) {
    console.log("No players returned from API.");
    return;
  }

  // Build quick lookup maps for team and position names.
  const teamById = new Map(
    teams.map((t) => [t.id, t])
  );
  const positionById = new Map(
    positions.map((p) => [p.id, p])
  );

  const scoredPlayers = players.map((p) => {
    const team = teamById.get(p.team);
    const position = positionById.get(p.element_type);

    const score = calculateScore(p);

    return {
      id: p.id,
      name: p.web_name,
      position: position ? position.singular_name_short || position.singular_name : undefined,
      team: team ? team.name : undefined,
      price: p.now_cost / 10,
      score,
    };
  });

  scoredPlayers.sort((a, b) => b.score - a.score);

  const top10 = scoredPlayers.slice(0, 10);

  console.log("\nTop 10 players by score:");
  top10.forEach((p, index) => {
    console.log(
      `${index + 1}. ${p.name} (${p.position}, ${p.team}) - £${p.price.toFixed(
        1
      )}, score: ${p.score.toFixed(2)}`
    );
  });

  // STEP 4: Analyze a hardcoded current team.
  const sampleTeamIds = scoredPlayers.slice(0, 15).map((p) => p.id);

  const analysis = analyzeCurrentTeam(sampleTeamIds, scoredPlayers);

  if (analysis.weakestPlayer && analysis.strongestPlayer) {
    console.log("\nCurrent team analysis (sample squad of 15):");
    console.log(
      `Weakest: ${analysis.weakestPlayer.name} - score: ${analysis.weakestPlayer.score.toFixed(
        2
      )}`
    );
    console.log(
      `Strongest: ${analysis.strongestPlayer.name} - score: ${analysis.strongestPlayer.score.toFixed(
        2
      )}`
    );
  } else {
    console.log("\nCould not analyze current team (no valid players).");
  }

  const moneyInBank = 2; // Example budget for testing.
  const transfersLeft = 3; // Test with up to 3 transfers.

  const multiSuggestion = suggestTransfers(
    sampleTeamIds,
    scoredPlayers,
    moneyInBank,
    transfersLeft
  );

  console.log(
    `\nMulti-transfer suggestion (up to ${transfersLeft} transfers, with team & budget constraints):`
  );

  if (!multiSuggestion || !Array.isArray(multiSuggestion.transfers)) {
    console.log("No suggestion object returned.");
  } else if (multiSuggestion.transfers.length === 0) {
    console.log("No beneficial transfers found.");
  } else {
    multiSuggestion.transfers.forEach((t, index) => {
      const out = t.transferOut;
      const inn = t.transferIn;
      console.log(
        `Transfer ${index + 1} OUT: ${out.name} - £${out.price.toFixed(
          1
        )}, score: ${out.score.toFixed(2)}`
      );
      console.log(
        `Transfer ${index + 1}  IN: ${inn.name} - £${inn.price.toFixed(
          1
        )}, score: ${inn.score.toFixed(2)}`
      );
      console.log(
        `  Improvement from this transfer: ${t.scoreImprovement.toFixed(2)}`
      );
    });

    console.log(
      `\nTotal score improvement: ${multiSuggestion.totalImprovement.toFixed(2)}`
    );
    console.log(
      `Remaining budget: £${multiSuggestion.remainingBudget.toFixed(1)}`
    );
  }
}

// Allow running via `node src/index.js`.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
