---
name: abhishekdoesstuff-page
description: Add, update, test, and publish pages in the abhishekdoesstuff.com repository. Use for static pages, interactive pages, live-data pages, historical media collections, Musings, navigation or sitemap changes, and Coolify deployment troubleshooting in this repo.
---

# Abhishek Does Stuff Page

Work from the repository root. Read `AGENTS.md`, then inspect the working tree before editing. Preserve unrelated changes and keep commits focused.

## Choose the page type

- Use `content/musings/<slug>/index.md` for an article or research note. `musings.js` builds these routes at startup; follow the front matter documented in `README.md`.
- Use `<slug>/index.html` plus root-level `<slug>.css` and `<slug>.js` for a designed or interactive page. Existing examples are `birds/` and `debabufy/`.
- Extend the homepage only when the request truly belongs on `/`; keep it static and fast.

Before designing, inspect `index.html`, `styles.css`, and the closest existing page. Reuse the maker-lab visual language, header/footer, CSS variables, typography, and practical tone unless the request explicitly calls for a new direction.

## Build a standalone page

1. Create semantic, accessible markup at `<slug>/index.html`.
2. Put page-specific presentation and behavior in root-level `<slug>.css` and `<slug>.js`. Use versioned URLs such as `/<slug>.css?v=YYYYMMDD-1` when changing cacheable assets.
3. Include canonical, description, Open Graph/Twitter, favicon, and viewport metadata. Use the production origin `https://abhishekdoesstuff.com`.
4. Support narrow screens, keyboard use, reduced motion, and useful loading, empty, and error states. Prefer progressive enhancement and native controls/dialogs.
5. Add the page to relevant navigation and footer surfaces without making the homepage heavy.

## Wire every public file

This repository is deny-by-default. A file existing in Git does not make it public.

Update `server.js` `PUBLIC_FILES` for:

- `/<slug>/` and `/<slug>/index.html` pointing to `<slug>/index.html`.
- Every page CSS, JavaScript, image, data, font, or download route.
- The extension MIME type in `TYPES` if it is new.

Add a redirect from `/<slug>` to `/<slug>/` in the main request handler. Use `CACHE.document` for HTML and CSS while iterating, `CACHE.asset` for ordinary assets, and long immutable caching only for content-addressed or intentionally stable media.

Update the Dockerfile separately:

- Add root files to its explicit root `COPY` instruction.
- Add `COPY <slug> ./<slug>` for the page directory.
- Ensure referenced `assets/` and `data/` directories are already copied.

Finally, add the canonical URL and current `lastmod` to `sitemap.xml`.

## Add historical media

Check artwork or archive media into `assets/<collection>/` instead of hotlinking it. Keep a machine-readable metadata file under `data/` with creator, work title, date, source page, source institution, and rights/licence fields. Preserve the original source URL even when serving a local copy.

If code derives asset routes from the metadata, validate every entry and add those routes to `PUBLIC_FILES` at startup. Never imply that public-domain status is known without recording the source's rights statement.

## Add live data safely

Do not connect the browser directly to a LAN service. Add a same-origin server route that fetches the upstream, validates it, and constructs a new narrow public object from allowed fields. Never pass through unknown fields.

For any live API, read [Live API and Coolify](references/live-api-and-coolify.md) before editing. It contains the required timeout, size, schema, streaming, environment, and deployment rules.

## Validate locally

Run the checks relevant to the change:

```bash
node --check server.js
node --check <slug>.js
npm start
```

With the server running, request the exact canonical page, its CSS/JS/assets, and any API route. Confirm the no-slash URL redirects, unknown paths remain 404, `HEAD` behaves correctly, and HTML does not reference a route absent from `PUBLIC_FILES`.

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
