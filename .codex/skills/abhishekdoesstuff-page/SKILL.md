---
name: abhishekdoesstuff-page
description: Add, update, test, and publish pages in the abhishekdoesstuff.com repository. Use for static pages, interactive pages, live-data pages, historical media collections, Musings, navigation or sitemap changes, and Coolify deployment troubleshooting in this repo.
---

# Abhishek Does Stuff Page

Work from the repository root. Read `AGENTS.md`, then inspect the working tree before editing. Preserve unrelated changes and keep commits focused.

## Choose the page type

- Use `content/musings/<slug>/index.md` for an article or research note. Astro's content collection renders these at build time; follow the front matter documented in `README.md`.
- Use `src/pages/<slug>/index.astro` for a designed or interactive page. Put reusable UI in `src/components/`, shared document structure in `src/layouts/`, and imported page styles in `src/styles/`. Existing examples include `birds` and `debabufy`.
- Extend the homepage only when the request truly belongs on `/`; keep it static and fast.

Before designing, inspect the shared layouts and components, the global styles, and the closest existing page. Reuse the maker-lab visual language, header/footer, CSS variables, typography, and practical tone unless the request explicitly calls for a new direction.

## Build a standalone page

1. Create semantic, accessible markup at `src/pages/<slug>/index.astro` and compose the shared layout instead of copying site chrome.
2. Import page-specific presentation from `src/styles/` with `?url` and pass the URL through `SiteLayout`'s `styles` prop so it follows shared styles. Put browser JavaScript in `public/` only when it must remain a plain script at a stable URL.
3. Supply the shared layout's title, description, canonical path, and any page-specific metadata. Use the production origin `https://abhishekdoesstuff.com`.
4. Support narrow screens, keyboard use, reduced motion, and useful loading, empty, and error states. Prefer progressive enhancement and native controls/dialogs.
5. Add the page to relevant navigation and footer surfaces without making the homepage heavy.

## Wire public files and routes

This repository is deny-by-default. Astro writes deployable files to `dist/`, then `scripts/build-site.mjs` generates `build/manifest.json`. The Node server serves only paths in that manifest.

- Put byte-for-byte public assets in `public/`. Its directory structure is its URL structure: `public/assets/example.png` becomes `/assets/example.png`.
- Create page routes in `src/pages/`. A directory `index.astro` produces the canonical trailing-slash URL.
- Add aliases and redirects through the existing Astro/post-build conventions so the generated manifest records them.
- Keep Markdown, source files, private data, and server configuration outside `public/`.
- Add a MIME mapping in `server.js` only when introducing a file extension the server does not already recognize.

Do not hand-edit a `PUBLIC_FILES` list or add per-page Docker copies. The build output and generated manifest are the public boundary. Update `public/sitemap.xml` when a canonical URL is added or removed.

## Add historical media

Check artwork or archive media into `public/assets/<collection>/` instead of hotlinking it. Keep a machine-readable metadata file under `data/` with creator, work title, date, source page, source institution, and rights/licence fields. Preserve the original source URL even when serving a local copy.

If code derives asset routes from the metadata, validate every entry and ensure the corresponding files are present in `public/` at build time. Never imply that public-domain status is known without recording the source's rights statement.

## Add live data safely

Do not connect the browser directly to a LAN service. Add a same-origin server route that fetches the upstream, validates it, and constructs a new narrow public object from allowed fields. Never pass through unknown fields.

For any live API, read [Live API and Coolify](references/live-api-and-coolify.md) before editing. It contains the required timeout, size, schema, streaming, environment, and deployment rules.

## Validate locally

Run the checks relevant to the change:

```bash
node --check server.js
npm run check
npm run build
npm start
```

With the built server running, request the exact canonical page, its CSS/JS/assets, and any API route. Confirm the no-slash URL redirects, unknown paths remain 404, `HEAD` behaves correctly, and HTML does not reference a route absent from `build/manifest.json`.

For a live-data page, test normal data, upstream unavailability, malformed data, timeout behavior, and streaming readiness where applicable. Do not weaken validation merely to make a sample payload pass.

Before committing, run:

```bash
git diff --check
git status --short
git diff --stat
```

Review the full diff for accidental secrets, LAN details exposed to the client, stale cache versions, broken canonical URLs, missing attribution, and unrelated edits.

## Commit, push, and verify

Commit only the intended files with an imperative message. Push only when the user asked to publish or push.

A successful Git push or accepted GitHub webhook is not proof of a successful Coolify deployment. Follow the verification procedure in [Live API and Coolify](references/live-api-and-coolify.md): confirm the deployment built the new commit, then request a visible marker and any API route from production.

Report the commit hash, what was verified, and any deployment issue that still needs attention.
