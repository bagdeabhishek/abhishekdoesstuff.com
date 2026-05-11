# abhishekdoesstuff.com

Static homepage for Abhishek Bagade's maker/hacker front door.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

## Status API

`server.js` serves static files and proxies `/api/status` to `STATUS_UPSTREAM` (default `http://192.168.1.61:9109/status`). Frontend polls `/api/status` every 60 seconds. Public-safe schema:

```json
{
  "host": "lenovo-m900-tiny",
  "location": "Bengaluru",
  "uptime_seconds": 12345,
  "load_1m": 0.18,
  "memory_used_pct": 41,
  "disk_used_pct": 63,
  "cpu_temp_c": 49,
  "updated_at": "2026-05-11T00:00:00Z"
}
```

Agent lives in `agent/`. Deploy it on host/LXC and reverse-proxy `/api/status` to `http://<agent-ip>:9109/status`.

## Coolify

Use Static/Nixpacks app from this repo. No build command required. Start command:

```bash
npm start
```

Set optional env vars:

- `STATUS_UPSTREAM=http://192.168.1.61:9109/status` — live M900 telemetry source.
- `GA_MEASUREMENT_ID=G-XXXXXXXXXX` — enables Google Analytics 4 via `/analytics.js`.

## SEO

The homepage ships with canonical tags, Open Graph/Twitter card metadata, JSON-LD `Person` + `WebSite` schema, `robots.txt`, `sitemap.xml`, `humans.txt`, and a share-card SVG at `/og.svg`.
