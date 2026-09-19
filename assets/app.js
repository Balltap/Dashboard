/* Executive dashboard for the Thailand bamboo-pulp mills.
   All numbers are read from data/dashboard.json - edit that file to update the page. */

const DATA_URL = "data/dashboard.json";
const SITE_COLOR_VAR = { PCB: "--series-1", SKA: "--series-2", CNX: "--series-3" };
// The map is really a small region map (Thailand + its neighbors); MAP_DEFAULT_VIEWBOX is
// the initial "focused on Thailand" crop, MAP_BASE_VIEWBOX is the full extent you can zoom
// out to (it shares Thailand's exact coordinate system, so nothing about Thailand moves).
const MAP_DEFAULT_VIEWBOX = { x: 0, y: 0, w: 300, h: 528 };
const MAP_BASE_VIEWBOX = { x: -165, y: -290, w: 580, h: 1020 };
const MAP_MIN_W = 40; // most zoomed-in: 300/40 = 7.5x
let mapViewBox = { ...MAP_DEFAULT_VIEWBOX };

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
  const otifPct = Math.max(0, Math.min(100, otif.current_pct));
  document.getElementById("otifPointer").style.left = otifPct + "%";
  document.getElementById("otifPointerValue").textContent = otif.current_pct + "%";

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
        layout: { padding: 0 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 9 } } },
          y: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), font: { size: 9 }, maxTicksLimit: 3 } },
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

function renderSiteCostTable() {
  const tbody = document.querySelector("#siteCostTable tbody");
  tbody.innerHTML = "";
  DATA.sites.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name_th}</td>
      <td>${s.days_on_hand} วัน</td>
      <td>${fmtNum(s.electricity_cost_thb_per_ton)} / ${fmtNum(s.water_cost_thb_per_ton)}</td>
      <td>${fmtNum(s.production_cost_thb_per_ton)}</td>`;
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
    pin.dataset.x = s.map_position.x;
    pin.dataset.y = s.map_position.y;
    pin.innerHTML = `
      <ellipse class="pin-ground-shadow" cx="0" cy="2" rx="11" ry="3.5"></ellipse>
      <circle class="pin-halo" cx="0" cy="-12" r="17"></circle>
      <circle class="pin-pulse" cx="0" cy="0" r="6"></circle>
      <g filter="url(#pinDropShadow)">
        <ellipse class="factory-smoke" cx="-7" cy="-40" rx="2.6" ry="2"></ellipse>
        <ellipse class="factory-smoke" cx="-8.5" cy="-44.5" rx="2" ry="1.5"></ellipse>
        <ellipse class="factory-smoke" cx="6.5" cy="-42" rx="2.6" ry="2"></ellipse>
        <ellipse class="factory-smoke" cx="8" cy="-46.5" rx="2" ry="1.5"></ellipse>
        <rect class="factory-chimney" x="-8.5" y="-34" width="3" height="9" rx="0.5"></rect>
        <rect class="factory-chimney" x="5.5" y="-36" width="3" height="11" rx="0.5"></rect>
        <rect class="factory-chimney-band" x="-8.5" y="-34" width="3" height="2.4"></rect>
        <rect class="factory-chimney-band" x="5.5" y="-36" width="3" height="2.4"></rect>
        <path class="factory-roof" d="M-13,-20 L13,-20 L10,-26.5 L-10,-26.5 Z"></path>
        <rect class="factory-wall" x="-11" y="-20" width="22" height="20" rx="1.5"></rect>
        <rect class="factory-wall-base" x="-11" y="-3.2" width="22" height="3.2"></rect>
        <rect class="factory-window" x="-8" y="-16" width="3.4" height="3.4" rx="0.5"></rect>
        <rect class="factory-window" x="-1.7" y="-16" width="3.4" height="3.4" rx="0.5"></rect>
        <rect class="factory-window" x="4.6" y="-16" width="3.4" height="3.4" rx="0.5"></rect>
        <rect class="factory-door" x="-3" y="-9" width="6" height="9" rx="1"></rect>
      </g>
      <text x="20" y="-9">${s.name_th}</text>`;
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      showPopup(s);
    });
    g.appendChild(pin);
  });
}

/* Shared markup: full site detail card, used inside the map pin popup */
function siteCardHTML(s) {
  return `
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
}

function showPopup(site) {
  activePinId = site.id;
  document.querySelectorAll(".site-pin").forEach((p) => {
    p.classList.toggle("active", p.getAttribute("data-site-id") === site.id);
  });
  const svgRect = document.getElementById("thailandMap").getBoundingClientRect();
  const px = svgRect.left + ((site.map_position.x - mapViewBox.x) / mapViewBox.w) * svgRect.width;
  const py = svgRect.top + ((site.map_position.y - mapViewBox.y) / mapViewBox.h) * svgRect.height;
  const popup = document.getElementById("mapPopup");
  popup.style.left = px + "px";
  popup.style.top = py + "px";
  popup.style.display = "block";
  popup.innerHTML = siteCardHTML(site);
}
function closePopup() {
  activePinId = null;
  document.getElementById("mapPopup").style.display = "none";
  document.querySelectorAll(".site-pin").forEach((p) => p.classList.remove("active"));
}
document.addEventListener("click", closePopup);

/* ---------------- Map zoom / pan ---------------- */
function applyMapViewBox() {
  document
    .getElementById("thailandMap")
    .setAttribute("viewBox", `${mapViewBox.x} ${mapViewBox.y} ${mapViewBox.w} ${mapViewBox.h}`);
  // Counter-scale pins so they stay a constant on-screen size relative to the default
  // (Thailand-focused) view, shrinking a bit as you zoom in past it, growing as you zoom out.
  const pinScale = mapViewBox.w / MAP_DEFAULT_VIEWBOX.w;
  document.querySelectorAll(".site-pin").forEach((pin) => {
    pin.setAttribute("transform", `translate(${pin.dataset.x},${pin.dataset.y}) scale(${pinScale})`);
  });
}
function clampMapViewBox(vb) {
  vb.w = Math.max(MAP_MIN_W, Math.min(MAP_BASE_VIEWBOX.w, vb.w));
  vb.h = vb.w * (MAP_BASE_VIEWBOX.h / MAP_BASE_VIEWBOX.w);
  vb.x = Math.max(MAP_BASE_VIEWBOX.x, Math.min(MAP_BASE_VIEWBOX.x + MAP_BASE_VIEWBOX.w - vb.w, vb.x));
  vb.y = Math.max(MAP_BASE_VIEWBOX.y, Math.min(MAP_BASE_VIEWBOX.y + MAP_BASE_VIEWBOX.h - vb.h, vb.y));
  return vb;
}
function updateZoomButtonsState() {
  const atMaxZoomOut = mapViewBox.w >= MAP_BASE_VIEWBOX.w - 0.01;
  const atDefault =
    Math.abs(mapViewBox.w - MAP_DEFAULT_VIEWBOX.w) < 0.5 &&
    Math.abs(mapViewBox.x - MAP_DEFAULT_VIEWBOX.x) < 0.5 &&
    Math.abs(mapViewBox.y - MAP_DEFAULT_VIEWBOX.y) < 0.5;
  const zoomOutBtn = document.getElementById("mapZoomOut");
  const resetBtn = document.getElementById("mapZoomReset");
  if (zoomOutBtn) zoomOutBtn.disabled = atMaxZoomOut;
  if (resetBtn) resetBtn.disabled = atDefault;
}
function zoomMapAt(clientX, clientY, factor) {
  const svg = document.getElementById("thailandMap");
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  const svgX = mapViewBox.x + relX * mapViewBox.w;
  const svgY = mapViewBox.y + relY * mapViewBox.h;
  const newW = mapViewBox.w / factor;
  const newH = newW * (MAP_BASE_VIEWBOX.h / MAP_BASE_VIEWBOX.w);
  mapViewBox = clampMapViewBox({ x: svgX - relX * newW, y: svgY - relY * newH, w: newW, h: newH });
  applyMapViewBox();
  updateZoomButtonsState();
}
function resetMapView() {
  mapViewBox = { ...MAP_DEFAULT_VIEWBOX };
  applyMapViewBox();
  updateZoomButtonsState();
}
function initMapZoomPan() {
  const wrap = document.getElementById("mapWrap");
  const svg = document.getElementById("thailandMap");
  const pointers = new Map();
  let dragging = false;
  let lastClient = null;
  let pinchStartDist = null;
  let pinchStartViewBox = null;

  wrap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      closePopup();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomMapAt(e.clientX, e.clientY, factor);
    },
    { passive: false }
  );

  wrap.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".site-pin") || e.target.closest(".map-zoom-controls")) return; // let pin/button clicks fire normally
    wrap.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastClient = { x: e.clientX, y: e.clientY };
      wrap.classList.add("dragging");
    } else if (pointers.size === 2) {
      dragging = false;
      const pts = Array.from(pointers.values());
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartViewBox = { ...mapViewBox };
    }
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStartDist && pinchStartViewBox) {
        mapViewBox = { ...pinchStartViewBox };
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        zoomMapAt(midX, midY, dist / pinchStartDist);
      }
      return;
    }
    if (dragging && lastClient) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dxSvg = ((e.clientX - lastClient.x) / rect.width) * mapViewBox.w;
      const dySvg = ((e.clientY - lastClient.y) / rect.height) * mapViewBox.h;
      mapViewBox = clampMapViewBox({ ...mapViewBox, x: mapViewBox.x - dxSvg, y: mapViewBox.y - dySvg });
      applyMapViewBox();
      lastClient = { x: e.clientX, y: e.clientY };
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStartDist = null;
    if (pointers.size === 1) {
      dragging = true;
      lastClient = Array.from(pointers.values())[0];
    } else if (pointers.size === 0) {
      dragging = false;
      wrap.classList.remove("dragging");
    }
  }
  wrap.addEventListener("pointerup", endPointer);
  wrap.addEventListener("pointercancel", endPointer);

  document.getElementById("mapZoomIn").addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = svg.getBoundingClientRect();
    zoomMapAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.5);
  });
  document.getElementById("mapZoomOut").addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = svg.getBoundingClientRect();
    zoomMapAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.5);
  });
  document.getElementById("mapZoomReset").addEventListener("click", (e) => {
    e.stopPropagation();
    closePopup();
    resetMapView();
  });

  updateZoomButtonsState();
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
        layout: { padding: 0 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 9 } } },
          y: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), font: { size: 9 }, maxTicksLimit: 4 } },
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
        layout: { padding: 0 },
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
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 9 } } },
          y: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), font: { size: 9 }, maxTicksLimit: 4, callback: (v) => (v / 1e6).toFixed(0) + "M" } },
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
        layout: { padding: 0 },
        plugins: { legend: { display: false } },
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
            ctx.font = "700 11px system-ui, sans-serif";
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;
            ctx.fillText(fmtTHB(w.total_thb), cx, cy);
            ctx.restore();
          },
        },
      ],
    })
  );
  const panel = document.getElementById("wasteChart").closest(".panel");
  let legend = panel.querySelector("#wasteLegend");
  if (!legend) {
    legend = document.createElement("div");
    legend.id = "wasteLegend";
    legend.className = "legend-row";
    panel.appendChild(legend);
  }
  const wasteColors = [cssVar("--series-1"), cssVar("--series-2"), cssVar("--series-3")];
  legend.innerHTML = w.categories_th
    .map((c, i) => `<span><i style="background:${wasteColors[i]}"></i>${c}</span>`)
    .join("");
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
        layout: { padding: 0 },
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 9 } } },
          y: { stacked: true, grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), font: { size: 9 }, maxTicksLimit: 4 } },
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
        layout: { padding: 0 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 9 } } },
          y: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), font: { size: 9 }, maxTicksLimit: 4 } },
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
  renderSiteCostTable();
  renderMap();
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

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((json) => {
    DATA = json;
    try {
      renderAll();
      initMapZoomPan();
    } catch (err) {
      document.body.innerHTML =
        '<p style="padding:40px;font-family:sans-serif;">เกิดข้อผิดพลาดขณะแสดงผลแดชบอร์ด: ' + err + "</p>";
      throw err;
    }
  })
  .catch((err) => {
    if (DATA) return; // render error already reported above
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif;">ไม่สามารถโหลดข้อมูล data/dashboard.json ได้: ' + err + "</p>";
  });

initTheme();
