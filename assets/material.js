/* Bamboo raw-material pre-processing detail page (Phetchabun / PCB only).
   Reads data/dashboard.json's bamboo_processing_pcb key, built from the
   factory's own weighing-log spreadsheets (Chipping + Node/Joint Separation).
   This is real 2569 (2026) process data, but it measures QC sampling at two
   pre-processing stations, not finished-pulp output - it does not replace
   production_ton_day / revenue / margin / OTIF / risk figures elsewhere. */

const DATA_URL = "data/dashboard.json";

function fmtNum(n, opts = {}) {
  return new Intl.NumberFormat("th-TH", opts).format(n);
}
function fmtKg(n) {
  if (n >= 1000) return fmtNum(n / 1000, { maximumFractionDigits: 2 }) + " ตัน";
  return fmtNum(n) + " กก.";
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function initTheme() {
  const saved = localStorage.getItem("dash-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("dash-theme", next);
  });
}

function renderHeader(data) {
  document.getElementById("dashCompany").textContent = data.meta.company_th;
  const d = new Date(data.meta.updated_at);
  document.getElementById("lastUpdated").textContent =
    "อัปเดตล่าสุด: " + d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function renderSummary(mat) {
  const node = mat.node_separation;
  const chip = mat.chipping;
  const pith = mat.pith_screening;

  const nodeTotal = node.total_kg.reduce((a, b) => a + b, 0);
  document.getElementById("sumNodeTotal").textContent = fmtKg(nodeTotal);
  document.getElementById("sumNodePeriod").textContent =
    `${node.month_labels_th[0]} - ${node.month_labels_th[node.month_labels_th.length - 1]}`;

  const chipTotal = chip.screened_chip_kg.reduce((a, b) => a + b, 0);
  document.getElementById("sumChipTotal").textContent = fmtKg(chipTotal);
  document.getElementById("sumChipPeriod").textContent =
    `${chip.period_labels_th[0]} - ${chip.period_labels_th[chip.period_labels_th.length - 1]}`;

  const pithTotal = pith.total_kg.reduce((a, b) => a + b, 0);
  document.getElementById("sumPithTotal").textContent = fmtKg(pithTotal);
  document.getElementById("sumPithPeriod").textContent =
    `${pith.month_labels_th[0]} - ${pith.month_labels_th[pith.month_labels_th.length - 1]}`;

  const sawdustTotal = node.sawdust_kg.reduce((a, b) => a + b, 0);
  document.getElementById("sumSawdustPct").textContent = ((sawdustTotal / nodeTotal) * 100).toFixed(1) + "%";

  document.getElementById("dataSourceBanner").textContent = mat.data_source_note_th;
  document.getElementById("sourceNote").textContent = mat.data_source_note_th;
}

function renderNodeChart(node) {
  const ctx = document.getElementById("nodeChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: node.month_labels_th,
      datasets: [
        { label: "ปล้องไผ่", data: node.internode_kg, backgroundColor: cssVar("--series-1"), stack: "s" },
        { label: "ข้อไผ่", data: node.node_kg, backgroundColor: cssVar("--series-2"), stack: "s" },
        { label: "ขี้เลื่อยไผ่", data: node.sawdust_kg, backgroundColor: cssVar("--series-4"), stack: "s" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, stacked: true, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          stacked: true,
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 } },
          beginAtZero: true,
          title: { display: true, text: "กก.", color: cssVar("--text-muted"), font: { size: 10 } },
        },
      },
    },
  });
}

function renderPithChart(pith) {
  const ctx = document.getElementById("pithChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: pith.month_labels_th,
      datasets: [
        { label: "มัดเส้นใย", data: pith.fiber_bundle_kg, backgroundColor: cssVar("--series-1"), stack: "s" },
        { label: "ขุยไผ่", data: pith.pith_dust_kg, backgroundColor: cssVar("--series-2"), stack: "s" },
        { label: "Over-size", data: pith.oversize_kg, backgroundColor: cssVar("--series-4"), stack: "s" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, stacked: true, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          stacked: true,
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 } },
          beginAtZero: true,
          title: { display: true, text: "กก.", color: cssVar("--text-muted"), font: { size: 10 } },
        },
      },
    },
  });
  document.getElementById("pithNote").textContent = pith.note_th;
}

function renderChipChart(chip) {
  const ctx = document.getElementById("chipChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: chip.period_labels_th,
      datasets: [
        {
          label: "Screened Chip",
          data: chip.screened_chip_kg,
          backgroundColor: cssVar("--series-1"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 } },
          beginAtZero: true,
          title: { display: true, text: "กก.", color: cssVar("--text-muted"), font: { size: 10 } },
        },
      },
    },
  });
  document.getElementById("chipNote").textContent = chip.note_th;
}

function renderLedger(node) {
  const tbody = document.getElementById("nodeLedgerBody");
  const tfoot = document.getElementById("nodeLedgerFoot");
  tbody.innerHTML = "";
  let sumInternode = 0, sumNode = 0, sumSawdust = 0, sumTotal = 0;

  node.month_labels_th.forEach((m, i) => {
    const internode = node.internode_kg[i];
    const nodeW = node.node_kg[i];
    const sawdust = node.sawdust_kg[i];
    const total = node.total_kg[i];
    sumInternode += internode;
    sumNode += nodeW;
    sumSawdust += sawdust;
    sumTotal += total;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m}</td>
      <td>${fmtNum(internode)}</td>
      <td>${fmtNum(nodeW)}</td>
      <td>${fmtNum(sawdust)}</td>
      <td class="cell-total">${fmtNum(total)}</td>
      <td>${((sawdust / total) * 100).toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `
    <tr>
      <td>รวมสะสม</td>
      <td>${fmtNum(sumInternode)}</td>
      <td>${fmtNum(sumNode)}</td>
      <td>${fmtNum(sumSawdust)}</td>
      <td>${fmtNum(sumTotal)}</td>
      <td>${((sumSawdust / sumTotal) * 100).toFixed(1)}%</td>
    </tr>`;
}

function renderPithLedger(pith) {
  const tbody = document.getElementById("pithLedgerBody");
  const tfoot = document.getElementById("pithLedgerFoot");
  tbody.innerHTML = "";
  let sumFiber = 0, sumDust = 0, sumOver = 0, sumTotal = 0;

  pith.month_labels_th.forEach((m, i) => {
    const fiber = pith.fiber_bundle_kg[i];
    const dust = pith.pith_dust_kg[i];
    const over = pith.oversize_kg[i];
    const total = pith.total_kg[i];
    sumFiber += fiber;
    sumDust += dust;
    sumOver += over;
    sumTotal += total;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m}</td>
      <td>${fmtNum(fiber)}</td>
      <td>${fmtNum(dust)}</td>
      <td>${fmtNum(over)}</td>
      <td class="cell-total">${fmtNum(total)}</td>`;
    tbody.appendChild(tr);
  });

  tfoot.innerHTML = `
    <tr>
      <td>รวมสะสม</td>
      <td>${fmtNum(sumFiber)}</td>
      <td>${fmtNum(sumDust)}</td>
      <td>${fmtNum(sumOver)}</td>
      <td>${fmtNum(sumTotal)}</td>
    </tr>`;
}

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    try {
      const mat = data.bamboo_processing_pcb;
      renderHeader(data);
      renderSummary(mat);
      renderNodeChart(mat.node_separation);
      renderChipChart(mat.chipping);
      renderPithChart(mat.pith_screening);
      renderLedger(mat.node_separation);
      renderPithLedger(mat.pith_screening);
      initTheme();
    } catch (err) {
      document.body.innerHTML =
        '<p style="padding:40px;font-family:sans-serif;">เกิดข้อผิดพลาดขณะแสดงผล: ' + err + "</p>";
      throw err;
    }
  })
  .catch((err) => {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif;">ไม่สามารถโหลดข้อมูล data/dashboard.json ได้: ' + err + "</p>";
  });
