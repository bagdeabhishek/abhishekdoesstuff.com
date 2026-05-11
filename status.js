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

    const stamp = data.updated_at ? new Date(data.updated_at) : new Date();
    $("metric-updated").textContent = `updated ${stamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    $("metric-updated").textContent = "status API offline; page still static";
  }
}

refreshStatus();
setInterval(refreshStatus, 60000);
