# Website contribution guide

This file tells coding agents and contributors how to add or update anything on **abhishekdoesstuff.com**. Apply these instructions throughout the repository and preserve unrelated work.

## Understand the website first

This is Abhishek Bagade's personal showcase for builds, repairs, GenAI experiments, CAD, electronics, and the homelab. Keep the practical maker voice and the distinctive paper, moss, and rust visual theme. Prefer real project details, useful images, and direct downloads over generic portfolio copy or decorative filler.

The stack is Astro + TypeScript for static pages and Markdown content collections, with a small Node HTTP server for production files, homelab telemetry, BirdNET, server-sent events, and analytics. Reuse the existing structure before adding a library or a new framework.

Before editing, read this file, inspect `git status --short`, and open the closest existing page and its styles. More detailed page and API instructions live in [.codex/skills/abhishekdoesstuff-page/SKILL.md](.codex/skills/abhishekdoesstuff-page/SKILL.md).

## Choose where the change belongs

| What you want to add or change | Where to work |
| --- | --- |
| Homepage introduction, featured build, field note, or lab section | `src/pages/index.astro` |
| A designed project page or interactive feature | `src/pages/<slug>/index.astro` |
| A research note / Musing | `content/musings/<slug>/index.md` |
| Shared page structure and metadata | `src/layouts/SiteLayout.astro` or `ArticleLayout.astro` |
| A reusable UI element | `src/components/` |
| Header links, Explore menu, or project count | `src/components/Header.astro` |
| Footer links, homepage portrait, or short bio | `src/components/Footer.astro` |
| Shared or page-specific presentation | `src/styles/` |
| Images, downloads, or scripts with stable public URLs | `public/`, usually `public/assets/<collection>/` |
| Search discovery and canonical URL listing | `public/sitemap.xml` |
| Server-side API validation or production HTTP behavior | `server.js` |
| Private artwork/source metadata | `data/` |
| Route aliases and the generated serving manifest | `scripts/build-site.mjs` |
| Collection front matter rules or Markdown rendering | `src/content.config.ts` and `src/lib/` |

Do not edit `dist/`, `.astro/`, `build/manifest.json`, or `node_modules/`. They are generated. Do not reintroduce duplicated root HTML pages or the former runtime Markdown renderer.

## Run the website locally

Use Node 24; the minimum supported Node version is 22.22.

```bash
npm ci
npm run dev
```

Development opens Astro on port **4321**, with hot reload. It builds an initial snapshot and starts the Node API service on **4322**; API and analytics requests go through Vite's same-origin proxy. Set `DEV_API_PORT` to change the backend port. The dev command forwards Astro CLI arguments, for example `npm run dev -- --port 4400`.

To preview the actual production server, including redirects and API behavior:

```bash
npm run build
npm start
```

The production server listens on port **3000**, or `PORT` when set. `npm run preview` is an alias for this server and also requires a completed build. Development allows URLs without trailing slashes so the API proxy can work; verify canonical redirects using the production server.

## Add a designed page

Create `src/pages/my-build/index.astro`. A minimal page with its own stylesheet looks like this:

```astro
---
import SiteLayout from "../../layouts/SiteLayout.astro";
import pageStyles from "../../styles/my-build.css?url";
---

<SiteLayout
  title="My build — Abhishek Does Stuff"
  description="A specific sentence explaining the build and what it does."
  canonicalPath="/my-build/"
  styles={[pageStyles]}
>
  <main id="main-content" class="article-shell">
    <header class="article-header">
      <p class="section-kicker">From the workbench</p>
      <h1>My build</h1>
      <p class="article-deck">What I made, why, and what I learned.</p>
    </header>
    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works">How it works</h2>
      <p>Start with the useful details.</p>
    </section>
  </main>
</SiteLayout>
```

Create the referenced `src/styles/my-build.css`, or omit the import and `styles` prop when shared styles are enough. The `?url` import and layout prop keep page styles **after** global styles. Do not change that ordering casually.

Use `SiteLayout` for the document, header, footer, theme control, status script, canonical URL, and social metadata. Do not copy those into each page. Supply accurate title and description; use its social-image and structured-data props when the defaults are unsuitable. Use the production origin `https://abhishekdoesstuff.com` for absolute metadata URLs.

Keep one visible `h1`, logical heading levels, unique anchor IDs, and the `main-content` skip-link target. See `src/pages/debabufy/index.astro` for a project page and `src/pages/birds/index.astro` for an interactive page with scripts and a dialog outside `main`.

Finally, link the page from an appropriate homepage section or shared navigation, and add its canonical URL to `public/sitemap.xml`. Creating an Astro route alone does not make it discoverable from the menus.

## Add or update a featured project

Edit the selected-build section in `src/pages/index.astro`, following a nearby project's markup and using a unique, descriptive ID. Include what the project does, the useful technical details, and working source, demo, CAD, or download links when available.

Put project images under `public/assets/projects/`. Add descriptive alt text and explicit dimensions; lazy-load images below the initial viewport. Preserve a sensible crop on mobile.

Update the homepage project index, numbering, any collection structured data that lists the projects, and the hard-coded count and wording in `Header.astro` when the featured total changes. A separate project page should use the shared layout described above. Keep the homepage fast and selective.

## Add a Musing

Create `content/musings/my-note/index.md`:

```markdown
---
title: "A useful research question"
permalink: /musings/my-note/
---

## Summary

Explain the finding and its practical relevance.

## What I tried

Describe the method, evidence, limitations, and sources.
```

Use a unique trailing-slash permalink under `/musings/`. The collection builds the article, archive entry, heading links, and research notice automatically. The layout supplies the title, so another Markdown `h1` is unnecessary. Follow existing notes for `Status:`, `Last updated:`, or `Completed:` lines; an ISO timestamp lets the archive order notes by their update date.

Set `published: false` in front matter for a draft. To move a note, retain an entry at the old permalink and set `redirect_to: /musings/new-note/`; the build converts its redirect page into an HTTP redirect. Preserve old published URLs. Update `public/sitemap.xml` manually for additions, removals, or moves; it is not generated from the collection.

Do not put Markdown sources under `public/`. Long-form writing hosted at `abagade.com` remains an external link unless the task explicitly asks to move it.

## Add assets, downloads, and interactions

Files under `public/` are copied to the build at the same URL: `public/assets/projects/example.webp` becomes `/assets/projects/example.webp`. Everything there is public. Keep credentials, private metadata, configuration, and source content elsewhere.

Optimize image size and format, preserve existing asset URLs, and use descriptive filenames. If replacing a cached asset at a stable URL, update its existing version query at the relevant references or give the replacement a new filename. Check the MIME mapping in `server.js` when adding an unfamiliar file type. Prefer direct, working CAD and project downloads.

For historical artwork, record creator, work title, date, source institution/page, and licence or rights statement under `data/`; preserve attribution in the UI. Bird artwork uses `data/bird-art.json`, files under `public/assets/birds/`, and `scripts/fetch-bird-art.mjs`. Do not refresh the full artwork cache unintentionally.

Use native controls, links, `details`, and dialogs where suitable. Astro can bundle a component's normal `<script>`; use a plain external script in `public/` with `is:inline` on its script tag only when it needs a stable URL. Keep executable scripts and CSS external in production: the Content Security Policy blocks inline handlers, inline executable scripts, and inline styles. Do not weaken that policy to make a widget work.

Scope behavior to the relevant component or page. Include loading, empty, error, and offline states for asynchronous features. Clean up timers and streams, and preserve keyboard focus when opening and closing dialogs.

## Keep the theme and navigation consistent

Use the existing CSS variables, including `--sheet`, `--surface`, `--ink`, `--subtle`, `--rule`, `--moss`, and `--vermilion`, instead of hard-coded light backgrounds or text colors. Check both light and dark themes, including images, diagrams, controls, and error states. Preserve system preference, manual preference persistence, and reduced-motion support.

Shared navigation lives in `Header.astro` and `Footer.astro`; home-section links must also work from subpages as `/#section-id`. Preserve the Explore menu, skip links, visible keyboard focus, and current-page indicators. Test narrow screens and long page titles for overflow.

The live homelab panel belongs near the top of the homepage. Keep the status display and theme control working when changing shared structure.

## Add live data or a server feature

Read [Live API and Coolify](.codex/skills/abhishekdoesstuff-page/references/live-api-and-coolify.md) before changing an API, stream, or runtime environment variable.

The browser must call a same-origin API in `server.js`, never a private LAN service directly. Validate upstream URL/protocol, content type, response size, timeout, schema, ranges, and timestamps; refuse upstream redirects. Construct an explicit public response and discard unknown fields. Return generic errors and `cache-control: no-store`.

Never expose LAN IPs, usernames, mounts, process names, kernel arguments, container IDs, service lists, internal ports, microphone/source IDs, clip names, audio paths, or secrets. Keep `STATUS_UPSTREAM` and `BIRDNET_UPSTREAM` server-side.

SSE must retain bounded buffering, recognized/sanitized event types, readiness, heartbeats, disconnect cleanup, and a non-streaming `HEAD` response. Extend `tests/server-regression.mjs` for meaningful API/security behavior changes.

When a feature requires a new environment variable, wire it through `server.js` and the Compose service environment, add a Docker default only when appropriate, and document it in `README.md`. Preserve existing Coolify routing, webhook, networks, and environment wiring unless the task requires changing them.

## Understand serving, dependencies, and deployment

`npm run build` runs Astro and then `scripts/build-site.mjs`. The latter creates the private `build/manifest.json`; production serves only its listed files and redirects from `dist/`. Do not restore a hand-maintained `PUBLIC_FILES` list or serve arbitrary repository paths. Use the existing build conventions for aliases, including the legacy `/notes/stock-picker-experiment.html` URL. Never edit the generated manifest directly.

Both Docker and Nixpacks install locked build dependencies, build the site, then start Node. Commit `package-lock.json` with intentional dependency changes. Astro is a build dependency, so omitting development dependencies during the build will break deployment.

The Docker runtime contains only `server.js`, `dist/`, `build/manifest.json`, and `data/bird-art.json`; it has no `node_modules`. Do not add a runtime package import or another private runtime file without deliberately updating the image contents and validating the runtime. New static pages need no per-page Docker copies.

GitHub pushes to the tracked branch trigger the existing Coolify webhook. An accepted webhook means deployment was queued, not that the new build is live. Do not replace this deployment path as part of a content or styling change.

## Validate and hand off

Scale validation to the change. For documentation-only edits, check the instructions, referenced paths, and diff; a full site test run is unnecessary. For website content, components, styles, or build changes, run:

```bash
npm run check
npm run build
npm test
npm start
```

Against the production preview, check the changed canonical URL, linked assets, no-slash redirects, `HEAD`, and unknown-path 404s. Confirm source files, `data/`, and `build/manifest.json` remain inaccessible. For UI changes, inspect mobile and desktop in both themes, navigation, keyboard operation, and browser errors. For live features, exercise success, unavailable/malformed upstream data, timeout, and streaming behavior as relevant.

Before committing, run `git diff --check`, review `git diff` and `git status --short`, and include only intended changes. Do not commit generated output, dependencies, credentials, or unrelated work. Push when the user has authorized publishing; follow any branch instruction already given in the conversation.

After publishing a website change, verify the intended commit/build, a visible production marker, changed routes and assets, and relevant live APIs at `https://abhishekdoesstuff.com`. If deployment cannot be confirmed, report the last verified stage instead of claiming it is live. Report the commit and checks performed.
