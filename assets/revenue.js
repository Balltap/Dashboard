/* Revenue detail page - accounting-style monthly ledger by site.
   Reads the same data/dashboard.json as the main dashboard (kpi_summary.total_gross_revenue),
   so editing that one file keeps both pages in sync. */

const DATA_URL = "data/dashboard.json";
const SITE_COLS = [
  { id: "PCB", name_th: "เพชรบูรณ์" },
  { id: "SKA", name_th: "สงขลา" },
  { id: "CNX", name_th: "เชียงใหม่" },
];

function fmtNum(n, opts = {}) {
  return new Intl.NumberFormat("th-TH", opts).format(n);
}
function fmtTHB(n) {
  if (n >= 1e6) return fmtNum(n / 1e6, { maximumFractionDigits: 1 }) + " ล้านบาท";
  return fmtNum(n) + " บาท";
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

function renderSummary(rev) {
  const months = rev.months;
  const total = rev.trend_thb.reduce((a, b) => a + b, 0);
  const avg = total / months.length;
  document.getElementById("sumTotal").textContent = fmtTHB(total);
  document.getElementById("sumPeriod").textContent =
    `สะสม ${months.length} เดือน (${months[0]} - ${months[months.length - 1]})`;
  document.getElementById("sumAvg").textContent = fmtTHB(avg);

  const siteTotals = SITE_COLS.map((s) => ({
    ...s,
    total: rev.by_site_thb[s.id].reduce((a, b) => a + b, 0),
  }));
  const top = siteTotals.reduce((a, b) => (b.total > a.total ? b : a));
  document.getElementById("sumTopSite").textContent = top.name_th;
  document.getElementById("sumTopSiteShare").textContent =
    fmtTHB(top.total) + ` (${((top.total / total) * 100).toFixed(1)}%)`;
}

function renderLedger(rev) {
  const months = rev.months;
  const tbody = document.getElementById("revenueLedgerBody");
  const tfoot = document.getElementById("revenueLedgerFoot");
  tbody.innerHTML = "";
  let cumulative = 0;
  const siteSums = { PCB: 0, SKA: 0, CNX: 0 };
  months.forEach((m, i) => {
    const monthTotal = rev.trend_thb[i];
    const prevTotal = i > 0 ? rev.trend_thb[i - 1] : null;
    const momPct = prevTotal ? (((monthTotal - prevTotal) / prevTotal) * 100).toFixed(1) : null;
    cumulative += monthTotal;
    SITE_COLS.forEach((s) => (siteSums[s.id] += rev.by_site_thb[s.id][i]));

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m}</td>
      ${SITE_COLS.map((s) => `<td>${fmtNum(rev.by_site_thb[s.id][i])}</td>`).join("")}
      <td class="cell-total">${fmtNum(monthTotal)}</td>
      <td class="${momPct === null ? "" : momPct >= 0 ? "cell-up" : "cell-down"}">${
        momPct === null ? "-" : (momPct >= 0 ? "+" : "") + momPct + "%"
      }</td>
      <td class="cell-cumulative">${fmtNum(cumulative)}</td>`;
    tbody.appendChild(tr);
  });

  const grandTotal = rev.trend_thb.reduce((a, b) => a + b, 0);
  tfoot.innerHTML = `
    <tr>
      <td>รวมทั้งปี</td>
      ${SITE_COLS.map((s) => `<td>${fmtNum(siteSums[s.id])}</td>`).join("")}
      <td>${fmtNum(grandTotal)}</td>
      <td>-</td>
      <td>${fmtNum(grandTotal)}</td>
    </tr>`;
}

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    try {
      const rev = data.kpi_summary.total_gross_revenue;
      renderHeader(data);
      renderSummary(rev);
      renderLedger(rev);
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
