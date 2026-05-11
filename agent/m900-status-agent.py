#!/usr/bin/env python3
"""Public-safe host telemetry API for abhishekdoesstuff.com.

Expose behind Coolify/Caddy as /api/status. Designed to run on the host or in a
small LXC with read-only access to the relevant proc/sys paths.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST_LABEL = os.getenv("STATUS_HOST_LABEL", "lenovo-m900-tiny")
LOCATION = os.getenv("STATUS_LOCATION", "Bengaluru")
PORT = int(os.getenv("STATUS_PORT", "9109"))
PROC_ROOT = Path(os.getenv("STATUS_PROC_ROOT", "/proc"))
SYS_ROOT = Path(os.getenv("STATUS_SYS_ROOT", "/sys"))
DISK_PATH = os.getenv("STATUS_DISK_PATH", "/")


def read_float(path: Path) -> float | None:
    try:
        return float(path.read_text().strip())
    except Exception:
        return None


def cpu_temp_c() -> float | None:
    thermal_root = SYS_ROOT / "class/thermal"
    for zone in sorted(thermal_root.glob("thermal_zone*/temp")):
        value = read_float(zone)
        if value is None:
            continue
        if value > 1000:
            value = value / 1000.0
        if 0 < value < 120:
            return round(value, 1)
    hwmon_root = SYS_ROOT / "class/hwmon"
    for temp in sorted(hwmon_root.glob("hwmon*/temp*_input")):
        value = read_float(temp)
        if value is None:
            continue
        if value > 1000:
            value = value / 1000.0
        if 0 < value < 120:
            return round(value, 1)
    return None


def memory_used_pct() -> int | None:
    values: dict[str, int] = {}
    try:
        for line in (PROC_ROOT / "meminfo").read_text().splitlines():
            key, raw = line.split(":", 1)
            values[key] = int(raw.strip().split()[0])
        total = values.get("MemTotal")
        available = values.get("MemAvailable")
        if not total or available is None:
            return None
        return round((1 - available / total) * 100)
    except Exception:
        return None


def disk_used_pct() -> int | None:
    try:
        usage = shutil.disk_usage(DISK_PATH)
        return round((usage.used / usage.total) * 100)
    except Exception:
        return None


def uptime_seconds() -> int:
    try:
        return round(float((PROC_ROOT / "uptime").read_text().split()[0]))
    except Exception:
        return round(time.monotonic())


def load_1m() -> float:
    try:
        return round(float((PROC_ROOT / "loadavg").read_text().split()[0]), 2)
    except Exception:
        return round(os.getloadavg()[0], 2)


def status_payload() -> dict[str, object]:
    return {
        "host": HOST_LABEL,
        "location": LOCATION,
        "uptime_seconds": uptime_seconds(),
        "load_1m": load_1m(),
        "memory_used_pct": memory_used_pct(),
        "disk_used_pct": disk_used_pct(),
        "cpu_temp_c": cpu_temp_c(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib API
        if self.path not in ("/", "/status", "/api/status"):
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps(status_payload(), separators=(",", ":")).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()
