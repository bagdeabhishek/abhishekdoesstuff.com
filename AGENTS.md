# AGENTS.md

## Project

`abhishekdoesstuff.com` is Abhishek Bagade's Astro-based hacker/maker homepage. Astro generates static pages; a small Node HTTP server serves only the generated build manifest and retains the public-safe telemetry, BirdNET, SSE, and analytics endpoints.

## Commands

Use Node 24 (minimum supported version is Node 22.22).

```bash
npm ci
npm run dev
npm run check
npm run build
npm start
```

`npm start` expects a completed build in `dist/` plus `build/manifest.json`.

## Structure

- `src/pages/` — Astro file-based routes
- `src/layouts/` — shared document and article layouts
- `src/components/` — reusable UI
- `src/styles/` — imported global and page-specific CSS
- `content/musings/<slug>/index.md` — private Markdown source for native content collections
- `public/` — files copied byte-for-byte to `dist/` at stable public URLs
- `scripts/build-site.mjs` — post-build manifest and redirect generation
- `server.js` — static manifest server and validated runtime API boundary
- `data/bird-art.json` — private runtime metadata used by the bird API

## Constraints

- Preserve existing URLs, aliases, visual design, accessibility, light/dark mode, and SEO metadata.
- Put static files that need literal public URLs under `public/`; do not put source content or private runtime data there.
- Treat `build/manifest.json` as the static serving allowlist. Do not add hand-maintained static allowlists to `server.js`.
- Keep the homepage static and fast. Reuse shared layouts and components instead of duplicating site chrome.
- Public APIs must not expose LAN IPs, usernames, mounts, process names, kernel arguments, container IDs, service lists, internal ports, microphone/source IDs, clip names, or audio paths.
- Do not change Compose/Coolify routing, webhook, network, or environment wiring unless the task explicitly requires it.
- Prefer direct CAD/project download links and a practical maker tone.

## Deployment

Docker and Nixpacks install all locked dependencies for the Astro build, run `npm run build`, then start `server.js`. The Docker runtime requires only `server.js`, `dist/`, `build/manifest.json`, and `data/bird-art.json`; it does not require `node_modules`.

Coolify runs the Node server. `STATUS_UPSTREAM` and `BIRDNET_UPSTREAM` remain server-side. A successful webhook means a deployment was accepted, so verify the built commit and production routes before reporting success.
