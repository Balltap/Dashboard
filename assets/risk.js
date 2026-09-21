/* Delivery Risk Score detail page.
   Reads the same data/dashboard.json as the main dashboard
   (kpi_summary.delivery_risk, plus order_execution for the at-risk order details
   and total_gross_revenue.months for shared month labels). */

const DATA_URL = "data/dashboard.json";
const SITE_NAMES = { PCB: "เพชรบูรณ์", SKA: "สงขลา", CNX: "เชียงใหม่" };

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

function zoneOf(score, risk) {
  if (score <= risk.low_max_score) return { key: "good", label: "ต่ำ" };
  if (score <= risk.medium_max_score) return { key: "warning", label: "กลาง" };
  return { key: "critical", label: "สูง" };
}

function renderSummary(risk) {
  document.getElementById("sumRiskScore").textContent = risk.score + "/" + risk.max_score;
  const zone = zoneOf(risk.score, risk);
  const zoneEl = document.getElementById("sumRiskZone");
  zoneEl.textContent = `ความเสี่ยง${zone.label} (เกณฑ์ต่ำ ≤${risk.low_max_score})`;
  zoneEl.style.color = cssVar(`--status-${zone.key}`);

  document.getElementById("sumOrdersAtRisk").textContent = risk.orders_at_risk + " รายการ";

  const siteEntries = Object.entries(risk.by_site_risk).sort((a, b) => b[1] - a[1]);
  const [topId, topScore] = siteEntries[0];
  document.getElementById("sumTopRiskSite").textContent = SITE_NAMES[topId];
  document.getElementById("sumTopRiskSiteDetail").textContent = `คะแนนความเสี่ยงสัมพัทธ์ ${topScore.toFixed(1)}`;
}

const riskZoneBandsPlugin = {
  id: "riskZoneBands",
  beforeDraw(chart, args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const y = scales.y;
    const top = chartArea.top;
    const bottom = chartArea.bottom;
    const yLow = y.getPixelForValue(opts.lowMax);
    const yMed = y.getPixelForValue(opts.medMax);
    ctx.save();
    ctx.fillStyle = colorWithAlpha(cssVar("--status-good"), 0.08);
    ctx.fillRect(chartArea.left, Math.max(top, yLow), chartArea.width, Math.max(0, bottom - Math.max(top, yLow)));
    ctx.fillStyle = colorWithAlpha(cssVar("--status-warning"), 0.08);
    ctx.fillRect(chartArea.left, Math.max(top, yMed), chartArea.width, Math.max(0, yLow - Math.max(top, yMed)));
    ctx.fillStyle = colorWithAlpha(cssVar("--status-critical"), 0.08);
    ctx.fillRect(chartArea.left, top, chartArea.width, Math.max(0, yMed - top));
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

function renderTrendChart(risk, months) {
  const ctx = document.getElementById("riskTrendChart");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "คะแนนความเสี่ยง",
          data: risk.score_trend,
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
        riskZoneBands: { lowMax: risk.low_max_score, medMax: risk.medium_max_score },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 } },
          beginAtZero: true,
          max: Math.max(risk.medium_max_score + 10, ...risk.score_trend) + 5,
        },
      },
    },
    plugins: [riskZoneBandsPlugin],
  });
}

function renderFactorChart(risk) {
  const factors = [...risk.factors].sort((a, b) => b.points - a.points);
  const ctx = document.getElementById("riskFactorChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: factors.map((f) => f.name_th),
      datasets: [
        {
          data: factors.map((f) => f.points),
          backgroundColor: cssVar("--series-1"),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 24 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { color: cssVar("--text-primary"), font: { size: 11 } } },
      },
    },
    plugins: [
      {
        id: "factorLabels",
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          const meta = chart.getDatasetMeta(0);
          ctx.save();
          ctx.font = "700 11px 'Noto Sans Thai', sans-serif";
          ctx.fillStyle = cssVar("--text-primary");
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          meta.data.forEach((bar, i) => {
            ctx.fillText(factors[i].points + " คะแนน", bar.x + 8, bar.y);
          });
          ctx.restore();
        },
      },
    ],
  });

  const top = [...risk.factors].sort((a, b) => b.points - a.points)[0];
  document.getElementById("riskFactorNote").textContent =
    `"${top.name_th}" เป็นปัจจัยที่ส่งผลต่อคะแนนความเสี่ยงมากที่สุด (${top.points} จาก ${risk.score} คะแนนรวม) - ดูรายละเอียดเครื่องจักรได้ที่ตาราง "รายการความผิดปกติของเครื่องจักร" ในหน้าแดชบอร์ดหลัก`;
}

function renderOrdersTable(risk, orderExecution) {
  const tbody = document.getElementById("atRiskOrdersBody");
  tbody.innerHTML = "";
  const levelKey = { ต่ำ: "good", กลาง: "warning", สูง: "critical" };
  risk.at_risk_orders.forEach((r) => {
    const order = orderExecution.find((o) => o.id === r.order_id);
    if (!order) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.id}</td>
      <td>${SITE_NAMES[order.site_id]}</td>
      <td>${order.stage_th}</td>
      <td>${order.progress_pct}%</td>
      <td><span class="zone-badge zone-${levelKey[r.level]}">${r.level}</span></td>
      <td class="cell-wrap">${r.reason_th}</td>`;
    tbody.appendChild(tr);
  });
}

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    try {
      const risk = data.kpi_summary.delivery_risk;
      const months = data.kpi_summary.total_gross_revenue.months;
      renderHeader(data);
      renderSummary(risk);
      renderTrendChart(risk, months);
      renderFactorChart(risk);
      renderOrdersTable(risk, data.order_execution);
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
