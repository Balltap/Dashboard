/* Executive dashboard for the Thailand bamboo-pulp mills.
   All numbers are read from data/dashboard.json - edit that file to update the page. */

const DATA_URL = "data/dashboard.json";
const SITE_COLOR_VAR = { PCB: "--series-1", SKA: "--series-2", CNX: "--series-3" };
const MAP_VIEWBOX = { width: 300, height: 528 };

let DATA = null;
let chartInstances = [];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmtNum(n, opts = {}) {
  return new Intl.NumberFormat("th-TH", opts).format(n);
}
function fmtTHB(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + " ล้านบาท";
  return fmtNum(n) + " บาท";
}
function siteById(id) {
  return DATA.sites.find((s) => s.id === id);
}

/* ---------------- Gauges (SVG semicircle meters) ---------------- */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = startAngle - endAngle <= 180 ? 0 : 1;
  return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 1, end.x, end.y].join(" ");
}
function drawGauge(svgEl, pct, fillColor) {
  const cx = 75, cy = 80, r = 60, thickness = 14;
  const clamped = Math.max(0, Math.min(100, pct));
  const endAngle = 180 - (clamped / 100) * 180;
  svgEl.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";
  const bg = document.createElementNS(ns, "path");
  bg.setAttribute("d", describeArc(cx, cy, r, 180, 0));
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", cssVar("--gridline"));
  bg.setAttribute("stroke-width", thickness);
  bg.setAttribute("stroke-linecap", "round");
  const fg = document.createElementNS(ns, "path");
  fg.setAttribute("d", describeArc(cx, cy, r, 180, endAngle));
  fg.setAttribute("fill", "none");
  fg.setAttribute("stroke", fillColor);
  fg.setAttribute("stroke-width", thickness);
  fg.setAttribute("stroke-linecap", "round");
  svgEl.appendChild(bg);
  svgEl.appendChild(fg);
}

/* ---------------- Header + KPI row ---------------- */
function renderHeader() {
  document.getElementById("dashTitle").textContent = DATA.meta.dashboard_title_th;
  document.getElementById("dashCompany").textContent =
    `${DATA.meta.company_th} · 3 โรงงาน: ${DATA.sites.map((s) => s.name_th).join(" · ")}`;
  const d = new Date(DATA.meta.updated_at);
  document.getElementById("lastUpdated").textContent =
    "อัปเดตล่าสุด: " + d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  document.getElementById("periodLabel").textContent = "ช่วงข้อมูล: " + DATA.meta.period_label;
}

function renderKpiRow() {
  const rev = DATA.kpi_summary.total_gross_revenue;
  document.getElementById("kpiRevenueValue").textContent = fmtTHB(rev.current_thb);
  const ctx = document.getElementById("revenueSparkline");
  chartInstances.push(
    new Chart(ctx, {
      type: "line",
      data: {
        labels: rev.months,
        datasets: [
          {
            data: rev.trend_thb,
            borderColor: cssVar("--series-1"),
            backgroundColor: "transparent",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: { x: { display: false }, y: { display: false } },
      },
    })
  );

  const margin = DATA.kpi_summary.gross_profit_margin;
  drawGauge(document.getElementById("marginGauge"), margin.current_pct, cssVar("--seq-400"));
  document.getElementById("marginGaugeValue").textContent = margin.current_pct + "%";
  document.getElementById("marginCaptionLeft").textContent = "เป้าหมาย " + margin.target_pct + "%";
  document.getElementById("marginCaptionRight").textContent =
    "ต่ำกว่าเป้า " + (margin.target_pct - margin.current_pct) + "%";

  const otif = DATA.kpi_summary.otif;
  const otifColor =
    otif.current_pct >= otif.green_min_pct
      ? cssVar("--status-good")
      : otif.current_pct >= otif.yellow_min_pct
      ? cssVar("--status-warning")
      : cssVar("--status-critical");
  drawGauge(document.getElementById("otifGauge"), otif.current_pct, otifColor);
  document.getElementById("otifGaugeValue").textContent = otif.current_pct + "%";

  const risk = DATA.kpi_summary.delivery_risk;
  document.getElementById("riskScoreValue").textContent = risk.score + "/" + risk.max_score;
  document.getElementById("riskLevelValue").textContent = "ความเสี่ยง" + risk.level;
  document.getElementById("riskOrdersAtRisk").textContent =
    "คำสั่งซื้อที่มีความเสี่ยง: " + risk.orders_at_risk + " รายการ";
}

/* ---------------- Left column: total production, table, power mix, anomalies ---------------- */
function renderTotalProduction() {
  const totalProd = DATA.sites.reduce((a, s) => a + s.production_ton_day, 0);
  const totalCap = DATA.sites.reduce((a, s) => a + s.capacity_ton_day, 0);
  document.getElementById("totalProdValue").textContent = fmtNum(totalProd) + " ตัน/วัน";
  document.getElementById("totalProdBar").style.width = Math.round((totalProd / totalCap) * 100) + "%";
  document.getElementById("totalProdCaption").textContent =
    fmtNum(totalProd) + " / " + fmtNum(totalCap) + " ตัน/วัน (กำลังการผลิตรวม)";
}

function renderSiteMetricsTable() {
  const tbody = document.querySelector("#siteMetricsTable tbody");
  tbody.innerHTML = "";
  DATA.sites.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name_th}</td>
      <td>${fmtNum(s.production_ton_day)}</td>
      <td>${fmtNum(s.inventory_ton)}</td>
      <td class="${s.demand_fulfillment_pct >= 95 ? "badge-ok" : "badge-warn"}">${s.demand_fulfillment_pct}%</td>
      <td>${s.storage_utilization_pct}%</td>`;
    tbody.appendChild(tr);
  });
}

function renderPowerMixChart() {
  const labels = DATA.sites.map((s) => s.name_th);
  const solar = DATA.sites.map((s) => s.power_mix_mw.solar);
  const biomass = DATA.sites.map((s) => s.power_mix_mw.biomass);
  const grid = DATA.sites.map((s) => s.power_mix_mw.grid);
  const ctx = document.getElementById("powerMixChart");
  chartInstances.push(
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "โซลาร์", data: solar, backgroundColor: cssVar("--series-1"), borderRadius: 4 },
          { label: "ชีวมวล", data: biomass, backgroundColor: cssVar("--series-2"), borderRadius: 4 },
          { label: "สายส่งไฟฟ้า", data: grid, backgroundColor: cssVar("--series-3"), borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: cssVar("--text-secondary"), boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
          y: { title: { display: true, text: "MW", color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
        },
      },
    })
  );
}

function renderAnomalyTable() {
  const tbody = document.querySelector("#anomalyTable tbody");
  tbody.innerHTML = "";
  const cols = ["digester", "washer", "bleach", "dryer", "press"];
  DATA.sites.forEach((s) => {
    const tr = document.createElement("tr");
    let cells = `<td>${s.name_th}</td>`;
    cols.forEach((c) => {
      const v = s.anomalies_by_equipment[c] || 0;
      const cls = v === 0 ? "anomaly-0" : v === 1 ? "anomaly-1" : "anomaly-2plus";
      cells += `<td><span class="anomaly-cell ${cls}">${v}</span></td>`;
    });
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
}

/* ---------------- Map ---------------- */
let activePinId = null;
function renderMap() {
  const ns = "http://www.w3.org/2000/svg";
  const g = document.getElementById("mapPins");
  g.innerHTML = "";
  DATA.sites.forEach((s) => {
    const pin = document.createElementNS(ns, "g");
    pin.setAttribute("class", "site-pin");
    pin.setAttribute("transform", `translate(${s.map_position.x}, ${s.map_position.y})`);
    pin.setAttribute("data-site-id", s.id);
    pin.innerHTML = `
      <ellipse class="pin-ground-shadow" cx="0" cy="3" rx="10" ry="3.5"></ellipse>
      <circle class="pin-pulse" cx="0" cy="0" r="6"></circle>
      <path class="pin-body" filter="url(#pinDropShadow)"
        d="M0,0 C-12,-17 -14,-25 -14,-31 C-14,-42 -7.7,-50 0,-50 C7.7,-50 14,-42 14,-31 C14,-25 12,-17 0,0 Z"></path>
      <circle class="pin-hole" cx="0" cy="-31" r="6.5"></circle>
      <ellipse class="pin-highlight" cx="-5" cy="-40" rx="4" ry="6" transform="rotate(-25 -5 -40)"></ellipse>
      <text x="19" y="-27">${s.name_th}</text>`;
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      showPopup(s);
    });
    g.appendChild(pin);
  });
}

function showPopup(site) {
  activePinId = site.id;
  document.querySelectorAll(".site-pin").forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-site-id") === site.id);
  });
  const wrap = document.getElementById("mapWrap");
  const wrapRect = wrap.getBoundingClientRect();
  const px = (site.map_position.x / MAP_VIEWBOX.width) * wrapRect.width;
  const py = (site.map_position.y / MAP_VIEWBOX.height) * wrapRect.height;
  const popup = document.getElementById("mapPopup");
  popup.style.left = px + "px";
  popup.style.top = py + "px";
  popup.style.display = "block";
  popup.innerHTML = `
    <div class="pop-title">${site.name_th} <span class="pop-badge">${site.anomalies_total} แจ้งเตือน</span></div>
    <div class="pop-row">การใช้กำลังผลิต <b>${site.capacity_utilization_pct}%</b></div>
    <div class="meter-track"><div class="meter-fill" style="width:${site.capacity_utilization_pct}%"></div></div>
    <div class="pop-row" style="margin-top:6px;">ประสิทธิภาพพลังงาน <b>${site.energy_efficiency_pct}%</b></div>
    <div class="meter-track"><div class="meter-fill" style="width:${site.energy_efficiency_pct}%"></div></div>
    <div class="pop-row" style="margin-top:6px;">ผลผลิต <b>${fmtNum(site.production_ton_day)} ตัน/วัน</b> · สต็อก <b>${fmtNum(site.inventory_ton)} ตัน</b></div>`;
}
document.addEventListener("click", () => {
  document.getElementById("mapPopup").style.display = "none";
  document.querySelectorAll(".site-pin").forEach((p) => p.classList.remove("active"));
});

/* ---------------- Site cards ---------------- */
function renderSiteCards() {
  const col = document.getElementById("siteCardsCol");
  col.innerHTML = "";
  DATA.sites.forEach((s) => {
    const card = document.createElement("div");
    card.className = "panel site-card";
    card.innerHTML = `
      <div class="site-card-head">
        <div><div class="name">${s.name_th}</div><div class="prov">${s.province_th} | ${s.country_th}</div></div>
        <span class="status-pill">${s.status}</span>
      </div>
      <div class="site-card-metrics">
        <div class="metric-block">
          <div class="mb-label">ผลผลิตเยื่อไผ่</div>
          <div class="mb-value">${fmtNum(s.production_ton_day)} <span style="font-size:11px;font-weight:400;">ตัน/วัน</span></div>
          <div class="mb-sub">ใช้กำลังผลิต ${s.capacity_utilization_pct}% · ตอบสนองดีมานด์ ${s.demand_fulfillment_pct}%</div>
        </div>
        <div class="metric-block">
          <div class="mb-label">สินค้าคงคลัง</div>
          <div class="mb-value">${fmtNum(s.inventory_ton)} <span style="font-size:11px;font-weight:400;">ตัน</span></div>
          <div class="mb-sub">ใช้พื้นที่คลัง ${s.storage_utilization_pct}%</div>
        </div>
        <div class="metric-block">
          <div class="mb-label">กำลังไฟฟ้า</div>
          <div class="mb-value">${s.power_mw} <span style="font-size:11px;font-weight:400;">MW</span></div>
          <div class="mb-sub">พลังงานหมุนเวียน ${s.renewable_pct}% · ประสิทธิภาพ ${s.energy_efficiency_pct}%</div>
        </div>
        <div class="metric-block">
          <div class="mb-label">สุขภาพเครื่องจักร</div>
          <div class="mb-value">${s.asset_health_pct}%</div>
          <div class="mini-bar-track" style="margin-top:4px;"><div class="mini-bar-fill" style="width:${s.asset_health_pct}%; background:${cssVar(SITE_COLOR_VAR[s.id])}"></div></div>
        </div>
      </div>
      <div class="site-card-foot">
        <span>แจ้งเตือน: <b class="${s.anomalies_total >= 3 ? "crit-dot" : s.anomalies_total >= 1 ? "warn-dot" : ""}">${s.anomalies_total}</b></span>
        <span>งานค้างกำหนด: <b class="${s.overdue_work_orders >= 1 ? "warn-dot" : ""}">${s.overdue_work_orders}</b></span>
      </div>`;
    col.appendChild(card);
  });
}

/* ---------------- Order execution ---------------- */
function renderOrderExecution() {
  const list = document.getElementById("orderExecutionList");
  list.innerHTML = "";
  DATA.order_execution.forEach((o) => {
    const site = siteById(o.site_id);
    const color = cssVar(SITE_COLOR_VAR[o.site_id] || "--series-1");
    const row = document.createElement("div");
    row.className = "order-row";
    row.innerHTML = `
      <div class="order-top">
        <span><span class="oid">${o.id}</span> <span class="ostage">· ${o.stage_th} · ${site ? site.name_th : ""}</span></span>
        <span class="ostatus">${o.status_th}</span>
      </div>
      <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${o.progress_pct}%; background:${color}"></div></div>`;
    list.appendChild(row);
  });
}

/* ---------------- Bottom charts ---------------- */
function renderPerformanceChart() {
  const p = DATA.performance_overview;
  const ctx = document.getElementById("performanceChart");
  chartInstances.push(
    new Chart(ctx, {
      type: "line",
      data: {
        labels: p.days_th,
        datasets: [
          { label: "ผลผลิตจริง", data: p.production_ton, borderColor: cssVar("--series-1"), backgroundColor: "transparent", borderWidth: 2, pointRadius: 3, tension: 0.3 },
          { label: "แผนส่งมอบ", data: p.delivery_plan_ton, borderColor: cssVar("--series-2"), backgroundColor: "transparent", borderWidth: 2, borderDash: [5, 4], pointRadius: 3, tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted") } },
          y: { title: { display: true, text: "ตัน", color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
        },
      },
    })
  );
}

function renderInventoryChart() {
  const labels = DATA.sites.map((s) => s.name_th);
  const values = DATA.sites.map((s) => s.inventory_value_thb);
  const colors = DATA.sites.map((s) => cssVar(SITE_COLOR_VAR[s.id]));
  const ctx = document.getElementById("inventoryChart");
  chartInstances.push(
    new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "มูลค่าสินค้าคงคลัง", data: values, backgroundColor: colors, borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (item) => {
                const s = DATA.sites[item.dataIndex];
                return "วันสำรองคลัง (DOH): " + s.days_on_hand + " วัน";
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted") } },
          y: { title: { display: true, text: "บาท", color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), callback: (v) => (v / 1e6).toFixed(0) + "M" } },
        },
      },
    })
  );
  const panel = document.getElementById("inventoryChart").closest(".panel");
  let cap = panel.querySelector("#inventoryDohLegend");
  if (!cap) {
    cap = document.createElement("div");
    cap.id = "inventoryDohLegend";
    cap.className = "legend-row";
    panel.appendChild(cap);
  }
  cap.innerHTML = DATA.sites.map((s) => `<span><i style="background:${cssVar(SITE_COLOR_VAR[s.id])}"></i>${s.name_th}: ${s.days_on_hand} วันสำรอง</span>`).join("");
}

function renderWasteChart() {
  const w = DATA.waste_scrap;
  const ctx = document.getElementById("wasteChart");
  chartInstances.push(
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: w.categories_th,
        datasets: [{ data: w.share_pct, backgroundColor: [cssVar("--series-1"), cssVar("--series-2"), cssVar("--series-3")], borderColor: cssVar("--surface-1"), borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: cssVar("--text-secondary"), boxWidth: 10, font: { size: 10 } } } },
        cutout: "62%",
      },
      plugins: [
        {
          id: "wasteCenterText",
          afterDraw(chart) {
            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = cssVar("--text-primary");
            ctx.font = "700 16px system-ui, sans-serif";
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;
            ctx.fillText(fmtTHB(w.total_thb), cx, cy);
            ctx.restore();
          },
        },
      ],
    })
  );
}

function renderEnergyCostChart() {
  const e = DATA.net_energy_cost;
  const ctx = document.getElementById("energyCostChart");
  chartInstances.push(
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: e.days_th,
        datasets: [
          { label: "ไฟฟ้า", data: e.electricity_thb_per_ton, backgroundColor: cssVar("--series-1"), stack: "s", borderRadius: { topLeft: 0, topRight: 0 } },
          { label: "ไอน้ำ", data: e.steam_thb_per_ton, backgroundColor: cssVar("--series-2"), stack: "s", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: cssVar("--text-muted") } },
          y: { stacked: true, title: { display: true, text: "บาท/ตัน", color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
        },
      },
    })
  );
}

function renderUnitCostChart() {
  const u = DATA.unit_cost;
  const ctx = document.getElementById("unitCostChart");
  chartInstances.push(
    new Chart(ctx, {
      type: "line",
      data: {
        labels: u.days_th,
        datasets: [
          { label: "วัตถุดิบ", data: u.material_thb_per_ton, borderColor: cssVar("--series-1"), backgroundColor: "transparent", borderWidth: 2, pointRadius: 3, tension: 0.3 },
          { label: "ค่าโสหุ้ยคงที่", data: u.overhead_thb_per_ton, borderColor: cssVar("--series-2"), backgroundColor: "transparent", borderWidth: 2, pointRadius: 3, tension: 0.3, yAxisID: "y" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted") } },
          y: { title: { display: true, text: "บาท/ตัน", color: cssVar("--text-muted") }, grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
        },
      },
    })
  );
}

/* ---------------- Boot ---------------- */
function destroyCharts() {
  chartInstances.forEach((c) => c.destroy());
  chartInstances = [];
}

function renderAll() {
  destroyCharts();
  renderHeader();
  renderKpiRow();
  renderTotalProduction();
  renderSiteMetricsTable();
  renderPowerMixChart();
  renderAnomalyTable();
  renderMap();
  renderSiteCards();
  renderOrderExecution();
  renderPerformanceChart();
  renderInventoryChart();
  renderWasteChart();
  renderEnergyCostChart();
  renderUnitCostChart();
}

function initTheme() {
  const saved = localStorage.getItem("dash-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("dash-theme", next);
    if (DATA) renderAll();
  });
}

fetch(DATA_URL)
  .then((r) => r.json())
  .then((json) => {
    DATA = json;
    renderAll();
  })
  .catch((err) => {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif;">ไม่สามารถโหลดข้อมูล data/dashboard.json ได้: ' + err + "</p>";
  });

initTheme();
