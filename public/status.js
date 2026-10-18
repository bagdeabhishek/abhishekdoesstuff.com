const STATUS_ENDPOINT = "/api/status";

const $ = (id) => document.getElementById(id);

function fmtUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function setPct(id, barId, value) {
  const pct = Number(value);
  if (!Number.isFinite(pct)) {
    $(id).textContent = "—";
    $(barId).style.width = "0%";
    return;
  }
  const safePct = Math.max(0, Math.min(100, Math.round(pct)));
  $(id).textContent = `${safePct}%`;
  $(barId).style.width = `${safePct}%`;
}

async function refreshStatus() {
  try {
    const response = await fetch(STATUS_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    $("metric-host").textContent = data.host || "m900-tiny";
    $("metric-uptime").textContent = fmtUptime(Number(data.uptime_seconds));
    $("metric-load").textContent = Number.isFinite(Number(data.load_1m)) ? Number(data.load_1m).toFixed(2) : "—";
    $("metric-temp").textContent = Number.isFinite(Number(data.cpu_temp_c)) ? `${Math.round(Number(data.cpu_temp_c))}°C` : "n/a";
    setPct("metric-ram", "metric-ram-bar", data.memory_used_pct);
    setPct("metric-disk", "metric-disk-bar", data.disk_used_pct);

    $("lab").dataset.status = "online";
    $("metric-connection").textContent = "Live homelab telemetry";
    const stamp = data.updated_at ? new Date(data.updated_at) : new Date();
    $("metric-updated").textContent = `updated ${stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    $("lab").dataset.status = "unavailable";
    $("metric-connection").textContent = "Live vitals unavailable";
    for (const id of ["metric-uptime", "metric-load", "metric-temp", "metric-ram", "metric-disk"]) {
      $(id).textContent = "—";
    }
    $("metric-ram-bar").style.width = "0%";
    $("metric-disk-bar").style.width = "0%";
    $("metric-updated").textContent = "Telemetry is unavailable. Retrying every minute.";
  }
}

if ($("metric-updated")) {
  refreshStatus();
  setInterval(refreshStatus, 60000);
}

// Progressive homepage navigation; the directory also works without JavaScript.
(() => {
  const contentsMenus = [...document.querySelectorAll("[data-contents]")];
  if (contentsMenus.length) {
    const compactContents = matchMedia("(max-width: 980px)");
    const updateContents = () => {
      for (const contents of contentsMenus) contents.open = !compactContents.matches;
    };
    compactContents.addEventListener("change", updateContents);
    updateContents();
  }
  const menu = document.querySelector("[data-nav-menu]");
  if (!menu) return;
  const summary = menu.querySelector("summary");
  menu.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    menu.open = false;
    if (link.hash && link.pathname === location.pathname) {
      const target = document.getElementById(link.hash.slice(1));
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener("click", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });

  if (document.body.classList.contains("subpage")) return;
  const links = [...document.querySelectorAll("[data-section-link]")];
  const sections = ["top", "builds", "listening", "field-notes", "writing"]
    .map((id) => document.getElementById(id)).filter(Boolean);
  const header = document.querySelector(".site-header");
  let scheduled = false;
  function updateLocation() {
    const cutoff = header.getBoundingClientRect().bottom + 80;
    let current = sections[0]?.id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= cutoff) current = section.id;
    }
    const labBounds = $("lab").getBoundingClientRect();
    if (labBounds.top <= cutoff && labBounds.bottom > header.getBoundingClientRect().bottom + 10) {
      current = "lab";
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
      current = sections[sections.length - 1]?.id;
    }
    for (const link of links) {
      if (link.dataset.sectionLink === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    scheduled = false;
  }
  function scheduleLocation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateLocation);
  }
  addEventListener("scroll", scheduleLocation, { passive: true });
  addEventListener("resize", scheduleLocation);
  updateLocation();
})();
