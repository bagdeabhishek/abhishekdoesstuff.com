# abhishekdoesstuff.com

Project workbench for Abhishek Bagade's GenAI, CAD, electronics, 3D-printing, and homelab builds.

Human-authored long-form writing remains at [abagade.com](https://abagade.com/). Clearly labeled AI-assisted research notes live here under [/musings/](https://abhishekdoesstuff.com/musings/).

## Markdown Musings

Each published Musing is stored as `content/musings/<slug>/index.md`. At startup, `musings.js` reads the front matter, renders GitHub-flavoured Markdown, and caches complete SEO-ready HTML pages in memory. The Markdown files are source files and are not served directly.

Use this minimal front matter for a new note:

```yaml
---
title: A useful title
permalink: /musings/a-useful-title/
---
```

Set `published: false` to keep a draft out of the collection. Existing moved URLs can use `redirect_to`.

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

Agent lives in `agent/`. Deploy it on host/LXC and reverse-proxy `/api/status` to `http://<agent-ip>:9109/status`. The public server validates and rebuilds the documented schema rather than forwarding arbitrary upstream fields.

## Coolify

Use Static/Nixpacks app from this repo. No build command required. Start command:

```bash
npm start
```

Set optional env vars:

- `STATUS_UPSTREAM=http://192.168.1.61:9109/status` — live M900 telemetry source.
- `GA_MEASUREMENT_ID=G-XXXXXXXXXX` — enables Google Analytics 4 via `/analytics.js`.

## SEO

The homepage ships with canonical tags, Open Graph/Twitter card metadata, JSON-LD `ProfilePage` + `Person` + `WebSite` schema, `robots.txt`, `sitemap.xml`, `humans.txt`, favicons, and a 1200×630 share card at `/og.png`.

Only routes explicitly listed in `server.js` are public. Add every new static asset to `PUBLIC_FILES` and the Docker image before referencing it from a page.
