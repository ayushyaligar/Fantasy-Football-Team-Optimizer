let players = [];
let squadState = [];
let selectedSlotId = null;
let originalPanelContentHTML = null;

// Load players from backend and build squad selectors
async function loadPlayers() {
  const res = await fetch("/players");
  players = await res.json();
  buildSquadSelectors();
}

function populateSelectOptions(select, playersForSelect) {
  // Remember current value to try to preserve it on filter.
  const previousValue = select.value;

  // Clear existing options.
  select.innerHTML = "";

  // Add an empty default option so nothing is pre-selected.
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select player...";
  select.appendChild(emptyOption);

  playersForSelect.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.name} (${p.team}) - £${p.price}`;
    select.appendChild(option);
  });

  // Restore previous selection if still available after filtering.
  if (previousValue && select.querySelector(`option[value="${previousValue}"]`)) {
    select.value = previousValue;
  }
}

function buildSquadSelectors() {
  const squadContainer = document.getElementById("squad-container");
  if (!squadContainer || !Array.isArray(players) || !players.length) return;

  const groups = [
    { id: "gk-container", position: "GKP", label: "Goalkeepers", count: 2 },
    { id: "def-container", position: "DEF", label: "Defenders", count: 5 },
    { id: "mid-container", position: "MID", label: "Midfielders", count: 5 },
    { id: "fwd-container", position: "FWD", label: "Forwards", count: 3 },
  ];

  groups.forEach((group) => {
    const gridEl = document.getElementById(group.id);
    if (!gridEl) return;

    gridEl.innerHTML = "";

    const groupWrapper = gridEl.parentElement;
    if (!groupWrapper) return;

    // Ensure we only have one search input per group.
    let searchInput = groupWrapper.querySelector(".player-search");
    if (!searchInput) {
      searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.className = "player-search";
      searchInput.placeholder = `Search ${group.label}...`;
      groupWrapper.insertBefore(searchInput, gridEl);
    }

    const positionPlayers = players.filter(
      (p) => p.position === group.position
    );

    // Create selects for this group.
    for (let i = 0; i < group.count; i++) {
      const select = document.createElement("select");
      select.className = "player-select";

      populateSelectOptions(select, positionPlayers);

      select.addEventListener("change", updateTotalCost);
      gridEl.appendChild(select);
    }

    // Wire up search to filter the options in this group's selects.
    searchInput.oninput = () => {
      const term = searchInput.value.trim().toLowerCase();
      const filtered =
        term === ""
          ? positionPlayers
          : positionPlayers.filter(
              (p) =>
                p.name.toLowerCase().includes(term) ||
                (p.team && p.team.toLowerCase().includes(term))
            );

      const selects = gridEl.querySelectorAll("select.player-select");
      selects.forEach((select) => {
        // Always include the currently selected player in this select
        // so existing choices are not lost when searching.
        const currentValue = select.value;
        const currentPlayer =
          currentValue && positionPlayers.find((p) => String(p.id) === currentValue);

        const playersForThisSelect =
          currentPlayer && !filtered.some((p) => p.id === currentPlayer.id)
            ? [currentPlayer, ...filtered]
            : filtered;

        populateSelectOptions(select, playersForThisSelect);
      });

      updateTotalCost();
    };
  });

  updateTotalCost();
}

function updateTotalCost() {
  const selects = document.querySelectorAll(".player-select");
  if (!selects.length) return;

  const playersById = new Map(
    players.map((p) => [String(p.id), p])
  );

  let total = 0;
  selects.forEach((s) => {
    const p = playersById.get(String(s.value));
    if (p && typeof p.price === "number") {
      total += p.price;
    }
  });

  const totalEl = document.getElementById("totalCostValue");
  if (totalEl) {
    totalEl.textContent = `£${total.toFixed(1)}`;
  }
}

function initPanelEventHandlers() {
  const optimizeBtn = document.getElementById("optimizeBtn");
  if (optimizeBtn) {
    optimizeBtn.removeEventListener("click", optimizeTeam);
    optimizeBtn.addEventListener("click", optimizeTeam);
  }
}

// Existing optimize logic, unchanged except for UI hooks
async function optimizeTeam() {
  // Build current team from squadState
  const currentTeamIds = squadState.map((s) => (s.player ? Number(s.player.id) : null));

  // Validate full squad selected
  if (currentTeamIds.some((id) => id === null || id === undefined)) {
    const results = document.getElementById("results");
    results.innerHTML = "";
    const msg = document.createElement("div");
    msg.className = "results-empty";
    msg.textContent = "Please fill all 15 squad slots before optimizing.";
    results.appendChild(msg);
    return;
  }

  const moneyInBank = Number(document.getElementById("moneyInBank").value);
  const transfersLeft = Number(document.getElementById("transfersLeft").value);

  const res = await fetch("/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentTeamIds, moneyInBank, transfersLeft }),
  });

  const data = await res.json();
  displayResults(data);
}

function displayResults(data) {
  const results = document.getElementById("results");
  results.innerHTML = "";

  if (!data) {
    const empty = document.createElement("div");
    empty.className = "results-empty";
    empty.textContent = "No data returned from optimizer.";
    results.appendChild(empty);
    return;
  }

  if (data.message) {
    const msg = document.createElement("div");
    msg.className = "results-empty";
    msg.textContent = data.message;
    results.appendChild(msg);
    return;
  }

  (data.transfers || []).forEach((t, index) => {
    const div = document.createElement("div");
    div.className = "transfer-item";

    const improvementClass =
      t.scoreImprovement > 0
        ? "improvement positive"
        : t.scoreImprovement < 0
        ? "improvement negative"
        : "improvement";

    div.innerHTML = `
      <div class="transfer-header">Transfer ${index + 1}</div>
      <div class="transfer-row">
        <span class="transfer-label">OUT</span>
        <span class="transfer-value">${t.transferOut.name}</span>
      </div>
      <div class="transfer-row">
        <span class="transfer-label">IN</span>
        <span class="transfer-value">${t.transferIn.name}</span>
      </div>
      <div class="${improvementClass}">
        Improvement: ${t.scoreImprovement.toFixed(2)}
      </div>
    `;
    results.appendChild(div);
  });

  if (data.totalImprovement !== undefined) {
    const summary = document.createElement("div");
    summary.className = "results-summary";
    summary.innerHTML = `
      <div><strong>Total Improvement:</strong> ${data.totalImprovement.toFixed(
        2
      )}</div>
      <div><strong>Remaining Budget:</strong> £${data.remainingBudget.toFixed(
        1
      )}</div>
    `;
    results.appendChild(summary);
  }

  // Highlight transfers on pitch
  highlightTransfers(data.transfers || []);
}

function highlightTransfers(transfers) {
  // Clear existing highlights
  const pitch = document.getElementById("pitch");
  if (!pitch) return;
  const slotDivs = pitch.querySelectorAll(".player-slot");
  slotDivs.forEach((d) => {
    d.classList.remove("transfer-out", "transfer-in");
    d.title = "";
  });

  transfers.forEach((t) => {
    // Find the slot that currently has the transferOut player
    const outPlayerId = t.transferOut && t.transferOut.id;
    if (outPlayerId === undefined || outPlayerId === null) return;

    const stateEntry = squadState.find((s) => s.player && Number(s.player.id) === Number(outPlayerId));
    if (!stateEntry) return;

    const slotDiv = pitch.querySelector(`.player-slot[data-slot-id="${stateEntry.slotId}"]`);
    if (!slotDiv) return;

    slotDiv.classList.add("transfer-out");
    // Also mark transfer-in suggestion visually on same slot
    slotDiv.classList.add("transfer-in");
    slotDiv.title = `Suggest IN: ${t.transferIn && t.transferIn.name}`;
  });
}

function updateSquadCost() {
  const total = squadState.reduce((sum, slot) => {
    if (!slot.player) return sum;

    const numericPrice = parseFloat(
      String(slot.player.price).replace("£", "")
    );

    return sum + (isNaN(numericPrice) ? 0 : numericPrice);
  }, 0);

  const el = document.getElementById("squadCost");
  if (el) {
    el.textContent = "£" + total.toFixed(1);
  }
}

document
  .getElementById("optimizeBtn")
  .addEventListener("click", optimizeTeam);

// --- Static formation slots on the pitch (Step 2) ---

const formationSlots = [
  // Goalkeepers (2)
  { id: "gk1", x: 35, y: 85, position: "GKP" },
  { id: "gk2", x: 65, y: 85, position: "GKP" },
  // Defenders (5)
  { id: "def1", x: 10, y: 60, position: "DEF" },
  { id: "def2", x: 30, y: 60, position: "DEF" },
  { id: "def3", x: 50, y: 60, position: "DEF" },
  { id: "def4", x: 70, y: 60, position: "DEF" },
  { id: "def5", x: 90, y: 60, position: "DEF" },
  // Midfielders (5)
  { id: "mid1", x: 10, y: 35, position: "MID" },
  { id: "mid2", x: 30, y: 35, position: "MID" },
  { id: "mid3", x: 50, y: 35, position: "MID" },
  { id: "mid4", x: 70, y: 35, position: "MID" },
  { id: "mid5", x: 90, y: 35, position: "MID" },
  // Forwards (3)
  { id: "fwd1", x: 25, y: 12, position: "FWD" },
  { id: "fwd2", x: 50, y: 12, position: "FWD" },
  { id: "fwd3", x: 75, y: 12, position: "FWD" },
];

// Initialize squad state for 15 slots.
squadState = formationSlots.map((slot) => ({
  slotId: slot.id,
  position: slot.position,
  player: null,
}));

function setSelectedSlot(slotId) {
  selectedSlotId = slotId;
  updateSlotHighlights();
  renderSlotSelectionPanel();
}

function updateSlotHighlights() {
  const pitch = document.getElementById("pitch");
  if (!pitch) return;
  const slotDivs = pitch.querySelectorAll(".player-slot");
  slotDivs.forEach((div) => {
    if (div.dataset.slotId === selectedSlotId) {
      div.classList.add("selected");
    } else {
      div.classList.remove("selected");
    }
  });
}

function renderSlotSelectionPanel() {
  // Use the larger panel content area for the searchable cards UI
  const panel = document.getElementById("panelContent");
  if (!panel) return;

  // Clear any previous validation messages when showing the panel
  clearValidationMessage();

  if (!selectedSlotId) {
    // Restore original panel content
    if (originalPanelContentHTML) {
      panel.innerHTML = originalPanelContentHTML;
      initPanelEventHandlers();
    }
    return;
  }

  const stateEntry = squadState.find((s) => s.slotId === selectedSlotId);
  if (!stateEntry) {
    if (originalPanelContentHTML) {
      panel.innerHTML = originalPanelContentHTML;
      initPanelEventHandlers();
    }
    return;
  }

  // Show search UI and grid in the side panel
  panel.innerHTML = `
    <div class="card selection-card">
      <h2 class="card-title">Select Player</h2>
      <input type="text" id="playerSearch" placeholder="Search player..." />
      <div id="playerGrid" class="player-grid"></div>
      <div id="validationMessage" class="validation-message" aria-live="polite"></div>
    </div>
  `;

  const filteredPlayers = players.filter((p) => p.position === stateEntry.position);

  // Render initial grid
  renderPlayerCards(filteredPlayers, stateEntry);

  const searchEl = document.getElementById("playerSearch");
  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      const q = (e.target.value || "").toLowerCase();
      const filtered = filteredPlayers.filter((p) => p.name.toLowerCase().includes(q));
      renderPlayerCards(filtered, stateEntry);
    });
  }
}

function assignPlayerToSlot(playerId) {
  if (!selectedSlotId) return;

  const player = players.find((p) => p.id === playerId);
  if (!player) return;

  const stateEntry = squadState.find((s) => s.slotId === selectedSlotId);
  if (!stateEntry) return;

  // Enforce max 3 players per team in the UI
  const teamCounts = getTeamCounts();
  const selectedTeam = player.team;
  const currentSlot = stateEntry;

  const alreadyInSlotSameTeam =
    currentSlot.player && currentSlot.player.team === selectedTeam;

  if (!alreadyInSlotSameTeam && (teamCounts[selectedTeam] || 0) >= 3) {
    showValidationMessage("You cannot select more than 3 players from the same team.");
    return;
  }

  // Assign player to slot in memory
  stateEntry.player = player;

  // Sync pitch UI from squadState so assignments are consistent
  updatePitchFromSquadState();

  // Clear any validation messages now that the assignment succeeded
  clearValidationMessage();

  // Reset side panel to default state
  selectedSlotId = null;
  updateSlotHighlights();
  renderSlotSelectionPanel();
}

function updatePitchFromSquadState() {
  const pitch = document.getElementById("pitch");
  if (!pitch) return;

  squadState.forEach((s) => {
    const slotDiv = pitch.querySelector(`.player-slot[data-slot-id="${s.slotId}"]`);
    if (!slotDiv) return;
    if (s.player) {
      // Render assigned slot with team abbr and player name
      const teamAbbr = getTeamAbbr(s.player.team);
      slotDiv.innerHTML = `
        <div class="slot-circle">${teamAbbr}</div>
        <div class="slot-name">${s.player.name}</div>
      `;
      slotDiv.classList.add("assigned");
    } else {
      // Render empty slot with position abbr
      const positionAbbr = s.position === "GKP" ? "GK" : s.position;
      slotDiv.innerHTML = `
        <div class="slot-circle">${positionAbbr}</div>
        <div class="slot-name empty-name"></div>
      `;
      slotDiv.classList.remove("assigned");
    }
  });

  // Update squad cost display whenever pitch/squad updates
  updateSquadCost();
}

function getTeamCounts() {
  const counts = {};
  squadState.forEach((slot) => {
    if (slot.player) {
      const team = slot.player.team;
      counts[team] = (counts[team] || 0) + 1;
    }
  });
  return counts;
}

function getTeamAbbr(teamName) {
  const map = {
    "Arsenal": "ARS",
    "Liverpool": "LIV",
    "Man City": "MCI",
    "Man Utd": "MUN",
    "Chelsea": "CHE",
    "Spurs": "TOT",
    "Newcastle": "NEW",
    "Aston Villa": "AVL",
    "Burnley": "BUR",
    "Bournemouth": "BOU",
    "Fulham": "FUL",
    "Crystal Palace": "CRY",
    "Brighton": "BHA",
    "Leeds": "LEE",
    "Nott'm Forest": "NFO",
    "West Ham": "WHU",
    "Wolves": "WOL",
    "Brentford": "BRE",
    "Everton": "EVE",
    "Sunderland": "SUN"
  };

  if (map[teamName]) {
    return map[teamName];
  }

  console.warn("Unknown team name:", teamName);
  return "UNK";
}

function renderPlayerCards(playersToRender, stateEntry) {
  const grid = document.getElementById("playerGrid");
  if (!grid) return;
  grid.innerHTML = "";

  // Determine assigned ids excluding current slot
  const assignedIds = new Set(
    squadState
      .filter((s) => s.player && s.slotId !== selectedSlotId)
      .map((s) => s.player.id)
  );

  const teamCounts = getTeamCounts();

  playersToRender.forEach((p) => {
    const card = document.createElement("div");
    card.className = "player-card";

    card.innerHTML = `
      <div class="player-name">${p.name}</div>
      <div class="player-team">${p.team || ""}</div>
      <div class="player-price">£${(typeof p.price === 'number' ? p.price.toFixed(1) : p.price)}</div>
    `;

    // Disable if already selected elsewhere
    if (assignedIds.has(p.id)) {
      card.classList.add("disabled");
      card.title = "Already selected in your squad";
    } else {
      // Disable if team limit reached (unless replacing same-team player in this slot)
      const selectedTeam = p.team;
      const currentSlot = stateEntry;
      const alreadyInSlotSameTeam = currentSlot.player && currentSlot.player.team === selectedTeam;
      if (!alreadyInSlotSameTeam && (teamCounts[selectedTeam] || 0) >= 3) {
        card.classList.add("disabled");
        card.title = "Team limit reached (3)";
      } else {
        card.addEventListener("click", () => {
          assignPlayerToSlot(p.id);
        });
      }
    }

    grid.appendChild(card);
  });
}

function showValidationMessage(msg, type = "error") {
  const el = document.getElementById("validationMessage");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden", "error", "info");
  el.classList.add(type || "error");
}

function clearValidationMessage() {
  const el = document.getElementById("validationMessage");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
  el.classList.remove("error", "info");
}

function renderPitchSlots() {
  const pitch = document.getElementById("pitch");
  if (!pitch) return;

  formationSlots.forEach((slot) => {
    const div = document.createElement("div");
    div.className = "player-slot";
    div.dataset.position = slot.position;
    div.dataset.slotId = slot.id;
    div.style.left = `${slot.x}%`;
    div.style.top = `${slot.y}%`;
    // Render empty slot with position abbreviation in separate circle and name elements
    const positionAbbr = slot.position === "GKP" ? "GK" : slot.position;
    div.innerHTML = `
      <div class="slot-circle">${positionAbbr}</div>
      <div class="slot-name empty-name"></div>
    `;
    div.addEventListener("click", () => setSelectedSlot(slot.id));
    pitch.appendChild(div);
  });

  // Ensure pitch reflects any existing squadState assignments
  updatePitchFromSquadState();
}

// Initialize page: render static pitch, then (for later steps) load players.
renderPitchSlots();
loadPlayers();

// Capture original panel HTML so we can restore it after using the selection UI
const panelContentEl = document.getElementById("panelContent");
if (panelContentEl) {
  originalPanelContentHTML = panelContentEl.innerHTML;
}

// Ensure panel handlers are attached for the initial content
initPanelEventHandlers();