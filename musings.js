const fs = require("fs");
const path = require("path");

const SITE = "https://abhishekdoesstuff.com";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function frontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: source };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: source.slice(match[0].length) };
}

function cleanBody(body, title) {
  return body
    .replace(/^\s*#\s+[^\r\n]+\s*\r?\n/, "")
    .replace(/^_(?:AI-assisted|AI-generated)[^\r\n]*_\s*\r?\n?/im, "")
    .trim();
}

function descriptionFrom(body) {
  const summary = body.match(/^##\s+(?:Summary|TL;DR)\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im)?.[1] || body;
  return summary
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function displayExcerpt(value) {
  if (value.length < 180) return value;
  const boundary = value.lastIndexOf(" ");
  return value.slice(0, boundary > 0 ? boundary : value.length) + "…";
}

function shell({ title, description, canonicalPath, body, type = "Article", dateModified }) {
  const canonical = `${SITE}${canonicalPath}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    headline: title,
    name: title,
    description,
    url: canonical,
    inLanguage: "en-IN",
    author: { "@type": "Person", name: "Abhishek Bagade", url: `${SITE}/` },
    isPartOf: { "@type": "WebSite", name: "Abhishek Does Stuff", url: `${SITE}/` },
  };
  if (dateModified) schema.dateModified = dateModified;
  const medicalNote = /retina|retinal/i.test(title)
    ? " This page is general information, not medical diagnosis. Sudden flashes, new floaters, or a curtain over vision require urgent professional assessment."
    : "";
  const isIndex = type === "CollectionPage";
  const headings = [];
  const articleBody = isIndex ? body : body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, heading) => {
    const id = `musing-section-${headings.length + 1}`;
    headings.push(`<a href="#${id}">${heading}</a>`);
    return `<h2 id="${id}">${heading}</h2>`;
  });
  const renderedBody = articleBody
    .replace(/<pre>/g, '<pre tabindex="0">')
    .replace(/<table>/g, '<table tabindex="0">')
    .replace(/<p>(Status:[\s\S]*?)<\/p>/, '<p class="notebook-meta">$1</p>');
  const contents = headings.length ? `<details class="article-contents" data-contents open><summary>In this note <span aria-hidden="true">+</span></summary><nav aria-label="Article contents">${headings.join("")}</nav></details>` : "";
  const note = `<aside class="ai-note"><strong>Research note</strong><p>AI-assisted research note. Verify important claims with primary sources.${medicalNote}</p></aside>`;
  const reading = isIndex ? `${note}<div class="prose">${renderedBody}</div>` : `<div class="reading-layout${contents ? "" : " reading-single"}"><article class="reading-copy">${note}<div class="prose">${renderedBody}</div></article>${contents}</div>`;
  return `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8">
    <meta name="color-scheme" content="light dark" />
    <script src="/assets/theme.js?v=20261018-7"></script><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f5f3ea">
<title>${escapeHtml(title)} — Abhishek Does Stuff</title>
<meta name="description" content="${escapeHtml(description)}"><meta name="author" content="Abhishek Bagade"><meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.ico?v=20261018-6" sizes="any">
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;600;650;700;750&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />

<link rel="stylesheet" href="/styles.css?v=20261018-7">
<meta property="og:type" content="article"><meta property="og:site_name" content="Abhishek Does Stuff"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/og.png?v=20261018-6">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${SITE}/og.png?v=20261018-6">
<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script></head>
<body class="workbench subpage ${isIndex ? "musing-index" : "musing-article"}" id="page-top"><a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <a class="brand" href="/" aria-label="Abhishek Does Stuff home"
        ><img
          class="brand-wordmark"
          src="/logo-512.webp?v=20261018-6"
          alt=""
          width="176"
          height="73"
          decoding="async"
        /></a
      >
      <nav class="primary-links" aria-label="Primary navigation">
        <a href="/#builds">Builds <span>06</span></a>
        <a href="/#field-notes">Field notes</a>
        <a href="/musings/" aria-current="page">Musings</a>
        <a href="/birds/">Birds</a>
        <a href="/#lab">Lab</a>
      </nav>
      <div class="header-tools">
        <button
          class="theme-toggle"
          type="button"
          data-theme-toggle
          aria-label="Dark mode"
          aria-pressed="false"
          title="Switch to dark theme"
          hidden
        >
          <svg class="theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M20.6 13.2A8.8 8.8 0 0 1 10.8 3.4a8.8 8.8 0 1 0 9.8 9.8Z" />
          </svg>
          <svg class="theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <circle cx="12" cy="12" r="4" /><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
          </svg>
        </button>
      <details class="site-directory" data-nav-menu>
        <summary>
          Explore <span class="menu-cross" aria-hidden="true"></span>
        </summary>
        <nav class="directory-panel" aria-label="Site directory">
          <div class="directory-group">
            <p>The workbench</p>
            <a href="/"
              ><span>The workbench</span><small>Start here</small></a
            >
            <a href="/#builds"
              ><span>Selected builds</span><small>Six projects</small></a
            >
            <a href="/#field-notes"
              ><span>Field notes</span><small>Made &amp; repaired</small></a
            >
            <a href="/#writing"
              ><span>Research notes</span><small>Open questions</small></a
            >
            <a href="/#lab"
              ><span>The homelab</span><small>Live vitals</small></a
            >
          </div>
          <div class="directory-group">
            <p>Other corners</p>
            <a href="/musings/" aria-current="page"
              ><span>Musings</span><small>Research archive ↗</small></a
            >
            <a href="/birds/"
              ><span>Listening Orrery</span><small>Live birdsong ↗</small></a
            >
            <a href="https://abagade.com/"
              ><span>Long-form writing</span><small>abagade.com ↗</small></a
            >
            <a href="https://www.instagram.com/abhishek_does_stuff/"
              ><span>Instagram</span><small>Builds &amp; bike hacks ↗</small></a
            >
            <a href="mailto:admin@abhishekdoesstuff.com"
              ><span>Say hello</span><small>Send a note ↗</small></a
            >
          </div>
        </nav>
      </details>
      </div>
    </header>

<main id="main-content" class="article-shell musing-shell"><p class="page-breadcrumb"><a href="/">The workbench</a><span>/</span>${isIndex ? "<span>Musings</span>" : "<a href=\"/musings/\">All Musings</a>"}</p><header class="article-header"><p class="section-kicker">${isIndex ? "Research / Open questions" : "From the research notebook"}</p><h1>${escapeHtml(title)}</h1><p class="article-deck">${escapeHtml(displayExcerpt(description))}</p></header>${reading}</main>
    <footer class="workshop-footer">
      <div class="footer-main">
        <div>
          <p class="workshop-kicker">Something on your workbench?</p>
          <a class="footer-hello" href="mailto:admin@abhishekdoesstuff.com"
            >Let’s compare notes<span aria-hidden="true">↗</span></a
          >
        </div>
        <div class="footer-links">
          <a rel="me" href="https://github.com/bagdeabhishek">GitHub ↗</a
          ><a rel="me" href="https://www.instagram.com/abhishek_does_stuff/"
            >Instagram ↗</a
          ><a rel="me" href="https://www.linkedin.com/in/bagdeabhishek/"
            >LinkedIn ↗</a
          ><a href="https://abagade.com/">Writing ↗</a>
        </div>
      </div>
      <nav class="footer-directory" aria-label="Footer navigation">
        <a href="/#builds">Builds</a><a href="/#field-notes">Field notes</a
        ><a href="/musings/">Musings</a><a href="/birds/">Birds</a
        ><a href="/#lab">Lab</a
        ><a href="mailto:admin@abhishekdoesstuff.com">Email ↗</a>
      </nav>
      <div class="footer-colophon">
        <span>© Abhishek Bagade</span
        ><span>An ongoing collection. Served from home.</span
        ><a href="#page-top">Back to the top ↑</a>
      </div>
    </footer>

<script src="/status.js?v=20261017-4" defer></script><script src="/analytics.js" defer></script></body></html>`;
}

async function buildMusings(root) {
  const { marked } = await import("marked");
  marked.use({ gfm: true, breaks: false });
  const sourceRoot = path.join(root, "content", "musings");
  const pages = new Map();
  const articles = [];

  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourcePath = path.join(sourceRoot, entry.name, "index.md");
    if (!fs.existsSync(sourcePath)) continue;
    const { data, body } = frontMatter(fs.readFileSync(sourcePath, "utf8"));
    if (data.published === "false") continue;
    const route = data.permalink || `/musings/${entry.name}/`;
    if (data.redirect_to) {
      pages.set(route, { redirect: data.redirect_to });
      continue;
    }
    const title = data.title || entry.name;
    const cleaned = cleanBody(body, title);
    const description = descriptionFrom(cleaned) || `An AI-assisted research musing about ${title}.`;
    const dateModified = cleaned.match(/^(?:Last updated|Completed):\s*([^\r\n]+)/im)?.[1];
    const html = shell({ title, description, canonicalPath: route, body: marked.parse(cleaned), dateModified });
    pages.set(route, { html });
    articles.push({ title, description, route, dateModified });
  }

  articles.sort((a, b) => (b.dateModified || "").localeCompare(a.dateModified || ""));
  const cards = articles.map((article) => `<li><a href="${article.route}"><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(displayExcerpt(article.description))}</span></a></li>`).join("");
  const indexBody = `<div class="musing-index-meta"><span>${articles.length} notes / an ongoing collection</span><span>GenAI / CAD / Hardware / Media</span></div><p class="musing-index-intro">Notes on GenAI, CAD, hardware, media, and other practical questions.</p><ul class="musing-list">${cards}</ul>`;
  pages.set("/musings/", { html: shell({ title: "Musings", description: "AI-assisted research notes on GenAI, CAD, hardware, media, and other practical questions.", canonicalPath: "/musings/", body: indexBody, type: "CollectionPage" }) });
  return { pages, articles };
}

module.exports = { buildMusings };
