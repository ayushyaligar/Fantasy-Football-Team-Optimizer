// fetchFPL.js
// Responsible for fetching data from the FPL API.

const fetch = require("node-fetch");

const FPL_BOOTSTRAP_URL =
  "https://fantasy.premierleague.com/api/bootstrap-static/";

/**
 * Fetches core FPL bootstrap data and returns
 * players, teams and positions in a simple object.
 *
 * @returns {Promise<{players: any[], teams: any[], positions: any[]}>}
 */
async function fetchFPLData() {
  let response;
  try {
    response = await fetch(FPL_BOOTSTRAP_URL);
  } catch (err) {
    throw new Error(`Network error while fetching FPL data: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch FPL data. Status: ${response.status} ${response.statusText}`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`Failed to parse FPL response as JSON: ${err.message}`);
  }

  const players = Array.isArray(data.elements) ? data.elements : [];
  const teams = Array.isArray(data.teams) ? data.teams : [];
  const positions = Array.isArray(data.element_types) ? data.element_types : [];

  return { players, teams, positions };
}

module.exports = {
  fetchFPLData,
};
