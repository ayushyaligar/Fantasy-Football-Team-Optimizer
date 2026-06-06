// server.js
// Express API exposing the FPL optimization engine.

const express = require("express");
const { fetchFPLData } = require("./fetchFPL");
const { calculateScore } = require("./scorer");
const { suggestTransfers } = require("./optimizer");

const PORT = 3000;

// In-memory cache of scored players.
let scoredPlayers = [];

async function bootstrapData() {
  const { players, teams, positions } = await fetchFPLData();

  if (!players || !players.length) {
    throw new Error("No players returned from FPL API during bootstrap.");
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const positionById = new Map(positions.map((p) => [p.id, p]));

  scoredPlayers = players.map((p) => {
    const team = teamById.get(p.team);
    const position = positionById.get(p.element_type);
    const score = calculateScore(p);

    return {
      id: p.id,
      name: p.web_name,
      position:
        position?.singular_name_short || position?.singular_name || undefined,
      team: team ? team.name : undefined,
      price: p.now_cost / 10,
      score,
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Serve static frontend assets from /public
  app.use(express.static("public"));

  // Health check / info route
  app.get("/", (req, res) => {
    res.json({
      status: "ok",
      playersLoaded: scoredPlayers.length,
    });
  });

  // Lightweight list of players (without scores).
  app.get("/players", (req, res) => {
    if (!scoredPlayers.length) {
      return res.status(503).json({
        error: "Player data not loaded yet. Try again shortly.",
      });
    }

    const simplePlayers = scoredPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team,
      price: p.price,
    }));

    res.json(simplePlayers);
  });

  app.post("/optimize", (req, res) => {
    const { currentTeamIds, moneyInBank, transfersLeft } = req.body || {};

    if (
      !Array.isArray(currentTeamIds) ||
      currentTeamIds.length !== 15 ||
      typeof moneyInBank !== "number" ||
      typeof transfersLeft !== "number"
    ) {
      return res.status(400).json({
        error:
          "Invalid request body. Expected { currentTeamIds[15], moneyInBank:number, transfersLeft:number }.",
      });
    }

    if (!scoredPlayers.length) {
      return res.status(503).json({
        error: "Player data not loaded yet. Try again shortly.",
      });
    }

    try {
      const result = suggestTransfers(
        currentTeamIds,
        scoredPlayers,
        moneyInBank,
        transfersLeft
      );
      res.json(result);
    } catch (err) {
      console.error("Error during optimization:", err);
      res.status(500).json({ error: "Internal optimization error." });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Bootstrap data, then start the server.
(async () => {
  try {
    console.log("Fetching FPL data on startup...");
    await bootstrapData();
    console.log(`Loaded ${scoredPlayers.length} players.`);
    await startServer();
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();

