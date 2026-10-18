# abhishekdoesstuff.com

Project workbench for Abhishek Bagade's GenAI, CAD, electronics, 3D-printing, and homelab builds. The site is built as static HTML with Astro and served by a small Node HTTP server that also provides the validated status, BirdNET, server-sent events, and analytics endpoints.

Long-form writing is at [abagade.com](https://abagade.com/). Research notes live here under [/musings/](https://abhishekdoesstuff.com/musings/).

## Development

Use Node 24 (Astro 7.4.0 requires Node 22.22 or newer), then install the locked dependencies:

```bash
npm ci
npm run dev
```

The development command builds an initial snapshot, starts the validated Node API service on port 4322, and starts Astro with hot reload on port 4321. API and analytics requests are proxied to the Node service; change `DEV_API_PORT` if 4322 is occupied. The Astro development server listens on all interfaces. Before handing off a change, run:

```bash
npm run check
npm run build
npm test
npm start
```

`npm run build` first runs Astro, then `scripts/build-site.mjs` creates `build/manifest.json`. `npm start` (or `npm run preview`) runs `server.js` against the already-built `dist/` directory and manifest, including the live APIs and legacy URL aliases; it does not compile the site at startup.

## Project conventions

- Pages live in `src/pages/` and follow Astro's file-based routing. A directory `index.astro` produces a clean trailing-slash route. Preserve established public URLs and redirects when moving a page.
- Shared page chrome and metadata belong in `src/layouts/`. Reusable UI belongs in `src/components/`. Import page-only styles from `src/styles/` with `?url` and pass them to `SiteLayout`'s `styles` prop; this keeps them after the shared stylesheet in the cascade.
- Musings are native Astro content entries at `content/musings/<slug>/index.md`. Use the existing front matter shape, including `permalink`; set `published: false` for drafts and `redirect_to` for moved URLs. Content sources are private build inputs and are never copied into `dist/`.
- Browser-visible files that must keep an exact URL belong in `public/`. For example, `public/assets/theme.js` is served as `/assets/theme.js`, while `public/status.js` is served as `/status.js`. Keep private metadata such as `data/bird-art.json` outside `public/`.
- Add generated routes and redirect behavior through Astro and `scripts/build-site.mjs`. The Node server serves only entries in `build/manifest.json`; a file's presence in the repository does not make it public.

A new Musing starts with front matter like this:

```yaml
---
title: A useful title
permalink: /musings/a-useful-title/
---
```

## Status and BirdNET APIs

`server.js` proxies `/api/status` to `STATUS_UPSTREAM` (default `http://192.168.1.61:9109/status`). The frontend polls it every 60 seconds. The server validates the upstream response and reconstructs this public-safe schema:

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

The public bird routes are also deliberately narrow. `/api/birds` exposes only aggregated species counts and artwork metadata, while `/api/birds/stream` rewrites BirdNET-Go events to species, confidence, and detection time. Neither API forwards microphone names, source IDs, clip names, internal URLs, or audio paths.

The M900 agent lives in `agent/`. Deploy it on the host or LXC and point `STATUS_UPSTREAM` at its `/status` endpoint. Historical plates live under `public/assets/birds/`; their source and licence metadata remains private in `data/bird-art.json`. `node scripts/fetch-bird-art.mjs` fetches missing works; set `BIRD_ART_REFRESH=1` only when intentionally refreshing every local copy.

## Deployment

Both supported paths install development dependencies because Astro is a build dependency, run `npm run build`, and start the Node server with `npm start`.

The Dockerfile uses Node 24 in separate build and runtime stages. The runtime image contains only `server.js`, `dist/`, `build/manifest.json`, and `data/bird-art.json`; it does not need `node_modules`. Nixpacks uses Node 24, runs `npm ci`, and builds before starting.

Optional environment variables:

- `STATUS_UPSTREAM=http://192.168.1.61:9109/status` — live M900 telemetry source.
- `BIRDNET_UPSTREAM=http://192.168.1.91` — BirdNET-Go base URL for the live `/birds/` summary and detection stream.
- `GA_MEASUREMENT_ID=G-XXXXXXXXXX` — enables Google Analytics 4 through `/analytics.js`.

After deployment, verify the intended commit and request a visible page marker, its public assets, the no-slash redirect, and the relevant API routes. A successful Git push or accepted Coolify webhook only confirms that deployment was queued.

## SEO

Shared layouts emit canonical, Open Graph/Twitter, favicon, and structured metadata. Stable root assets such as `robots.txt`, `sitemap.xml`, `humans.txt`, favicons, and the 1200x630 share card remain in `public/` at their existing URLs.
