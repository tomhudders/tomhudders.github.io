/**********************
 * SCORING
 **********************/
const scenarios = {
  5: {
    ridersPerTeam: 5,
    activePositions: 10,
    minWinPoints: 28
  },
  4: {
    ridersPerTeam: 4,
    activePositions: 8,
    minWinPoints: 27
  },
  3: {
    ridersPerTeam: 3,
    activePositions: 6,
    minWinPoints: 23
  }
};

function buildPoints(activePositions) {
  const pts = {};
  let score = 10;
  for (let i = 1; i <= activePositions; i++) {
    pts[i] = score--;
  }
  return pts;
}


/**********************
 * BUILD TABLE
 **********************/
const tbody = document.getElementById("rows");
const scenarioSelect = document.getElementById("scenario");

let points = {};
let currentScenario = scenarios[5];

function buildTable() {
  tbody.innerHTML = "";

  points = buildPoints(currentScenario.activePositions);

  for (let pos = 1; pos <= 10; pos++) {
    const disabled = pos > currentScenario.activePositions;

    const tr = document.createElement("tr");
    if (disabled) tr.style.opacity = 0.4;

    tr.innerHTML = `
      <td>${pos}</td>
      <td><input type="checkbox" data-team="A" data-pos="${pos}" ${disabled ? "disabled" : ""}></td>
      <td><input type="checkbox" data-team="B" data-pos="${pos}" ${disabled ? "disabled" : ""}></td>
      <td>${points[pos] ?? "-"}</td>
    `;
    tbody.appendChild(tr);
  }
}

buildTable();

/**********************
 * PREVENT DOUBLE ASSIGNMENT
 **********************/
document.addEventListener("change", e => {
  if (e.target.type !== "checkbox") return;

  const pos = e.target.dataset.pos;
  const team = e.target.dataset.team;
  const otherTeam = team === "A" ? "B" : "A";

  const other = document.querySelector(
    `input[data-pos="${pos}"][data-team="${otherTeam}"]`
  );

  if (e.target.checked) {
    other.checked = false;
  }

  calculate(); // live recalculation
});

/**********************
 * COMBINATIONS HELPER
 **********************/
function combinations(arr, k) {
  const result = [];

  function backtrack(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }

  backtrack(0, []);
  return result;
}

/**********************
 * CRITICAL POSITIONS
 **********************/
function findCriticalPositions(best, remainingPositions, fixedPointsA, fixedPointsB) {
  const critical = [];

  for (const pos of best.Agets) {
    const worseOptions = remainingPositions.filter(
      p => p > pos && !best.Agets.includes(p)
    );

    for (const worse of worseOptions) {
      const newA = best.Agets.filter(p => p !== pos).concat(worse);
      const newB = remainingPositions.filter(p => !newA.includes(p));

      const Apts =
        fixedPointsA + newA.reduce((s, p) => s + points[p], 0);
      const Bpts =
        fixedPointsB + newB.reduce((s, p) => s + points[p], 0);

      if (Apts <= Bpts) {
        critical.push(pos);
        break;
      }
    }
  }

  return critical;
}

/**********************
 * DEGRADATION EXPLANATION
 **********************/
function degradationExplanation(best, remainingPositions, fixedPointsA, fixedPointsB) {
  for (const pos of best.Agets) {
    const worse = remainingPositions.find(
      p => p > pos && !best.Agets.includes(p)
    );

    if (!worse) continue;

    const newA = best.Agets.filter(p => p !== pos).concat(worse);
    const newB = remainingPositions.filter(p => !newA.includes(p));

    const Apts =
      fixedPointsA + newA.reduce((s, p) => s + points[p], 0);
    const Bpts =
      fixedPointsB + newB.reduce((s, p) => s + points[p], 0);

    if (Apts <= Bpts) {
      return `If HMB replaces position ${pos} with ${worse}, they lose (${Apts} vs ${Bpts}).`;
    }
  }
  return null;
}

/**********************
 * MAIN CALCULATION
 **********************/
function calculate() {
  let fixedA = [];
  let fixedB = [];

  document.querySelectorAll("input[type=checkbox]").forEach(cb => {
    if (cb.checked) {
      const pos = Number(cb.dataset.pos);
      cb.dataset.team === "A" ? fixedA.push(pos) : fixedB.push(pos);
    }
  });

  if (
    fixedA.length > currentScenario.ridersPerTeam ||
    fixedB.length > currentScenario.ridersPerTeam
  ) {
    output(`❌ Each team can have at most ${currentScenario.ridersPerTeam} riders.`);
    return;
  }

  const fixedPointsA = fixedA.reduce((s, p) => s + points[p], 0);
  const fixedPointsB = fixedB.reduce((s, p) => s + points[p], 0);

  const remainingPositions = [];
  for (let p = 1; p <= currentScenario.activePositions; p++) {
    if (!fixedA.includes(p) && !fixedB.includes(p)) {
      remainingPositions.push(p);
    }
  }

  const remainingA = currentScenario.ridersPerTeam - fixedA.length;
  const remainingB = currentScenario.ridersPerTeam - fixedB.length;


  let winningScenarios = [];

  for (const Agets of combinations(remainingPositions, remainingA)) {
    const Bgets = remainingPositions.filter(p => !Agets.includes(p));

    const totalA =
      fixedPointsA + Agets.reduce((s, p) => s + points[p], 0);
    const totalB =
      fixedPointsB + Bgets.reduce((s, p) => s + points[p], 0);

    if (totalA > totalB && totalA >= currentScenario.minWinPoints) {
      winningScenarios.push({ Agets, Bgets, totalA, totalB });
    }
  }

  if (winningScenarios.length === 0) {
    output(`
  <h2 class="error">HMB cannot win anymore</h2>
  <p class="small">Even in the best remaining scenario.</p>
`);
clearHighlights();

    clearHighlights();
    return;
  }

  winningScenarios.sort((a, b) => a.totalA - b.totalA);
  const best = winningScenarios[0];

  const critical = findCriticalPositions(
    best,
    remainingPositions,
    fixedPointsA,
    fixedPointsB
  );

  const explanation = degradationExplanation(
    best,
    remainingPositions,
    fixedPointsA,
    fixedPointsB
  );

  highlight(best.Agets, critical);

let html = `
  <h2 class="success">HMB can still win</h2>

  <div class="result-block none">
    <span class="result-label">Fixed HMB:</span>
    ${fixedA.join(", ") || "none"}<br>
    <span class="result-label">Fixed Opponent:</span>
    ${fixedB.join(", ") || "none"}
  </div>

  <div class="result-block primary">
    <span class="result-label">Worst acceptable positions for HMB:</span><br>
    ${best.Agets.join(", ")}
  </div>

  <div class="result-block">
    <span class="result-label">Opponent gets:</span><br>
    ${best.Bgets.join(", ")}
  </div>

  <div class="result-block">
    <span class="result-label">Final points</span><br>
    HMB: ${best.totalA}<br>
    Opponent: ${best.totalB}<br>
    <strong>Winning margin: ${best.totalA - best.totalB}</strong>
  </div>
`;

if (critical.length) {
  html += `
    <div class="result-block small">
      ⚠️ <strong>Critical positions:</strong> ${critical.join(", ")}
    </div>
  `;
}

if (explanation) {
  html += `
    <div class="result-block small">
      ${explanation}
    </div>
  `;
}

output(html);

}

/**********************
 * UI HELPERS
 **********************/
function output(text) {
  const el = document.getElementById("output");
  el.innerHTML = text;
}

function clearHighlights() {
  document.querySelectorAll("tr").forEach(tr => {
    tr.classList.remove("required", "critical");
  });
}

function highlight(required, critical) {
  clearHighlights();

  required.forEach(pos => {
    const row = document
      .querySelector(`input[data-pos="${pos}"]`)
      .closest("tr");
    row.classList.add("required");
  });

  critical.forEach(pos => {
    const row = document
      .querySelector(`input[data-pos="${pos}"]`)
      .closest("tr");
    row.classList.add("critical");
  });
}

scenarioSelect.addEventListener("change", () => {
  currentScenario = scenarios[scenarioSelect.value];
  buildTable();
  calculate();
});
