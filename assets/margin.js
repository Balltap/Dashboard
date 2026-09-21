/* Gross Profit Margin detail page.
   Reads the same data/dashboard.json as the main dashboard
   (kpi_summary.total_gross_revenue for the revenue trend/months,
   kpi_summary.gross_profit_margin for everything margin/cost-specific). */

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
function fmtTHB(n) {
  if (n >= 1e6) return fmtNum(n / 1e6, { maximumFractionDigits: 1 }) + " ล้านบาท";
  return fmtNum(n) + " บาท";
}
function fmtPct(n, digits = 1) {
  return (n >= 0 ? "+" : "") + n.toFixed(digits) + "%";
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

function renderSummary(margin, rev) {
  document.getElementById("sumCurrentMargin").textContent = margin.current_pct + "%";
  const gap = margin.current_pct - margin.target_pct;
  const gapEl = document.getElementById("sumMarginGap");
  gapEl.textContent = `เป้าหมาย ${margin.target_pct}% (${gap >= 0 ? "สูงกว่า" : "ต่ำกว่า"}เป้า ${Math.abs(gap).toFixed(0)} จุด)`;
  gapEl.style.color = gap >= 0 ? cssVar("--status-good") : cssVar("--status-critical");

  const annualGP = margin.gross_profit_thb.reduce((a, b) => a + b, 0);
  const annualCogs = margin.cogs_thb.reduce((a, b) => a + b, 0);
  document.getElementById("sumGrossProfit").textContent = fmtTHB(annualGP);
  document.getElementById("sumCogsTotal").textContent = "ต้นทุนขายสะสม " + fmtTHB(annualCogs);

  const sites = SITE_COLS.map((s) => ({ ...s, ...margin.by_site[s.id] }));
  const best = sites.reduce((a, b) => (b.margin_pct > a.margin_pct ? b : a));
  const worst = sites.reduce((a, b) => (b.margin_pct < a.margin_pct ? b : a));
  document.getElementById("sumSiteSpread").textContent =
    (best.margin_pct - worst.margin_pct).toFixed(0) + " จุด";
  document.getElementById("sumSiteSpreadDetail").textContent =
    `${best.name_th} ${best.margin_pct}% สูงสุด · ${worst.name_th} ${worst.margin_pct}% ต่ำสุด`;
}

function renderTrendChart(margin, rev) {
  const ctx = document.getElementById("marginTrendChart");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: rev.months,
      datasets: [
        {
          label: "อัตรากำไรจริง",
          data: margin.margin_pct_trend,
          borderColor: cssVar("--series-1"),
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
        },
        {
          label: "เป้าหมาย",
          data: rev.months.map(() => margin.target_pct),
          borderColor: cssVar("--text-muted"),
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 6 } },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), font: { size: 10 }, callback: (v) => v + "%" },
          suggestedMin: 20,
          suggestedMax: 50,
        },
      },
    },
  });
}

function renderBridgeChart(margin) {
  const toM = (n) => Math.round((n / 1e6) * 10) / 10;
  const revenueM = toM(margin.cogs_thb.reduce((a, b) => a + b, 0) + margin.gross_profit_thb.reduce((a, b) => a + b, 0));
  const materialM = toM(margin.cost_breakdown_thb.material.reduce((a, b) => a + b, 0));
  const energyM = toM(margin.cost_breakdown_thb.energy.reduce((a, b) => a + b, 0));
  const overheadM = toM(margin.cost_breakdown_thb.overhead.reduce((a, b) => a + b, 0));
  const gpM = toM(margin.gross_profit_thb.reduce((a, b) => a + b, 0));

  let running = revenueM;
  const afterMaterial = running - materialM;
  const afterEnergy = afterMaterial - energyM;
  const afterOverhead = afterEnergy - overheadM;

  const labels = ["รายได้รวม", "วัตถุดิบ", "พลังงาน", "ค่าโสหุ้ย", "กำไรขั้นต้น"];
  const ranges = [
    [0, revenueM],
    [afterMaterial, revenueM],
    [afterEnergy, afterMaterial],
    [afterOverhead, afterEnergy],
    [0, gpM],
  ];
  const deltas = [revenueM, -materialM, -energyM, -overheadM, gpM];
  const colors = [
    cssVar("--series-1"),
    cssVar("--text-muted"),
    cssVar("--text-muted"),
    cssVar("--text-muted"),
    cssVar("--status-good"),
  ];

  const bridgeLabelsPlugin = {
    id: "bridgeLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.font = "700 10px 'Noto Sans Thai', sans-serif";
      ctx.textAlign = "center";
      meta.data.forEach((bar, i) => {
        const top = Math.min(bar.y, bar.base);
        ctx.fillStyle = cssVar("--text-primary");
        const text = (deltas[i] > 0 ? "+" : "") + fmtNum(deltas[i], { maximumFractionDigits: 1 }) + "M";
        ctx.fillText(text, bar.x, top - 6);
      });
      ctx.restore();
    },
  };

  const ctx = document.getElementById("marginBridgeChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: ranges, backgroundColor: colors, borderRadius: 4, barPercentage: 0.6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar("--text-muted"), font: { size: 10 } } },
        y: { display: false, suggestedMin: 0, suggestedMax: revenueM * 1.08 },
      },
    },
    plugins: [bridgeLabelsPlugin],
  });
}

function renderSiteTable(margin) {
  const tbody = document.getElementById("siteMarginBody");
  const tfoot = document.getElementById("siteMarginFoot");
  tbody.innerHTML = "";
  const sites = SITE_COLS.map((s) => ({ ...s, ...margin.by_site[s.id] })).sort(
    (a, b) => b.margin_pct - a.margin_pct
  );
  sites.forEach((s) => {
    const gap = s.margin_pct - margin.target_pct;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name_th}</td>
      <td>${fmtNum(s.revenue_thb)}</td>
      <td>${fmtNum(s.cogs_thb)}</td>
      <td class="cell-total">${fmtNum(s.gross_profit_thb)}</td>
      <td class="cell-cumulative">${s.margin_pct.toFixed(1)}%</td>
      <td class="${gap >= 0 ? "cell-up" : "cell-down"}">${fmtPct(gap, 0)} จุด</td>`;
    tbody.appendChild(tr);
  });

  const totalRevenue = sites.reduce((a, s) => a + s.revenue_thb, 0);
  const totalCogs = sites.reduce((a, s) => a + s.cogs_thb, 0);
  const totalGP = sites.reduce((a, s) => a + s.gross_profit_thb, 0);
  const totalMargin = (totalGP / totalRevenue) * 100;
  tfoot.innerHTML = `
    <tr>
      <td>รวมทั้งบริษัท</td>
      <td>${fmtNum(totalRevenue)}</td>
      <td>${fmtNum(totalCogs)}</td>
      <td>${fmtNum(totalGP)}</td>
      <td>${totalMargin.toFixed(1)}%</td>
      <td>-</td>
    </tr>`;

  const worst = sites[sites.length - 1];
  document.getElementById("siteMarginNote").textContent =
    `${worst.name_th} มีอัตรากำไรต่ำสุดในกลุ่ม ซึ่งสอดคล้องกับการใช้กำลังการผลิตที่ต่ำกว่าโรงงานอื่น (ต้นทุนคงที่ถูกกระจายไปตามหน่วยผลิตที่น้อยกว่า) - ดูรายละเอียดได้ที่ตาราง "สรุปตัวชี้วัดรายโรงงาน" ในหน้าแดชบอร์ดหลัก`;
}

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    try {
      const margin = data.kpi_summary.gross_profit_margin;
      const rev = data.kpi_summary.total_gross_revenue;
      renderHeader(data);
      renderSummary(margin, rev);
      renderTrendChart(margin, rev);
      renderBridgeChart(margin);
      renderSiteTable(margin);
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
