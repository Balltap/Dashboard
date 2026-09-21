/* OTIF (On-Time In-Full) detail page.
   Reads the same data/dashboard.json as the main dashboard
   (kpi_summary.otif, plus total_gross_revenue.months for shared month labels
   and order_execution for the at-a-glance order list). */

const DATA_URL = "data/dashboard.json";
const SITE_COLS = [
  { id: "PCB", name_th: "เพชรบูรณ์" },
  { id: "SKA", name_th: "สงขลา" },
  { id: "CNX", name_th: "เชียงใหม่" },
];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function fmtNum(n, opts = {}) {
  return new Intl.NumberFormat("th-TH", opts).format(n);
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

function zoneOf(pct, otif) {
  if (pct >= otif.green_min_pct) return { key: "good", label: "เขียว" };
  if (pct >= otif.yellow_min_pct) return { key: "warning", label: "เหลือง" };
  return { key: "critical", label: "แดง" };
}

function renderSummary(otif) {
  document.getElementById("sumOtif").textContent = otif.current_pct + "%";
  const zone = zoneOf(otif.current_pct, otif);
  const zoneEl = document.getElementById("sumOtifZone");
  zoneEl.textContent = `โซน${zone.label} (เกณฑ์เขียว ≥${otif.green_min_pct}%)`;
  zoneEl.style.color = cssVar(`--status-${zone.key}`);

  const lastOnTime = otif.on_time_pct_trend[otif.on_time_pct_trend.length - 1];
  const lastInFull = otif.in_full_pct_trend[otif.in_full_pct_trend.length - 1];
  document.getElementById("sumOnTime").textContent = lastOnTime + "%";
  document.getElementById("sumInFull").textContent = lastInFull + "%";
}

const thresholdBandsPlugin = {
  id: "thresholdBands",
  beforeDraw(chart, args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const y = scales.y;
    const top = chartArea.top;
    const bottom = chartArea.bottom;
    const yGreen = y.getPixelForValue(opts.greenMin);
    const yYellow = y.getPixelForValue(opts.yellowMin);
    ctx.save();
    ctx.fillStyle = colorWithAlpha(cssVar("--status-good"), 0.08);
    ctx.fillRect(chartArea.left, top, chartArea.width, Math.max(0, yGreen - top));
    ctx.fillStyle = colorWithAlpha(cssVar("--status-warning"), 0.08);
    ctx.fillRect(chartArea.left, Math.max(top, yGreen), chartArea.width, Math.max(0, yYellow - Math.max(top, yGreen)));
    ctx.fillStyle = colorWithAlpha(cssVar("--status-critical"), 0.08);
    ctx.fillRect(chartArea.left, Math.max(top, yYellow), chartArea.width, Math.max(0, bottom - Math.max(top, yYellow)));
    ctx.restore();
  },
};
function colorWithAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderTrendChart(otif, months) {
  const ctx = document.getElementById("otifTrendChart");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "OTIF",
          data: otif.otif_pct_trend,
          borderColor: cssVar("--series-1"),
          backgroundColor: "transparent",
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 6 } },
      plugins: {
        legend: { display: false },
        thresholdBands: { greenMin: otif.green_min_pct, yellowMin: otif.yellow_min_pct },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 }, callback: (v) => v + "%" },
          suggestedMin: 75,
          suggestedMax: 100,
        },
      },
    },
    plugins: [thresholdBandsPlugin],
  });
}

function renderComponentChart(otif, months) {
  const ctx = document.getElementById("otifComponentChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          label: "ตรงเวลา (On-Time)",
          data: otif.on_time_pct_trend,
          backgroundColor: cssVar("--series-1"),
          borderRadius: 3,
        },
        {
          label: "ครบถ้วน (In-Full)",
          data: otif.in_full_pct_trend,
          backgroundColor: cssVar("--series-4"),
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 0 },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 }, callback: (v) => v + "%" },
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });

  const avgOnTime = otif.on_time_pct_trend.reduce((a, b) => a + b, 0) / otif.on_time_pct_trend.length;
  const avgInFull = otif.in_full_pct_trend.reduce((a, b) => a + b, 0) / otif.in_full_pct_trend.length;
  const driver = avgOnTime < avgInFull ? "ความล่าช้าในการส่งมอบ (On-Time)" : "การส่งไม่ครบจำนวน (In-Full)";
  document.getElementById("componentNote").textContent =
    `เฉลี่ยทั้งปี: ตรงเวลา ${avgOnTime.toFixed(1)}% · ครบถ้วน ${avgInFull.toFixed(1)}% - ${driver} เป็นสาเหตุหลักที่ฉุด OTIF ในปีนี้ (ต่างจากอีกองค์ประกอบ ${Math.abs(avgOnTime - avgInFull).toFixed(1)} จุด)`;
}

function renderSiteTable(otif, orderExecution) {
  const tbody = document.getElementById("siteOtifBody");
  tbody.innerHTML = "";
  const sites = SITE_COLS.map((s) => ({ ...s, ...otif.by_site[s.id] })).sort(
    (a, b) => b.otif_pct - a.otif_pct
  );
  sites.forEach((s) => {
    const zone = zoneOf(s.otif_pct, otif);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name_th}</td>
      <td>${s.on_time_pct}%</td>
      <td>${s.in_full_pct}%</td>
      <td class="cell-cumulative">${s.otif_pct.toFixed(1)}%</td>
      <td><span class="zone-badge zone-${zone.key}">${zone.label}</span></td>
      <td class="${s.overdue_work_orders > 0 ? "cell-down" : ""}">${s.overdue_work_orders} รายการ</td>`;
    tbody.appendChild(tr);
  });

  const worst = sites[sites.length - 1];
  const worstOrders = orderExecution.filter((o) => o.site_id === worst.id);
  const orderNote = worstOrders.length
    ? ` งานที่กำลังดำเนินการอยู่ตอนนี้: ${worstOrders.map((o) => `${o.id} (${o.stage_th}, ${o.status_th})`).join(", ")}.`
    : "";
  document.getElementById("siteOtifNote").textContent =
    `${worst.name_th} มี OTIF ต่ำสุด (${worst.otif_pct.toFixed(1)}%) และมีงานค้างกำหนด ${worst.overdue_work_orders} รายการมากที่สุดในกลุ่ม.${orderNote}`;
}

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    try {
      const otif = data.kpi_summary.otif;
      const months = data.kpi_summary.total_gross_revenue.months;
      renderHeader(data);
      renderSummary(otif);
      renderTrendChart(otif, months);
      renderComponentChart(otif, months);
      renderSiteTable(otif, data.order_execution);
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
