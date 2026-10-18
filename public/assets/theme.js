// Apply the preference before styles load, then wire the visible control.
(() => {
  const key = "ads-theme";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") preference = saved;
  } catch (_) {
    // The toggle still works when browser storage is unavailable.
  }

  function apply() {
    const theme = preference || (system.matches ? "dark" : "light");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#191e1a" : "#f5f3ea");
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      button.hidden = false;
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.title = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
    }
  }

  apply();
  system.addEventListener("change", () => {
    if (!preference) apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
    apply();
  });
  function ready() {
    apply();
    for (const button of document.querySelectorAll("[data-theme-toggle]")) {
      button.addEventListener("click", () => {
        preference = root.dataset.theme === "dark" ? "light" : "dark";
        try { localStorage.setItem(key, preference); } catch (_) {}
        apply();
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
})();
