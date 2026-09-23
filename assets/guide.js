/* Guide page - static content, only needs theme sync and company name from dashboard.json. */

const DATA_URL = "data/dashboard.json";

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

fetch(DATA_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    document.getElementById("dashCompany").textContent = data.meta.company_th;
    initTheme();
  })
  .catch(() => {
    initTheme();
  });
